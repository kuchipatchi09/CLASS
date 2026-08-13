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
  query,
  where,
  updateDoc,
  setDoc,
  increment,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =========================================================
   설정
========================================================= */

const ADMIN_EMAIL = "cnsh32_1218@g.cnees.kr";

const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  hd: "g.cnees.kr",
  prompt: "select_account"
});

let currentAdmin = null;
let matches = [];
let predictions = [];

let unsubscribeMatches = null;
let unsubscribePredictions = null;


/* =========================================================
   HTML 요소
========================================================= */

function findElement(...selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);

    if (element) {
      return element;
    }
  }

  return null;
}

function getLoginButton() {
  return findElement(
    "#adminLoginBtn",
    "#login",
    "#loginBtn",
    "#admin-login",
    "[data-admin-login]"
  );
}

function getStatusElement() {
  return findElement(
    "#adminStatus",
    "#loginStatus",
    "#statusMessage",
    "#status",
    "[data-admin-status]"
  );
}

function getAdminEmailElement() {
  return findElement(
    "#adminEmail",
    "#userEmail",
    "[data-admin-email]"
  );
}

function getDashboardElement() {
  let dashboard = findElement(
    "#adminMatches",
    "#matchManagement",
    "#matchesList",
    "#liveStats",
    "#adminDashboard",
    "[data-admin-matches]"
  );

  if (dashboard) {
    return dashboard;
  }

  dashboard = document.createElement("section");
  dashboard.id = "adminMatches";
  dashboard.className = "admin-match-section";

  const main = document.querySelector("main") || document.body;
  main.appendChild(dashboard);

  return dashboard;
}


/* =========================================================
   공통 함수
========================================================= */

function setStatus(message, type = "normal") {
  const element = getStatusElement();

  if (element) {
    element.textContent = message;

    if (type === "error") {
      element.style.color = "#dc2626";
    } else if (type === "success") {
      element.style.color = "#15803d";
    } else {
      element.style.color = "";
    }
  }

  console.log(`[관리자] ${message}`);
}

function showError(error, title = "오류") {
  console.error(error);

  const message =
    error?.message ||
    error?.code ||
    "알 수 없는 오류가 발생했습니다.";

  setStatus(`${title}: ${message}`, "error");
}

function isAdmin(user) {
  return Boolean(
    user?.email &&
    user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
}

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

  return Number.isNaN(milliseconds) ? 0 : milliseconds;
}

function formatDeadline(value) {
  const milliseconds = timestampToMilliseconds(value);

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

function getPredictionTeam(prediction) {
  return (
    prediction.pick ||
    prediction.predictedTeam ||
    prediction.selectedTeam ||
    prediction.team ||
    prediction.choice ||
    null
  );
}

function getPredictionUserId(prediction) {
  return (
    prediction.uid ||
    prediction.userId ||
    prediction.userUID ||
    null
  );
}

function getPredictionsForMatch(matchId) {
  return predictions.filter((prediction) => {
    return (
      prediction.matchId === matchId ||
      prediction.gameId === matchId
    );
  });
}

function calculateVotes(match) {
  const matchPredictions = getPredictionsForMatch(match.id);

  let teamACount = 0;
  let teamBCount = 0;

  for (const prediction of matchPredictions) {
    const selectedTeam = getPredictionTeam(prediction);

    if (selectedTeam === match.teamA) {
      teamACount += 1;
    }

    if (selectedTeam === match.teamB) {
      teamBCount += 1;
    }
  }

  const total = teamACount + teamBCount;

  return {
    teamACount,
    teamBCount,
    total,

    teamAPercent:
      total === 0
        ? 0
        : Math.round((teamACount / total) * 100),

    teamBPercent:
      total === 0
        ? 0
        : Math.round((teamBCount / total) * 100)
  };
}


/* =========================================================
   관리자 로그인
========================================================= */

async function loginOrLogout() {
  const button = getLoginButton();

  try {
    if (auth.currentUser) {
      button.disabled = true;
      await signOut(auth);
      return;
    }

    button.disabled = true;
    button.textContent = "로그인 중...";

    setStatus("Google 로그인 창을 여는 중입니다.");

    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    if (!isAdmin(user)) {
      await signOut(auth);

      alert(
        `관리자 계정만 로그인할 수 있습니다.\n\n관리자 계정: ${ADMIN_EMAIL}`
      );

      return;
    }

    setStatus("관리자 로그인이 완료되었습니다.", "success");
  } catch (error) {
    if (error.code === "auth/popup-closed-by-user") {
      setStatus("로그인 창이 닫혔습니다.");
      return;
    }

    if (error.code === "auth/popup-blocked") {
      alert(
        "로그인 팝업이 차단되었습니다.\n브라우저 주소창에서 팝업을 허용해주세요."
      );
    } else {
      alert(`로그인 실패\n${error.message}`);
    }

    showError(error, "로그인 실패");
  } finally {
    if (button) {
      button.disabled = false;

      if (!auth.currentUser) {
        button.textContent = "관리자 로그인";
      }
    }
  }
}

function bindLoginButton() {
  const button = getLoginButton();

  if (!button) {
    setStatus(
      "관리자 로그인 버튼을 찾지 못했습니다. 버튼 ID를 adminLoginBtn으로 설정해주세요.",
      "error"
    );

    console.error(
      `admin.html에 다음 버튼이 필요합니다:
      <button id="adminLoginBtn" type="button">관리자 로그인</button>`
    );

    return;
  }

  button.type = "button";
  button.removeAttribute("onclick");

  /*
   이전에 연결된 이벤트가 있더라도 중복 실행되지 않게 복제합니다.
  */
  const cleanButton = button.cloneNode(true);

  button.replaceWith(cleanButton);
  cleanButton.addEventListener("click", loginOrLogout);

  console.log("관리자 로그인 버튼 연결 완료");
}

function updateLoginUI(user) {
  const button = getLoginButton();
  const emailElement = getAdminEmailElement();

  if (button) {
    button.disabled = false;
    button.textContent = user ? "로그아웃" : "관리자 로그인";
  }

  if (emailElement) {
    emailElement.textContent = user?.email || ADMIN_EMAIL;
  }

  document.body.classList.toggle(
    "admin-logged-in",
    Boolean(user)
  );

  document.body.classList.toggle(
    "admin-logged-out",
    !user
  );
}


/* =========================================================
   관리자 화면 출력
========================================================= */

function renderDashboard() {
  const dashboard = getDashboardElement();

  if (!currentAdmin) {
    dashboard.innerHTML = `
      <div class="admin-notice">
        관리자 계정으로 로그인하면 실시간 예측 비율과 경기 결과를 관리할 수 있습니다.
      </div>
    `;

    return;
  }

  if (matches.length === 0) {
    dashboard.innerHTML = `
      <div class="admin-notice">
        Firestore의 matches 컬렉션에 등록된 경기가 없습니다.
      </div>
    `;

    return;
  }

  const sortedMatches = [...matches].sort((a, b) => {
    return (
      timestampToMilliseconds(a.deadline) -
      timestampToMilliseconds(b.deadline)
    );
  });

  dashboard.innerHTML = `
    <div class="admin-section-heading">
      <div>
        <p class="admin-eyebrow">LIVE CONTROL</p>
        <h2>실시간 승부 예측 현황</h2>
        <p>
          아무도 참여하지 않은 경기는 양쪽 모두 0%로 표시됩니다.
        </p>
      </div>

      <div class="admin-total">
        전체 경기 ${matches.length}개
      </div>
    </div>

    <div class="admin-match-grid">
      ${sortedMatches.map(createMatchCard).join("")}
    </div>
  `;

  bindResultButtons();
}

function createMatchCard(match) {
  const votes = calculateVotes(match);

  const isBye = Boolean(match.byeTeam);

  const isFinished =
    match.status === "finished" ||
    match.status === "closed" ||
    Boolean(match.winner);

  const winner = match.winner || match.byeTeam || "";

  let statusLabel = "예측 진행 중";
  let statusClass = "open";

  if (isBye) {
    statusLabel = "부전승";
    statusClass = "bye";
  } else if (isFinished) {
    statusLabel = "결과 확정";
    statusClass = "finished";
  }

  return `
    <article
      class="admin-match-card ${isFinished ? "finished" : ""}"
      data-match-id="${escapeHtml(match.id)}"
    >
      <div class="admin-match-top">
        <div>
          <span class="admin-round">
            ${escapeHtml(match.round || "경기")}
          </span>

          <span class="admin-date">
            ${escapeHtml(
              match.dateLabel || formatDeadline(match.deadline)
            )}
          </span>
        </div>

        <span class="admin-match-status ${statusClass}">
          ${statusLabel}
        </span>
      </div>

      ${
        isBye
          ? createByeCard(match)
          : createNormalMatchCard(match, votes, isFinished, winner)
      }
    </article>
  `;
}

function createByeCard(match) {
  return `
    <div class="admin-bye-box">
      <div class="admin-bye-label">BYE</div>

      <strong>
        ${escapeHtml(match.byeTeam)}
      </strong>

      <p>
        상대 팀 없이 다음 라운드로 진출하는 부전승 경기입니다.
      </p>
    </div>
  `;
}

function createNormalMatchCard(
  match,
  votes,
  isFinished,
  winner
) {
  return `
    <div class="admin-versus">
      <strong>${escapeHtml(match.teamA || "미정")}</strong>
      <span>VS</span>
      <strong>${escapeHtml(match.teamB || "미정")}</strong>
    </div>

    <div class="admin-vote-row">
      <div class="admin-vote-info">
        <strong>${escapeHtml(match.teamA || "미정")}</strong>

        <span>
          ${votes.teamACount}명 · ${votes.teamAPercent}%
        </span>
      </div>

      <div class="admin-vote-bar">
        <div
          class="admin-vote-fill team-a"
          style="width: ${votes.teamAPercent}%"
        ></div>
      </div>
    </div>

    <div class="admin-vote-row">
      <div class="admin-vote-info">
        <strong>${escapeHtml(match.teamB || "미정")}</strong>

        <span>
          ${votes.teamBCount}명 · ${votes.teamBPercent}%
        </span>
      </div>

      <div class="admin-vote-bar">
        <div
          class="admin-vote-fill team-b"
          style="width: ${votes.teamBPercent}%"
        ></div>
      </div>
    </div>

    <div class="admin-vote-summary">
      총 참여 ${votes.total}명
    </div>

    <div class="admin-result-control">
      ${
        isFinished
          ? `
            <div class="admin-winner-result">
              승리 팀
              <strong>${escapeHtml(winner)}</strong>
            </div>

            <button
              type="button"
              class="admin-reopen-button"
              data-reopen="${escapeHtml(match.id)}"
            >
              확정 취소
            </button>
          `
          : `
            <select
              class="admin-winner-select"
              data-winner="${escapeHtml(match.id)}"
            >
              <option value="">승리 팀 선택</option>

              <option value="${escapeHtml(match.teamA || "")}">
                ${escapeHtml(match.teamA || "미정")}
              </option>

              <option value="${escapeHtml(match.teamB || "")}">
                ${escapeHtml(match.teamB || "미정")}
              </option>
            </select>

            <button
              type="button"
              class="admin-confirm-button"
              data-confirm="${escapeHtml(match.id)}"
            >
              결과 확정
            </button>
          `
      }
    </div>
  `;
}


/* =========================================================
   경기 결과 처리
========================================================= */

function bindResultButtons() {
  document
    .querySelectorAll("[data-confirm]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const matchId = button.dataset.confirm;

        const select = document.querySelector(
          `[data-winner="${CSS.escape(matchId)}"]`
        );

        const winner = select?.value;

        if (!winner) {
          alert("승리 팀을 먼저 선택해주세요.");
          return;
        }

        const match = matches.find(
          (item) => item.id === matchId
        );

        if (!match) {
          alert("경기 정보를 찾지 못했습니다.");
          return;
        }

        const confirmed = confirm(
          `${winner} 팀의 승리로 확정할까요?\n\n확정하면 참가자의 적중 수와 생존 상태가 반영됩니다.`
        );

        if (!confirmed) {
          return;
        }

        button.disabled = true;
        select.disabled = true;
        button.textContent = "처리 중...";

        try {
          await confirmMatchResult(match, winner);

          alert(
            `${winner} 팀의 승리로 확정했습니다.`
          );
        } catch (error) {
          showError(error, "경기 결과 확정 실패");

          alert(
            `결과 확정에 실패했습니다.\n${error.message}`
          );

          button.disabled = false;
          select.disabled = false;
          button.textContent = "결과 확정";
        }
      });
    });

  document
    .querySelectorAll("[data-reopen]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const matchId = button.dataset.reopen;

        const confirmed = confirm(
          "결과 확정을 취소할까요?\n\n이미 반영된 적중 수와 탈락 상태는 자동으로 복구되지 않습니다."
        );

        if (!confirmed) {
          return;
        }

        button.disabled = true;
        button.textContent = "처리 중...";

        try {
          await updateDoc(
            doc(db, "matches", matchId),
            {
              status: "open",
              winner: null,
              updatedAt: serverTimestamp()
            }
          );

          alert("결과 확정을 취소했습니다.");
        } catch (error) {
          showError(error, "확정 취소 실패");

          button.disabled = false;
          button.textContent = "확정 취소";
        }
      });
    });
}

async function confirmMatchResult(match, winner) {
  /*
   resultApplied가 true이면 사용자 결과를 다시 반영하지 않고
   경기의 승리 팀 정보만 변경합니다.
  */
  if (match.resultApplied === true) {
    await updateDoc(
      doc(db, "matches", match.id),
      {
        winner,
        status: "finished",
        updatedAt: serverTimestamp()
      }
    );

    return;
  }

  const predictionQuery = query(
    collection(db, "predictions"),
    where("matchId", "==", match.id)
  );

  const predictionSnapshot =
    await getDocs(predictionQuery);

  if (predictionSnapshot.size > 450) {
    throw new Error(
      "예측 참가자가 450명을 초과하여 한 번에 처리할 수 없습니다."
    );
  }

  const batch = writeBatch(db);

  predictionSnapshot.forEach(
    (predictionDocument) => {
      const prediction =
        predictionDocument.data();

      const userId =
        getPredictionUserId(prediction);

      const selectedTeam =
        getPredictionTeam(prediction);

      if (!userId) {
        console.warn(
          "사용자 UID가 없는 예측:",
          predictionDocument.id
        );

        return;
      }

      const correct = selectedTeam === winner;

      const userReference =
        doc(db, "users", userId);

      const predictionReference =
        predictionDocument.ref;

      if (correct) {
        batch.set(
          userReference,
          {
            alive: true,
            hits: increment(1),
            correctCount: increment(1),
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      } else {
        batch.set(
          userReference,
          {
            alive: false,
            eliminatedMatchId: match.id,
            eliminatedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      }

      batch.update(
        predictionReference,
        {
          correct,
          result: correct
            ? "correct"
            : "wrong",
          checkedAt: serverTimestamp()
        }
      );
    }
  );

  batch.update(
    doc(db, "matches", match.id),
    {
      winner,
      status: "finished",
      resultApplied: true,
      finishedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
  );

  await batch.commit();
}


/* =========================================================
   실시간 Firestore 연결
========================================================= */

function startRealtimeListeners() {
  stopRealtimeListeners();

  unsubscribeMatches = onSnapshot(
    collection(db, "matches"),

    (snapshot) => {
      matches = snapshot.docs.map(
        (matchDocument) => ({
          id: matchDocument.id,
          ...matchDocument.data()
        })
      );

      renderDashboard();
    },

    (error) => {
      showError(
        error,
        "경기 정보 불러오기 실패"
      );
    }
  );

  unsubscribePredictions = onSnapshot(
    collection(db, "predictions"),

    (snapshot) => {
      predictions = snapshot.docs.map(
        (predictionDocument) => ({
          id: predictionDocument.id,
          ...predictionDocument.data()
        })
      );

      renderDashboard();
    },

    (error) => {
      showError(
        error,
        "예측 현황 불러오기 실패"
      );
    }
  );
}

function stopRealtimeListeners() {
  if (unsubscribeMatches) {
    unsubscribeMatches();
    unsubscribeMatches = null;
  }

  if (unsubscribePredictions) {
    unsubscribePredictions();
    unsubscribePredictions = null;
  }

  matches = [];
  predictions = [];
}


/* =========================================================
   스타일
========================================================= */

function addAdminStyles() {
  if (document.getElementById("admin-js-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "admin-js-style";

  style.textContent = `
    .admin-match-section {
      width: min(1180px, calc(100% - 48px));
      margin: 32px auto 80px;
    }

    .admin-section-heading {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 20px;
    }

    .admin-section-heading h2 {
      margin: 2px 0 7px;
      font-size: 28px;
      letter-spacing: -0.04em;
    }

    .admin-section-heading p {
      margin: 0;
      color: #64748b;
    }

    .admin-eyebrow {
      color: #1468ff !important;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.12em;
    }

    .admin-total {
      padding: 10px 14px;
      border-radius: 999px;
      background: #eaf1ff;
      color: #1468ff;
      font-size: 14px;
      font-weight: 700;
    }

    .admin-match-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }

    .admin-match-card {
      padding: 22px;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      background: #ffffff;
      box-shadow: 0 12px 35px rgba(15, 23, 42, 0.06);
    }

    .admin-match-card.finished {
      background: #f8fafc;
    }

    .admin-match-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      margin-bottom: 20px;
    }

    .admin-round {
      font-weight: 800;
    }

    .admin-date {
      margin-left: 7px;
      color: #64748b;
      font-size: 14px;
    }

    .admin-match-status {
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
    }

    .admin-match-status.open {
      background: #dcfce7;
      color: #166534;
    }

    .admin-match-status.finished {
      background: #dbeafe;
      color: #1d4ed8;
    }

    .admin-match-status.bye {
      background: #fef3c7;
      color: #92400e;
    }

    .admin-versus {
      display: grid;
      grid-template-columns: 1fr 45px 1fr;
      align-items: center;
      margin-bottom: 22px;
      text-align: center;
      font-size: 21px;
    }

    .admin-versus span {
      color: #94a3b8;
      font-size: 13px;
      font-weight: 800;
    }

    .admin-vote-row {
      margin-top: 15px;
    }

    .admin-vote-info {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }

    .admin-vote-info span {
      color: #64748b;
      font-size: 14px;
    }

    .admin-vote-bar {
      height: 9px;
      overflow: hidden;
      border-radius: 999px;
      background: #e2e8f0;
    }

    .admin-vote-fill {
      height: 100%;
      border-radius: inherit;
      transition: width 0.25s ease;
    }

    .admin-vote-fill.team-a {
      background: #1468ff;
    }

    .admin-vote-fill.team-b {
      background: #f97316;
    }

    .admin-vote-summary {
      margin-top: 16px;
      color: #475569;
      font-size: 14px;
    }

    .admin-result-control {
      display: flex;
      gap: 10px;
      margin-top: 20px;
      padding-top: 18px;
      border-top: 1px solid #e2e8f0;
    }

    .admin-winner-select {
      flex: 1;
      min-width: 0;
      height: 44px;
      padding: 0 12px;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      background: #ffffff;
      font: inherit;
    }

    .admin-confirm-button,
    .admin-reopen-button {
      height: 44px;
      padding: 0 17px;
      border: 0;
      border-radius: 12px;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }

    .admin-confirm-button {
      background: #121920;
      color: #ffffff;
    }

    .admin-reopen-button {
      background: #e2e8f0;
      color: #334155;
    }

    .admin-confirm-button:disabled,
    .admin-reopen-button:disabled {
      cursor: wait;
      opacity: 0.5;
    }

    .admin-winner-result {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .admin-winner-result strong {
      color: #1468ff;
    }

    .admin-bye-box {
      padding: 26px;
      border-radius: 16px;
      background: #eff6ff;
      text-align: center;
    }

    .admin-bye-box strong {
      display: block;
      margin: 8px 0;
      font-size: 25px;
    }

    .admin-bye-box p {
      margin: 0;
      color: #64748b;
    }

    .admin-bye-label {
      color: #1468ff;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.15em;
    }

    .admin-notice {
      padding: 50px 24px;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      background: #ffffff;
      color: #64748b;
      text-align: center;
    }

    @media (max-width: 900px) {
      .admin-match-grid {
        grid-template-columns: 1fr;
      }

      .admin-match-section {
        width: min(100% - 28px, 720px);
      }
    }
  `;

  document.head.appendChild(style);
}


/* =========================================================
   인증 상태 확인
========================================================= */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentAdmin = null;

    stopRealtimeListeners();
    updateLoginUI(null);
    renderDashboard();

    setStatus("관리자 로그인이 필요합니다.");

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

  updateLoginUI(user);

  setStatus(
    `${user.displayName || "관리자"}님으로 로그인했습니다.`,
    "success"
  );

  startRealtimeListeners();
});


/* =========================================================
   페이지 시작
========================================================= */

function initializeAdminPage() {
  addAdminStyles();
  bindLoginButton();
  updateLoginUI(auth.currentUser);
  renderDashboard();

  console.log("admin.js 실행 완료");
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeAdminPage
  );
} else {
  initializeAdminPage();
}
