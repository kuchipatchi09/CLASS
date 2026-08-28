import {
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  setDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  auth,
  db,
  provider
} from "./firebase-config.js";

/* =========================================================
   기본 설정
========================================================= */

const ADMIN_EMAIL = "cnsh32_1218@g.cnees.kr";
const HIDDEN_EMAILS = new Set([
  "whisk1209@g.cnees.kr"
]);

const ROUND_ORDER = [
  "round1",
  "round2",
  "semifinal",
  "final"
];

const ROUND_INFO = {
  round1: {
    title: "1라운드",
    requiredCorrect: 3,
    nextRound: "round2"
  },
  round2: {
    title: "2라운드",
    requiredCorrect: 3,
    nextRound: "semifinal"
  },
  semifinal: {
    title: "준결승",
    requiredCorrect: 1,
    nextRound: "final"
  },
  final: {
    title: "결승",
    requiredCorrect: 1,
    nextRound: null
  }
};

const MISSING_SET_PENALTY = 200;

let currentAdmin = null;
let allMatches = [];
let allRounds = [];
let allUsers = [];
let allRoundPredictions = [];

let selectedMatch = null;
let selectedWinner = null;
let selectedSettlementRound = null;

/* =========================================================
   DOM
========================================================= */

const adminLoginScreen = document.getElementById("adminLoginScreen");
const adminDashboard = document.getElementById("adminDashboard");

const adminLoginBtn = document.getElementById("adminLoginBtn");
const adminLoginMainBtn = document.getElementById("adminLoginMainBtn");
const adminAccountInfo = document.getElementById("adminAccountInfo");
const adminAccountName = document.getElementById("adminAccountName");
const adminAccountEmail = document.getElementById("adminAccountEmail");

const setupTournamentBtn = document.getElementById(
  "setupTournamentBtn"
);

const adminTotalParticipants = document.getElementById(
  "adminTotalParticipants"
);
const adminAliveParticipants = document.getElementById(
  "adminAliveParticipants"
);
const adminCompletedMatches = document.getElementById(
  "adminCompletedMatches"
);
const adminTotalPredictions = document.getElementById(
  "adminTotalPredictions"
);

const currentRoundAdminCard = document.getElementById(
  "currentRoundAdminCard"
);
const livePredictionGrid = document.getElementById(
  "livePredictionGrid"
);
const adminTopRanking = document.getElementById("adminTopRanking");
const adminRoundList = document.getElementById("adminRoundList");
const adminParticipantList = document.getElementById(
  "adminParticipantList"
);

const setupModal = document.getElementById("setupModal");
const setupStatus = document.getElementById("setupStatus");

const matchResultModal = document.getElementById(
  "matchResultModal"
);
const matchResultTitle = document.getElementById(
  "matchResultTitle"
);
const matchResultDescription = document.getElementById(
  "matchResultDescription"
);
const matchResultSummary = document.getElementById(
  "matchResultSummary"
);
const matchResultWarning = document.getElementById(
  "matchResultWarning"
);
const confirmMatchResultBtn = document.getElementById(
  "confirmMatchResultBtn"
);
const cancelMatchResultBtn = document.getElementById(
  "cancelMatchResultBtn"
);

const adminFinalScorePanel = document.getElementById(
  "adminFinalScorePanel"
);
const actualFinalTeamA = document.getElementById(
  "actualFinalTeamA"
);
const actualFinalTeamB = document.getElementById(
  "actualFinalTeamB"
);
const actualFinalWinner = document.getElementById(
  "actualFinalWinner"
);
const actualSet3Card = document.getElementById(
  "actualSet3Card"
);

const actualSetInputs = [
  {
    card: null,
    scoreA: document.getElementById("actualSet1ScoreA"),
    scoreB: document.getElementById("actualSet1ScoreB"),
    winner: document.getElementById("actualSet1Winner"),
    labelA: document.getElementById("actualSet1TeamALabel"),
    labelB: document.getElementById("actualSet1TeamBLabel")
  },
  {
    card: null,
    scoreA: document.getElementById("actualSet2ScoreA"),
    scoreB: document.getElementById("actualSet2ScoreB"),
    winner: document.getElementById("actualSet2Winner"),
    labelA: document.getElementById("actualSet2TeamALabel"),
    labelB: document.getElementById("actualSet2TeamBLabel")
  },
  {
    card: actualSet3Card,
    scoreA: document.getElementById("actualSet3ScoreA"),
    scoreB: document.getElementById("actualSet3ScoreB"),
    winner: document.getElementById("actualSet3Winner"),
    labelA: document.getElementById("actualSet3TeamALabel"),
    labelB: document.getElementById("actualSet3TeamBLabel")
  }
];

const roundSettlementModal = document.getElementById(
  "roundSettlementModal"
);
const roundSettlementTitle = document.getElementById(
  "roundSettlementTitle"
);
const roundSettlementDescription = document.getElementById(
  "roundSettlementDescription"
);
const roundSettlementPreview = document.getElementById(
  "roundSettlementPreview"
);
const confirmRoundSettlementBtn = document.getElementById(
  "confirmRoundSettlementBtn"
);
const cancelRoundSettlementBtn = document.getElementById(
  "cancelRoundSettlementBtn"
);

const adminToast = document.getElementById("adminToast");

/* =========================================================
   공통 함수
========================================================= */

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isAdminEmail(email) {
  return normalizeEmail(email) === ADMIN_EMAIL;
}

function isHiddenUser(email) {
  return HIDDEN_EMAILS.has(normalizeEmail(email));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getDisplayName(user) {
  return (
    user.displayName ||
    user.name ||
    user.email?.split("@")[0] ||
    "이름 없음"
  );
}

function getRoundTitle(roundKey) {
  return (
    ROUND_INFO[roundKey]?.title ||
    allRounds.find((round) => round.id === roundKey)?.title ||
    roundKey
  );
}

function getTimestampMillis(value) {
  if (!value) return 0;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value.seconds) {
    return value.seconds * 1000;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function showToast(message, type = "success") {
  if (!adminToast) {
    alert(message);
    return;
  }

  adminToast.textContent = message;
  adminToast.className = `toast ${type}`;
  adminToast.hidden = false;

  window.clearTimeout(showToast.timer);

  showToast.timer = window.setTimeout(() => {
    adminToast.hidden = true;
  }, 3500);
}

function openModal(modal) {
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeModal(modal) {
  if (!modal) return;
  modal.hidden = true;

  const openedModal = document.querySelector(
    ".modal-backdrop:not([hidden])"
  );

  if (!openedModal) {
    document.body.classList.remove("modal-open");
  }
}

function getMatchNumber(match) {
  return (
    Number(match.matchNo) ||
    Number(String(match.id).replace(/\D/g, "")) ||
    0
  );
}

function sortMatches(matches) {
  return [...matches].sort((a, b) => {
    const orderDifference =
      Number(a.order || getMatchNumber(a)) -
      Number(b.order || getMatchNumber(b));

    return orderDifference || a.id.localeCompare(b.id);
  });
}

function getCurrentRound() {
  const activeRound = allRounds.find((round) =>
    ["open", "active"].includes(round.status)
  );

  if (activeRound) return activeRound;

  for (const roundKey of ROUND_ORDER) {
    const matches = allMatches.filter(
      (match) => match.roundKey === roundKey
    );

    if (
      matches.length > 0 &&
      matches.some((match) => !match.winner)
    ) {
      return {
        id: roundKey,
        title: getRoundTitle(roundKey),
        status: "open"
      };
    }
  }

  return allRounds.at(-1) || null;
}

function getMatchStatusLabel(match) {
  if (match.winner) return "결과 확정";

  if (match.status === "open") return "예측 진행 중";
  if (match.status === "closed") return "예측 마감";

  return "예정";
}

function isFinalMatch(match) {
  return (
    match?.roundKey === "final" ||
    match?.round === "결승" ||
    match?.id === "match11"
  );
}

/* =========================================================
   인증
========================================================= */

async function loginAdmin() {
  try {
    const result = await signInWithPopup(auth, provider);
    const email = normalizeEmail(result.user.email);

    if (!isAdminEmail(email)) {
      await signOut(auth);

      showToast(
        "관리자 계정으로만 로그인할 수 있습니다.",
        "error"
      );

      return;
    }
  } catch (error) {
    console.error(error);

    showToast(
      `관리자 로그인 실패: ${error.message}`,
      "error"
    );
  }
}

async function logoutAdmin() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
    showToast("로그아웃에 실패했습니다.", "error");
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentAdmin = null;

    adminLoginScreen.hidden = false;
    adminDashboard.hidden = true;
    adminAccountInfo.hidden = true;

    adminLoginBtn.textContent = "관리자 로그인";
    return;
  }

  if (!isAdminEmail(user.email)) {
    await signOut(auth);

    showToast(
      "이 계정에는 관리자 권한이 없습니다.",
      "error"
    );

    return;
  }

  currentAdmin = user;

  adminLoginScreen.hidden = true;
  adminDashboard.hidden = false;
  adminAccountInfo.hidden = false;

  adminAccountName.textContent =
    user.displayName || "챌린저컵 관리자";
  adminAccountEmail.textContent = user.email;
  adminLoginBtn.textContent = "로그아웃";

  await loadAdminData();
});

adminLoginBtn?.addEventListener("click", () => {
  if (currentAdmin) {
    logoutAdmin();
  } else {
    loginAdmin();
  }
});

adminLoginMainBtn?.addEventListener("click", loginAdmin);

/* =========================================================
   Firebase 데이터 불러오기
========================================================= */

async function loadAdminData() {
  if (!currentAdmin) return;

  try {
    const [
      matchSnapshot,
      roundSnapshot,
      userSnapshot,
      predictionSnapshot
    ] = await Promise.all([
      getDocs(collection(db, "matches")),
      getDocs(collection(db, "rounds")),
      getDocs(collection(db, "users")),
      getDocs(collection(db, "roundPredictions"))
    ]);

    allMatches = matchSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    allRounds = roundSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    allUsers = userSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    allRoundPredictions = predictionSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    renderAdmin();
  } catch (error) {
    console.error(error);

    showToast(
      `관리자 데이터를 불러오지 못했습니다: ${error.message}`,
      "error"
    );
  }
}

function renderAdmin() {
  renderStatistics();
  renderCurrentRound();
  renderLivePredictions();
  renderTopRanking();
  renderMatchManagement();
  renderParticipantList();
}

/* =========================================================
   대시보드 통계
========================================================= */

function getVisibleParticipants() {
  return allUsers.filter((user) => {
    const email = normalizeEmail(user.email);

    return (
      email &&
      email !== ADMIN_EMAIL &&
      !isHiddenUser(email)
    );
  });
}

function renderStatistics() {
  const participants = getVisibleParticipants();

  const aliveCount = participants.filter(
    (user) => user.alive !== false && user.eliminated !== true
  ).length;

  const completedMatches = allMatches.filter(
    (match) => Boolean(match.winner)
  ).length;

  adminTotalParticipants.textContent = participants.length;
  adminAliveParticipants.textContent = aliveCount;
  adminCompletedMatches.textContent = completedMatches;
  adminTotalPredictions.textContent =
    allRoundPredictions.length;
}

/* =========================================================
   현재 라운드
========================================================= */

function renderCurrentRound() {
  const currentRound = getCurrentRound();

  if (!currentRound) {
    currentRoundAdminCard.innerHTML = `
      <div class="admin-empty-state">
        현재 진행 중인 라운드가 없습니다.
      </div>
    `;
    return;
  }

  const roundKey = currentRound.id;
  const matches = sortMatches(
    allMatches.filter((match) => match.roundKey === roundKey)
  );

  const completedCount = matches.filter(
    (match) => match.winner
  ).length;

  const predictionCount = allRoundPredictions.filter(
    (prediction) => prediction.roundKey === roundKey
  ).length;

  const allCompleted =
    matches.length > 0 &&
    completedCount === matches.length;

  const alreadySettled =
    currentRound.resultProcessed === true ||
    currentRound.settled === true ||
    matches.every((match) => match.resultProcessed === true);

  currentRoundAdminCard.innerHTML = `
    <div class="current-round-card">
      <div class="current-round-info">
        <span class="round-status">
          ${escapeHtml(currentRound.status || "진행 중")}
        </span>

        <h3>${escapeHtml(getRoundTitle(roundKey))}</h3>

        <p>
          ${matches.length}경기 중
          <strong>${completedCount}경기</strong> 결과 확정 ·
          <strong>${predictionCount}명</strong> 제출
        </p>
      </div>

      <button
        type="button"
        class="primary-button"
        data-settle-round="${escapeHtml(roundKey)}"
        ${!allCompleted || alreadySettled ? "disabled" : ""}
      >
        ${
          alreadySettled
            ? "정산 완료"
            : allCompleted
              ? "라운드 정산"
              : "모든 결과 입력 필요"
        }
      </button>
    </div>
  `;

  currentRoundAdminCard
    .querySelector("[data-settle-round]")
    ?.addEventListener("click", () => {
      openRoundSettlement(roundKey);
    });
}

/* =========================================================
   실시간 예측 비율
========================================================= */

function getPredictionSelection(prediction, matchId) {
  if (prediction.selections?.[matchId]) {
    return prediction.selections[matchId];
  }

  if (prediction.predictions?.[matchId]) {
    return prediction.predictions[matchId];
  }

  if (prediction.answers?.[matchId]) {
    return prediction.answers[matchId];
  }

  if (
    prediction.matchId === matchId &&
    prediction.selectedTeam
  ) {
    return prediction.selectedTeam;
  }

  return null;
}

function getMatchPredictionCounts(match) {
  const roundPredictions = allRoundPredictions.filter(
    (prediction) => prediction.roundKey === match.roundKey
  );

  let teamACount = 0;
  let teamBCount = 0;

  roundPredictions.forEach((prediction) => {
    const selection = getPredictionSelection(
      prediction,
      match.id
    );

    if (selection === match.teamA) teamACount += 1;
    if (selection === match.teamB) teamBCount += 1;
  });

  return {
    teamACount,
    teamBCount,
    total: teamACount + teamBCount
  };
}

function renderLivePredictions() {
  const currentRound = getCurrentRound();

  if (!currentRound) {
    livePredictionGrid.innerHTML = `
      <div class="admin-empty-state">
        표시할 예측 경기가 없습니다.
      </div>
    `;
    return;
  }

  const matches = sortMatches(
    allMatches.filter(
      (match) => match.roundKey === currentRound.id
    )
  );

  if (matches.length === 0) {
    livePredictionGrid.innerHTML = `
      <div class="admin-empty-state">
        현재 라운드 경기가 없습니다.
      </div>
    `;
    return;
  }

  livePredictionGrid.innerHTML = matches
    .map((match) => {
      const counts = getMatchPredictionCounts(match);

      const teamAPercent = counts.total
        ? Math.round((counts.teamACount / counts.total) * 100)
        : 0;

      const teamBPercent = counts.total
        ? Math.round((counts.teamBCount / counts.total) * 100)
        : 0;

      return `
        <article class="live-prediction-card">
          <div class="live-match-meta">
            <span>${escapeHtml(match.dateLabel || "")}</span>
            <span>${escapeHtml(getMatchStatusLabel(match))}</span>
          </div>

          <div class="live-match-teams">
            <strong>${escapeHtml(match.teamA || "미정")}</strong>
            <span>VS</span>
            <strong>${escapeHtml(match.teamB || "미정")}</strong>
          </div>

          <div class="prediction-ratio-row">
            <div class="prediction-ratio-label">
              <strong>${escapeHtml(match.teamA || "TEAM A")}</strong>
              <span>${counts.teamACount}명 · ${teamAPercent}%</span>
            </div>

            <div class="prediction-ratio-track">
              <span style="width:${teamAPercent}%"></span>
            </div>
          </div>

          <div class="prediction-ratio-row">
            <div class="prediction-ratio-label">
              <strong>${escapeHtml(match.teamB || "TEAM B")}</strong>
              <span>${counts.teamBCount}명 · ${teamBPercent}%</span>
            </div>

            <div class="prediction-ratio-track">
              <span style="width:${teamBPercent}%"></span>
            </div>
          </div>

          <p class="prediction-total">
            총 ${counts.total}명 참여
          </p>
        </article>
      `;
    })
    .join("");
}

/* =========================================================
   랭킹
========================================================= */

function getFinalTiebreak(user) {
  const value = user.finalTiebreak || {};

  return {
    finalWinnerCorrect:
      value.finalWinnerCorrect === true ? 1 : 0,
    correctSetWinners:
      Number(value.correctSetWinners || 0),
    exactSetScores:
      Number(value.exactSetScores || 0),
    totalScoreError:
      Number.isFinite(Number(value.totalScoreError))
        ? Number(value.totalScoreError)
        : Number.MAX_SAFE_INTEGER
  };
}

function sortRankingUsers(users) {
  return [...users].sort((a, b) => {
    const hitDifference =
      Number(b.totalHits || 0) - Number(a.totalHits || 0);

    if (hitDifference !== 0) return hitDifference;

    const finalA = getFinalTiebreak(a);
    const finalB = getFinalTiebreak(b);

    if (
      finalB.finalWinnerCorrect !==
      finalA.finalWinnerCorrect
    ) {
      return (
        finalB.finalWinnerCorrect -
        finalA.finalWinnerCorrect
      );
    }

    if (
      finalB.correctSetWinners !==
      finalA.correctSetWinners
    ) {
      return (
        finalB.correctSetWinners -
        finalA.correctSetWinners
      );
    }

    if (
      finalB.exactSetScores !==
      finalA.exactSetScores
    ) {
      return (
        finalB.exactSetScores -
        finalA.exactSetScores
      );
    }

    if (
      finalA.totalScoreError !==
      finalB.totalScoreError
    ) {
      return (
        finalA.totalScoreError -
        finalB.totalScoreError
      );
    }

    const submittedDifference =
      getTimestampMillis(a.finalSubmittedAt) -
      getTimestampMillis(b.finalSubmittedAt);

    if (submittedDifference !== 0) {
      return submittedDifference;
    }

    return getDisplayName(a).localeCompare(
      getDisplayName(b),
      "ko"
    );
  });
}

function renderTopRanking() {
  const ranking = sortRankingUsers(
    getVisibleParticipants()
  ).slice(0, 5);

  if (ranking.length === 0) {
    adminTopRanking.innerHTML = `
      <div class="admin-empty-state">
        아직 집계 전입니다.
      </div>
    `;
    return;
  }

  adminTopRanking.innerHTML = `
    <ol class="admin-ranking-list">
      ${ranking
        .map(
          (user, index) => `
            <li>
              <span class="ranking-number">
                ${String(index + 1).padStart(2, "0")}
              </span>

              <div class="ranking-person">
                <strong>${escapeHtml(getDisplayName(user))}</strong>
                <span>
                  ${
                    user.alive === false ||
                    user.eliminated === true
                      ? "탈락"
                      : "생존 중"
                  }
                </span>
              </div>

              <strong class="ranking-hits">
                ${Number(user.totalHits || 0)}
                <small>HITS</small>
              </strong>
            </li>
          `
        )
        .join("")}
    </ol>
  `;
}

/* =========================================================
   경기 관리
========================================================= */

function renderMatchManagement() {
  adminRoundList.innerHTML = ROUND_ORDER.map((roundKey) => {
    const matches = sortMatches(
      allMatches.filter(
        (match) => match.roundKey === roundKey
      )
    );

    if (matches.length === 0) return "";

    const roundDocument = allRounds.find(
      (round) => round.id === roundKey
    );

    const settled =
      roundDocument?.settled === true ||
      roundDocument?.resultProcessed === true;

    return `
      <section class="admin-round-section">
        <div class="admin-round-heading">
          <div>
            <p class="eyebrow">${escapeHtml(roundKey)}</p>
            <h2>${escapeHtml(getRoundTitle(roundKey))}</h2>
          </div>

          <span class="round-status">
            ${settled ? "정산 완료" : "정산 전"}
          </span>
        </div>

        <div class="admin-match-grid">
          ${matches.map(renderAdminMatchCard).join("")}
        </div>
      </section>
    `;
  }).join("");

  adminRoundList
    .querySelectorAll("[data-match-winner]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const matchId = button.dataset.matchId;
        const winner = button.dataset.matchWinner;

        const match = allMatches.find(
          (item) => item.id === matchId
        );

        openMatchResult(match, winner);
      });
    });

  adminRoundList
    .querySelectorAll("[data-settle-round]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        openRoundSettlement(button.dataset.settleRound);
      });
    });
}

function renderAdminMatchCard(match) {
  const hasBothTeams = Boolean(match.teamA && match.teamB);
  const locked = !hasBothTeams || Boolean(match.winner);

  return `
    <article class="admin-match-card">
      <div class="admin-match-meta">
        <span>
          GAME ${String(getMatchNumber(match)).padStart(2, "0")}
        </span>

        <span>${escapeHtml(getMatchStatusLabel(match))}</span>
      </div>

      <p class="admin-match-date">
        ${escapeHtml(match.dateLabel || "")}
      </p>

      <div class="admin-match-team-buttons">
        <button
          type="button"
          data-match-id="${escapeHtml(match.id)}"
          data-match-winner="${escapeHtml(match.teamA || "")}"
          class="${match.winner === match.teamA ? "winner" : ""}"
          ${locked ? "disabled" : ""}
        >
          <small>TEAM A</small>
          <strong>${escapeHtml(match.teamA || "미정")}</strong>
        </button>

        <span>VS</span>

        <button
          type="button"
          data-match-id="${escapeHtml(match.id)}"
          data-match-winner="${escapeHtml(match.teamB || "")}"
          class="${match.winner === match.teamB ? "winner" : ""}"
          ${locked ? "disabled" : ""}
        >
          <small>TEAM B</small>
          <strong>${escapeHtml(match.teamB || "미정")}</strong>
        </button>
      </div>

      ${
        match.winner
          ? `
            <div class="admin-result-label">
              승리 팀
              <strong>${escapeHtml(match.winner)}</strong>
            </div>
          `
          : `
            <div class="admin-result-label pending">
              승리 팀을 선택하세요.
            </div>
          `
      }

      ${
        isFinalMatch(match) && match.setResults?.length
          ? `
            <div class="admin-final-result-summary">
              ${match.setResults
                .map(
                  (setResult) => `
                    <span>
                      ${setResult.set}세트
                      ${setResult.teamAScore}:${setResult.teamBScore}
                    </span>
                  `
                )
                .join("")}
            </div>
          `
          : ""
      }
    </article>
  `;
}

/* =========================================================
   경기 결과 확정
========================================================= */

function resetFinalScoreInputs() {
  actualSetInputs.forEach((setInput) => {
    setInput.scoreA.value = "";
    setInput.scoreB.value = "";
    setInput.scoreA.disabled = false;
    setInput.scoreB.disabled = false;
    setInput.winner.textContent = "점수를 입력하세요.";
  });

  actualSet3Card.classList.remove("disabled");
  actualFinalWinner.textContent = "점수 입력 전";
}

function updateFinalTeamLabels(match) {
  actualFinalTeamA.textContent = match.teamA;
  actualFinalTeamB.textContent = match.teamB;

  actualSetInputs.forEach((setInput) => {
    setInput.labelA.textContent = match.teamA;
    setInput.labelB.textContent = match.teamB;
  });
}

function parseScore(input) {
  if (input.value === "") return null;

  const score = Number(input.value);

  if (
    !Number.isInteger(score) ||
    score < 0 ||
    score > 99
  ) {
    return null;
  }

  return score;
}

function getSetWinner(teamA, teamB, scoreA, scoreB) {
  if (scoreA === null || scoreB === null) return null;
  if (scoreA === scoreB) return "tie";

  return scoreA > scoreB ? teamA : teamB;
}

function calculateAdminFinalResult({
  strict = false
} = {}) {
  if (!selectedMatch || !isFinalMatch(selectedMatch)) {
    return null;
  }

  const teamA = selectedMatch.teamA;
  const teamB = selectedMatch.teamB;

  const firstTwoSets = actualSetInputs.slice(0, 2).map(
    (setInput, index) => {
      const teamAScore = parseScore(setInput.scoreA);
      const teamBScore = parseScore(setInput.scoreB);
      const winner = getSetWinner(
        teamA,
        teamB,
        teamAScore,
        teamBScore
      );

      return {
        set: index + 1,
        teamAScore,
        teamBScore,
        winner
      };
    }
  );

  firstTwoSets.forEach((result, index) => {
    const output = actualSetInputs[index].winner;

    if (
      result.teamAScore === null ||
      result.teamBScore === null
    ) {
      output.textContent = "점수를 입력하세요.";
    } else if (result.winner === "tie") {
      output.textContent = "동점은 입력할 수 없습니다.";
    } else {
      output.textContent = `${result.winner} 세트 승`;
    }
  });

  const firstValid = firstTwoSets.every(
    (result) =>
      result.teamAScore !== null &&
      result.teamBScore !== null &&
      result.winner !== "tie"
  );

  if (!firstValid) {
    actualSet3Card.classList.remove("disabled");
    actualSetInputs[2].scoreA.disabled = false;
    actualSetInputs[2].scoreB.disabled = false;
    actualFinalWinner.textContent = "점수 입력 전";

    if (strict) {
      throw new Error(
        "1세트와 2세트의 실제 점수를 정확히 입력하세요."
      );
    }

    return null;
  }

  const requiresThirdSet =
    firstTwoSets[0].winner !== firstTwoSets[1].winner;

  if (!requiresThirdSet) {
    actualSetInputs[2].scoreA.value = "";
    actualSetInputs[2].scoreB.value = "";
    actualSetInputs[2].scoreA.disabled = true;
    actualSetInputs[2].scoreB.disabled = true;
    actualSetInputs[2].winner.textContent =
      "3세트가 진행되지 않았습니다.";
    actualSet3Card.classList.add("disabled");

    const winner = firstTwoSets[0].winner;
    actualFinalWinner.textContent = winner;

    return {
      winner,
      setResults: firstTwoSets
    };
  }

  actualSet3Card.classList.remove("disabled");
  actualSetInputs[2].scoreA.disabled = false;
  actualSetInputs[2].scoreB.disabled = false;

  const thirdSet = {
    set: 3,
    teamAScore: parseScore(actualSetInputs[2].scoreA),
    teamBScore: parseScore(actualSetInputs[2].scoreB)
  };

  thirdSet.winner = getSetWinner(
    teamA,
    teamB,
    thirdSet.teamAScore,
    thirdSet.teamBScore
  );

  if (
    thirdSet.teamAScore === null ||
    thirdSet.teamBScore === null
  ) {
    actualSetInputs[2].winner.textContent =
      "3세트 점수를 입력하세요.";
    actualFinalWinner.textContent = "3세트 입력 필요";

    if (strict) {
      throw new Error(
        "1·2세트 승리 팀이 다르므로 3세트 점수가 필요합니다."
      );
    }

    return null;
  }

  if (thirdSet.winner === "tie") {
    actualSetInputs[2].winner.textContent =
      "동점은 입력할 수 없습니다.";
    actualFinalWinner.textContent = "점수를 확인하세요.";

    if (strict) {
      throw new Error(
        "3세트 점수는 동점일 수 없습니다."
      );
    }

    return null;
  }

  actualSetInputs[2].winner.textContent =
    `${thirdSet.winner} 세트 승`;
  actualFinalWinner.textContent = thirdSet.winner;

  return {
    winner: thirdSet.winner,
    setResults: [...firstTwoSets, thirdSet]
  };
}

function openMatchResult(match, winner) {
  if (!match || !winner) return;

  selectedMatch = match;
  selectedWinner = winner;

  matchResultTitle.textContent = `${
    getRoundTitle(match.roundKey)
  } 경기 결과 확정`;

  matchResultDescription.textContent =
    "선택한 승리 팀과 경기 정보를 확인하세요.";

  matchResultSummary.innerHTML = `
    <div class="result-confirmation">
      <span>${escapeHtml(match.teamA)}</span>
      <strong>VS</strong>
      <span>${escapeHtml(match.teamB)}</span>
    </div>

    <div class="selected-winner-box">
      선택한 승리 팀
      <strong>${escapeHtml(winner)}</strong>
    </div>
  `;

  resetFinalScoreInputs();

  if (isFinalMatch(match)) {
    adminFinalScorePanel.hidden = false;
    updateFinalTeamLabels(match);

    matchResultWarning.textContent =
      "결승은 실제 세트별 점수까지 입력해야 결과를 확정할 수 있습니다.";
  } else {
    adminFinalScorePanel.hidden = true;

    matchResultWarning.textContent =
      "결과 확정 후 라운드를 정산하면 참가자의 적중 수와 통과 상태가 변경됩니다.";
  }

  openModal(matchResultModal);
}

actualSetInputs.forEach((setInput) => {
  setInput.scoreA?.addEventListener(
    "input",
    () => calculateAdminFinalResult()
  );

  setInput.scoreB?.addEventListener(
    "input",
    () => calculateAdminFinalResult()
  );
});

async function confirmMatchResult() {
  if (!selectedMatch || !selectedWinner) return;

  confirmMatchResultBtn.disabled = true;
  confirmMatchResultBtn.textContent = "저장 중...";

  try {
    const updateData = {
      winner: selectedWinner,
      status: "completed",
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (isFinalMatch(selectedMatch)) {
      const finalResult = calculateAdminFinalResult({
        strict: true
      });

      if (finalResult.winner !== selectedWinner) {
        throw new Error(
          `입력한 세트 점수의 실제 승리 팀은 ${finalResult.winner}입니다. 경기 카드에서 해당 팀을 다시 선택하세요.`
        );
      }

      updateData.setResults = finalResult.setResults;
      updateData.finalScoreRecorded = true;
    }

    await updateDoc(
      doc(db, "matches", selectedMatch.id),
      updateData
    );

    closeModal(matchResultModal);

    showToast(
      `${selectedMatch.id} 경기 결과를 확정했습니다.`
    );

    selectedMatch = null;
    selectedWinner = null;

    await loadAdminData();
  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  } finally {
    confirmMatchResultBtn.disabled = false;
    confirmMatchResultBtn.textContent = "경기 결과 확정";
  }
}

confirmMatchResultBtn?.addEventListener(
  "click",
  confirmMatchResult
);

cancelMatchResultBtn?.addEventListener("click", () => {
  selectedMatch = null;
  selectedWinner = null;
  closeModal(matchResultModal);
});

/* =========================================================
   라운드 정산
========================================================= */

function getPredictionSelections(prediction) {
  return (
    prediction.selections ||
    prediction.predictions ||
    prediction.answers ||
    {}
  );
}

function countCorrectPredictions(prediction, matches) {
  const selections = getPredictionSelections(prediction);

  return matches.reduce((count, match) => {
    const selectedTeam =
      selections[match.id] ||
      getPredictionSelection(prediction, match.id);

    return count + (selectedTeam === match.winner ? 1 : 0);
  }, 0);
}

function calculateFinalTiebreak(
  prediction,
  finalMatch
) {
  const actualSets = Array.isArray(finalMatch.setResults)
    ? finalMatch.setResults
    : [];

  const finalPrediction =
    prediction.finalPrediction || {};

  const predictedSets = Array.isArray(finalPrediction.sets)
    ? finalPrediction.sets
    : [];

  const predictedWinner =
    finalPrediction.winner ||
    getPredictionSelection(prediction, finalMatch.id);

  let correctSetWinners = 0;
  let exactSetScores = 0;
  let totalScoreError = 0;

  actualSets.forEach((actualSet, index) => {
    const predictedSet = predictedSets.find(
      (item) => Number(item.set) === Number(actualSet.set)
    ) || predictedSets[index];

    if (!predictedSet) {
      totalScoreError += MISSING_SET_PENALTY;
      return;
    }

    const predictedAScore = Number(
      predictedSet.teamAScore
    );
    const predictedBScore = Number(
      predictedSet.teamBScore
    );

    if (
      !Number.isFinite(predictedAScore) ||
      !Number.isFinite(predictedBScore)
    ) {
      totalScoreError += MISSING_SET_PENALTY;
      return;
    }

    const predictedSetWinner =
      predictedSet.winner ||
      (
        predictedAScore > predictedBScore
          ? finalMatch.teamA
          : finalMatch.teamB
      );

    if (predictedSetWinner === actualSet.winner) {
      correctSetWinners += 1;
    }

    if (
      predictedAScore === Number(actualSet.teamAScore) &&
      predictedBScore === Number(actualSet.teamBScore)
    ) {
      exactSetScores += 1;
    }

    totalScoreError +=
      Math.abs(
        predictedAScore - Number(actualSet.teamAScore)
      ) +
      Math.abs(
        predictedBScore - Number(actualSet.teamBScore)
      );
  });

  return {
    finalWinnerCorrect:
      predictedWinner === finalMatch.winner,
    correctSetWinners,
    exactSetScores,
    totalScoreError
  };
}

function getSettlementPreview(roundKey) {
  const roundInfo = ROUND_INFO[roundKey];

  const matches = sortMatches(
    allMatches.filter(
      (match) => match.roundKey === roundKey
    )
  );

  const predictions = allRoundPredictions.filter(
    (prediction) => prediction.roundKey === roundKey
  );

  const results = predictions.map((prediction) => {
    const correctCount = countCorrectPredictions(
      prediction,
      matches
    );

    return {
      prediction,
      correctCount,
      passed:
        correctCount >= roundInfo.requiredCorrect
    };
  });

  return {
    matches,
    predictions,
    results,
    passCount: results.filter((result) => result.passed)
      .length,
    failCount: results.filter((result) => !result.passed)
      .length
  };
}

function openRoundSettlement(roundKey) {
  const roundInfo = ROUND_INFO[roundKey];

  if (!roundInfo) {
    showToast("라운드 정보를 찾을 수 없습니다.", "error");
    return;
  }

  const preview = getSettlementPreview(roundKey);

  if (preview.matches.length === 0) {
    showToast("해당 라운드 경기가 없습니다.", "error");
    return;
  }

  if (
    preview.matches.some((match) => !match.winner)
  ) {
    showToast(
      "모든 경기 결과를 먼저 확정하세요.",
      "error"
    );
    return;
  }

  if (
    roundKey === "final" &&
    !preview.matches[0]?.setResults?.length
  ) {
    showToast(
      "결승 세트별 실제 점수가 저장되지 않았습니다.",
      "error"
    );
    return;
  }

  selectedSettlementRound = roundKey;

  roundSettlementTitle.textContent =
    `${roundInfo.title} 정산`;

  roundSettlementDescription.textContent =
    `${preview.matches.length}경기의 결과와 ${preview.predictions.length}명의 예측을 비교합니다.`;

  roundSettlementPreview.innerHTML = `
    <div class="settlement-stat-grid">
      <article>
        <span>예측 제출</span>
        <strong>${preview.predictions.length}명</strong>
      </article>

      <article>
        <span>통과 예정</span>
        <strong>${preview.passCount}명</strong>
      </article>

      <article>
        <span>탈락 예정</span>
        <strong>${preview.failCount}명</strong>
      </article>

      <article>
        <span>통과 조건</span>
        <strong>
          ${
            roundKey === "final"
              ? "우승 팀 적중"
              : `${preview.matches.length}경기 중 ${roundInfo.requiredCorrect}경기 이상`
          }
        </strong>
      </article>
    </div>

    ${
      roundKey === "final"
        ? `
          <div class="admin-message-box">
            결승 동점 순위는 전체 적중 수 → 결승 승리 팀 →
            세트 승자 → 정확한 세트 점수 → 점수 오차 순으로
            계산됩니다.
          </div>
        `
        : ""
    }
  `;

  openModal(roundSettlementModal);
}

async function confirmRoundSettlement() {
  const roundKey = selectedSettlementRound;
  const roundInfo = ROUND_INFO[roundKey];

  if (!roundKey || !roundInfo) return;

  confirmRoundSettlementBtn.disabled = true;
  confirmRoundSettlementBtn.textContent = "정산 중...";

  try {
    const preview = getSettlementPreview(roundKey);
    const batch = writeBatch(db);

    for (const result of preview.results) {
      const prediction = result.prediction;

      const predictionRef = doc(
        db,
        "roundPredictions",
        prediction.id
      );

      const predictionUpdate = {
        correctCount: result.correctCount,
        passed: result.passed,
        resultProcessed: true,
        processedAt: serverTimestamp()
      };

      if (roundKey === "final") {
        const finalMatch = preview.matches[0];

        predictionUpdate.finalTiebreak =
          calculateFinalTiebreak(
            prediction,
            finalMatch
          );
      }

      batch.update(predictionRef, predictionUpdate);

      const userRef = doc(db, "users", prediction.uid);
      const userSnapshot = await getDoc(userRef);

      if (!userSnapshot.exists()) continue;

      const userData = userSnapshot.data();
      const previousHits = Number(userData.totalHits || 0);

      const userUpdate = {
        totalHits:
          previousHits + result.correctCount,
        currentRound:
          result.passed
            ? roundInfo.nextRound || "finished"
            : roundKey,
        alive:
          roundKey === "final"
            ? result.passed
            : result.passed,
        eliminated: !result.passed,
        updatedAt: serverTimestamp()
      };

      if (result.passed && roundInfo.nextRound) {
        userUpdate.eliminated = false;
      }

      if (roundKey === "final") {
        userUpdate.finalTiebreak =
          predictionUpdate.finalTiebreak;

        userUpdate.finalSubmittedAt =
          prediction.submittedAt ||
          prediction.updatedAt ||
          null;

        userUpdate.finalRankEligible = true;
      }

      batch.update(userRef, userUpdate);
    }

    preview.matches.forEach((match) => {
      batch.update(doc(db, "matches", match.id), {
        resultProcessed: true,
        updatedAt: serverTimestamp()
      });
    });

    batch.set(
      doc(db, "rounds", roundKey),
      {
        title: roundInfo.title,
        status: "completed",
        settled: true,
        resultProcessed: true,
        settledAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    await batch.commit();

    if (roundInfo.nextRound) {
      await prepareNextRound(
        roundKey,
        roundInfo.nextRound
      );
    } else {
      await updateTournamentCurrentRound("finished");
    }

    closeModal(roundSettlementModal);

    showToast(`${roundInfo.title} 정산을 완료했습니다.`);

    selectedSettlementRound = null;
    await loadAdminData();
  } catch (error) {
    console.error(error);

    showToast(
      `라운드 정산 실패: ${error.message}`,
      "error"
    );
  } finally {
    confirmRoundSettlementBtn.disabled = false;
    confirmRoundSettlementBtn.textContent =
      "라운드 정산 확정";
  }
}

confirmRoundSettlementBtn?.addEventListener(
  "click",
  confirmRoundSettlement
);

cancelRoundSettlementBtn?.addEventListener("click", () => {
  selectedSettlementRound = null;
  closeModal(roundSettlementModal);
});

/* =========================================================
   다음 라운드 대진 연결
========================================================= */

function getSourceWinner(sourceMatchId) {
  if (!sourceMatchId) return null;

  const sourceMatch = allMatches.find(
    (match) => match.id === sourceMatchId
  );

  return sourceMatch?.winner || null;
}

async function prepareNextRound(
  completedRoundKey,
  nextRoundKey
) {
  const freshMatchSnapshot = await getDocs(
    collection(db, "matches")
  );

  const freshMatches = freshMatchSnapshot.docs.map(
    (item) => ({
      id: item.id,
      ...item.data()
    })
  );

  const nextMatches = sortMatches(
    freshMatches.filter(
      (match) => match.roundKey === nextRoundKey
    )
  );

  const batch = writeBatch(db);

  nextMatches.forEach((match) => {
    let teamA =
      getSourceWinner(match.sourceA) ||
      match.teamA ||
      null;

    let teamB =
      getSourceWinner(match.sourceB) ||
      match.teamB ||
      null;

    /*
      sourceA/sourceB가 있는데 기존 allMatches에 반영되지 않은 경우
      새로 읽은 경기 목록에서 다시 찾습니다.
    */
    if (match.sourceA) {
      teamA =
        freshMatches.find(
          (source) => source.id === match.sourceA
        )?.winner || teamA;
    }

    if (match.sourceB) {
      teamB =
        freshMatches.find(
          (source) => source.id === match.sourceB
        )?.winner || teamB;
    }

    /*
      실제 부전승 경기만 byeTeam을 사용합니다.
      과거에 잘못 남은 byeTeam 필드는 팀 연결보다 우선하지 않습니다.
    */
    if (!teamA && match.byeTeam) {
      teamA = match.byeTeam;
    }

    const updateData = {
      teamA,
      teamB,
      status: "open",
      winner: null,
      resultProcessed: false,
      updatedAt: serverTimestamp()
    };

    batch.set(
      doc(db, "matches", match.id),
      updateData,
      { merge: true }
    );
  });

  batch.set(
    doc(db, "rounds", nextRoundKey),
    {
      title: getRoundTitle(nextRoundKey),
      status: "open",
      settled: false,
      resultProcessed: false,
      openedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  await batch.commit();
  await updateTournamentCurrentRound(nextRoundKey);
}

async function updateTournamentCurrentRound(roundKey) {
  const updateData = {
    currentRound: roundKey,
    updatedAt: serverTimestamp()
  };

  await Promise.allSettled([
    setDoc(
      doc(db, "settings", "tournament"),
      updateData,
      { merge: true }
    ),
    setDoc(
      doc(db, "tournament", "config"),
      updateData,
      { merge: true }
    )
  ]);
}

/* =========================================================
   참가자 목록
========================================================= */

function renderParticipantList() {
  const users = sortRankingUsers(
    getVisibleParticipants()
  );

  if (users.length === 0) {
    adminParticipantList.innerHTML = `
      <tr>
        <td colspan="5">
          아직 참가자가 없습니다.
        </td>
      </tr>
    `;
    return;
  }

  adminParticipantList.innerHTML = users
    .map((user, index) => {
      const eliminated =
        user.alive === false ||
        user.eliminated === true;

      return `
        <tr>
          <td>${index + 1}</td>

          <td>
            <div class="participant-identity">
              <strong>
                ${escapeHtml(getDisplayName(user))}
              </strong>

              <span>
                ${escapeHtml(user.email || "")}
              </span>
            </div>
          </td>

          <td>
            <strong>
              ${Number(user.totalHits || 0)} HITS
            </strong>
          </td>

          <td>
            ${escapeHtml(
              getRoundTitle(user.currentRound || "round1")
            )}
          </td>

          <td>
            <span class="participant-status ${
              eliminated ? "eliminated" : "alive"
            }">
              ${eliminated ? "탈락" : "생존"}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");
}

/* =========================================================
   관리자 페이지 메뉴
========================================================= */

document
  .querySelectorAll("[data-admin-page]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const page = button.dataset.adminPage;

      document
        .querySelectorAll("[data-admin-page]")
        .forEach((item) => {
          item.classList.toggle(
            "active",
            item.dataset.adminPage === page
          );
        });

      document
        .querySelectorAll("[data-admin-page-panel]")
        .forEach((panel) => {
          panel.hidden =
            panel.dataset.adminPagePanel !== page;
        });
    });
  });

/* =========================================================
   모달 및 데이터 확인
========================================================= */

setupTournamentBtn?.addEventListener("click", () => {
  setupStatus.innerHTML = `
    <strong>현재 저장된 데이터</strong><br>
    경기 ${allMatches.length}개 ·
    라운드 ${allRounds.length}개 ·
    참가자 ${getVisibleParticipants().length}명 ·
    예측 ${allRoundPredictions.length}개
    <br><br>
    기존 데이터는 그대로 유지됩니다. 다시 생성하지 마세요.
  `;

  openModal(setupModal);
});

document
  .querySelectorAll("[data-close-modal]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const modal = document.getElementById(
        button.dataset.closeModal
      );

      closeModal(modal);
    });
  });

document
  .querySelectorAll(".modal-backdrop")
  .forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal(modal);
      }
    });
  });

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  document
    .querySelectorAll(".modal-backdrop:not([hidden])")
    .forEach((modal) => closeModal(modal));
});
