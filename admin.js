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
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =========================================================
   기본 설정
========================================================= */

const ADMIN_EMAIL =
  "cnsh32_1218@g.cnees.kr";

const SCHOOL_DOMAIN =
  "g.cnees.kr";

const provider =
  new GoogleAuthProvider();

provider.setCustomParameters({
  hd: SCHOOL_DOMAIN,
  prompt: "select_account"
});

let currentAdmin = null;

let rounds = [];
let matches = [];
let predictions = [];
let users = [];

let selectedMatchId = null;
let selectedWinner = null;
let selectedSettlementRoundId = null;

let participantFilter = "all";

let unsubscribeRounds = null;
let unsubscribeMatches = null;
let unsubscribePredictions = null;
let unsubscribeUsers = null;


/* =========================================================
   HTML 요소
========================================================= */

const elements = {
  adminLoginBtn:
    document.getElementById("adminLoginBtn"),

  adminLoginMainBtn:
    document.getElementById("adminLoginMainBtn"),

  adminName:
    document.getElementById("adminName"),

  adminEmail:
    document.getElementById("adminEmail"),

  adminStatus:
    document.getElementById("adminStatus"),

  adminLoginNotice:
    document.getElementById("adminLoginNotice"),

  adminDashboard:
    document.getElementById("adminDashboard"),

  setupTournamentBtn:
    document.getElementById("setupTournamentBtn"),

  totalParticipantCount:
    document.getElementById("totalParticipantCount"),

  aliveParticipantCount:
    document.getElementById("aliveParticipantCount"),

  eliminatedParticipantCount:
    document.getElementById("eliminatedParticipantCount"),

  totalPredictionCount:
    document.getElementById("totalPredictionCount"),

  currentRoundAdminCard:
    document.getElementById("currentRoundAdminCard"),

  livePredictionGrid:
    document.getElementById("livePredictionGrid"),

  adminTopRanking:
    document.getElementById("adminTopRanking"),

  adminRoundList:
    document.getElementById("adminRoundList"),

  adminParticipantList:
    document.getElementById("adminParticipantList"),

  setupModal:
    document.getElementById("setupModal"),

  closeSetupModalBtn:
    document.getElementById("closeSetupModalBtn"),

  cancelSetupBtn:
    document.getElementById("cancelSetupBtn"),

  confirmSetupBtn:
    document.getElementById("confirmSetupBtn"),

  matchResultModal:
    document.getElementById("matchResultModal"),

  closeMatchResultModalBtn:
    document.getElementById("closeMatchResultModalBtn"),

  cancelMatchResultBtn:
    document.getElementById("cancelMatchResultBtn"),

  confirmMatchResultBtn:
    document.getElementById("confirmMatchResultBtn"),

  matchResultTitle:
    document.getElementById("matchResultTitle"),

  matchResultDescription:
    document.getElementById("matchResultDescription"),

  matchResultSummary:
    document.getElementById("matchResultSummary"),

  roundSettlementModal:
    document.getElementById("roundSettlementModal"),

  closeSettlementModalBtn:
    document.getElementById("closeSettlementModalBtn"),

  cancelSettlementBtn:
    document.getElementById("cancelSettlementBtn"),

  confirmSettlementBtn:
    document.getElementById("confirmSettlementBtn"),

  roundSettlementTitle:
    document.getElementById("roundSettlementTitle"),

  roundSettlementDescription:
    document.getElementById("roundSettlementDescription"),

  settlementPreview:
    document.getElementById("settlementPreview")
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

function isAdmin(user) {
  return (
    user?.email?.toLowerCase() ===
    ADMIN_EMAIL.toLowerCase()
  );
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

  const milliseconds =
    new Date(value).getTime();

  return Number.isNaN(milliseconds)
    ? 0
    : milliseconds;
}

function formatDate(value) {
  const milliseconds =
    timestampToMilliseconds(value);

  if (!milliseconds) {
    return "미정";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(milliseconds));
}

function createKoreanTimestamp(
  year,
  month,
  day,
  hour,
  minute
) {
  const monthText =
    String(month).padStart(2, "0");

  const dayText =
    String(day).padStart(2, "0");

  const hourText =
    String(hour).padStart(2, "0");

  const minuteText =
    String(minute).padStart(2, "0");

  const date = new Date(
    `${year}-${monthText}-${dayText}T${hourText}:${minuteText}:00+09:00`
  );

  return Timestamp.fromDate(date);
}

function setStatus(
  message,
  type = "normal"
) {
  elements.adminStatus.textContent =
    message;

  elements.adminStatus.dataset.type =
    type;

  console.log(`[관리자] ${message}`);
}

function showError(
  error,
  title = "오류"
) {
  console.error(error);

  const message =
    error?.message ||
    error?.code ||
    "알 수 없는 오류가 발생했습니다.";

  setStatus(
    `${title}: ${message}`,
    "error"
  );
}

function getRoundById(roundId) {
  return rounds.find(
    (round) => round.id === roundId
  );
}

function getRoundMatches(roundId) {
  return matches
    .filter(
      (match) =>
        match.roundKey === roundId
    )
    .sort(
      (a, b) =>
        Number(a.order || 0) -
        Number(b.order || 0)
    );
}

function getRoundPredictions(roundId) {
  return predictions.filter(
    (prediction) =>
      prediction.roundKey === roundId
  );
}

function getCurrentRound() {
  const sortedRounds =
    [...rounds].sort(
      (a, b) =>
        Number(a.order || 0) -
        Number(b.order || 0)
    );

  return (
    sortedRounds.find(
      (round) =>
        round.status === "open"
    ) ||
    sortedRounds.find(
      (round) =>
        round.settled !== true
    ) ||
    sortedRounds[
      sortedRounds.length - 1
    ] ||
    null
  );
}

function getNextRound(round) {
  if (!round) {
    return null;
  }

  return rounds.find(
    (item) =>
      Number(item.order) ===
      Number(round.order) + 1
  );
}

function getPredictionTeam(
  prediction,
  matchId
) {
  return prediction?.picks?.[matchId] || null;
}

function getParticipantUsers() {
  return users.filter((user) => {
    const email =
      user.email?.toLowerCase();

    return (
      user.isAdmin !== true &&
      email !== ADMIN_EMAIL.toLowerCase() &&
      email !== "whisk1209@g.cnees.kr"
    );
  });
}
function getUserHits(user) {
  return Number(
    user.totalHits ||
    user.correctCount ||
    0
  );
}

function getSortedUsers() {
  return getParticipantUsers()
    .sort((a, b) => {
      const hitDifference =
        getUserHits(b) -
        getUserHits(a);

      if (hitDifference !== 0) {
        return hitDifference;
      }

      const roundDifference =
        Number(
          b.highestRoundOrder || 0
        ) -
        Number(
          a.highestRoundOrder || 0
        );

      if (roundDifference !== 0) {
        return roundDifference;
      }

      return String(
        a.displayName ||
        a.name ||
        ""
      ).localeCompare(
        String(
          b.displayName ||
          b.name ||
          ""
        ),
        "ko"
      );
    });
}

function closeModal(modal) {
  modal.hidden = true;
  document.body.classList.remove(
    "modal-open"
  );
}

function openModal(modal) {
  modal.hidden = false;
  document.body.classList.add(
    "modal-open"
  );
}


/* =========================================================
   관리자 로그인
========================================================= */

async function loginOrLogout() {
  try {
    if (auth.currentUser) {
      elements.adminLoginBtn.disabled =
        true;

      await signOut(auth);
      return;
    }

    elements.adminLoginBtn.disabled =
      true;

    elements.adminLoginBtn.textContent =
      "로그인 중...";

    setStatus(
      "Google 로그인 창을 여는 중입니다."
    );

    const result =
      await signInWithPopup(
        auth,
        provider
      );

    if (!isAdmin(result.user)) {
      await signOut(auth);

      alert(
        `관리자 계정만 로그인할 수 있습니다.\n\n${ADMIN_EMAIL}`
      );

      return;
    }

    setStatus(
      "관리자 로그인이 완료되었습니다.",
      "success"
    );
  } catch (error) {
    if (
      error.code ===
      "auth/popup-closed-by-user"
    ) {
      setStatus(
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
    elements.adminLoginBtn.disabled =
      false;

    if (!auth.currentUser) {
      elements.adminLoginBtn.textContent =
        "관리자 로그인";
    }
  }
}

function updateAdminUI(user) {
  if (!user) {
    elements.adminName.textContent =
      "관리자 로그인 필요";

    elements.adminEmail.textContent =
      ADMIN_EMAIL;

    elements.adminLoginBtn.textContent =
      "관리자 로그인";

    elements.adminLoginNotice.hidden =
      false;

    document
      .querySelectorAll(
        ".admin-page-section"
      )
      .forEach((section) => {
        section.hidden = true;
      });

    return;
  }

  elements.adminName.textContent =
    user.displayName || "관리자";

  elements.adminEmail.textContent =
    user.email;

  elements.adminLoginBtn.textContent =
    "로그아웃";

  elements.adminLoginNotice.hidden =
    true;

  openAdminPage("dashboard");
}


/* =========================================================
   관리자 메뉴
========================================================= */

function openAdminPage(pageName) {
  if (!currentAdmin) {
    return;
  }

  document
    .querySelectorAll(
      "[data-admin-page]"
    )
    .forEach((section) => {
      const active =
        section.dataset.adminPage ===
        pageName;

      section.hidden = !active;
    });

  document
    .querySelectorAll(
      "[data-admin-page-target]"
    )
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.adminPageTarget ===
          pageName
      );
    });
}

function bindAdminNavigation() {
  document
    .querySelectorAll(
      "[data-admin-page-target]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          openAdminPage(
            button.dataset.adminPageTarget
          );
        }
      );
    });
}


/* =========================================================
   초기 대회 데이터
========================================================= */

function getInitialRounds() {
  return [
    {
      id: "round1",
      title: "1라운드",
      order: 1,
      matchCount: 4,
      requiredCorrect: 3,
      deadline: createKoreanTimestamp(
        2026, 8, 20, 12, 50
      ),
      status: "open",
      settled: false
    },

    {
      id: "round2",
      title: "2라운드",
      order: 2,
      matchCount: 4,
      requiredCorrect: 3,
      deadline: createKoreanTimestamp(
        2026, 8, 25, 12, 50
      ),
      status: "waiting",
      settled: false
    },

    {
      id: "semifinal",
      title: "준결승",
      order: 3,
      matchCount: 2,
      requiredCorrect: 1,
      deadline: createKoreanTimestamp(
        2026, 8, 27, 18, 20
      ),
      status: "waiting",
      settled: false
    },

    {
      id: "final",
      title: "결승",
      order: 4,
      matchCount: 1,
      requiredCorrect: 1,
      deadline: createKoreanTimestamp(
        2026, 9, 1, 12, 50
      ),
      status: "waiting",
      settled: false
    }
  ];
}

function getInitialMatches() {
  return [
    {
      id: "match01",
      roundKey: "round1",
      round: "1라운드",
      order: 1,
      teamA: "1-2",
      teamB: "3-1",
      dateLabel: "8월 20일 목요일 점심",
      winner: null,
      status: "scheduled"
    },

    {
      id: "match02",
      roundKey: "round1",
      round: "1라운드",
      order: 2,
      teamA: "1-1",
      teamB: "3-4",
      dateLabel: "8월 20일 목요일 저녁",
      winner: null,
      status: "scheduled"
    },

    {
      id: "match03",
      roundKey: "round1",
      round: "1라운드",
      order: 3,
      teamA: "1-4",
      teamB: "2-4",
      dateLabel: "8월 24일 월요일 점심",
      winner: null,
      status: "scheduled"
    },

    {
      id: "match04",
      roundKey: "round1",
      round: "1라운드",
      order: 4,
      teamA: "3-3",
      teamB: "3-2",
      dateLabel: "8월 24일 월요일 저녁",
      winner: null,
      status: "scheduled"
    },

    {
      id: "match05",
      roundKey: "round2",
      round: "2라운드",
      order: 1,
      teamA: "1라운드 1경기 승자",
      teamB: "1-3",
      sourceA: "match01",
      sourceB: null,
      dateLabel: "8월 25일 화요일 점심",
      winner: null,
      status: "waiting"
    },

    {
      id: "match06",
      roundKey: "round2",
      round: "2라운드",
      order: 2,
      teamA: "1라운드 2경기 승자",
      teamB: "2-2",
      sourceA: "match02",
      sourceB: null,
      dateLabel: "8월 25일 화요일 저녁",
      winner: null,
      status: "waiting"
    },

    {
      id: "match07",
      roundKey: "round2",
      round: "2라운드",
      order: 3,
      teamA: "1라운드 3경기 승자",
      teamB: "2-1",
      sourceA: "match03",
      sourceB: null,
      dateLabel: "8월 26일 수요일 저녁",
      winner: null,
      status: "waiting"
    },

    {
      id: "match08",
      roundKey: "round2",
      round: "2라운드",
      order: 4,
      teamA: "1라운드 4경기 승자",
      teamB: "2-3",
      sourceA: "match04",
      sourceB: null,
      dateLabel: "8월 27일 목요일 점심",
      winner: null,
      status: "waiting"
    },

    {
      id: "match09",
      roundKey: "semifinal",
      round: "준결승",
      order: 1,
      teamA: "2라운드 1경기 승자",
      teamB: "2라운드 2경기 승자",
      sourceA: "match05",
      sourceB: "match06",
      dateLabel: "8월 27일 목요일 저녁",
      winner: null,
      status: "waiting"
    },

    {
      id: "match10",
      roundKey: "semifinal",
      round: "준결승",
      order: 2,
      teamA: "2라운드 3경기 승자",
      teamB: "2라운드 4경기 승자",
      sourceA: "match07",
      sourceB: "match08",
      dateLabel: "8월 31일 월요일 점심",
      winner: null,
      status: "waiting"
    },

    {
      id: "match11",
      roundKey: "final",
      round: "결승",
      order: 1,
      teamA: "준결승 1경기 승자",
      teamB: "준결승 2경기 승자",
      sourceA: "match09",
      sourceB: "match10",
      dateLabel: "9월 1일 화요일 점심",
      winner: null,
      status: "waiting"
    }
  ];
}

async function createTournamentData() {
  if (!currentAdmin) {
    return;
  }

  elements.confirmSetupBtn.disabled =
    true;

  elements.confirmSetupBtn.textContent =
    "생성 중...";

  try {
    const roundSnapshot =
      await getDocs(
        collection(db, "rounds")
      );

    const matchSnapshot =
      await getDocs(
        collection(db, "matches")
      );

    const existingRoundIds =
      new Set(
        roundSnapshot.docs.map(
          (item) => item.id
        )
      );

    const existingMatchIds =
      new Set(
        matchSnapshot.docs.map(
          (item) => item.id
        )
      );

    const batch = writeBatch(db);

    for (
      const round of getInitialRounds()
    ) {
      const { id, ...roundData } =
        round;

      const data = {
        ...roundData,
        updatedAt: serverTimestamp()
      };

      if (
        !existingRoundIds.has(id)
      ) {
        data.createdAt =
          serverTimestamp();
      } else {
        /*
         기존 결과는 덮어쓰지 않습니다.
        */
        delete data.status;
        delete data.settled;
      }

      batch.set(
        doc(db, "rounds", id),
        data,
        { merge: true }
      );
    }

    for (
      const match of getInitialMatches()
    ) {
      const { id, ...matchData } =
        match;

      const data = {
        ...matchData,
        updatedAt: serverTimestamp()
      };

      if (
        !existingMatchIds.has(id)
      ) {
        data.createdAt =
          serverTimestamp();
      } else {
        /*
         기존 승리 팀과 경기 상태는 보존합니다.
        */
        delete data.winner;
        delete data.status;
      }

      batch.set(
        doc(db, "matches", id),
        data,
        { merge: true }
      );
    }

    await batch.commit();

    closeModal(elements.setupModal);

    setStatus(
      "전체 라운드와 11경기를 생성했습니다.",
      "success"
    );

    alert(
      "대회 데이터 생성이 완료되었습니다."
    );
  } catch (error) {
    showError(
      error,
      "대회 데이터 생성 실패"
    );
  } finally {
    elements.confirmSetupBtn.disabled =
      false;

    elements.confirmSetupBtn.textContent =
      "전체 경기 생성";
  }
}


/* =========================================================
   대시보드
========================================================= */

function renderDashboard() {
  const participants =
    getParticipantUsers();

  const aliveCount =
    participants.filter(
      (user) => user.alive !== false
    ).length;

  const eliminatedCount =
    participants.filter(
      (user) => user.alive === false
    ).length;

  elements.totalParticipantCount.textContent =
    String(participants.length);

  elements.aliveParticipantCount.textContent =
    String(aliveCount);

  elements.eliminatedParticipantCount.textContent =
    String(eliminatedCount);

  elements.totalPredictionCount.textContent =
    String(predictions.length);

  renderCurrentRoundCard();
  renderLivePredictions();
  renderAdminRanking();
}

function renderCurrentRoundCard() {
  const round = getCurrentRound();

  if (!round) {
    elements.currentRoundAdminCard.innerHTML = `
      <p class="empty-text">
        등록된 라운드가 없습니다.
      </p>
    `;

    return;
  }

  const roundMatches =
    getRoundMatches(round.id);

  const finishedMatches =
    roundMatches.filter(
      (match) => Boolean(match.winner)
    ).length;

  const roundPredictions =
    getRoundPredictions(round.id);

  elements.currentRoundAdminCard.innerHTML = `
    <div class="admin-current-round-main">
      <div>
        <span class="admin-round-number">
          ROUND ${Number(round.order || 0)}
        </span>

        <h2>
          ${escapeHtml(round.title)}
        </h2>

        <p>
          ${roundMatches.length}경기 중
          ${Number(round.requiredCorrect)}경기 이상 적중 시 통과
        </p>
      </div>

      <span class="admin-round-status ${escapeHtml(round.status)}">
        ${
          round.settled
            ? "정산 완료"
            : round.status === "open"
              ? "예측 진행 중"
              : round.status === "locked"
                ? "예측 마감"
                : "대기"
        }
      </span>
    </div>

    <div class="admin-current-round-data">
      <div>
        <span>예측 마감</span>
        <strong>${escapeHtml(formatDate(round.deadline))}</strong>
      </div>

      <div>
        <span>제출 인원</span>
        <strong>${roundPredictions.length}명</strong>
      </div>

      <div>
        <span>결과 입력</span>
        <strong>${finishedMatches} / ${roundMatches.length}</strong>
      </div>
    </div>
  `;
}

function renderLivePredictions() {
  const round = getCurrentRound();

  if (!round) {
    elements.livePredictionGrid.innerHTML = `
      <p class="empty-text">
        현재 라운드가 없습니다.
      </p>
    `;

    return;
  }

  const roundMatches =
    getRoundMatches(round.id);

  const roundPredictions =
    getRoundPredictions(round.id);

  if (roundMatches.length === 0) {
    elements.livePredictionGrid.innerHTML = `
      <p class="empty-text">
        등록된 경기가 없습니다.
      </p>
    `;

    return;
  }

  elements.livePredictionGrid.innerHTML =
    roundMatches
      .map((match) => {
        return createLivePredictionCard(
          match,
          roundPredictions
        );
      })
      .join("");
}

function createLivePredictionCard(
  match,
  roundPredictions
) {
  let teamACount = 0;
  let teamBCount = 0;

  for (
    const prediction of roundPredictions
  ) {
    const selectedTeam =
      getPredictionTeam(
        prediction,
        match.id
      );

    if (selectedTeam === match.teamA) {
      teamACount += 1;
    }

    if (selectedTeam === match.teamB) {
      teamBCount += 1;
    }
  }

  const total =
    teamACount + teamBCount;

  const teamAPercent =
    total === 0
      ? 0
      : Math.round(
          (teamACount / total) * 100
        );

  const teamBPercent =
    total === 0
      ? 0
      : Math.round(
          (teamBCount / total) * 100
        );

  return `
    <article class="admin-live-card">
      <div class="admin-live-card-top">
        <span>
          ${escapeHtml(match.dateLabel)}
        </span>

        <strong>
          ${
            match.winner
              ? "결과 확정"
              : "진행 전"
          }
        </strong>
      </div>

      <div class="admin-live-versus">
        <strong>${escapeHtml(match.teamA)}</strong>
        <span>VS</span>
        <strong>${escapeHtml(match.teamB)}</strong>
      </div>

      <div class="admin-live-team">
        <div>
          <strong>${escapeHtml(match.teamA)}</strong>
          <span>${teamACount}명 · ${teamAPercent}%</span>
        </div>

        <div class="admin-live-track">
          <div
            class="admin-live-fill team-a"
            style="width: ${teamAPercent}%"
          ></div>
        </div>
      </div>

      <div class="admin-live-team">
        <div>
          <strong>${escapeHtml(match.teamB)}</strong>
          <span>${teamBCount}명 · ${teamBPercent}%</span>
        </div>

        <div class="admin-live-track">
          <div
            class="admin-live-fill team-b"
            style="width: ${teamBPercent}%"
          ></div>
        </div>
      </div>

      <p class="admin-live-total">
        총 ${total}명 참여
      </p>
    </article>
  `;
}

function renderAdminRanking() {
  const ranking =
    getSortedUsers().slice(0, 5);

  if (ranking.length === 0) {
    elements.adminTopRanking.innerHTML = `
      <p class="empty-text">
        아직 집계 전입니다.
      </p>
    `;

    return;
  }

  elements.adminTopRanking.innerHTML =
    ranking
      .map((user, index) => {
        return `
          <div class="admin-ranking-row">
            <strong class="admin-ranking-position">
              ${index + 1}
            </strong>

            <div>
              <strong>
                ${escapeHtml(
                  user.displayName ||
                  user.name ||
                  "참가자"
                )}
              </strong>

              <span>
                ${escapeHtml(user.email || "")}
              </span>
            </div>

            <strong>
              ${getUserHits(user)} HITS
            </strong>

            <span class="${
              user.alive === false
                ? "eliminated"
                : "alive"
            }">
              ${
                user.alive === false
                  ? "탈락"
                  : "생존"
              }
            </span>
          </div>
        `;
      })
      .join("");
}


/* =========================================================
   경기 관리
========================================================= */

function renderRoundManagement() {
  const sortedRounds =
    [...rounds].sort(
      (a, b) =>
        Number(a.order || 0) -
        Number(b.order || 0)
    );

  if (sortedRounds.length === 0) {
    elements.adminRoundList.innerHTML = `
      <p class="empty-text">
        대회 데이터 자동 생성 버튼을 먼저 눌러주세요.
      </p>
    `;

    return;
  }

  elements.adminRoundList.innerHTML =
    sortedRounds
      .map(createRoundManagementCard)
      .join("");

  bindMatchManagementButtons();
}

function createRoundManagementCard(round) {
  const roundMatches =
    getRoundMatches(round.id);

  const finishedCount =
    roundMatches.filter(
      (match) => Boolean(match.winner)
    ).length;

  const canSettle =
    roundMatches.length > 0 &&
    finishedCount === roundMatches.length &&
    round.settled !== true;

  return `
    <section class="admin-round-management-card">
      <div class="admin-round-management-heading">
        <div>
          <span>
            ROUND ${Number(round.order)}
          </span>

          <h2>
            ${escapeHtml(round.title)}
          </h2>

          <p>
            ${roundMatches.length}경기 중
            ${Number(round.requiredCorrect)}경기 이상 적중 시 통과
          </p>
        </div>

        <div class="admin-round-actions">
          <span class="admin-round-status ${escapeHtml(round.status)}">
            ${
              round.settled
                ? "정산 완료"
                : `${finishedCount}/${roundMatches.length} 결과 입력`
            }
          </span>

          <button
            type="button"
            class="admin-settlement-button"
            data-settle-round="${escapeHtml(round.id)}"
            ${
              canSettle
                ? ""
                : "disabled"
            }
          >
            ${
              round.settled
                ? "정산 완료"
                : "라운드 정산"
            }
          </button>
        </div>
      </div>

      <div class="admin-match-management-grid">
        ${
          roundMatches
            .map(createMatchManagementCard)
            .join("")
        }
      </div>
    </section>
  `;
}

function createMatchManagementCard(match) {
  return `
    <article class="admin-match-management-card">
      <div class="admin-match-management-top">
        <span>
          ${escapeHtml(match.id.toUpperCase())}
        </span>

        <strong>
          ${
            match.winner
              ? "결과 확정"
              : "결과 대기"
          }
        </strong>
      </div>

      <p class="admin-match-date">
        ${escapeHtml(match.dateLabel || "")}
      </p>

      <div class="admin-match-teams">
        <button
          type="button"
          class="admin-result-team-button
            ${
              match.winner === match.teamA
                ? "winner"
                : ""
            }"
          data-result-match="${escapeHtml(match.id)}"
          data-result-team="${escapeHtml(match.teamA || "")}"
        >
          <span>TEAM A</span>
          <strong>${escapeHtml(match.teamA || "미정")}</strong>
        </button>

        <span class="admin-match-vs">
          VS
        </span>

        <button
          type="button"
          class="admin-result-team-button
            ${
              match.winner === match.teamB
                ? "winner"
                : ""
            }"
          data-result-match="${escapeHtml(match.id)}"
          data-result-team="${escapeHtml(match.teamB || "")}"
        >
          <span>TEAM B</span>
          <strong>${escapeHtml(match.teamB || "미정")}</strong>
        </button>
      </div>

      ${
        match.winner
          ? `
            <div class="admin-confirmed-winner">
              승리 팀
              <strong>${escapeHtml(match.winner)}</strong>
            </div>
          `
          : `
            <p class="admin-result-help">
              승리 팀 버튼을 눌러 결과를 확정하세요.
            </p>
          `
      }
    </article>
  `;
}

function bindMatchManagementButtons() {
  document
    .querySelectorAll(
      "[data-result-match]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          openMatchResultModal(
            button.dataset.resultMatch,
            button.dataset.resultTeam
          );
        }
      );
    });

  document
    .querySelectorAll(
      "[data-settle-round]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          openSettlementModal(
            button.dataset.settleRound
          );
        }
      );
    });
}


/* =========================================================
   경기 결과 확정
========================================================= */

function openMatchResultModal(
  matchId,
  winner
) {
  const match =
    matches.find(
      (item) => item.id === matchId
    );

  if (!match || !winner) {
    return;
  }

  if (
    winner.includes("승자") ||
    winner === "미정"
  ) {
    alert(
      "이전 경기 결과가 아직 반영되지 않았습니다."
    );

    return;
  }

  selectedMatchId = matchId;
  selectedWinner = winner;

  elements.matchResultTitle.textContent =
    `${winner} 승리 확정`;

  elements.matchResultDescription.textContent =
    "경기 결과를 확인해주세요.";

  elements.matchResultSummary.innerHTML = `
    <span>
      ${escapeHtml(match.teamA)}
      VS
      ${escapeHtml(match.teamB)}
    </span>

    <strong>
      ${escapeHtml(winner)} 승리
    </strong>
  `;

  openModal(elements.matchResultModal);
}

async function confirmMatchResult() {
  const match =
    matches.find(
      (item) =>
        item.id === selectedMatchId
    );

  if (
    !match ||
    !selectedWinner
  ) {
    return;
  }

  elements.confirmMatchResultBtn.disabled =
    true;

  elements.confirmMatchResultBtn.textContent =
    "처리 중...";

  try {
    const batch = writeBatch(db);

    batch.update(
      doc(db, "matches", match.id),
      {
        winner: selectedWinner,
        status: "finished",
        finishedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );

    /*
     이 경기의 승자를 사용하는 다음 경기에
     팀 이름을 자동으로 전달합니다.
    */
    const dependentMatches =
      matches.filter(
        (item) =>
          item.sourceA === match.id ||
          item.sourceB === match.id
      );

    for (
      const dependentMatch of
      dependentMatches
    ) {
      const updateData = {
        updatedAt: serverTimestamp()
      };

      if (
        dependentMatch.sourceA ===
        match.id
      ) {
        updateData.teamA =
          selectedWinner;
      }

      if (
        dependentMatch.sourceB ===
        match.id
      ) {
        updateData.teamB =
          selectedWinner;
      }

      if (
        dependentMatch.sourceA ===
          match.id ||
        dependentMatch.sourceB ===
          match.id
      ) {
        updateData.status =
          "scheduled";
      }

      batch.update(
        doc(
          db,
          "matches",
          dependentMatch.id
        ),
        updateData
      );
    }

    await batch.commit();

    closeModal(
      elements.matchResultModal
    );

    setStatus(
      `${match.id} 경기 결과를 확정했습니다.`,
      "success"
    );
  } catch (error) {
    showError(
      error,
      "경기 결과 확정 실패"
    );
  } finally {
    elements.confirmMatchResultBtn.disabled =
      false;

    elements.confirmMatchResultBtn.textContent =
      "결과 확정";

    selectedMatchId = null;
    selectedWinner = null;
  }
}


/* =========================================================
   라운드 정산
========================================================= */

function calculatePredictionResult(
  prediction,
  roundMatches
) {
  let correctCount = 0;

  for (const match of roundMatches) {
    const selectedTeam =
      prediction?.picks?.[match.id];

    if (
      selectedTeam &&
      selectedTeam === match.winner
    ) {
      correctCount += 1;
    }
  }

  return correctCount;
}

function getSettlementData(round) {
  const roundMatches =
    getRoundMatches(round.id);

  const roundPredictions =
    getRoundPredictions(round.id);

  const eligibleUsers =
    getParticipantUsers().filter(
      (user) => {
        return (
          user.alive !== false &&
          (
            user.currentRound === round.id ||
            Number(
              user.highestRoundOrder || 1
            ) === Number(round.order)
          )
        );
      }
    );

  const requiredCorrect =
    Number(round.requiredCorrect || 1);

  const results =
    eligibleUsers.map((user) => {
      const prediction =
        roundPredictions.find(
          (item) =>
            item.uid === user.id ||
            item.uid === user.uid
        );

      const correctCount =
        prediction
          ? calculatePredictionResult(
              prediction,
              roundMatches
            )
          : 0;

      return {
        user,
        prediction,
        correctCount,
        passed:
          correctCount >= requiredCorrect
      };
    });

  return {
    roundMatches,
    roundPredictions,
    eligibleUsers,
    results,
    passedCount:
      results.filter(
        (item) => item.passed
      ).length,

    failedCount:
      results.filter(
        (item) => !item.passed
      ).length
  };
}

function openSettlementModal(roundId) {
  const round =
    getRoundById(roundId);

  if (!round) {
    return;
  }

  if (round.settled === true) {
    alert(
      "이미 정산이 완료된 라운드입니다."
    );

    return;
  }

  const roundMatches =
    getRoundMatches(round.id);

  if (
    roundMatches.length === 0 ||
    roundMatches.some(
      (match) => !match.winner
    )
  ) {
    alert(
      "모든 경기의 승리 팀을 먼저 확정해주세요."
    );

    return;
  }

  const settlement =
    getSettlementData(round);

  selectedSettlementRoundId =
    roundId;

  elements.roundSettlementTitle.textContent =
    `${round.title} 결과 정산`;

  elements.roundSettlementDescription.textContent =
    `${roundMatches.length}경기 중 ${round.requiredCorrect}경기 이상 적중한 참가자가 통과합니다.`;

  elements.settlementPreview.innerHTML = `
    <div>
      <span>정산 대상</span>
      <strong>${settlement.results.length}명</strong>
    </div>

    <div>
      <span>예상 통과</span>
      <strong>${settlement.passedCount}명</strong>
    </div>

    <div>
      <span>예상 탈락</span>
      <strong>${settlement.failedCount}명</strong>
    </div>

    <div>
      <span>예측 미제출</span>
      <strong>
        ${
          settlement.results.filter(
            (item) => !item.prediction
          ).length
        }명
      </strong>
    </div>
  `;

  openModal(
    elements.roundSettlementModal
  );
}

async function settleRound() {
  const round =
    getRoundById(
      selectedSettlementRoundId
    );

  if (!round) {
    return;
  }

  if (round.settled === true) {
    alert(
      "이미 정산된 라운드입니다."
    );

    closeModal(
      elements.roundSettlementModal
    );

    return;
  }

  const settlement =
    getSettlementData(round);

  if (
    settlement.results.length > 430
  ) {
    alert(
      "정산 대상이 너무 많아 한 번에 처리할 수 없습니다."
    );

    return;
  }

  const nextRound =
    getNextRound(round);

  elements.confirmSettlementBtn.disabled =
    true;

  elements.confirmSettlementBtn.textContent =
    "정산 중...";

  try {
    const batch = writeBatch(db);

    for (
      const result of settlement.results
    ) {
      const userId =
        result.user.id ||
        result.user.uid;

      const previousHits =
        getUserHits(result.user);

      const userData = {
        totalHits:
          previousHits +
          result.correctCount,

        correctCount:
          previousHits +
          result.correctCount,

        highestRoundOrder:
          result.passed
            ? Number(
                nextRound?.order ||
                round.order
              )
            : Number(round.order),

        updatedAt: serverTimestamp()
      };

      userData[
        `roundScores.${round.id}`
      ] = result.correctCount;

      if (
        round.id === "final"
      ) {
        userData.alive =
          result.passed;

        userData.finalWinner =
          result.passed;

        userData.currentRound =
          "finished";
      } else if (result.passed) {
        userData.alive = true;

        userData.currentRound =
          nextRound?.id || "finished";
      } else {
        userData.alive = false;

        userData.eliminatedRound =
          round.id;

        userData.eliminatedAt =
          serverTimestamp();
      }

      batch.set(
        doc(db, "users", userId),
        userData,
        { merge: true }
      );

      if (result.prediction) {
        batch.set(
          doc(
            db,
            "roundPredictions",
            result.prediction.id
          ),
          {
            correctCount:
              result.correctCount,

            passed:
              result.passed,

            resultProcessed: true,
            processedAt:
              serverTimestamp()
          },
          { merge: true }
        );
      }
    }

    batch.update(
      doc(db, "rounds", round.id),
      {
        status: "finished",
        settled: true,
        settledAt: serverTimestamp(),
        passedCount:
          settlement.passedCount,

        failedCount:
          settlement.failedCount,

        updatedAt: serverTimestamp()
      }
    );

    if (nextRound) {
      batch.update(
        doc(
          db,
          "rounds",
          nextRound.id
        ),
        {
          status: "open",
          updatedAt: serverTimestamp()
        }
      );
    }

    await batch.commit();

    closeModal(
      elements.roundSettlementModal
    );

    setStatus(
      `${round.title} 정산이 완료되었습니다.`,
      "success"
    );

    alert(
      `${round.title} 정산 완료\n\n통과 ${settlement.passedCount}명\n탈락 ${settlement.failedCount}명`
    );
  } catch (error) {
    showError(
      error,
      "라운드 정산 실패"
    );
  } finally {
    elements.confirmSettlementBtn.disabled =
      false;

    elements.confirmSettlementBtn.textContent =
      "라운드 정산 실행";

    selectedSettlementRoundId = null;
  }
}


/* =========================================================
   참가자 목록
========================================================= */

function renderParticipants() {
  let participantUsers =
    getSortedUsers();

  if (
    participantFilter === "alive"
  ) {
    participantUsers =
      participantUsers.filter(
        (user) => user.alive !== false
      );
  }

  if (
    participantFilter === "eliminated"
  ) {
    participantUsers =
      participantUsers.filter(
        (user) => user.alive === false
      );
  }

  if (
    participantUsers.length === 0
  ) {
    elements.adminParticipantList.innerHTML = `
      <p class="empty-text">
        해당하는 참가자가 없습니다.
      </p>
    `;

    return;
  }

  elements.adminParticipantList.innerHTML =
    participantUsers
      .map((user, index) => {
        const round =
          getRoundById(
            user.currentRound
          );

        return `
          <div class="admin-participant-row">
            <strong>
              ${index + 1}
            </strong>

            <div>
              <strong>
                ${escapeHtml(
                  user.displayName ||
                  user.name ||
                  "참가자"
                )}
              </strong>

              <span>
                ${escapeHtml(user.email || "")}
              </span>
            </div>

            <span>
              ${
                user.finalWinner
                  ? "최종 통과"
                  : round
                    ? escapeHtml(round.title)
                    : user.alive === false
                      ? "도전 종료"
                      : "1라운드"
              }
            </span>

            <strong>
              ${getUserHits(user)}경기
            </strong>

            <span class="participant-state ${
              user.alive === false
                ? "eliminated"
                : "alive"
            }">
              ${
                user.alive === false
                  ? "탈락"
                  : "생존"
              }
            </span>
          </div>
        `;
      })
      .join("");
}


/* =========================================================
   실시간 데이터 연결
========================================================= */

function stopRealtimeListeners() {
  if (unsubscribeRounds) {
    unsubscribeRounds();
    unsubscribeRounds = null;
  }

  if (unsubscribeMatches) {
    unsubscribeMatches();
    unsubscribeMatches = null;
  }

  if (unsubscribePredictions) {
    unsubscribePredictions();
    unsubscribePredictions = null;
  }

  if (unsubscribeUsers) {
    unsubscribeUsers();
    unsubscribeUsers = null;
  }

  rounds = [];
  matches = [];
  predictions = [];
  users = [];
}

function renderAll() {
  renderDashboard();
  renderRoundManagement();
  renderParticipants();
}

function startRealtimeListeners() {
  stopRealtimeListeners();

  unsubscribeRounds = onSnapshot(
    collection(db, "rounds"),

    (snapshot) => {
      rounds = snapshot.docs.map(
        (roundDocument) => ({
          id: roundDocument.id,
          ...roundDocument.data()
        })
      );

      renderAll();
    },

    (error) => {
      showError(
        error,
        "라운드 불러오기 실패"
      );
    }
  );

  unsubscribeMatches = onSnapshot(
    collection(db, "matches"),

    (snapshot) => {
      matches = snapshot.docs.map(
        (matchDocument) => ({
          id: matchDocument.id,
          ...matchDocument.data()
        })
      );

      renderAll();
    },

    (error) => {
      showError(
        error,
        "경기 불러오기 실패"
      );
    }
  );

  unsubscribePredictions = onSnapshot(
    collection(db, "roundPredictions"),

    (snapshot) => {
      predictions = snapshot.docs.map(
        (predictionDocument) => ({
          id: predictionDocument.id,
          ...predictionDocument.data()
        })
      );

      renderAll();
    },

    (error) => {
      showError(
        error,
        "예측 현황 불러오기 실패"
      );
    }
  );

  unsubscribeUsers = onSnapshot(
    collection(db, "users"),

    (snapshot) => {
      users = snapshot.docs.map(
        (userDocument) => ({
          id: userDocument.id,
          ...userDocument.data()
        })
      );

      renderAll();
    },

    (error) => {
      showError(
        error,
        "참가자 불러오기 실패"
      );
    }
  );
}


/* =========================================================
   버튼 연결
========================================================= */

function bindEvents() {
  elements.adminLoginBtn.addEventListener(
    "click",
    loginOrLogout
  );

  elements.adminLoginMainBtn.addEventListener(
    "click",
    loginOrLogout
  );

  elements.setupTournamentBtn.addEventListener(
    "click",
    () => {
      openModal(elements.setupModal);
    }
  );

  elements.closeSetupModalBtn.addEventListener(
    "click",
    () => closeModal(elements.setupModal)
  );

  elements.cancelSetupBtn.addEventListener(
    "click",
    () => closeModal(elements.setupModal)
  );

  elements.confirmSetupBtn.addEventListener(
    "click",
    createTournamentData
  );

  elements.closeMatchResultModalBtn.addEventListener(
    "click",
    () => closeModal(
      elements.matchResultModal
    )
  );

  elements.cancelMatchResultBtn.addEventListener(
    "click",
    () => closeModal(
      elements.matchResultModal
    )
  );

  elements.confirmMatchResultBtn.addEventListener(
    "click",
    confirmMatchResult
  );

  elements.closeSettlementModalBtn.addEventListener(
    "click",
    () => closeModal(
      elements.roundSettlementModal
    )
  );

  elements.cancelSettlementBtn.addEventListener(
    "click",
    () => closeModal(
      elements.roundSettlementModal
    )
  );

  elements.confirmSettlementBtn.addEventListener(
    "click",
    settleRound
  );

  document
    .querySelectorAll(
      "[data-participant-filter]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          participantFilter =
            button.dataset.participantFilter;

          document
            .querySelectorAll(
              "[data-participant-filter]"
            )
            .forEach((item) => {
              item.classList.toggle(
                "active",
                item === button
              );
            });

          renderParticipants();
        }
      );
    });

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") {
        return;
      }

      closeModal(elements.setupModal);
      closeModal(elements.matchResultModal);
      closeModal(elements.roundSettlementModal);
    }
  );
}


/* =========================================================
   로그인 상태
========================================================= */

onAuthStateChanged(
  auth,
  async (user) => {
    if (!user) {
      currentAdmin = null;

      stopRealtimeListeners();
      updateAdminUI(null);

      setStatus(
        "관리자 로그인이 필요합니다."
      );

      return;
    }

    if (!isAdmin(user)) {
      currentAdmin = null;

      await signOut(auth);

      alert(
        `관리자 계정이 아닙니다.\n${ADMIN_EMAIL} 계정으로 로그인해주세요.`
      );

      return;
    }

    currentAdmin = user;

    updateAdminUI(user);
    startRealtimeListeners();

    setStatus(
      `${user.displayName || "관리자"}님으로 로그인했습니다.`,
      "success"
    );
  }
);


/* =========================================================
   시작
========================================================= */

function initializeAdmin() {
  bindAdminNavigation();
  bindEvents();
  updateAdminUI(auth.currentUser);

  console.log(
    "챌린저컵 관리자 시스템 시작"
  );
}

initializeAdmin();

