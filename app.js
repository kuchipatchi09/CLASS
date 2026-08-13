import { auth, db } from "./firebase-config.js";

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =========================================================
   기본 설정
========================================================= */

const SCHOOL_DOMAIN = "g.cnees.kr";
const ADMIN_EMAIL = "cnsh32_1218@g.cnees.kr";

const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  hd: SCHOOL_DOMAIN,
  prompt: "select_account"
});

const ROUND_RULES = {
  round1: {
    title: "1라운드",
    requiredCorrect: 3
  },

  round2: {
    title: "2라운드",
    requiredCorrect: 3
  },

  semifinal: {
    title: "준결승",
    requiredCorrect: 1
  },

  final: {
    title: "결승",
    requiredCorrect: 1
  }
};

let currentUser = null;
let currentUserData = null;
let currentRound = null;

let rounds = [];
let matches = [];
let rankingUsers = [];

let currentRoundPrediction = null;
let selectedPicks = {};

let unsubscribeUser = null;
let unsubscribePrediction = null;


/* =========================================================
   HTML 요소
========================================================= */

const elements = {
  loginBtn: document.getElementById("loginBtn"),

  headerUserName:
    document.getElementById("headerUserName"),

  headerUserEmail:
    document.getElementById("headerUserEmail"),

  appMessage:
    document.getElementById("appMessage"),

  loginNotice:
    document.getElementById("loginNotice"),

  eliminatedNotice:
    document.getElementById("eliminatedNotice"),

  currentRoundTitle:
    document.getElementById("currentRoundTitle"),

  currentRoundDescription:
    document.getElementById("currentRoundDescription"),

  roundStatusBadge:
    document.getElementById("roundStatusBadge"),

  roundDeadline:
    document.getElementById("roundDeadline"),

  roundRequirement:
    document.getElementById("roundRequirement"),

  myRoundState:
    document.getElementById("myRoundState"),

  matchGrid:
    document.getElementById("matchGrid"),

  selectionCount:
    document.getElementById("selectionCount"),

  submitHelp:
    document.getElementById("submitHelp"),

  submitRoundBtn:
    document.getElementById("submitRoundBtn"),

  bracketPreview:
    document.getElementById("bracketPreview"),

  fullBracket:
    document.getElementById("fullBracket"),

  topRanking:
    document.getElementById("topRanking"),

  fullRanking:
    document.getElementById("fullRanking"),

  myTotalHits:
    document.getElementById("myTotalHits"),

  myStatusMessage:
    document.getElementById("myStatusMessage"),

  predictionModal:
    document.getElementById("predictionModal"),

  closeModalBtn:
    document.getElementById("closeModalBtn"),

  cancelSubmitBtn:
    document.getElementById("cancelSubmitBtn"),

  confirmSubmitBtn:
    document.getElementById("confirmSubmitBtn"),

  modalPredictionList:
    document.getElementById("modalPredictionList")
};


/* =========================================================
   공통 함수
========================================================= */

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timestampToMilliseconds(value) {
  if (!value) {
    return 0;
  }

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.seconds === "number") {
    return value.seconds * 1000;
  }

  const milliseconds = new Date(value).getTime();

  return Number.isNaN(milliseconds)
    ? 0
    : milliseconds;
}

function formatDate(value) {
  const milliseconds =
    timestampToMilliseconds(value);

  if (!milliseconds) {
    return "마감 시간 미설정";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(milliseconds));
}

function isSchoolAccount(user) {
  const email =
    user?.email?.toLowerCase() || "";

  return email.endsWith(`@${SCHOOL_DOMAIN}`);
}

function isAdminAccount(user) {
  return (
    user?.email?.toLowerCase() ===
    ADMIN_EMAIL.toLowerCase()
  );
}

function showMessage(
  message,
  type = "normal",
  duration = 4000
) {
  if (!elements.appMessage) {
    return;
  }

  elements.appMessage.textContent = message;
  elements.appMessage.dataset.type = type;
  elements.appMessage.hidden = false;

  if (duration > 0) {
    window.clearTimeout(
      showMessage.timeoutId
    );

    showMessage.timeoutId =
      window.setTimeout(() => {
        elements.appMessage.hidden = true;
      }, duration);
  }
}

function showError(error, title = "오류") {
  console.error(error);

  const message =
    error?.message ||
    error?.code ||
    "알 수 없는 오류가 발생했습니다.";

  showMessage(
    `${title}: ${message}`,
    "error",
    7000
  );
}

function getRoundRule(roundKey) {
  return (
    ROUND_RULES[roundKey] || {
      title: roundKey || "라운드",
      requiredCorrect: 1
    }
  );
}

function getRoundTitle(round) {
  if (!round) {
    return "진행 중인 라운드가 없습니다";
  }

  return (
    round.title ||
    getRoundRule(round.id).title
  );
}

function getRoundRequiredCorrect(round) {
  if (!round) {
    return 0;
  }

  return Number(
    round.requiredCorrect ??
    getRoundRule(round.id).requiredCorrect
  );
}

function getRoundMatches(roundKey) {
  return matches
    .filter((match) => {
      return match.roundKey === roundKey;
    })
    .sort((a, b) => {
      return (
        Number(a.order || 0) -
        Number(b.order || 0)
      );
    });
}

function isRoundDeadlinePassed(round) {
  if (!round) {
    return true;
  }

  const deadline =
    timestampToMilliseconds(round.deadline);

  if (!deadline) {
    return false;
  }

  return Date.now() >= deadline;
}

function isRoundOpen(round) {
  if (!round) {
    return false;
  }

  return (
    round.status === "open" &&
    round.settled !== true &&
    !isRoundDeadlinePassed(round)
  );
}

function getPredictionDocumentId(
  roundKey,
  uid
) {
  return `${roundKey}_${uid}`;
}

function getCurrentRoundFromData() {
  if (rounds.length === 0) {
    return null;
  }

  /*
   로그인한 사용자는 사용자 문서의 currentRound를 우선 사용합니다.
  */
  if (currentUserData?.currentRound) {
    const userRound = rounds.find(
      (round) =>
        round.id === currentUserData.currentRound
    );

    if (userRound) {
      return userRound;
    }
  }

  /*
   로그인 전에는 현재 열려 있거나 아직 정산되지 않은
   가장 앞 라운드를 표시합니다.
  */
  const activeRound = [...rounds]
    .sort(
      (a, b) =>
        Number(a.order || 0) -
        Number(b.order || 0)
    )
    .find((round) => {
      return (
        round.status === "open" ||
        round.status === "locked" ||
        round.settled !== true
      );
    });

  return activeRound || rounds[rounds.length - 1];
}

function canCurrentUserPredict() {
  if (!currentUser) {
    return false;
  }

  if (!currentUserData) {
    return false;
  }

  if (currentUserData.alive === false) {
    return false;
  }

  if (!currentRound) {
    return false;
  }

  if (
    currentUserData.currentRound &&
    currentUserData.currentRound !==
      currentRound.id
  ) {
    return false;
  }

  return isRoundOpen(currentRound);
}


/* =========================================================
   페이지 메뉴
========================================================= */

function openPage(pageName) {
  document
    .querySelectorAll("[data-page]")
    .forEach((section) => {
      const active =
        section.dataset.page === pageName;

      section.hidden = !active;
      section.classList.toggle(
        "active",
        active
      );
    });

  document
    .querySelectorAll(".nav-button")
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.pageTarget ===
          pageName
      );
    });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function bindNavigation() {
  document
    .querySelectorAll("[data-page-target]")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const pageName =
            button.dataset.pageTarget;

          if (pageName) {
            openPage(pageName);
          }
        }
      );
    });
}


/* =========================================================
   로그인
========================================================= */

async function handleLogin() {
  try {
    if (auth.currentUser) {
      elements.loginBtn.disabled = true;

      await signOut(auth);

      return;
    }

    elements.loginBtn.disabled = true;
    elements.loginBtn.textContent =
      "로그인 중...";

    const result =
      await signInWithPopup(
        auth,
        provider
      );

    const user = result.user;

    if (!isSchoolAccount(user)) {
      await signOut(auth);

      alert(
        "g.cnees.kr 학교 계정으로만 참여할 수 있습니다."
      );

      return;
    }

    await createOrUpdateUser(user);

    showMessage(
      "학교 계정 로그인이 완료되었습니다.",
      "success"
    );
  } catch (error) {
    if (
      error.code ===
      "auth/popup-closed-by-user"
    ) {
      showMessage(
        "로그인 창이 닫혔습니다."
      );

      return;
    }

    if (
      error.code ===
      "auth/popup-blocked"
    ) {
      alert(
        "로그인 팝업이 차단되었습니다.\n브라우저에서 팝업을 허용해주세요."
      );
    }

    showError(error, "로그인 실패");
  } finally {
    elements.loginBtn.disabled = false;

    if (!auth.currentUser) {
      elements.loginBtn.textContent =
        "학교 계정 로그인";
    }
  }
}

async function createOrUpdateUser(user) {
  const userReference =
    doc(db, "users", user.uid);

  const userSnapshot =
    await getDoc(userReference);

  if (!userSnapshot.exists()) {
    await setDoc(userReference, {
      uid: user.uid,
      name:
        user.displayName ||
        user.email.split("@")[0],

      displayName:
        user.displayName ||
        user.email.split("@")[0],

      email: user.email,
      alive: true,
      totalHits: 0,
      correctCount: 0,
      currentRound: "round1",
      highestRoundOrder: 1,
      isAdmin: isAdminAccount(user),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return;
  }

  await setDoc(
    userReference,
    {
      name:
        user.displayName ||
        user.email.split("@")[0],

      displayName:
        user.displayName ||
        user.email.split("@")[0],

      email: user.email,
      isAdmin: isAdminAccount(user),
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    {
      merge: true
    }
  );
}

function updateAccountUI(user) {
  if (!user) {
    elements.headerUserName.textContent =
      "로그인 필요";

    elements.headerUserEmail.textContent =
      SCHOOL_DOMAIN;

    elements.loginBtn.textContent =
      "학교 계정 로그인";

    elements.loginNotice.hidden = false;

    return;
  }

  elements.headerUserName.textContent =
    user.displayName ||
    user.email.split("@")[0];

  elements.headerUserEmail.textContent =
    user.email;

  elements.loginBtn.textContent =
    "로그아웃";

  elements.loginNotice.hidden = true;
}


/* =========================================================
   사용자 문서 실시간 연결
========================================================= */

function stopUserListener() {
  if (unsubscribeUser) {
    unsubscribeUser();
    unsubscribeUser = null;
  }

  currentUserData = null;
}

function startUserListener(user) {
  stopUserListener();

  const userReference =
    doc(db, "users", user.uid);

  unsubscribeUser = onSnapshot(
    userReference,

    (snapshot) => {
      currentUserData =
        snapshot.exists()
          ? {
              id: snapshot.id,
              ...snapshot.data()
            }
          : null;

      refreshCurrentRound();
      renderMyStatus();
      renderPredictionSection();
    },

    (error) => {
      showError(
        error,
        "사용자 정보 불러오기 실패"
      );
    }
  );
}


/* =========================================================
   라운드별 내 예측 실시간 연결
========================================================= */

function stopPredictionListener() {
  if (unsubscribePrediction) {
    unsubscribePrediction();
    unsubscribePrediction = null;
  }

  currentRoundPrediction = null;
  selectedPicks = {};
}

function startPredictionListener() {
  stopPredictionListener();

  if (
    !currentUser ||
    !currentRound
  ) {
    renderPredictionSection();
    return;
  }

  const predictionId =
    getPredictionDocumentId(
      currentRound.id,
      currentUser.uid
    );

  const predictionReference =
    doc(
      db,
      "roundPredictions",
      predictionId
    );

  unsubscribePrediction = onSnapshot(
    predictionReference,

    (snapshot) => {
      currentRoundPrediction =
        snapshot.exists()
          ? {
              id: snapshot.id,
              ...snapshot.data()
            }
          : null;

      selectedPicks = {
        ...(
          currentRoundPrediction?.picks ||
          {}
        )
      };

      renderPredictionSection();
    },

    (error) => {
      showError(
        error,
        "내 예측 정보 불러오기 실패"
      );
    }
  );
}


/* =========================================================
   현재 라운드
========================================================= */

function refreshCurrentRound() {
  const nextRound =
    getCurrentRoundFromData();

  const changed =
    currentRound?.id !== nextRound?.id;

  currentRound = nextRound;

  if (changed) {
    startPredictionListener();
  }

  renderPredictionSection();
}


/* =========================================================
   예측 화면 출력
========================================================= */

function renderPredictionSection() {
  const round = currentRound;
  const roundMatches = round
    ? getRoundMatches(round.id)
    : [];

  if (!round) {
    elements.currentRoundTitle.textContent =
      "진행 중인 라운드가 없습니다";

    elements.currentRoundDescription.textContent =
      "관리자가 경기 일정을 등록하면 표시됩니다.";

    elements.roundStatusBadge.textContent =
      "대기";

    elements.roundDeadline.textContent =
      "미정";

    elements.roundRequirement.textContent =
      "미정";

    elements.myRoundState.textContent =
      "대기";

    elements.matchGrid.innerHTML = `
      <div class="loading-card">
        등록된 라운드가 없습니다.
      </div>
    `;

    elements.submitRoundBtn.disabled = true;
    elements.selectionCount.textContent =
      "0 / 0";

    return;
  }

  const roundTitle =
    getRoundTitle(round);

  const requiredCorrect =
    getRoundRequiredCorrect(round);

  elements.currentRoundTitle.textContent =
    `${roundTitle} 승부 예측`;

  elements.currentRoundDescription.textContent =
    `${roundMatches.length}경기의 승리 팀을 모두 선택한 뒤 한 번에 제출하세요.`;

  elements.roundDeadline.textContent =
    formatDate(round.deadline);

  elements.roundRequirement.textContent =
    `${roundMatches.length}경기 중 ${requiredCorrect}경기 이상 적중`;

  renderRoundStatus(round);
  renderUserRoundState();
  renderMatchGrid(roundMatches);
  updateSelectionUI(roundMatches);
}

function renderRoundStatus(round) {
  const badge =
    elements.roundStatusBadge;

  badge.className =
    "round-status-badge";

  if (round.settled === true) {
    badge.textContent =
      "정산 완료";

    badge.classList.add("finished");
    return;
  }

  if (
    round.status === "locked" ||
    isRoundDeadlinePassed(round)
  ) {
    badge.textContent =
      "예측 마감";

    badge.classList.add("closed");
    return;
  }

  if (round.status === "open") {
    badge.textContent =
      "예측 진행 중";

    badge.classList.add("open");
    return;
  }

  badge.textContent =
    "준비 중";

  badge.classList.add("waiting");
}

function renderUserRoundState() {
  if (!currentUser) {
    elements.myRoundState.textContent =
      "로그인 필요";

    elements.eliminatedNotice.hidden =
      true;

    return;
  }

  if (!currentUserData) {
    elements.myRoundState.textContent =
      "정보 확인 중";

    return;
  }

  if (currentUserData.alive === false) {
    elements.myRoundState.textContent =
      "도전 종료";

    elements.eliminatedNotice.hidden =
      false;

    return;
  }

  elements.eliminatedNotice.hidden = true;

  if (
    currentRoundPrediction?.submittedAt
  ) {
    elements.myRoundState.textContent =
      "예측 제출 완료";
  } else {
    elements.myRoundState.textContent =
      "예측 가능";
  }
}

function renderMatchGrid(roundMatches) {
  if (roundMatches.length === 0) {
    elements.matchGrid.innerHTML = `
      <div class="loading-card">
        해당 라운드의 경기가 아직 등록되지 않았습니다.
      </div>
    `;

    return;
  }

  elements.matchGrid.innerHTML =
    roundMatches
      .map(
        (match, index) =>
          createPredictionCard(
            match,
            index
          )
      )
      .join("");

  bindTeamButtons();
}

function createPredictionCard(
  match,
  index
) {
  if (match.byeTeam) {
    return `
      <article class="prediction-match-card bye-card">
        <div class="match-card-top">
          <span>
            GAME ${String(index + 1).padStart(2, "0")}
          </span>

          <span class="match-state">
            부전승
          </span>
        </div>

        <div class="bye-team">
          <span>BYE</span>

          <strong>
            ${escapeHtml(match.byeTeam)}
          </strong>

          <p>
            이 경기는 예측 대상이 아닙니다.
          </p>
        </div>
      </article>
    `;
  }

  const teamASelected =
    selectedPicks[match.id] ===
    match.teamA;

  const teamBSelected =
    selectedPicks[match.id] ===
    match.teamB;

  const disabled =
    !canCurrentUserPredict();

  return `
    <article
      class="prediction-match-card"
      data-match-card="${escapeHtml(match.id)}"
    >
      <div class="match-card-top">
        <span>
          GAME ${String(index + 1).padStart(2, "0")}
        </span>

        <span class="match-state">
          ${
            selectedPicks[match.id]
              ? "선택 완료"
              : "선택 필요"
          }
        </span>
      </div>

      <div class="match-date">
        ${
          escapeHtml(
            match.dateLabel ||
            formatDate(match.deadline)
          )
        }
      </div>

      <div class="match-versus">
        <button
          type="button"
          class="team-choice-button
            ${teamASelected ? "selected" : ""}"
          data-match-id="${escapeHtml(match.id)}"
          data-team="${escapeHtml(match.teamA || "")}"
          ${disabled ? "disabled" : ""}
        >
          <span class="team-choice-label">
            TEAM A
          </span>

          <strong>
            ${escapeHtml(match.teamA || "미정")}
          </strong>

          <span class="choice-check">
            ${
              teamASelected
                ? "선택됨"
                : "승리 예측"
            }
          </span>
        </button>

        <div class="versus-mark">
          VS
        </div>

        <button
          type="button"
          class="team-choice-button
            ${teamBSelected ? "selected" : ""}"
          data-match-id="${escapeHtml(match.id)}"
          data-team="${escapeHtml(match.teamB || "")}"
          ${disabled ? "disabled" : ""}
        >
          <span class="team-choice-label">
            TEAM B
          </span>

          <strong>
            ${escapeHtml(match.teamB || "미정")}
          </strong>

          <span class="choice-check">
            ${
              teamBSelected
                ? "선택됨"
                : "승리 예측"
            }
          </span>
        </button>
      </div>

      <div class="public-vote-notice">
        예측 비율은 마감 후 공개됩니다.
      </div>
    </article>
  `;
}

function bindTeamButtons() {
  document
    .querySelectorAll(
      ".team-choice-button"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          if (!canCurrentUserPredict()) {
            return;
          }

          const matchId =
            button.dataset.matchId;

          const team =
            button.dataset.team;

          if (!matchId || !team) {
            return;
          }

          selectedPicks[matchId] = team;

          const roundMatches =
            getRoundMatches(
              currentRound.id
            );

          renderMatchGrid(roundMatches);
          updateSelectionUI(roundMatches);
        }
      );
    });
}

function updateSelectionUI(roundMatches) {
  const predictableMatches =
    roundMatches.filter(
      (match) => !match.byeTeam
    );

  const selectedCount =
    predictableMatches.filter(
      (match) =>
        Boolean(selectedPicks[match.id])
    ).length;

  const total =
    predictableMatches.length;

  elements.selectionCount.textContent =
    `${selectedCount} / ${total}`;

  const allSelected =
    total > 0 &&
    selectedCount === total;

  const canSubmit =
    allSelected &&
    canCurrentUserPredict();

  elements.submitRoundBtn.disabled =
    !canSubmit;

  if (!currentUser) {
    elements.submitHelp.textContent =
      "학교 계정으로 로그인한 뒤 참여할 수 있습니다.";

    return;
  }

  if (currentUserData?.alive === false) {
    elements.submitHelp.textContent =
      "도전이 종료되어 더 이상 예측할 수 없습니다.";

    return;
  }

  if (
    !isRoundOpen(currentRound)
  ) {
    elements.submitHelp.textContent =
      "이 라운드의 예측이 마감되었습니다.";

    return;
  }

  if (allSelected) {
    elements.submitHelp.textContent =
      currentRoundPrediction
        ? "선택을 확인한 뒤 수정 내용을 제출하세요."
        : "모든 경기 선택이 완료되었습니다.";

    elements.submitRoundBtn.textContent =
      currentRoundPrediction
        ? "예측 수정하기"
        : "예측 한 번에 제출하기";

    return;
  }

  elements.submitHelp.textContent =
    `남은 ${total - selectedCount}경기의 승리 팀을 선택해주세요.`;

  elements.submitRoundBtn.textContent =
    currentRoundPrediction
      ? "예측 수정하기"
      : "예측 한 번에 제출하기";
}


/* =========================================================
   예측 제출 확인창
========================================================= */

function openPredictionModal() {
  if (!canCurrentUserPredict()) {
    showMessage(
      "현재 예측을 제출할 수 없습니다.",
      "error"
    );

    return;
  }

  const roundMatches =
    getRoundMatches(currentRound.id)
      .filter(
        (match) => !match.byeTeam
      );

  const allSelected =
    roundMatches.every(
      (match) =>
        Boolean(selectedPicks[match.id])
    );

  if (!allSelected) {
    showMessage(
      "모든 경기의 승리 팀을 선택해주세요.",
      "error"
    );

    return;
  }

  elements.modalPredictionList.innerHTML =
    roundMatches
      .map((match, index) => {
        return `
          <div class="modal-prediction-item">
            <span>
              경기 ${index + 1}
            </span>

            <div>
              <small>
                ${escapeHtml(match.teamA)}
                VS
                ${escapeHtml(match.teamB)}
              </small>

              <strong>
                ${escapeHtml(selectedPicks[match.id])}
                승리
              </strong>
            </div>
          </div>
        `;
      })
      .join("");

  elements.predictionModal.hidden = false;
  document.body.classList.add(
    "modal-open"
  );
}

function closePredictionModal() {
  elements.predictionModal.hidden = true;
  document.body.classList.remove(
    "modal-open"
  );
}

async function submitRoundPrediction() {
  if (
    !currentUser ||
    !currentRound ||
    !canCurrentUserPredict()
  ) {
    showMessage(
      "예측을 제출할 수 없습니다.",
      "error"
    );

    closePredictionModal();
    return;
  }

  const roundMatches =
    getRoundMatches(currentRound.id)
      .filter(
        (match) => !match.byeTeam
      );

  const allSelected =
    roundMatches.every(
      (match) =>
        Boolean(selectedPicks[match.id])
    );

  if (!allSelected) {
    showMessage(
      "모든 경기의 승리 팀을 선택해주세요.",
      "error"
    );

    closePredictionModal();
    return;
  }

  const predictionId =
    getPredictionDocumentId(
      currentRound.id,
      currentUser.uid
    );

  const predictionReference =
    doc(
      db,
      "roundPredictions",
      predictionId
    );

  elements.confirmSubmitBtn.disabled = true;
  elements.confirmSubmitBtn.textContent =
    "제출 중...";

  try {
    const baseData = {
      uid: currentUser.uid,
      email: currentUser.email,

      displayName:
        currentUser.displayName ||
        currentUser.email.split("@")[0],

      roundKey: currentRound.id,
      roundOrder:
        Number(currentRound.order || 0),

      picks: {
        ...selectedPicks
      },

      matchCount:
        roundMatches.length,

      correctCount: null,
      passed: null,
      resultProcessed: false,
      updatedAt: serverTimestamp()
    };

    if (!currentRoundPrediction) {
      baseData.submittedAt =
        serverTimestamp();
    }

    await setDoc(
      predictionReference,
      baseData,
      {
        merge: true
      }
    );

    closePredictionModal();

    showMessage(
      currentRoundPrediction
        ? "예측을 수정했습니다."
        : "예측 제출이 완료되었습니다.",
      "success"
    );
  } catch (error) {
    showError(
      error,
      "예측 제출 실패"
    );
  } finally {
    elements.confirmSubmitBtn.disabled =
      false;

    elements.confirmSubmitBtn.textContent =
      "예측 제출";
  }
}


/* =========================================================
   대진표 출력
========================================================= */

function renderBracket() {
  if (matches.length === 0) {
    elements.bracketPreview.innerHTML = `
      <p class="empty-text">
        등록된 대진 정보가 없습니다.
      </p>
    `;

    elements.fullBracket.innerHTML = `
      <p class="empty-text">
        등록된 대진 정보가 없습니다.
      </p>
    `;

    return;
  }

  const sortedRounds = [...rounds].sort(
    (a, b) =>
      Number(a.order || 0) -
      Number(b.order || 0)
  );

  elements.bracketPreview.innerHTML =
    createBracketPreview(sortedRounds);

  elements.fullBracket.innerHTML =
    sortedRounds
      .map((round) => {
        return createBracketRound(round);
      })
      .join("");
}

function createBracketPreview(sortedRounds) {
  const previewRounds =
    sortedRounds.slice(0, 4);

  return `
    <div class="mini-bracket">
      ${
        previewRounds
          .map((round) => {
            const roundMatches =
              getRoundMatches(round.id);

            return `
              <div class="mini-bracket-column">
                <strong>
                  ${escapeHtml(getRoundTitle(round))}
                </strong>

                ${
                  roundMatches
                    .map((match) => {
                      const winner =
                        match.winner ||
                        match.byeTeam;

                      return `
                        <div class="mini-match">
                          <span
                            class="${
                              winner === match.teamA
                                ? "winner"
                                : ""
                            }"
                          >
                            ${escapeHtml(match.teamA || match.byeTeam || "미정")}
                          </span>

                          ${
                            !match.byeTeam
                              ? `
                                <span
                                  class="${
                                    winner === match.teamB
                                      ? "winner"
                                      : ""
                                  }"
                                >
                                  ${escapeHtml(match.teamB || "미정")}
                                </span>
                              `
                              : ""
                          }
                        </div>
                      `;
                    })
                    .join("")
                }
              </div>
            `;
          })
          .join("")
      }
    </div>
  `;
}

function createBracketRound(round) {
  const roundMatches =
    getRoundMatches(round.id);

  return `
    <section class="bracket-round">
      <div class="bracket-round-heading">
        <div>
          <span>
            ROUND ${Number(round.order || 0)}
          </span>

          <h2>
            ${escapeHtml(getRoundTitle(round))}
          </h2>
        </div>

        <strong>
          ${roundMatches.length}경기
        </strong>
      </div>

      <div class="bracket-match-list">
        ${
          roundMatches
            .map((match) => {
              return createBracketMatch(match);
            })
            .join("")
        }
      </div>
    </section>
  `;
}

function createBracketMatch(match) {
  if (match.byeTeam) {
    return `
      <article class="bracket-match bye">
        <div class="bracket-match-info">
          <span>
            ${escapeHtml(match.dateLabel || "부전승")}
          </span>

          <strong>
            BYE
          </strong>
        </div>

        <div class="bracket-team winner">
          <span>
            ${escapeHtml(match.byeTeam)}
          </span>

          <strong>
            부전승
          </strong>
        </div>
      </article>
    `;
  }

  return `
    <article class="bracket-match">
      <div class="bracket-match-info">
        <span>
          ${escapeHtml(
            match.dateLabel ||
            formatDate(match.deadline)
          )}
        </span>

        <strong>
          ${
            match.winner
              ? "경기 종료"
              : "예정"
          }
        </strong>
      </div>

      <div
        class="bracket-team
          ${
            match.winner === match.teamA
              ? "winner"
              : ""
          }"
      >
        <span>
          ${escapeHtml(match.teamA || "미정")}
        </span>

        <strong>
          ${
            match.winner === match.teamA
              ? "WIN"
              : ""
          }
        </strong>
      </div>

      <div
        class="bracket-team
          ${
            match.winner === match.teamB
              ? "winner"
              : ""
          }"
      >
        <span>
          ${escapeHtml(match.teamB || "미정")}
        </span>

        <strong>
          ${
            match.winner === match.teamB
              ? "WIN"
              : ""
          }
        </strong>
      </div>
    </article>
  `;
}


/* =========================================================
   랭킹
========================================================= */

function getSortedRankingUsers() {
  return [...rankingUsers]
    .filter((user) => {
      return user.isAdmin !== true;
    })
    .sort((a, b) => {
      const hitDifference =
        Number(b.totalHits || b.correctCount || 0) -
        Number(a.totalHits || a.correctCount || 0);

      if (hitDifference !== 0) {
        return hitDifference;
      }

      const roundDifference =
        Number(b.highestRoundOrder || 0) -
        Number(a.highestRoundOrder || 0);

      if (roundDifference !== 0) {
        return roundDifference;
      }

      return String(
        a.displayName || a.name || ""
      ).localeCompare(
        String(
          b.displayName || b.name || ""
        ),
        "ko"
      );
    });
}

function renderRanking() {
  const ranking =
    getSortedRankingUsers();

  if (ranking.length === 0) {
    elements.topRanking.innerHTML = `
      <p class="empty-text">
        아직 집계 전입니다.
      </p>
    `;

    elements.fullRanking.innerHTML = `
      <p class="empty-text">
        아직 집계 전입니다.
      </p>
    `;

    return;
  }

  elements.topRanking.innerHTML =
    ranking
      .slice(0, 5)
      .map((user, index) => {
        return createTopRankingItem(
          user,
          index
        );
      })
      .join("");

  elements.fullRanking.innerHTML =
    ranking
      .map((user, index) => {
        return createFullRankingItem(
          user,
          index
        );
      })
      .join("");
}

function createTopRankingItem(user, index) {
  const hits =
    Number(
      user.totalHits ||
      user.correctCount ||
      0
    );

  return `
    <div class="top-ranking-item">
      <span class="ranking-position">
        ${String(index + 1).padStart(2, "0")}
      </span>

      <div class="ranking-person">
        <strong>
          ${escapeHtml(
            user.displayName ||
            user.name ||
            "참가자"
          )}
        </strong>

        <span>
          ${
            user.alive === false
              ? "도전 종료"
              : "생존 중"
          }
        </span>
      </div>

      <strong class="ranking-hits">
        ${hits}
        <small>HITS</small>
      </strong>
    </div>
  `;
}

function createFullRankingItem(user, index) {
  const hits =
    Number(
      user.totalHits ||
      user.correctCount ||
      0
    );

  return `
    <div class="ranking-table-row">
      <strong class="ranking-position">
        ${index + 1}
      </strong>

      <div class="ranking-person">
        <strong>
          ${escapeHtml(
            user.displayName ||
            user.name ||
            "참가자"
          )}
        </strong>

        <span>
          ${
            user.currentRound
              ? escapeHtml(
                  getRoundRule(
                    user.currentRound
                  ).title
                )
              : "참가자"
          }
        </span>
      </div>

      <strong class="ranking-hits">
        ${hits}경기
      </strong>

      <span
        class="ranking-alive-state
          ${
            user.alive === false
              ? "eliminated"
              : "alive"
          }"
      >
        ${
          user.alive === false
            ? "도전 종료"
            : "생존"
        }
      </span>
    </div>
  `;
}


/* =========================================================
   나의 현황
========================================================= */

function renderMyStatus() {
  if (
    !currentUser ||
    !currentUserData
  ) {
    elements.myTotalHits.textContent =
      "0";

    elements.myStatusMessage.textContent =
      "로그인 후 확인할 수 있습니다.";

    return;
  }

  const hits =
    Number(
      currentUserData.totalHits ||
      currentUserData.correctCount ||
      0
    );

  elements.myTotalHits.textContent =
    String(hits);

  if (
    currentUserData.alive === false
  ) {
    elements.myStatusMessage.textContent =
      "이번 챌린저컵 도전이 종료되었습니다.";

    return;
  }

  if (currentUserData.finalWinner) {
    elements.myStatusMessage.textContent =
      "최종 라운드까지 통과했습니다.";

    return;
  }

  const roundTitle =
    getRoundRule(
      currentUserData.currentRound
    ).title;

  elements.myStatusMessage.textContent =
    `${roundTitle}에 도전 중입니다.`;
}


/* =========================================================
   Firestore 전체 데이터 연결
========================================================= */

function startPublicListeners() {
  onSnapshot(
    collection(db, "rounds"),

    (snapshot) => {
      rounds = snapshot.docs
        .map((roundDocument) => ({
          id: roundDocument.id,
          ...roundDocument.data()
        }))
        .sort(
          (a, b) =>
            Number(a.order || 0) -
            Number(b.order || 0)
        );

      refreshCurrentRound();
      renderBracket();
    },

    (error) => {
      showError(
        error,
        "라운드 정보 불러오기 실패"
      );
    }
  );

  onSnapshot(
    collection(db, "matches"),

    (snapshot) => {
      matches = snapshot.docs.map(
        (matchDocument) => ({
          id: matchDocument.id,
          ...matchDocument.data()
        })
      );

      renderPredictionSection();
      renderBracket();
    },

    (error) => {
      showError(
        error,
        "경기 정보 불러오기 실패"
      );
    }
  );

  onSnapshot(
    collection(db, "users"),

    (snapshot) => {
      rankingUsers =
        snapshot.docs.map(
          (userDocument) => ({
            id: userDocument.id,
            ...userDocument.data()
          })
        );

      renderRanking();
    },

    (error) => {
      showError(
        error,
        "랭킹 불러오기 실패"
      );
    }
  );
}


/* =========================================================
   인증 상태 감시
========================================================= */

onAuthStateChanged(
  auth,
  async (user) => {
    stopUserListener();
    stopPredictionListener();

    if (!user) {
      currentUser = null;
      currentUserData = null;
      currentRoundPrediction = null;
      selectedPicks = {};

      updateAccountUI(null);
      refreshCurrentRound();
      renderMyStatus();
      renderPredictionSection();

      return;
    }

    if (!isSchoolAccount(user)) {
      await signOut(auth);

      alert(
        "g.cnees.kr 학교 계정으로만 참여할 수 있습니다."
      );

      return;
    }

    currentUser = user;

    updateAccountUI(user);

    try {
      await createOrUpdateUser(user);
      startUserListener(user);
    } catch (error) {
      showError(
        error,
        "사용자 등록 실패"
      );
    }
  }
);


/* =========================================================
   버튼 연결
========================================================= */

function bindEvents() {
  elements.loginBtn.addEventListener(
    "click",
    handleLogin
  );

  elements.submitRoundBtn.addEventListener(
    "click",
    openPredictionModal
  );

  elements.closeModalBtn.addEventListener(
    "click",
    closePredictionModal
  );

  elements.cancelSubmitBtn.addEventListener(
    "click",
    closePredictionModal
  );

  elements.confirmSubmitBtn.addEventListener(
    "click",
    submitRoundPrediction
  );

  elements.predictionModal.addEventListener(
    "click",
    (event) => {
      if (
        event.target ===
        elements.predictionModal
      ) {
        closePredictionModal();
      }
    }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        !elements.predictionModal.hidden
      ) {
        closePredictionModal();
      }
    }
  );
}


/* =========================================================
   시작
========================================================= */

function initializeAppPage() {
  bindNavigation();
  bindEvents();
  startPublicListeners();

  updateAccountUI(auth.currentUser);
  renderMyStatus();
  renderPredictionSection();

  console.log(
    "챌린저컵 라운드 예측 시스템 시작"
  );
}

initializeAppPage();
