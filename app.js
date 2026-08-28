import {
  auth,
  db,
  googleProvider
} from "./firebase-config.js";

const provider = googleProvider;

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


const SCHOOL_DOMAIN = "g.cnees.kr";
const ADMIN_EMAIL = "cnsh32_1218@g.cnees.kr";
const HIDDEN_EMAIL = "whisk1209@g.cnees.kr";

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
let currentRoundPrediction = null;

let rounds = [];
let matches = [];
let rankingUsers = [];
let selectedPicks = {};

let unsubscribeUser = null;
let unsubscribePrediction = null;

/*
 * 결승 세트 점수 임시 저장
 */
let finalScoreDraft = {
  1: { teamAScore: null, teamBScore: null },
  2: { teamAScore: null, teamBScore: null },
  3: { teamAScore: null, teamBScore: null }
};


const elements = {
  loginBtn: document.getElementById("loginBtn"),
  headerUserName: document.getElementById("headerUserName"),
  headerUserEmail: document.getElementById("headerUserEmail"),

  appMessage: document.getElementById("appMessage"),
  loginNotice: document.getElementById("loginNotice"),
  eliminatedNotice: document.getElementById("eliminatedNotice"),

  currentRoundTitle: document.getElementById("currentRoundTitle"),
  currentRoundDescription: document.getElementById(
    "currentRoundDescription"
  ),
  roundStatusBadge: document.getElementById("roundStatusBadge"),
  roundDeadline: document.getElementById("roundDeadline"),
  roundRequirement: document.getElementById("roundRequirement"),
  myRoundState: document.getElementById("myRoundState"),

  matchGrid: document.getElementById("matchGrid"),
  selectionCount: document.getElementById("selectionCount"),
  submitHelp: document.getElementById("submitHelp"),
  submitRoundBtn: document.getElementById("submitRoundBtn"),

  bracketPreview: document.getElementById("bracketPreview"),
  fullBracket: document.getElementById("fullBracket"),
  topRanking: document.getElementById("topRanking"),
  fullRanking: document.getElementById("fullRanking"),

  myTotalHits: document.getElementById("myTotalHits"),
  myStatusMessage: document.getElementById("myStatusMessage"),

  predictionModal: document.getElementById("predictionModal"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  cancelSubmitBtn: document.getElementById("cancelSubmitBtn"),
  confirmSubmitBtn: document.getElementById("confirmSubmitBtn"),
  modalPredictionList: document.getElementById("modalPredictionList"),
  modalFinalPrediction: document.getElementById(
    "modalFinalPrediction"
  ),

  finalPredictionPanel: document.getElementById(
    "finalPredictionPanel"
  ),
  finalSet3Card: document.getElementById("finalSet3Card"),
  predictedFinalWinner: document.getElementById(
    "predictedFinalWinner"
  ),

  finalSet1TeamA: document.getElementById("finalSet1TeamA"),
  finalSet1TeamB: document.getElementById("finalSet1TeamB"),
  finalSet2TeamA: document.getElementById("finalSet2TeamA"),
  finalSet2TeamB: document.getElementById("finalSet2TeamB"),
  finalSet3TeamA: document.getElementById("finalSet3TeamA"),
  finalSet3TeamB: document.getElementById("finalSet3TeamB"),

  finalSet1ScoreA: document.getElementById("finalSet1ScoreA"),
  finalSet1ScoreB: document.getElementById("finalSet1ScoreB"),
  finalSet2ScoreA: document.getElementById("finalSet2ScoreA"),
  finalSet2ScoreB: document.getElementById("finalSet2ScoreB"),
  finalSet3ScoreA: document.getElementById("finalSet3ScoreA"),
  finalSet3ScoreB: document.getElementById("finalSet3ScoreB"),

  finalSet1Winner: document.getElementById("finalSet1Winner"),
  finalSet2Winner: document.getElementById("finalSet2Winner"),
  finalSet3Winner: document.getElementById("finalSet3Winner")
};


function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timestampToMilliseconds(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;

  const valueAsDate = new Date(value).getTime();
  return Number.isNaN(valueAsDate) ? 0 : valueAsDate;
}

function formatDate(value) {
  const milliseconds = timestampToMilliseconds(value);

  if (!milliseconds) return "마감 시간 미설정";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(milliseconds));
}

function isSchoolAccount(user) {
  return (
    user?.email?.toLowerCase().endsWith(`@${SCHOOL_DOMAIN}`) === true
  );
}

function isAdminAccount(user) {
  return (
    user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
}

function showMessage(message, type = "normal", duration = 4000) {
  if (!elements.appMessage) return;

  elements.appMessage.textContent = message;
  elements.appMessage.dataset.type = type;
  elements.appMessage.hidden = false;

  clearTimeout(showMessage.timeoutId);

  if (duration > 0) {
    showMessage.timeoutId = setTimeout(() => {
      elements.appMessage.hidden = true;
    }, duration);
  }
}

function showError(error, title = "오류") {
  console.error(error);

  showMessage(
    `${title}: ${error?.message || error?.code || "알 수 없는 오류"}`,
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
  return round?.title || getRoundRule(round?.id).title;
}

function getRoundRequiredCorrect(round) {
  return Number(
    round?.requiredCorrect ??
    getRoundRule(round?.id).requiredCorrect
  );
}

function getRoundMatches(roundKey) {
  return matches
    .filter((match) => match.roundKey === roundKey)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function isRoundDeadlinePassed(round) {
  const deadline = timestampToMilliseconds(round?.deadline);
  return deadline ? Date.now() >= deadline : false;
}

function isRoundOpen(round) {
  return Boolean(
    round &&
    round.status === "open" &&
    round.settled !== true &&
    !isRoundDeadlinePassed(round)
  );
}

function getPredictionDocumentId(roundKey, uid) {
  return `${roundKey}_${uid}`;
}

function getCurrentRoundFromData() {
  if (!rounds.length) return null;

  if (currentUserData?.currentRound) {
    const userRound = rounds.find(
      (round) => round.id === currentUserData.currentRound
    );

    if (userRound) return userRound;
  }

  return (
    [...rounds]
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      .find(
        (round) =>
          round.status === "open" ||
          round.status === "locked" ||
          round.settled !== true
      ) ||
    rounds[rounds.length - 1]
  );
}

function canCurrentUserPredict() {
  if (!currentUser || !currentUserData || !currentRound) return false;
  if (currentUserData.alive === false) return false;

  if (
    currentUserData.currentRound &&
    currentUserData.currentRound !== currentRound.id
  ) {
    return false;
  }

  return isRoundOpen(currentRound);
}


/* 페이지 메뉴 */

function openPage(pageName) {
  document.querySelectorAll("[data-page]").forEach((section) => {
    const active = section.dataset.page === pageName;
    section.hidden = !active;
    section.classList.toggle("active", active);
  });

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.pageTarget === pageName
    );
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindNavigation() {
  document.querySelectorAll("[data-page-target]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.pageTarget) {
        openPage(button.dataset.pageTarget);
      }
    });
  });
}


/* 로그인 */

async function handleLogin() {
  try {
    if (auth.currentUser) {
      elements.loginBtn.disabled = true;
      await signOut(auth);
      return;
    }

    elements.loginBtn.disabled = true;
    elements.loginBtn.textContent = "로그인 중...";

    const result = await signInWithPopup(auth, provider);

    if (!isSchoolAccount(result.user)) {
      await signOut(auth);
      alert("g.cnees.kr 학교 계정으로만 참여할 수 있습니다.");
      return;
    }

    await createOrUpdateUser(result.user);
    showMessage("학교 계정 로그인이 완료되었습니다.", "success");
  } catch (error) {
    if (error.code === "auth/popup-closed-by-user") {
      showMessage("로그인 창이 닫혔습니다.");
      return;
    }

    if (error.code === "auth/popup-blocked") {
      alert("브라우저에서 로그인 팝업을 허용해주세요.");
    }

    showError(error, "로그인 실패");
  } finally {
    elements.loginBtn.disabled = false;

    if (!auth.currentUser) {
      elements.loginBtn.textContent = "학교 계정 로그인";
    }
  }
}

async function createOrUpdateUser(user) {
  const reference = doc(db, "users", user.uid);
  const snapshot = await getDoc(reference);
  const name = user.displayName || user.email.split("@")[0];

  if (!snapshot.exists()) {
    await setDoc(reference, {
      uid: user.uid,
      name,
      displayName: name,
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
    reference,
    {
      name,
      displayName: name,
      email: user.email,
      isAdmin: isAdminAccount(user),
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

function updateAccountUI(user) {
  if (!user) {
    elements.headerUserName.textContent = "로그인 필요";
    elements.headerUserEmail.textContent = SCHOOL_DOMAIN;
    elements.loginBtn.textContent = "학교 계정 로그인";
    elements.loginNotice.hidden = false;
    return;
  }

  elements.headerUserName.textContent =
    user.displayName || user.email.split("@")[0];

  elements.headerUserEmail.textContent = user.email;
  elements.loginBtn.textContent = "로그아웃";
  elements.loginNotice.hidden = true;
}


/* 사용자 데이터 */

function stopUserListener() {
  if (unsubscribeUser) unsubscribeUser();
  unsubscribeUser = null;
  currentUserData = null;
}

function startUserListener(user) {
  stopUserListener();

  unsubscribeUser = onSnapshot(
    doc(db, "users", user.uid),
    (snapshot) => {
      currentUserData = snapshot.exists()
        ? { id: snapshot.id, ...snapshot.data() }
        : null;

      refreshCurrentRound();
      renderMyStatus();
      renderPredictionSection();
    },
    (error) => showError(error, "사용자 정보 불러오기 실패")
  );
}


/* 예측 데이터 */

function resetFinalScoreDraft() {
  finalScoreDraft = {
    1: { teamAScore: null, teamBScore: null },
    2: { teamAScore: null, teamBScore: null },
    3: { teamAScore: null, teamBScore: null }
  };
}

function loadFinalScoreDraft(finalPrediction) {
  resetFinalScoreDraft();

  if (!finalPrediction?.sets) return;

  finalPrediction.sets.forEach((setResult) => {
    if (!finalScoreDraft[setResult.set]) return;

    finalScoreDraft[setResult.set] = {
      teamAScore: Number(setResult.teamAScore),
      teamBScore: Number(setResult.teamBScore)
    };
  });
}

function stopPredictionListener() {
  if (unsubscribePrediction) unsubscribePrediction();

  unsubscribePrediction = null;
  currentRoundPrediction = null;
  selectedPicks = {};
  resetFinalScoreDraft();
}

function startPredictionListener() {
  stopPredictionListener();

  if (!currentUser || !currentRound) {
    renderPredictionSection();
    return;
  }

  const predictionId = getPredictionDocumentId(
    currentRound.id,
    currentUser.uid
  );

  unsubscribePrediction = onSnapshot(
    doc(db, "roundPredictions", predictionId),
    (snapshot) => {
      currentRoundPrediction = snapshot.exists()
        ? { id: snapshot.id, ...snapshot.data() }
        : null;

      selectedPicks = {
        ...(currentRoundPrediction?.picks || {})
      };

      loadFinalScoreDraft(
        currentRoundPrediction?.finalPrediction
      );

      renderPredictionSection();
    },
    (error) => showError(error, "내 예측 정보 불러오기 실패")
  );
}

function refreshCurrentRound() {
  const nextRound = getCurrentRoundFromData();
  const changed = currentRound?.id !== nextRound?.id;

  currentRound = nextRound;

  if (changed) startPredictionListener();

  renderPredictionSection();
}


/* 결승 세트 예측 */

function getFinalMatch() {
  return getRoundMatches("final")[0] || null;
}

function parseScore(input) {
  if (!input || input.value === "") return null;

  const number = Number(input.value);

  if (
    !Number.isInteger(number) ||
    number < 0 ||
    number > 99
  ) {
    return null;
  }

  return number;
}

function getSetWinner(setNumber, finalMatch = getFinalMatch()) {
  const scores = finalScoreDraft[setNumber];

  if (
    !finalMatch ||
    scores.teamAScore === null ||
    scores.teamBScore === null ||
    scores.teamAScore === scores.teamBScore
  ) {
    return null;
  }

  return scores.teamAScore > scores.teamBScore
    ? finalMatch.teamA
    : finalMatch.teamB;
}

function isThirdSetRequired() {
  const winner1 = getSetWinner(1);
  const winner2 = getSetWinner(2);

  return Boolean(winner1 && winner2 && winner1 !== winner2);
}

function getPredictedFinalWinner() {
  const winner1 = getSetWinner(1);
  const winner2 = getSetWinner(2);

  if (!winner1 || !winner2) return null;
  if (winner1 === winner2) return winner1;

  return getSetWinner(3);
}

function buildFinalPrediction() {
  if (currentRound?.id !== "final") return null;

  const finalMatch = getFinalMatch();
  const winner1 = getSetWinner(1, finalMatch);
  const winner2 = getSetWinner(2, finalMatch);

  if (!finalMatch || !winner1 || !winner2) return null;

  const sets = [
    {
      set: 1,
      teamAScore: finalScoreDraft[1].teamAScore,
      teamBScore: finalScoreDraft[1].teamBScore,
      winner: winner1
    },
    {
      set: 2,
      teamAScore: finalScoreDraft[2].teamAScore,
      teamBScore: finalScoreDraft[2].teamBScore,
      winner: winner2
    }
  ];

  if (winner1 !== winner2) {
    const winner3 = getSetWinner(3, finalMatch);

    if (!winner3) return null;

    sets.push({
      set: 3,
      teamAScore: finalScoreDraft[3].teamAScore,
      teamBScore: finalScoreDraft[3].teamBScore,
      winner: winner3
    });
  }

  return {
    winner: winner1 === winner2 ? winner1 : sets[2].winner,
    sets
  };
}

function isFinalPredictionValid() {
  if (currentRound?.id !== "final") return true;

  const finalMatch = getFinalMatch();
  const prediction = buildFinalPrediction();

  if (!finalMatch || !prediction) return false;

  return selectedPicks[finalMatch.id] === prediction.winner;
}

function setWinnerText(element, setNumber) {
  const winner = getSetWinner(setNumber);

  if (!winner) {
    element.textContent = "서로 다른 점수를 입력해주세요.";
    return;
  }

  element.textContent = `${winner} 세트 승리 예상`;
}

function fillFinalInputs() {
  const inputMap = {
    1: [elements.finalSet1ScoreA, elements.finalSet1ScoreB],
    2: [elements.finalSet2ScoreA, elements.finalSet2ScoreB],
    3: [elements.finalSet3ScoreA, elements.finalSet3ScoreB]
  };

  Object.entries(inputMap).forEach(([setNumber, inputs]) => {
    const score = finalScoreDraft[Number(setNumber)];

    inputs[0].value =
      score.teamAScore === null ? "" : score.teamAScore;

    inputs[1].value =
      score.teamBScore === null ? "" : score.teamBScore;
  });
}

function renderFinalPredictionPanel() {
  if (!elements.finalPredictionPanel) return;

  if (currentRound?.id !== "final") {
    elements.finalPredictionPanel.hidden = true;
    return;
  }

  elements.finalPredictionPanel.hidden = false;

  const finalMatch = getFinalMatch();

  if (!finalMatch) return;

  [
    elements.finalSet1TeamA,
    elements.finalSet2TeamA,
    elements.finalSet3TeamA
  ].forEach((element) => {
    element.textContent = finalMatch.teamA || "TEAM A";
  });

  [
    elements.finalSet1TeamB,
    elements.finalSet2TeamB,
    elements.finalSet3TeamB
  ].forEach((element) => {
    element.textContent = finalMatch.teamB || "TEAM B";
  });

  fillFinalInputs();
  updateFinalPredictionUI();
}

function updateFinalPredictionUI() {
  if (currentRound?.id !== "final") return;

  setWinnerText(elements.finalSet1Winner, 1);
  setWinnerText(elements.finalSet2Winner, 2);

  const thirdSetRequired = isThirdSetRequired();

  elements.finalSet3Card.classList.toggle(
    "disabled",
    !thirdSetRequired
  );

  elements.finalSet3ScoreA.disabled = !thirdSetRequired;
  elements.finalSet3ScoreB.disabled = !thirdSetRequired;

  if (!thirdSetRequired) {
    finalScoreDraft[3] = {
      teamAScore: null,
      teamBScore: null
    };

    elements.finalSet3ScoreA.value = "";
    elements.finalSet3ScoreB.value = "";

    elements.finalSet3Winner.textContent =
      getSetWinner(1) && getSetWinner(1) === getSetWinner(2)
        ? "2:0 예상으로 3세트가 진행되지 않습니다."
        : "첫 두 세트의 점수를 먼저 입력해주세요.";
  } else {
    setWinnerText(elements.finalSet3Winner, 3);
  }

  const predictedWinner = getPredictedFinalWinner();

  elements.predictedFinalWinner.textContent =
    predictedWinner || "점수 입력 필요";

  updateSelectionUI(getRoundMatches(currentRound.id));
}

function bindFinalScoreInputs() {
  const inputs = [
    [elements.finalSet1ScoreA, 1, "teamAScore"],
    [elements.finalSet1ScoreB, 1, "teamBScore"],
    [elements.finalSet2ScoreA, 2, "teamAScore"],
    [elements.finalSet2ScoreB, 2, "teamBScore"],
    [elements.finalSet3ScoreA, 3, "teamAScore"],
    [elements.finalSet3ScoreB, 3, "teamBScore"]
  ];

  inputs.forEach(([input, setNumber, key]) => {
    input?.addEventListener("input", () => {
      finalScoreDraft[setNumber][key] = parseScore(input);
      updateFinalPredictionUI();
    });
  });
}


/* 예측 화면 */

function renderPredictionSection() {
  const round = currentRound;
  const roundMatches = round ? getRoundMatches(round.id) : [];

  if (!round) {
    elements.currentRoundTitle.textContent =
      "진행 중인 라운드가 없습니다";

    elements.currentRoundDescription.textContent =
      "관리자가 경기 일정을 등록하면 표시됩니다.";

    elements.roundStatusBadge.textContent = "대기";
    elements.roundDeadline.textContent = "미정";
    elements.roundRequirement.textContent = "미정";
    elements.myRoundState.textContent = "대기";
    elements.matchGrid.innerHTML =
      `<div class="loading-card">등록된 라운드가 없습니다.</div>`;

    elements.submitRoundBtn.disabled = true;
    elements.finalPredictionPanel.hidden = true;
    return;
  }

  elements.currentRoundTitle.textContent =
    `${getRoundTitle(round)} 승부 예측`;

  elements.currentRoundDescription.textContent =
    round.id === "final"
      ? "결승 승리 팀과 세트별 예상 점수를 입력해주세요."
      : `${roundMatches.length}경기의 승리 팀을 모두 선택해주세요.`;

  elements.roundDeadline.textContent = formatDate(round.deadline);

  elements.roundRequirement.textContent =
    round.id === "final"
      ? "결승 승리 팀 적중"
      : `${roundMatches.length}경기 중 ${getRoundRequiredCorrect(round)}경기 이상 적중`;

  renderRoundStatus(round);
  renderUserRoundState();
  renderMatchGrid(roundMatches);
  renderFinalPredictionPanel();
  updateSelectionUI(roundMatches);
}

function renderRoundStatus(round) {
  const badge = elements.roundStatusBadge;
  badge.className = "round-status-badge";

  if (round.settled === true) {
    badge.textContent = "정산 완료";
    badge.classList.add("finished");
  } else if (
    round.status === "locked" ||
    isRoundDeadlinePassed(round)
  ) {
    badge.textContent = "예측 마감";
    badge.classList.add("closed");
  } else if (round.status === "open") {
    badge.textContent = "예측 진행 중";
    badge.classList.add("open");
  } else {
    badge.textContent = "준비 중";
    badge.classList.add("waiting");
  }
}

function renderUserRoundState() {
  if (!currentUser) {
    elements.myRoundState.textContent = "로그인 필요";
    elements.eliminatedNotice.hidden = true;
    return;
  }

  if (!currentUserData) {
    elements.myRoundState.textContent = "정보 확인 중";
    return;
  }

  if (currentUserData.alive === false) {
    elements.myRoundState.textContent = "도전 종료";
    elements.eliminatedNotice.hidden = false;
    return;
  }

  elements.eliminatedNotice.hidden = true;

  elements.myRoundState.textContent =
    currentRoundPrediction?.submittedAt
      ? "예측 제출 완료"
      : "예측 가능";
}

function renderMatchGrid(roundMatches) {
  if (!roundMatches.length) {
    elements.matchGrid.innerHTML =
      `<div class="loading-card">해당 라운드의 경기가 없습니다.</div>`;
    return;
  }

  elements.matchGrid.innerHTML = roundMatches
    .map(createPredictionCard)
    .join("");

  bindTeamButtons();
}

function createPredictionCard(match, index) {
  const teamASelected = selectedPicks[match.id] === match.teamA;
  const teamBSelected = selectedPicks[match.id] === match.teamB;
  const disabled = !canCurrentUserPredict();

  return `
    <article class="prediction-match-card">
      <div class="match-card-top">
        <span>GAME ${String(index + 1).padStart(2, "0")}</span>
        <span class="match-state">
          ${selectedPicks[match.id] ? "선택 완료" : "선택 필요"}
        </span>
      </div>

      <div class="match-date">
        ${escapeHtml(match.dateLabel || formatDate(match.deadline))}
      </div>

      <div class="match-versus">
        <button
          type="button"
          class="team-choice-button ${teamASelected ? "selected" : ""}"
          data-match-id="${escapeHtml(match.id)}"
          data-team="${escapeHtml(match.teamA || "")}"
          ${disabled ? "disabled" : ""}
        >
          <span class="team-choice-label">TEAM A</span>
          <strong>${escapeHtml(match.teamA || "미정")}</strong>
          <span class="choice-check">
            ${teamASelected ? "선택됨" : "승리 예측"}
          </span>
        </button>

        <div class="versus-mark">VS</div>

        <button
          type="button"
          class="team-choice-button ${teamBSelected ? "selected" : ""}"
          data-match-id="${escapeHtml(match.id)}"
          data-team="${escapeHtml(match.teamB || "")}"
          ${disabled ? "disabled" : ""}
        >
          <span class="team-choice-label">TEAM B</span>
          <strong>${escapeHtml(match.teamB || "미정")}</strong>
          <span class="choice-check">
            ${teamBSelected ? "선택됨" : "승리 예측"}
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
  document.querySelectorAll(".team-choice-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (!canCurrentUserPredict()) return;

      selectedPicks[button.dataset.matchId] = button.dataset.team;

      const roundMatches = getRoundMatches(currentRound.id);

      renderMatchGrid(roundMatches);
      updateSelectionUI(roundMatches);
    });
  });
}

function updateSelectionUI(roundMatches) {
  const predictableMatches = roundMatches.filter(
    (match) => !match.byeTeam
  );

  const selectedCount = predictableMatches.filter(
    (match) => Boolean(selectedPicks[match.id])
  ).length;

  const total = predictableMatches.length;
  const allSelected = total > 0 && selectedCount === total;
  const finalValid = isFinalPredictionValid();

  elements.selectionCount.textContent = `${selectedCount} / ${total}`;

  elements.submitRoundBtn.disabled = !(
    allSelected &&
    finalValid &&
    canCurrentUserPredict()
  );

  if (!currentUser) {
    elements.submitHelp.textContent =
      "학교 계정으로 로그인한 뒤 참여할 수 있습니다.";
  } else if (currentUserData?.alive === false) {
    elements.submitHelp.textContent =
      "도전이 종료되어 더 이상 예측할 수 없습니다.";
  } else if (!isRoundOpen(currentRound)) {
    elements.submitHelp.textContent =
      "이 라운드의 예측이 마감되었습니다.";
  } else if (!allSelected) {
    elements.submitHelp.textContent =
      `남은 ${total - selectedCount}경기의 승리 팀을 선택해주세요.`;
  } else if (currentRound.id === "final" && !buildFinalPrediction()) {
    elements.submitHelp.textContent =
      "1·2세트 점수와 필요한 경우 3세트 점수를 입력해주세요.";
  } else if (currentRound.id === "final" && !finalValid) {
    elements.submitHelp.textContent =
      "경기 승리 팀 선택과 점수로 계산된 최종 승리 팀이 다릅니다.";
  } else {
    elements.submitHelp.textContent =
      currentRoundPrediction
        ? "수정한 예측을 다시 제출할 수 있습니다."
        : "모든 예측 입력이 완료되었습니다.";
  }

  elements.submitRoundBtn.textContent =
    currentRoundPrediction
      ? "예측 수정하기"
      : "예측 한 번에 제출하기";
}


/* 제출 */

function openPredictionModal() {
  const roundMatches = getRoundMatches(currentRound.id).filter(
    (match) => !match.byeTeam
  );

  if (
    !canCurrentUserPredict() ||
    !roundMatches.every((match) => selectedPicks[match.id])
  ) {
    showMessage("모든 경기의 승리 팀을 선택해주세요.", "error");
    return;
  }

  const finalPrediction = buildFinalPrediction();

  if (currentRound.id === "final" && !finalPrediction) {
    showMessage("세트별 예상 점수를 모두 입력해주세요.", "error");
    return;
  }

  if (currentRound.id === "final" && !isFinalPredictionValid()) {
    showMessage(
      "선택한 결승 승리 팀과 점수 예측 결과가 다릅니다.",
      "error"
    );
    return;
  }

  elements.modalPredictionList.innerHTML = roundMatches
    .map(
      (match, index) => `
        <div class="modal-prediction-item">
          <span>경기 ${index + 1}</span>
          <div>
            <small>
              ${escapeHtml(match.teamA)} VS ${escapeHtml(match.teamB)}
            </small>
            <strong>
              ${escapeHtml(selectedPicks[match.id])} 승리
            </strong>
          </div>
        </div>
      `
    )
    .join("");

  if (finalPrediction) {
    elements.modalFinalPrediction.hidden = false;
    elements.modalFinalPrediction.innerHTML = `
      <h3>세트별 예상 점수</h3>

      ${finalPrediction.sets
        .map(
          (setResult) => `
            <div>
              <span>${setResult.set}세트</span>
              <strong>
                ${escapeHtml(getFinalMatch().teamA)}
                ${setResult.teamAScore}
                :
                ${setResult.teamBScore}
                ${escapeHtml(getFinalMatch().teamB)}
              </strong>
            </div>
          `
        )
        .join("")}

      <p>
        예상 최종 승리 팀
        <strong>${escapeHtml(finalPrediction.winner)}</strong>
      </p>
    `;
  } else {
    elements.modalFinalPrediction.hidden = true;
    elements.modalFinalPrediction.innerHTML = "";
  }

  elements.predictionModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closePredictionModal() {
  elements.predictionModal.hidden = true;
  document.body.classList.remove("modal-open");
}

async function submitRoundPrediction() {
  if (!currentUser || !currentRound || !canCurrentUserPredict()) {
    showMessage("예측을 제출할 수 없습니다.", "error");
    return;
  }

  const roundMatches = getRoundMatches(currentRound.id).filter(
    (match) => !match.byeTeam
  );

  if (!roundMatches.every((match) => selectedPicks[match.id])) {
    showMessage("모든 경기를 선택해주세요.", "error");
    return;
  }

  const finalPrediction = buildFinalPrediction();

  if (
    currentRound.id === "final" &&
    (!finalPrediction || !isFinalPredictionValid())
  ) {
    showMessage("결승 세부 예측을 다시 확인해주세요.", "error");
    return;
  }

  const predictionId = getPredictionDocumentId(
    currentRound.id,
    currentUser.uid
  );

  elements.confirmSubmitBtn.disabled = true;
  elements.confirmSubmitBtn.textContent = "제출 중...";

  try {
    const data = {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName:
        currentUser.displayName || currentUser.email.split("@")[0],

      roundKey: currentRound.id,
      roundOrder: Number(currentRound.order || 0),
      picks: { ...selectedPicks },
      matchCount: roundMatches.length,

      correctCount: currentRoundPrediction?.correctCount ?? null,
      passed: currentRoundPrediction?.passed ?? null,
      resultProcessed:
        currentRoundPrediction?.resultProcessed ?? false,

      updatedAt: serverTimestamp()
    };

    if (!currentRoundPrediction?.submittedAt) {
      data.submittedAt = serverTimestamp();
    }

    if (currentRound.id === "final") {
      data.finalPrediction = finalPrediction;
    }

    await setDoc(
      doc(db, "roundPredictions", predictionId),
      data,
      { merge: true }
    );

    closePredictionModal();

    showMessage(
      currentRoundPrediction
        ? "예측을 수정했습니다."
        : "예측 제출이 완료되었습니다.",
      "success"
    );
  } catch (error) {
    showError(error, "예측 제출 실패");
  } finally {
    elements.confirmSubmitBtn.disabled = false;
    elements.confirmSubmitBtn.textContent = "예측 제출";
  }
}


/* 대진표 */

function renderBracket() {
  if (!matches.length) return;

  const sortedRounds = [...rounds].sort(
    (a, b) => Number(a.order || 0) - Number(b.order || 0)
  );

  elements.bracketPreview.innerHTML = `
    <div class="mini-bracket">
      ${sortedRounds
        .map(
          (round) => `
            <div class="mini-bracket-column">
              <strong>${escapeHtml(getRoundTitle(round))}</strong>

              ${getRoundMatches(round.id)
                .map(
                  (match) => `
                    <div class="mini-match">
                      <span class="${
                        match.winner === match.teamA ? "winner" : ""
                      }">
                        ${escapeHtml(match.teamA || "미정")}
                      </span>

                      <span class="${
                        match.winner === match.teamB ? "winner" : ""
                      }">
                        ${escapeHtml(match.teamB || "미정")}
                      </span>
                    </div>
                  `
                )
                .join("")}
            </div>
          `
        )
        .join("")}
    </div>
  `;

  elements.fullBracket.innerHTML = sortedRounds
    .map(
      (round) => `
        <section class="bracket-round">
          <div class="bracket-round-heading">
            <div>
              <span>ROUND ${Number(round.order || 0)}</span>
              <h2>${escapeHtml(getRoundTitle(round))}</h2>
            </div>

            <strong>${getRoundMatches(round.id).length}경기</strong>
          </div>

          <div class="bracket-match-list">
            ${getRoundMatches(round.id)
              .map(
                (match) => `
                  <article class="bracket-match">
                    <div class="bracket-match-info">
                      <span>${escapeHtml(match.dateLabel || "")}</span>
                      <strong>${match.winner ? "경기 종료" : "예정"}</strong>
                    </div>

                    <div class="bracket-team ${
                      match.winner === match.teamA ? "winner" : ""
                    }">
                      <span>${escapeHtml(match.teamA || "미정")}</span>
                      <strong>
                        ${match.winner === match.teamA ? "WIN" : ""}
                      </strong>
                    </div>

                    <div class="bracket-team ${
                      match.winner === match.teamB ? "winner" : ""
                    }">
                      <span>${escapeHtml(match.teamB || "미정")}</span>
                      <strong>
                        ${match.winner === match.teamB ? "WIN" : ""}
                      </strong>
                    </div>
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
      `
    )
    .join("");
}


/* 랭킹 */

function getUserHits(user) {
  return Number(user.totalHits || user.correctCount || 0);
}

function getSortedRankingUsers() {
  return [...rankingUsers]
    .filter((user) => {
      const email = user.email?.toLowerCase();

      return (
        user.isAdmin !== true &&
        email !== ADMIN_EMAIL.toLowerCase() &&
        email !== HIDDEN_EMAIL.toLowerCase()
      );
    })
    .sort((a, b) => {
      const hits = getUserHits(b) - getUserHits(a);
      if (hits !== 0) return hits;

      const winnerCorrect =
        Number(b.finalTiebreak?.finalWinnerCorrect === true) -
        Number(a.finalTiebreak?.finalWinnerCorrect === true);

      if (winnerCorrect !== 0) return winnerCorrect;

      const setWinners =
        Number(b.finalTiebreak?.correctSetWinners || 0) -
        Number(a.finalTiebreak?.correctSetWinners || 0);

      if (setWinners !== 0) return setWinners;

      const exactScores =
        Number(b.finalTiebreak?.exactSetScores || 0) -
        Number(a.finalTiebreak?.exactSetScores || 0);

      if (exactScores !== 0) return exactScores;

      const errorA =
        a.finalTiebreak?.totalScoreError ?? Number.MAX_SAFE_INTEGER;

      const errorB =
        b.finalTiebreak?.totalScoreError ?? Number.MAX_SAFE_INTEGER;

      if (errorA !== errorB) return errorA - errorB;

      return String(a.displayName || a.name || "").localeCompare(
        String(b.displayName || b.name || ""),
        "ko"
      );
    });
}

function renderRanking() {
  const ranking = getSortedRankingUsers();

  if (!ranking.length) {
    elements.topRanking.innerHTML =
      `<p class="empty-text">아직 집계 전입니다.</p>`;

    elements.fullRanking.innerHTML =
      `<p class="empty-text">아직 집계 전입니다.</p>`;

    return;
  }

  elements.topRanking.innerHTML = ranking
    .slice(0, 5)
    .map(
      (user, index) => `
        <div class="top-ranking-item">
          <span class="ranking-position">
            ${String(index + 1).padStart(2, "0")}
          </span>

          <div class="ranking-person">
            <strong>
              ${escapeHtml(user.displayName || user.name || "참가자")}
            </strong>

            <span>
              ${user.alive === false ? "도전 종료" : "생존 중"}
            </span>
          </div>

          <strong class="ranking-hits">
            ${getUserHits(user)}
            <small>HITS</small>
          </strong>
        </div>
      `
    )
    .join("");

  elements.fullRanking.innerHTML = ranking
    .map(
      (user, index) => `
        <div class="ranking-table-row">
          <strong class="ranking-position">${index + 1}</strong>

          <div class="ranking-person">
            <strong>
              ${escapeHtml(user.displayName || user.name || "참가자")}
            </strong>

            <span>
              ${escapeHtml(getRoundRule(user.currentRound).title)}
            </span>
          </div>

          <strong class="ranking-hits">
            ${getUserHits(user)}경기
          </strong>

          <span class="ranking-alive-state ${
            user.alive === false ? "eliminated" : "alive"
          }">
            ${user.alive === false ? "도전 종료" : "생존"}
          </span>
        </div>
      `
    )
    .join("");
}

function renderMyStatus() {
  if (!currentUser || !currentUserData) {
    elements.myTotalHits.textContent = "0";
    elements.myStatusMessage.textContent =
      "로그인 후 확인할 수 있습니다.";
    return;
  }

  elements.myTotalHits.textContent = String(getUserHits(currentUserData));

  if (currentUserData.alive === false) {
    elements.myStatusMessage.textContent =
      "이번 챌린저컵 도전이 종료되었습니다.";
  } else if (currentUserData.finalWinner) {
    elements.myStatusMessage.textContent =
      "결승전까지 최종 통과했습니다.";
  } else {
    elements.myStatusMessage.textContent =
      `${getRoundRule(currentUserData.currentRound).title}에 도전 중입니다.`;
  }
}


/* 실시간 데이터 */

function startPublicListeners() {
  onSnapshot(
    collection(db, "rounds"),
    (snapshot) => {
      rounds = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

      refreshCurrentRound();
      renderBracket();
    },
    (error) => showError(error, "라운드 정보 불러오기 실패")
  );

  onSnapshot(
    collection(db, "matches"),
    (snapshot) => {
      matches = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      renderPredictionSection();
      renderBracket();
    },
    (error) => showError(error, "경기 정보 불러오기 실패")
  );

  onSnapshot(
    collection(db, "users"),
    (snapshot) => {
      rankingUsers = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      renderRanking();
    },
    (error) => showError(error, "랭킹 불러오기 실패")
  );
}


/* 인증 상태 */

onAuthStateChanged(auth, async (user) => {
  stopUserListener();
  stopPredictionListener();

  if (!user) {
    currentUser = null;
    currentUserData = null;
    updateAccountUI(null);
    refreshCurrentRound();
    renderMyStatus();
    renderPredictionSection();
    return;
  }

  if (!isSchoolAccount(user)) {
    await signOut(auth);
    alert("g.cnees.kr 학교 계정으로만 참여할 수 있습니다.");
    return;
  }

  currentUser = user;
  updateAccountUI(user);

  try {
    await createOrUpdateUser(user);
    startUserListener(user);
  } catch (error) {
    showError(error, "사용자 등록 실패");
  }
});


/* 이벤트 */

function bindEvents() {
  elements.loginBtn.addEventListener("click", handleLogin);
  elements.submitRoundBtn.addEventListener("click", openPredictionModal);
  elements.closeModalBtn.addEventListener("click", closePredictionModal);
  elements.cancelSubmitBtn.addEventListener("click", closePredictionModal);
  elements.confirmSubmitBtn.addEventListener(
    "click",
    submitRoundPrediction
  );

  elements.predictionModal.addEventListener("click", (event) => {
    if (event.target === elements.predictionModal) {
      closePredictionModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      !elements.predictionModal.hidden
    ) {
      closePredictionModal();
    }
  });

  bindFinalScoreInputs();
}


/* 시작 */

function initializeAppPage() {
  bindNavigation();
  bindEvents();
  startPublicListeners();

  updateAccountUI(auth.currentUser);
  renderMyStatus();
  renderPredictionSection();

  console.log("챌린저컵 예측 시스템 시작");
}

initializeAppPage();
