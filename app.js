<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, viewport-fit=cover"
  >

  <title>챌린저컵 관리자</title>

  <link rel="stylesheet" href="./style.css">
</head>

<body class="admin-body">
  <header class="site-header">
    <a class="brand" href="./index.html">
      <span class="brand-mark"></span>

      <span class="brand-title">
        CHALLENGER CUP
      </span>

      <span class="brand-divider"></span>

      <span class="brand-subtitle">
        ADMIN
      </span>
    </a>

    <nav class="main-nav" aria-label="관리자 메뉴">
      <button
        type="button"
        class="nav-button active"
        data-admin-page="dashboard"
      >
        대시보드
      </button>

      <button
        type="button"
        class="nav-button"
        data-admin-page="matches"
      >
        경기 관리
      </button>

      <button
        type="button"
        class="nav-button"
        data-admin-page="participants"
      >
        참가자
      </button>

      <a class="nav-button" href="./index.html">
        사용자 화면
      </a>
    </nav>

    <div class="header-account">
      <div id="adminAccountInfo" class="account-info" hidden>
        <strong id="adminAccountName">관리자</strong>
        <span id="adminAccountEmail"></span>
      </div>

      <button
        type="button"
        id="adminLoginBtn"
        class="header-login-button"
      >
        관리자 로그인
      </button>
    </div>
  </header>

  <main class="admin-main">
    <!-- 로그인 전 화면 -->
    <section id="adminLoginScreen" class="admin-login-screen">
      <div class="admin-login-card">
        <p class="eyebrow">CHALLENGER CUP</p>

        <h1>관리자 페이지</h1>

        <p>
          경기 결과 확정, 라운드 정산, 실시간 예측 비율을
          관리할 수 있습니다.
        </p>

        <button
          type="button"
          id="adminLoginMainBtn"
          class="primary-button"
        >
          학교 계정으로 관리자 로그인
        </button>

        <p class="admin-login-notice">
          관리자 계정
          <strong>cnsh32_1218@g.cnees.kr</strong>만 접근할 수 있습니다.
        </p>
      </div>
    </section>

    <!-- 관리자 화면 -->
    <section id="adminDashboard" hidden>
      <!-- 대시보드 -->
      <section
        id="adminPageDashboard"
        class="admin-page"
        data-admin-page-panel="dashboard"
      >
        <div class="admin-page-heading">
          <div>
            <p class="eyebrow">ADMIN DASHBOARD</p>
            <h1>대회 운영 현황</h1>
            <p>
              경기 결과를 확정하고 라운드별 통과자를 정산합니다.
            </p>
          </div>

          <button
            type="button"
            id="setupTournamentBtn"
            class="secondary-button"
          >
            대회 데이터 확인
          </button>
        </div>

        <section class="admin-stat-grid">
          <article class="admin-stat-card">
            <span>전체 참가자</span>
            <strong id="adminTotalParticipants">0</strong>
          </article>

          <article class="admin-stat-card">
            <span>현재 생존자</span>
            <strong id="adminAliveParticipants">0</strong>
          </article>

          <article class="admin-stat-card">
            <span>완료된 경기</span>
            <strong id="adminCompletedMatches">0</strong>
          </article>

          <article class="admin-stat-card">
            <span>전체 예측 제출</span>
            <strong id="adminTotalPredictions">0</strong>
          </article>
        </section>

        <section class="admin-dashboard-grid">
          <div class="admin-dashboard-main">
            <article class="admin-panel">
              <div class="admin-panel-heading">
                <div>
                  <p class="eyebrow">CURRENT ROUND</p>
                  <h2>현재 라운드</h2>
                </div>
              </div>

              <div id="currentRoundAdminCard">
                현재 라운드를 불러오는 중입니다.
              </div>
            </article>

            <article class="admin-panel">
              <div class="admin-panel-heading">
                <div>
                  <p class="eyebrow">LIVE PREDICTION</p>
                  <h2>실시간 예측 비율</h2>
                </div>

                <span class="live-badge">
                  <span class="live-dot"></span>
                  LIVE
                </span>
              </div>

              <div id="livePredictionGrid" class="live-prediction-grid">
                예측 정보를 불러오는 중입니다.
              </div>
            </article>
          </div>

          <aside class="admin-dashboard-side">
            <article class="admin-panel">
              <div class="admin-panel-heading">
                <div>
                  <p class="eyebrow">LEADERBOARD</p>
                  <h2>적중 랭킹 TOP 5</h2>
                </div>
              </div>

              <div id="adminTopRanking">
                아직 집계 전입니다.
              </div>
            </article>

            <article class="admin-panel">
              <div class="admin-panel-heading">
                <div>
                  <p class="eyebrow">QUICK GUIDE</p>
                  <h2>관리 순서</h2>
                </div>
              </div>

              <ol class="admin-guide-list">
                <li>경기 종료 후 승리 팀을 확정합니다.</li>
                <li>라운드의 모든 경기 결과를 입력합니다.</li>
                <li>라운드 정산으로 통과자를 결정합니다.</li>
                <li>다음 라운드가 자동으로 열렸는지 확인합니다.</li>
              </ol>
            </article>
          </aside>
        </section>
      </section>

      <!-- 경기 관리 -->
      <section
        id="adminPageMatches"
        class="admin-page"
        data-admin-page-panel="matches"
        hidden
      >
        <div class="admin-page-heading">
          <div>
            <p class="eyebrow">MATCH CONTROL</p>
            <h1>경기 관리</h1>
            <p>
              각 경기의 승리 팀을 선택하고 결과를 확정합니다.
            </p>
          </div>
        </div>

        <div id="adminRoundList" class="admin-round-list">
          경기 정보를 불러오는 중입니다.
        </div>
      </section>

      <!-- 참가자 관리 -->
      <section
        id="adminPageParticipants"
        class="admin-page"
        data-admin-page-panel="participants"
        hidden
      >
        <div class="admin-page-heading">
          <div>
            <p class="eyebrow">PARTICIPANTS</p>
            <h1>참가자 현황</h1>
            <p>
              적중 경기 수와 라운드 통과 상태를 확인합니다.
            </p>
          </div>
        </div>

        <div class="admin-panel">
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>순위</th>
                  <th>참가자</th>
                  <th>적중</th>
                  <th>현재 라운드</th>
                  <th>상태</th>
                </tr>
              </thead>

              <tbody id="adminParticipantList">
                <tr>
                  <td colspan="5">
                    참가자 정보를 불러오는 중입니다.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  </main>

  <!-- 대회 데이터 확인 모달 -->
  <div
    id="setupModal"
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="setupModalTitle"
    hidden
  >
    <div class="modal-card">
      <div class="modal-heading">
        <div>
          <p class="eyebrow">TOURNAMENT DATA</p>
          <h2 id="setupModalTitle">대회 데이터 확인</h2>
        </div>

        <button
          type="button"
          class="modal-close"
          data-close-modal="setupModal"
          aria-label="닫기"
        >
          ×
        </button>
      </div>

      <div class="modal-content">
        <p>
          기존 경기, 예측, 참가자 데이터는 삭제하지 않습니다.
        </p>

        <p>
          이미 대회 데이터가 생성되어 있다면 다시 생성할 필요가
          없습니다.
        </p>

        <div id="setupStatus" class="admin-message-box">
          현재 Firebase 데이터를 확인할 수 있습니다.
        </div>
      </div>

      <div class="modal-actions">
        <button
          type="button"
          class="secondary-button"
          data-close-modal="setupModal"
        >
          닫기
        </button>
      </div>
    </div>
  </div>

  <!-- 경기 결과 확정 모달 -->
  <div
    id="matchResultModal"
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="matchResultTitle"
    hidden
  >
    <div class="modal-card modal-card-wide">
      <div class="modal-heading">
        <div>
          <p class="eyebrow">MATCH RESULT</p>
          <h2 id="matchResultTitle">경기 결과 확정</h2>
        </div>

        <button
          type="button"
          class="modal-close"
          data-close-modal="matchResultModal"
          aria-label="닫기"
        >
          ×
        </button>
      </div>

      <div class="modal-content">
        <p id="matchResultDescription">
          승리 팀을 확인한 뒤 결과를 확정하세요.
        </p>

        <div
          id="matchResultSummary"
          class="match-result-summary"
        ></div>

        <!-- 결승 경기에서만 표시 -->
        <section
          id="adminFinalScorePanel"
          class="admin-final-score-panel"
          hidden
        >
          <div class="admin-final-score-heading">
            <div>
              <p class="eyebrow">FINAL SET RESULT</p>
              <h3>결승 실제 세트별 점수</h3>
            </div>

            <div class="admin-final-team-heading">
              <strong id="actualFinalTeamA">TEAM A</strong>
              <span>VS</span>
              <strong id="actualFinalTeamB">TEAM B</strong>
            </div>
          </div>

          <p id="adminFinalScoreHelp" class="form-help">
            1·2세트 승리 팀이 서로 다르면 3세트 점수도 입력하세요.
          </p>

          <div class="admin-final-set-list">
            <article class="admin-final-set-card">
              <div class="admin-final-set-title">
                <strong>1세트</strong>
                <span id="actualSet1Winner">점수를 입력하세요.</span>
              </div>

              <div class="admin-final-score-inputs">
                <label>
                  <span id="actualSet1TeamALabel">TEAM A</span>
                  <input
                    type="number"
                    id="actualSet1ScoreA"
                    min="0"
                    max="99"
                    inputmode="numeric"
                    placeholder="0"
                  >
                </label>

                <span class="score-divider">:</span>

                <label>
                  <span id="actualSet1TeamBLabel">TEAM B</span>
                  <input
                    type="number"
                    id="actualSet1ScoreB"
                    min="0"
                    max="99"
                    inputmode="numeric"
                    placeholder="0"
                  >
                </label>
              </div>
            </article>

            <article class="admin-final-set-card">
              <div class="admin-final-set-title">
                <strong>2세트</strong>
                <span id="actualSet2Winner">점수를 입력하세요.</span>
              </div>

              <div class="admin-final-score-inputs">
                <label>
                  <span id="actualSet2TeamALabel">TEAM A</span>
                  <input
                    type="number"
                    id="actualSet2ScoreA"
                    min="0"
                    max="99"
                    inputmode="numeric"
                    placeholder="0"
                  >
                </label>

                <span class="score-divider">:</span>

                <label>
                  <span id="actualSet2TeamBLabel">TEAM B</span>
                  <input
                    type="number"
                    id="actualSet2ScoreB"
                    min="0"
                    max="99"
                    inputmode="numeric"
                    placeholder="0"
                  >
                </label>
              </div>
            </article>

            <article
              id="actualSet3Card"
              class="admin-final-set-card"
            >
              <div class="admin-final-set-title">
                <strong>3세트</strong>
                <span id="actualSet3Winner">
                  1·2세트 결과에 따라 입력
                </span>
              </div>

              <div class="admin-final-score-inputs">
                <label>
                  <span id="actualSet3TeamALabel">TEAM A</span>
                  <input
                    type="number"
                    id="actualSet3ScoreA"
                    min="0"
                    max="99"
                    inputmode="numeric"
                    placeholder="0"
                  >
                </label>

                <span class="score-divider">:</span>

                <label>
                  <span id="actualSet3TeamBLabel">TEAM B</span>
                  <input
                    type="number"
                    id="actualSet3ScoreB"
                    min="0"
                    max="99"
                    inputmode="numeric"
                    placeholder="0"
                  >
                </label>
              </div>
            </article>
          </div>

          <div class="admin-final-winner-box">
            실제 결승 승리 팀
            <strong id="actualFinalWinner">점수 입력 전</strong>
          </div>
        </section>

        <div id="matchResultWarning" class="admin-warning-box">
          결과 확정 후 라운드를 정산하면 참가자의 적중 수와
          통과 상태가 변경됩니다.
        </div>
      </div>

      <div class="modal-actions">
        <button
          type="button"
          id="cancelMatchResultBtn"
          class="secondary-button"
        >
          취소
        </button>

        <button
          type="button"
          id="confirmMatchResultBtn"
          class="primary-button danger-button"
        >
          경기 결과 확정
        </button>
      </div>
    </div>
  </div>

  <!-- 라운드 정산 모달 -->
  <div
    id="roundSettlementModal"
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="roundSettlementTitle"
    hidden
  >
    <div class="modal-card modal-card-wide">
      <div class="modal-heading">
        <div>
          <p class="eyebrow">ROUND SETTLEMENT</p>
          <h2 id="roundSettlementTitle">라운드 정산</h2>
        </div>

        <button
          type="button"
          class="modal-close"
          data-close-modal="roundSettlementModal"
          aria-label="닫기"
        >
          ×
        </button>
      </div>

      <div class="modal-content">
        <p id="roundSettlementDescription">
          모든 경기 결과와 참가자 예측을 비교합니다.
        </p>

        <div
          id="roundSettlementPreview"
          class="round-settlement-preview"
        >
          정산 정보를 계산하는 중입니다.
        </div>

        <div class="admin-warning-box">
          정산을 완료하면 적중 수와 통과 여부가 참가자 정보에
          저장됩니다. 결승 정산 시 세트 승자와 점수 오차도 함께
          계산됩니다.
        </div>
      </div>

      <div class="modal-actions">
        <button
          type="button"
          id="cancelRoundSettlementBtn"
          class="secondary-button"
        >
          취소
        </button>

        <button
          type="button"
          id="confirmRoundSettlementBtn"
          class="primary-button danger-button"
        >
          라운드 정산 확정
        </button>
      </div>
    </div>
  </div>

  <div
    id="adminToast"
    class="toast"
    role="status"
    aria-live="polite"
    hidden
  ></div>

  <script type="module" src="./admin.js"></script>
</body>
</html>
