<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <meta
    name="description"
    content="제5회 챌린저컵 승부 예측 관리자 페이지"
  >

  <title>챌린저컵 관리자</title>

  <link rel="stylesheet" href="./style.css">
</head>

<body class="admin-page">
  <!-- =====================================================
       상단
  ====================================================== -->

  <header class="top-header admin-header">
    <a
      href="./index.html"
      class="brand"
      aria-label="챌린저컵 메인으로 이동"
    >
      <span
        class="brand-mark"
        aria-hidden="true"
      ></span>

      <span class="brand-title">
        CHALLENGER CUP
      </span>

      <span class="brand-sport">
        ADMIN
      </span>
    </a>

    <nav class="main-nav">
      <button
        type="button"
        class="nav-button active"
        data-admin-page-target="dashboard"
      >
        운영 현황
      </button>

      <button
        type="button"
        class="nav-button"
        data-admin-page-target="matches"
      >
        경기 관리
      </button>

      <button
        type="button"
        class="nav-button"
        data-admin-page-target="participants"
      >
        참가자
      </button>

      <a
        href="./index.html"
        class="nav-button admin-home-link"
      >
        사용자 화면
      </a>
    </nav>

    <div class="header-account">
      <div class="account-text">
        <strong id="adminName">
          관리자 로그인 필요
        </strong>

        <span id="adminEmail">
          cnsh32_1218@g.cnees.kr
        </span>
      </div>

      <button
        type="button"
        id="adminLoginBtn"
        class="login-button"
      >
        관리자 로그인
      </button>
    </div>
  </header>


  <!-- =====================================================
       상태 메시지
  ====================================================== -->

  <div
    id="adminStatus"
    class="app-message admin-status-message"
    role="status"
    aria-live="polite"
  >
    관리자 로그인이 필요합니다.
  </div>


  <main class="admin-main">
    <!-- ===================================================
         관리자 로그인 전
    ==================================================== -->

    <section
      id="adminLoginNotice"
      class="admin-login-screen"
    >
      <div class="admin-login-card">
        <p class="eyebrow">
          ADMIN ACCESS
        </p>

        <h1>
          챌린저컵 운영자
        </h1>

        <p>
          등록된 관리자 학교 계정으로 로그인하면
          경기 결과와 참가자 통과 여부를 관리할 수 있습니다.
        </p>

        <button
          type="button"
          id="adminLoginMainBtn"
          class="round-submit-button"
        >
          관리자 계정으로 로그인
        </button>

        <span class="admin-login-email">
          cnsh32_1218@g.cnees.kr
        </span>
      </div>
    </section>


    <!-- ===================================================
         운영 현황
    ==================================================== -->

    <section
      id="adminDashboard"
      class="admin-page-section"
      data-admin-page="dashboard"
      hidden
    >
      <div class="content-container">
        <div class="admin-page-heading">
          <div>
            <p class="eyebrow">
              LIVE CONTROL
            </p>

            <h1>
              운영 현황
            </h1>

            <p>
              실시간 예측 현황과 현재 라운드 상태를 확인합니다.
            </p>
          </div>

          <button
            type="button"
            id="setupTournamentBtn"
            class="admin-primary-button"
          >
            대회 데이터 자동 생성
          </button>
        </div>


        <!-- 통계 -->

        <div class="admin-stat-grid">
          <article class="admin-stat-card">
            <span>
              전체 참가자
            </span>

            <strong id="totalParticipantCount">
              0
            </strong>

            <small>
              관리자 제외
            </small>
          </article>

          <article class="admin-stat-card">
            <span>
              생존 참가자
            </span>

            <strong id="aliveParticipantCount">
              0
            </strong>

            <small>
              다음 예측 가능
            </small>
          </article>

          <article class="admin-stat-card">
            <span>
              탈락 참가자
            </span>

            <strong id="eliminatedParticipantCount">
              0
            </strong>

            <small>
              현황 열람 가능
            </small>
          </article>

          <article class="admin-stat-card">
            <span>
              제출된 예측
            </span>

            <strong id="totalPredictionCount">
              0
            </strong>

            <small>
              라운드별 제출
            </small>
          </article>
        </div>


        <!-- 현재 라운드 -->

        <section class="admin-dashboard-block">
          <div class="admin-block-heading">
            <div>
              <span class="side-label">
                CURRENT ROUND
              </span>

              <h2>
                현재 라운드
              </h2>
            </div>
          </div>

          <div
            id="currentRoundAdminCard"
            class="admin-current-round"
          >
            <p class="empty-text">
              라운드 정보를 불러오는 중입니다.
            </p>
          </div>
        </section>


        <!-- 실시간 비율 -->

        <section class="admin-dashboard-block">
          <div class="admin-block-heading">
            <div>
              <span class="side-label">
                LIVE PREDICTION
              </span>

              <h2>
                실시간 예측 비율
              </h2>
            </div>

            <span class="admin-live-indicator">
              <i></i>
              LIVE
            </span>
          </div>

          <div
            id="livePredictionGrid"
            class="admin-live-grid"
          >
            <p class="empty-text">
              실시간 예측 정보를 불러오는 중입니다.
            </p>
          </div>
        </section>


        <!-- 최근 랭킹 -->

        <section class="admin-dashboard-block">
          <div class="admin-block-heading">
            <div>
              <span class="side-label">
                LEADERBOARD
              </span>

              <h2>
                적중 랭킹 TOP 5
              </h2>
            </div>
          </div>

          <div
            id="adminTopRanking"
            class="admin-ranking-list"
          >
            <p class="empty-text">
              아직 집계 전입니다.
            </p>
          </div>
        </section>
      </div>
    </section>


    <!-- ===================================================
         경기 관리
    ==================================================== -->

    <section
      id="adminMatchesPage"
      class="admin-page-section"
      data-admin-page="matches"
      hidden
    >
      <div class="content-container">
        <div class="admin-page-heading">
          <div>
            <p class="eyebrow">
              MATCH CONTROL
            </p>

            <h1>
              경기 및 라운드 관리
            </h1>

            <p>
              승리 팀을 확정한 뒤 라운드 전체 결과를
              일괄 정산합니다.
            </p>
          </div>
        </div>


        <div class="admin-important-notice">
          <strong>
            경기 결과 확정과 라운드 정산은 다릅니다
          </strong>

          <p>
            각 경기의 승리 팀을 먼저 확정하고,
            해당 라운드의 모든 경기 결과가 입력되면
            라운드 정산 버튼을 눌러주세요.
          </p>
        </div>


        <div
          id="adminRoundList"
          class="admin-round-list"
        >
          <p class="empty-text">
            경기 정보를 불러오는 중입니다.
          </p>
        </div>
      </div>
    </section>


    <!-- ===================================================
         참가자 관리
    ==================================================== -->

    <section
      id="adminParticipantsPage"
      class="admin-page-section"
      data-admin-page="participants"
      hidden
    >
      <div class="content-container">
        <div class="admin-page-heading">
          <div>
            <p class="eyebrow">
              PARTICIPANTS
            </p>

            <h1>
              참가자 현황
            </h1>

            <p>
              적중 경기 수와 현재 생존 상태를 확인합니다.
            </p>
          </div>

          <div class="admin-participant-filters">
            <button
              type="button"
              class="participant-filter active"
              data-participant-filter="all"
            >
              전체
            </button>

            <button
              type="button"
              class="participant-filter"
              data-participant-filter="alive"
            >
              생존
            </button>

            <button
              type="button"
              class="participant-filter"
              data-participant-filter="eliminated"
            >
              탈락
            </button>
          </div>
        </div>


        <div class="admin-participant-table">
          <div class="admin-participant-head">
            <span>
              순위
            </span>

            <span>
              참가자
            </span>

            <span>
              현재 라운드
            </span>

            <span>
              적중
            </span>

            <span>
              상태
            </span>
          </div>

          <div
            id="adminParticipantList"
            class="admin-participant-list"
          >
            <p class="empty-text">
              참가자 정보를 불러오는 중입니다.
            </p>
          </div>
        </div>
      </div>
    </section>
  </main>


  <!-- =====================================================
       데이터 생성 확인창
  ====================================================== -->

  <div
    id="setupModal"
    class="modal-backdrop"
    hidden
  >
    <div
      class="prediction-modal admin-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="setupModalTitle"
    >
      <button
        type="button"
        id="closeSetupModalBtn"
        class="modal-close-button"
        aria-label="창 닫기"
      >
        ×
      </button>

      <p class="eyebrow">
        TOURNAMENT SETUP
      </p>

      <h2 id="setupModalTitle">
        대회 데이터를 생성할까요?
      </h2>

      <p>
        rounds 컬렉션과 matches 컬렉션에
        전체 라운드 및 11경기를 자동으로 등록합니다.
      </p>

      <div class="setup-summary">
        <div>
          <span>
            1라운드
          </span>

          <strong>
            4경기 · 3개 이상 통과
          </strong>
        </div>

        <div>
          <span>
            2라운드
          </span>

          <strong>
            4경기 · 3개 이상 통과
          </strong>
        </div>

        <div>
          <span>
            준결승
          </span>

          <strong>
            2경기 · 1개 이상 통과
          </strong>
        </div>

        <div>
          <span>
            결승
          </span>

          <strong>
            1경기 · 적중 시 최종 통과
          </strong>
        </div>
      </div>

      <div class="admin-modal-warning">
        같은 문서 ID가 이미 존재하면 팀과 경기 일정이
        기본 설정값으로 갱신될 수 있습니다.
      </div>

      <div class="modal-buttons">
        <button
          type="button"
          id="cancelSetupBtn"
          class="modal-cancel-button"
        >
          취소
        </button>

        <button
          type="button"
          id="confirmSetupBtn"
          class="modal-confirm-button"
        >
          전체 경기 생성
        </button>
      </div>
    </div>
  </div>


  <!-- =====================================================
       경기 결과 확정창
  ====================================================== -->

  <div
    id="matchResultModal"
    class="modal-backdrop"
    hidden
  >
    <div
      class="prediction-modal admin-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="matchResultTitle"
    >
      <button
        type="button"
        id="closeMatchResultModalBtn"
        class="modal-close-button"
        aria-label="창 닫기"
      >
        ×
      </button>

      <p class="eyebrow">
        MATCH RESULT
      </p>

      <h2 id="matchResultTitle">
        경기 결과 확정
      </h2>

      <p id="matchResultDescription">
        승리 팀을 확인해주세요.
      </p>

      <div
        id="matchResultSummary"
        class="match-result-summary"
      ></div>

      <div class="modal-buttons">
        <button
          type="button"
          id="cancelMatchResultBtn"
          class="modal-cancel-button"
        >
          취소
        </button>

        <button
          type="button"
          id="confirmMatchResultBtn"
          class="modal-confirm-button"
        >
          결과 확정
        </button>
      </div>
    </div>
  </div>


  <!-- =====================================================
       라운드 정산 확인창
  ====================================================== -->

  <div
    id="roundSettlementModal"
    class="modal-backdrop"
    hidden
  >
    <div
      class="prediction-modal admin-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="roundSettlementTitle"
    >
      <button
        type="button"
        id="closeSettlementModalBtn"
        class="modal-close-button"
        aria-label="창 닫기"
      >
        ×
      </button>

      <p class="eyebrow">
        ROUND SETTLEMENT
      </p>

      <h2 id="roundSettlementTitle">
        라운드 결과 정산
      </h2>

      <p id="roundSettlementDescription">
        참가자의 적중 수와 통과 여부를 계산합니다.
      </p>

      <div
        id="settlementPreview"
        class="settlement-preview"
      ></div>

      <div class="admin-modal-warning">
        정산 후 참가자의 누적 적중 수와 생존 상태가
        변경됩니다. 같은 라운드는 한 번만 정산됩니다.
      </div>

      <div class="modal-buttons">
        <button
          type="button"
          id="cancelSettlementBtn"
          class="modal-cancel-button"
        >
          취소
        </button>

        <button
          type="button"
          id="confirmSettlementBtn"
          class="modal-confirm-button"
        >
          라운드 정산 실행
        </button>
      </div>
    </div>
  </div>


  <footer class="site-footer">
    <p>
      제5회 챌린저컵 · 관리자 페이지
    </p>

    <a href="./index.html">
      사용자 화면으로 돌아가기
    </a>
  </footer>


  <script
    type="module"
    src="./admin.js"
  ></script>
</body>
</html>
