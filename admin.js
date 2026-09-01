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
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  auth,
  db,
  provider
} from "./firebase-config.js";

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

const adminLoginScreen =
  document.getElementById("adminLoginScreen");

const adminDashboard =
  document.getElementById("adminDashboard");

const adminLoginBtn =
  document.getElementById("adminLoginBtn");

const adminLoginMainBtn =
  document.getElementById("adminLoginMainBtn");

const adminAccountInfo =
  document.getElementById("adminAccountInfo");

const adminAccountName =
  document.getElementById("adminAccountName");

const adminAccountEmail =
  document.getElementById("adminAccountEmail");

const setupTournamentBtn =
  document.getElementById("setupTournamentBtn");

const adminTotalParticipants =
  document.getElementById("adminTotalParticipants");

const adminAliveParticipants =
  document.getElementById("adminAliveParticipants");

const adminCompletedMatches =
  document.getElementById("adminCompletedMatches");

const adminTotalPredictions =
  document.getElementById("adminTotalPredictions");

const currentRoundAdminCard =
  document.getElementById("currentRoundAdminCard");

const livePredictionGrid =
  document.getElementById("livePredictionGrid");

const adminTopRanking =
  document.getElementById("adminTopRanking");

const adminRoundList =
  document.getElementById("adminRoundList");

const adminParticipantList =
  document.getElementById("adminParticipantList");

const setupModal =
  document.getElementById("setupModal");

const setupStatus =
  document.getElementById("setupStatus");

const matchResultModal =
  document.getElementById("matchResultModal");

const matchResultTitle =
  document.getElementById("matchResultTitle");

const matchResultDescription =
  document.getElementById("matchResultDescription");

const matchResultSummary =
  document.getElementById("matchResultSummary");

const matchResultWarning =
  document.getElementById("matchResultWarning");

const confirmMatchResultBtn =
  document.getElementById("confirmMatchResultBtn");

const cancelMatchResultBtn =
  document.getElementById("cancelMatchResultBtn");

const adminFinalScorePanel =
  document.getElementById("adminFinalScorePanel");

const actualFinalTeamA =
  document.getElementById("actualFinalTeamA");

const actualFinalTeamB =
  document.getElementById("actualFinalTeamB");

const actualFinalWinner =
  document.getElementById("actualFinalWinner");

const actualSet3Card =
  document.getElementById("actualSet3Card");

const roundSettlementModal =
  document.getElementById("roundSettlementModal");

const roundSettlementTitle =
  document.getElementById("roundSettlementTitle");

const roundSettlementDescription =
  document.getElementById("roundSettlementDescription");

const roundSettlementPreview =
  document.getElementById("roundSettlementPreview");

const confirmRoundSettlementBtn =
  document.getElementById("confirmRoundSettlementBtn");

const cancelRoundSettlementBtn =
  document.getElementById("cancelRoundSettlementBtn");

const adminToast =
  document.getElementById("adminToast");

const actualSetInputs = [
  {
    scoreA: document.getElementById("actualSet1ScoreA"),
    scoreB: document.getElementById("actualSet1ScoreB"),
    winner: document.getElementById("actualSet1Winner"),
    labelA: document.getElementById("actualSet1TeamALabel"),
    labelB: document.getElementById("actualSet1TeamBLabel")
  },
  {
    scoreA: document.getElementById("actualSet2ScoreA"),
    scoreB: document.getElementById("actualSet2ScoreB"),
    winner: document.getElementById("actualSet2Winner"),
    labelA: document.getElementById("actualSet2TeamALabel"),
    labelB: document.getElementById("actualSet2TeamBLabel")
  },
  {
    scoreA: document.getElementById("actualSet3ScoreA"),
    scoreB: document.getElementById("actualSet3ScoreB"),
    winner: document.getElementById("actualSet3Winner"),
    labelA: document.getElementById("actualSet3TeamALabel"),
    labelB: document.getElementById("actualSet3TeamBLabel")
  }
];

/* =========================================================
   공통
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
    roundKey ||
    "라운드"
  );
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
    const aOrder = Number(a.order || getMatchNumber(a));
    const bOrder = Number(b.order || getMatchNumber(b));

    return aOrder - bOrder || a.id.localeCompare(b.id);
  });
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

function isFinalMatch(match) {
  return (
    match?.roundKey === "final" ||
    match?.round === "결승" ||
    match?.id === "match11"
  );
}

function showToast(message, type = "success") {
  if (!adminToast) {
    alert(message);
    return;
  }

  adminToast.textContent = message;
  adminToast.className = `toast ${type}`;
  adminToast.hidden = false;

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
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

  if (!document.querySelector(".modal-backdrop:not([hidden])")) {
    document.body.classList.remove("modal-open");
  }
}

/* =========================================================
   기존 예측 형식 호환
========================================================= */

function extractSelectionValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    return (
      value.selectedTeam ||
      value.winner ||
      value.team ||
      value.choice ||
      value.value ||
      value.prediction ||
      null
    );
  }

  return null;
}

function getPredictionSelection(prediction, matchId) {
  const containers = [
    prediction.selections,
    prediction.predictions,
    prediction.answers,
    prediction.picks,
    prediction.choices
  ];

  for (const container of containers) {
    if (!container) continue;

    if (Array.isArray(container)) {
      const item = container.find((entry) =>
        entry?.matchId === matchId ||
        entry?.id === matchId ||
        entry?.match === matchId
      );

      if (item) {
        return extractSelectionValue(item);
      }

      continue;
    }

    if (
      typeof container === "object" &&
      Object.prototype.hasOwnProperty.call(container, matchId)
    ) {
      return extractSelectionValue(container[matchId]);
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(prediction, matchId)
  ) {
    return extractSelectionValue(prediction[matchId]);
  }

  if (
    prediction.matchId === matchId ||
    prediction.match === matchId
  ) {
    return (
      prediction.selectedTeam ||
      prediction.winner ||
      prediction.team ||
      prediction.choice ||
      prediction.prediction ||
      prediction.value ||
      null
    );
  }

  return null;
}

function getPredictionSelections(prediction) {
  return (
    prediction.selections ||
    prediction.predictions ||
    prediction.answers ||
    prediction.picks ||
    prediction.choices ||
    {}
  );
}

/* =========================================================
   인증
========================================================= */

async function loginAdmin() {
  try {
    const result = await signInWithPopup(auth, provider);

    if (!isAdminEmail(result.user.email)) {
      await signOut(auth);

      showToast(
        "관리자 계정으로만 로그인할 수 있습니다.",
        "error"
      );
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

adminLoginBtn?.addEventListener("click", () => {
  if (currentAdmin) {
    logoutAdmin();
  } else {
    loginAdmin();
  }
});

adminLoginMainBtn?.addEventListener("click", loginAdmin);

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

/* =========================================================
   데이터 불러오기
========================================================= */

async function loadCollectionSafely(collectionName) {
  try {
    const snapshot = await getDocs(
      collection(db, collectionName)
    );

    return snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
      _collection: collectionName
    }));
  } catch (error) {
    console.warn(
      `${collectionName} 컬렉션을 불러오지 못했습니다.`,
      error
    );

    return [];
  }
}

async function loadAdminData() {
  if (!currentAdmin) return;

  try {
    const [
      matches,
      rounds,
      users,
      roundPredictions,
      oldPredictions
    ] = await Promise.all([
      loadCollectionSafely("matches"),
      loadCollectionSafely("rounds"),
      loadCollectionSafely("users"),
      loadCollectionSafely("roundPredictions"),
      loadCollectionSafely("predictions")
    ]);

    allMatches = matches;
    allRounds = rounds;
    allUsers = users;

    /*
      예전 predictions와 새 roundPredictions를 모두 읽습니다.
      같은 문서가 양쪽에 있다면 컬렉션명을 포함해 구분됩니다.
    */
    allRoundPredictions = [
      ...roundPredictions,
      ...oldPredictions
    ];

    renderAdmin();
  } catch (error) {
    console.error(error);

    showToast(
      `관리자 데이터 로딩 실패: ${error.message}`,
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
   참가자 및 통계
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

function getUniquePredictionCount() {
  const keys = new Set();

  allRoundPredictions.forEach((prediction) => {
    const key = [
      prediction.uid || prediction.userId || prediction.email,
      prediction.roundKey || prediction.round || "",
      prediction.matchId || "",
      prediction._collection || ""
    ].join("_");

    keys.add(key);
  });

  return keys.size;
}

function renderStatistics() {
  const participants = getVisibleParticipants();

  const aliveCount = participants.filter(
    (user) =>
      user.alive !== false &&
      user.eliminated !== true
  ).length;

  const completedCount = allMatches.filter(
    (match) => Boolean(match.winner)
  ).length;

  adminTotalParticipants.textContent = participants.length;
  adminAliveParticipants.textContent = aliveCount;
  adminCompletedMatches.textContent = completedCount;
  adminTotalPredictions.textContent =
    getUniquePredictionCount();
}

/* =========================================================
   현재 라운드
========================================================= */

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
      matches.length &&
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
    allMatches.filter(
      (match) => match.roundKey === roundKey
    )
  );

  const completedCount = matches.filter(
    (match) => match.winner
  ).length;

  const predictionUsers = new Set(
    allRoundPredictions
      .filter((prediction) =>
        prediction.roundKey === roundKey ||
        prediction.round === roundKey
      )
      .map((prediction) =>
        prediction.uid ||
        prediction.userId ||
        prediction.email
      )
      .filter(Boolean)
  );

  const allCompleted =
    matches.length > 0 &&
    matches.every((match) => Boolean(match.winner));

  const roundDocument = allRounds.find(
    (round) => round.id === roundKey
  );

  const settled =
    roundDocument?.settled === true ||
    roundDocument?.resultProcessed === true;

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
          <strong>${predictionUsers.size}명</strong> 제출
        </p>
      </div>

      <button
        type="button"
        class="primary-button"
        data-settle-round="${escapeHtml(roundKey)}"
        ${!allCompleted || settled ? "disabled" : ""}
      >
        ${
          settled
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

function isPredictionForRound(prediction, roundKey) {
  if (
    prediction.roundKey === roundKey ||
    prediction.round === roundKey
  ) {
    return true;
  }

  /*
    예전 개별 경기 예측에는 roundKey가 없을 수 있으므로
    matchId로 라운드를 확인합니다.
  */
  if (prediction.matchId) {
    const match = allMatches.find(
      (item) => item.id === prediction.matchId
    );

    return match?.roundKey === roundKey;
  }

  return false;
}

function getMatchPredictionCounts(match) {
  const relevantPredictions = allRoundPredictions.filter(
    (prediction) =>
      isPredictionForRound(prediction, match.roundKey)
  );

  const teamAUsers = new Set();
  const teamBUsers = new Set();

  relevantPredictions.forEach((prediction) => {
    const selection = getPredictionSelection(
      prediction,
      match.id
    );

    const participantKey =
      prediction.uid ||
      prediction.userId ||
      prediction.email ||
      prediction.id;

    if (selection === match.teamA) {
      teamAUsers.add(participantKey);
    }

    if (selection === match.teamB) {
      teamBUsers.add(participantKey);
    }
  });

  return {
    teamACount: teamAUsers.size,
    teamBCount: teamBUsers.size,
    total: teamAUsers.size + teamBUsers.size
  };
}

function getMatchStatusLabel(match) {
  if (match.winner) return "결과 확정";
  if (match.status === "open") return "예측 진행 중";
  if (match.status === "closed") return "예측 마감";

  return "예정";
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

  if (!matches.length) {
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
        ? Math.round(
            (counts.teamACount / counts.total) * 100
          )
        : 0;

      const teamBPercent = counts.total
        ? Math.round(
            (counts.teamBCount / counts.total) * 100
          )
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
              <span>
                ${counts.teamACount}명 · ${teamAPercent}%
              </span>
            </div>

            <div class="prediction-ratio-track">
              <span style="width:${teamAPercent}%"></span>
            </div>
          </div>

          <div class="prediction-ratio-row">
            <div class="prediction-ratio-label">
              <strong>${escapeHtml(match.teamB || "TEAM B")}</strong>
              <span>
                ${counts.teamBCount}명 · ${teamBPercent}%
              </span>
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
    const hits =
      Number(b.totalHits || 0) -
      Number(a.totalHits || 0);

    if (hits !== 0) return hits;

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
      finalA.totalScoreError !==
      finalB.totalScoreError
    ) {
      return (
        finalA.totalScoreError -
        finalB.totalScoreError
      );
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

  if (!ranking.length) {
    adminTopRanking.innerHTML = `
      <div class="admin-empty-state">
        아직 집계 전입니다.
      </div>
    `;

    return;
  }

  adminTopRanking.innerHTML = `
    <ol class="admin-ranking-list">
      ${ranking.map((user, index) => `
        <li>
          <span class="ranking-number">
            ${String(index + 1).padStart(2, "0")}
          </span>

          <div class="ranking-person">
            <strong>
              ${escapeHtml(getDisplayName(user))}
            </strong>

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
      `).join("")}
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

    if (!matches.length) return "";

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
        const match = allMatches.find(
          (item) => item.id === button.dataset.matchId
        );

        openMatchResult(
          match,
          button.dataset.matchWinner
        );
      });
    });
}

function renderAdminMatchCard(match) {
  const hasTeams = Boolean(match.teamA && match.teamB);
  const locked = !hasTeams || Boolean(match.winner);

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
        isFinalMatch(match) &&
        Array.isArray(match.setResults)
          ? `
            <div class="admin-final-result-summary">
              ${match.setResults.map((setResult) => `
                <span>
                  ${setResult.set}세트
                  ${setResult.teamAScore}:${setResult.teamBScore}
                </span>
              `).join("")}
            </div>
          `
          : ""
      }
    </article>
  `;
}

/* =========================================================
   결승 점수 및 경기 결과
========================================================= */

function resetFinalScoreInputs() {
  actualSetInputs.forEach((input) => {
    input.scoreA.value = "";
    input.scoreB.value = "";
    input.scoreA.disabled = false;
    input.scoreB.disabled = false;
    input.winner.textContent = "점수를 입력하세요.";
  });

  actualSet3Card?.classList.remove("disabled");
  actualFinalWinner.textContent = "점수 입력 전";
}

function updateFinalTeamLabels(match) {
  actualFinalTeamA.textContent = match.teamA;
  actualFinalTeamB.textContent = match.teamB;

  actualSetInputs.forEach((input) => {
    input.labelA.textContent = match.teamA;
    input.labelB.textContent = match.teamB;
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

function calculateAdminFinalResult({ strict = false } = {}) {
  if (!selectedMatch || !isFinalMatch(selectedMatch)) {
    return null;
  }

  const teamA = selectedMatch.teamA;
  const teamB = selectedMatch.teamB;

  const firstTwoSets = actualSetInputs
    .slice(0, 2)
    .map((input, index) => {
      const teamAScore = parseScore(input.scoreA);
      const teamBScore = parseScore(input.scoreB);

      return {
        set: index + 1,
        teamAScore,
        teamBScore,
        winner: getSetWinner(
          teamA,
          teamB,
          teamAScore,
          teamBScore
        )
      };
    });

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

  const validFirstTwo = firstTwoSets.every(
    (result) =>
      result.teamAScore !== null &&
      result.teamBScore !== null &&
      result.winner !== "tie"
  );

  if (!validFirstTwo) {
    actualFinalWinner.textContent = "점수 입력 전";

    if (strict) {
      throw new Error(
        "1세트와 2세트 점수를 정확히 입력하세요."
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

  matchResultTitle.textContent =
    `${getRoundTitle(match.roundKey)} 경기 결과 확정`;

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
      "결승은 실제 세트별 점수를 입력해야 결과를 확정할 수 있습니다.";
  } else {
    adminFinalScorePanel.hidden = true;

    matchResultWarning.textContent =
      "결과 확정 후 라운드를 정산하면 참가자의 적중 수와 통과 상태가 변경됩니다.";
  }

  openModal(matchResultModal);
}

actualSetInputs.forEach((input) => {
  input.scoreA?.addEventListener(
    "input",
    () => calculateAdminFinalResult()
  );

  input.scoreB?.addEventListener(
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
          `입력한 점수의 실제 승리 팀은 ${finalResult.winner}입니다.`
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
    showToast("경기 결과를 확정했습니다.");

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
   정산
========================================================= */

function countCorrectPredictions(prediction, matches) {
  return matches.reduce((count, match) => {
    const selection = getPredictionSelection(
      prediction,
      match.id
    );

    return count + (selection === match.winner ? 1 : 0);
  }, 0);
}

function calculateFinalTiebreak(prediction, finalMatch) {
  const MAX_SET_ERROR = 15;

  const actualSets = Array.isArray(finalMatch.setResults)
    ? finalMatch.setResults
    : [];

  const finalPrediction =
    prediction.finalPrediction || {};

  const predictedSets = Array.isArray(finalPrediction.sets)
    ? finalPrediction.sets
    : [];

  const predictedFinalWinner =
    finalPrediction.winner ||
    getPredictionSelection(prediction, finalMatch.id);

  let correctSetWinners = 0;
  let totalNormalizedError = 0;

  actualSets.forEach((actualSet, index) => {
    const predictedSet =
      predictedSets.find(
        (item) =>
          Number(item.set) === Number(actualSet.set)
      ) || predictedSets[index];

    /*
      실제로 진행된 세트에 대한 예측이 없으면
      최대 오차 15점을 적용합니다.
    */
    if (!predictedSet) {
      totalNormalizedError += MAX_SET_ERROR;
      return;
    }

    const predictedAScore =
      Number(predictedSet.teamAScore);

    const predictedBScore =
      Number(predictedSet.teamBScore);

    const actualAScore =
      Number(actualSet.teamAScore);

    const actualBScore =
      Number(actualSet.teamBScore);

    const invalidScores =
      !Number.isFinite(predictedAScore) ||
      !Number.isFinite(predictedBScore) ||
      !Number.isFinite(actualAScore) ||
      !Number.isFinite(actualBScore) ||
      predictedAScore < 0 ||
      predictedBScore < 0 ||
      actualAScore < 0 ||
      actualBScore < 0 ||
      predictedAScore === predictedBScore ||
      actualAScore === actualBScore;

    if (invalidScores) {
      totalNormalizedError += MAX_SET_ERROR;
      return;
    }

    const predictedSetWinner =
      predictedAScore > predictedBScore
        ? finalMatch.teamA
        : finalMatch.teamB;

    const actualSetWinner =
      actualSet.winner ||
      (
        actualAScore > actualBScore
          ? finalMatch.teamA
          : finalMatch.teamB
      );

    /*
      세트 승자를 틀린 경우 해당 세트는
      최대 오차 15점으로 처리합니다.
    */
    if (predictedSetWinner !== actualSetWinner) {
      totalNormalizedError += MAX_SET_ERROR;
      return;
    }

    correctSetWinners += 1;

    const predictedWinnerScore =
      predictedSetWinner === finalMatch.teamA
        ? predictedAScore
        : predictedBScore;

    const predictedLoserScore =
      predictedSetWinner === finalMatch.teamA
        ? predictedBScore
        : predictedAScore;

    const actualWinnerScore =
      actualSetWinner === finalMatch.teamA
        ? actualAScore
        : actualBScore;

    const actualLoserScore =
      actualSetWinner === finalMatch.teamA
        ? actualBScore
        : actualAScore;

    if (
      predictedWinnerScore <= 0 ||
      actualWinnerScore <= 0
    ) {
      totalNormalizedError += MAX_SET_ERROR;
      return;
    }

    /*
      예측 점수와 실제 점수를 각각
      승자 15점 기준으로 환산합니다.
    */
    const normalizedPredictedLoserScore =
      15 * (
        predictedLoserScore /
        predictedWinnerScore
      );

    const normalizedActualLoserScore =
      15 * (
        actualLoserScore /
        actualWinnerScore
      );

    const setError = Math.abs(
      normalizedPredictedLoserScore -
      normalizedActualLoserScore
    );

    totalNormalizedError += Math.min(
      MAX_SET_ERROR,
      setError
    );
  });

  /*
    실제 진행된 세트 수로 나눈 평균 오차입니다.
    랭킹 비교에는 반올림하지 않은 원래 값을 사용합니다.
  */
  const normalizedScoreError =
    actualSets.length > 0
      ? totalNormalizedError / actualSets.length
      : MAX_SET_ERROR;

  return {
    finalWinnerCorrect:
      predictedFinalWinner === finalMatch.winner,

    correctSetWinners,

    /*
      기존 랭킹 코드와 호환하기 위해
      totalScoreError에도 평균 환산 오차를 저장합니다.
    */
    totalScoreError: normalizedScoreError,
    normalizedScoreError,
    scoreErrorMethod: "15-point-ratio-v1"
  };
}
function getRoundPredictions(roundKey) {
  const result = [];
  const seen = new Set();

  allRoundPredictions
    .filter((prediction) =>
      isPredictionForRound(prediction, roundKey)
    )
    .forEach((prediction) => {
      const userKey =
        prediction.uid ||
        prediction.userId ||
        prediction.email ||
        prediction.id;

      /*
        라운드 일괄 예측을 우선하고, 같은 사용자의 개별 문서는
        중복 정산하지 않습니다.
      */
      const hasMultipleSelections = [
        prediction.selections,
        prediction.predictions,
        prediction.answers,
        prediction.picks,
        prediction.choices
      ].some((container) =>
        container &&
        (
          Array.isArray(container) ||
          typeof container === "object"
        )
      );

      const key = hasMultipleSelections
        ? `${userKey}_${roundKey}_round`
        : `${userKey}_${roundKey}_${prediction.matchId || prediction.id}`;

      if (!seen.has(key)) {
        seen.add(key);
        result.push(prediction);
      }
    });

  return result;
}

function getSettlementPreview(roundKey) {
  const info = ROUND_INFO[roundKey];

  const matches = sortMatches(
    allMatches.filter(
      (match) => match.roundKey === roundKey
    )
  );

  const predictions = getRoundPredictions(roundKey);

  const results = predictions.map((prediction) => {
    const correctCount =
      countCorrectPredictions(prediction, matches);

    return {
      prediction,
      correctCount,
      passed: correctCount >= info.requiredCorrect
    };
  });

  return {
    matches,
    predictions,
    results,
    passCount: results.filter((result) => result.passed).length,
    failCount: results.filter((result) => !result.passed).length
  };
}

function openRoundSettlement(roundKey) {
  const info = ROUND_INFO[roundKey];
  const preview = getSettlementPreview(roundKey);

  if (!info) {
    showToast("라운드 정보가 없습니다.", "error");
    return;
  }

  if (!preview.matches.length) {
    showToast("해당 라운드 경기가 없습니다.", "error");
    return;
  }

  if (preview.matches.some((match) => !match.winner)) {
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
      "결승 세트별 실제 점수가 없습니다.",
      "error"
    );

    return;
  }

  selectedSettlementRound = roundKey;

  roundSettlementTitle.textContent =
    `${info.title} 정산`;

  roundSettlementDescription.textContent =
    `${preview.matches.length}경기와 ${preview.predictions.length}명의 예측을 비교합니다.`;

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
              : `${info.requiredCorrect}경기 이상 적중`
          }
        </strong>
      </article>
    </div>
  `;

  openModal(roundSettlementModal);
}

async function confirmRoundSettlement() {
  const roundKey = selectedSettlementRound;
  const info = ROUND_INFO[roundKey];

  if (!roundKey || !info) return;

  confirmRoundSettlementBtn.disabled = true;
  confirmRoundSettlementBtn.textContent = "정산 중...";

  try {
    const preview = getSettlementPreview(roundKey);
    const batch = writeBatch(db);

    for (const result of preview.results) {
      const prediction = result.prediction;

      /*
        정산 결과는 roundPredictions 문서에만 직접 기록합니다.
        예전 predictions 문서는 기존 데이터 보존을 위해 수정하지 않습니다.
      */
      if (prediction._collection === "roundPredictions") {
        const predictionUpdate = {
          correctCount: result.correctCount,
          passed: result.passed,
          resultProcessed: true,
          processedAt: serverTimestamp()
        };

        if (roundKey === "final") {
          predictionUpdate.finalTiebreak =
            calculateFinalTiebreak(
              prediction,
              preview.matches[0]
            );
        }

        batch.update(
          doc(db, "roundPredictions", prediction.id),
          predictionUpdate
        );
      }

      const uid =
        prediction.uid ||
        prediction.userId;

      if (!uid) continue;

      const userRef = doc(db, "users", uid);
      const userSnapshot = await getDoc(userRef);

      if (!userSnapshot.exists()) continue;

      const userData = userSnapshot.data();

      const userUpdate = {
        totalHits:
          Number(userData.totalHits || 0) +
          result.correctCount,

        currentRound: result.passed
          ? info.nextRound || "finished"
          : roundKey,

        alive: result.passed,
        eliminated: !result.passed,
        updatedAt: serverTimestamp()
      };

      if (roundKey === "final") {
        userUpdate.finalTiebreak =
          calculateFinalTiebreak(
            prediction,
            preview.matches[0]
          );

        userUpdate.finalSubmittedAt =
          prediction.submittedAt ||
          prediction.updatedAt ||
          null;
      }

      batch.update(userRef, userUpdate);
    }

    preview.matches.forEach((match) => {
      batch.update(
        doc(db, "matches", match.id),
        {
          resultProcessed: true,
          updatedAt: serverTimestamp()
        }
      );
    });

    batch.set(
      doc(db, "rounds", roundKey),
      {
        title: info.title,
        status: "completed",
        settled: true,
        resultProcessed: true,
        settledAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    await batch.commit();

    if (info.nextRound) {
      await prepareNextRound(info.nextRound);
    } else {
      await updateTournamentCurrentRound("finished");
    }

    closeModal(roundSettlementModal);

    showToast(`${info.title} 정산을 완료했습니다.`);

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

cancelRoundSettlementBtn?.addEventListener(
  "click",
  () => {
    selectedSettlementRound = null;
    closeModal(roundSettlementModal);
  }
);

/* =========================================================
   다음 라운드 연결
========================================================= */

async function prepareNextRound(nextRoundKey) {
  const snapshot = await getDocs(
    collection(db, "matches")
  );

  const freshMatches = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));

  const nextMatches = sortMatches(
    freshMatches.filter(
      (match) => match.roundKey === nextRoundKey
    )
  );

  const batch = writeBatch(db);

  nextMatches.forEach((match) => {
    const sourceA = freshMatches.find(
      (item) => item.id === match.sourceA
    );

    const sourceB = freshMatches.find(
      (item) => item.id === match.sourceB
    );

    const teamA =
      sourceA?.winner ||
      match.teamA ||
      match.byeTeam ||
      null;

    const teamB =
      sourceB?.winner ||
      match.teamB ||
      null;

    batch.set(
      doc(db, "matches", match.id),
      {
        teamA,
        teamB,
        status: "open",
        winner: null,
        resultProcessed: false,
        updatedAt: serverTimestamp()
      },
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
   참가자 표
========================================================= */

function renderParticipantList() {
  const users = sortRankingUsers(
    getVisibleParticipants()
  );

  if (!users.length) {
    adminParticipantList.innerHTML = `
      <tr>
        <td colspan="5">아직 참가자가 없습니다.</td>
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

              <span>${escapeHtml(user.email || "")}</span>
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
   메뉴·모달
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

setupTournamentBtn?.addEventListener("click", () => {
  setupStatus.innerHTML = `
    <strong>현재 Firebase 데이터</strong><br>
    경기 ${allMatches.length}개 ·
    라운드 ${allRounds.length}개 ·
    참가자 ${getVisibleParticipants().length}명 ·
    예측 문서 ${allRoundPredictions.length}개
    <br><br>
    기존 데이터는 그대로 유지됩니다.
  `;

  openModal(setupModal);
});

document
  .querySelectorAll("[data-close-modal]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      closeModal(
        document.getElementById(
          button.dataset.closeModal
        )
      );
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
    .forEach(closeModal);
});
