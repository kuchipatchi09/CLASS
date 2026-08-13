<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <title>챌린저컵 관리자</title>

  <link rel="stylesheet" href="./style.css">

  <style>
    .admin-page {
      max-width: 1180px;
      margin: 0 auto;
      padding: 35px 24px 70px;
    }

    .admin-heading {
      margin-bottom: 28px;
    }

    .admin-heading small {
      color: #1468ff;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.15em;
    }

    .admin-heading h1 {
      margin: 7px 0 8px;
      font-size: 40px;
      letter-spacing: -0.055em;
    }

    .admin-heading p {
      margin: 0;
      color: #77818c;
      font-size: 13px;
      line-height: 1.6;
    }

    .admin-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 380px;
      gap: 20px;
      align-items: start;
    }

    .admin-column {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .admin-panel {
      padding: 26px;
    }

    .admin-panel-title {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 20px;
    }

    .admin-panel-title small {
      color: #1468ff;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.14em;
    }

    .admin-panel-title h2 {
      margin: 4px 0 0;
      font-size: 21px;
    }

    .admin-panel-title > span {
      padding: 6px 9px;
      border-radius: 20px;
      background: #fff1f1;
      color: #d94141;
      font-size: 9px;
      font-weight: 800;
    }

    #adminMessage {
      margin-bottom: 20px;
      padding: 13px 15px;
      border-radius: 11px;
      background: #f1f3f5;
      color: #626d78;
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    #adminMessage.success {
      background: #eaf7e5;
      color: #337322;
    }

    #adminMessage.error {
      background: #fff0f0;
      color: #bd3434;
    }

    .live-stats-title {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 26px;
    }

    .live-stats-title small {
      color: #1468ff;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.14em;
    }

    .live-stats-title h2 {
      margin: 5px 0 0;
      font-size: 25px;
    }

    .live-stats-title h2 span {
      margin: 0 9px;
      color: #a4abb3;
      font-size: 13px;
    }

    .live-stats-title > strong {
      font-size: 15px;
    }

    .live-empty {
      padding: 30px 15px;
      color: #8b949e;
      font-size: 12px;
      text-align: center;
    }

    .prediction-stat {
      margin-top: 19px;
    }

    .prediction-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .prediction-label b {
      font-size: 15px;
    }

    .prediction-label span {
      color: #68727d;
      font-size: 12px;
    }

    .prediction-bar {
      height: 10px;
      overflow: hidden;
      background: #e8ebef;
      border-radius: 10px;
    }

    .prediction-bar i {
      display: block;
      width: 0;
      height: 100%;
      background: #1468ff;
      border-radius: 10px;
      transition: width 0.35s ease;
    }

    .prediction-bar.team-b i {
      background: #8b5cf6;
    }

    .live-meta {
      display: flex;
      justify-content: space-between;
      margin-top: 23px;
      padding-top: 15px;
      border-top: 1px solid #e6eaee;
      color: #8b949e;
      font-size: 10px;
    }

    .match-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .admin-match {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 125px 90px;
      gap: 10px;
      align-items: center;
      padding: 15px;
      border: 1px solid #e6eaee;
      border-radius: 14px;
      background: #ffffff;
    }

    .admin-match.open-match {
      border-color: #a8c5ff;
      background: #f6f9ff;
    }

    .admin-match.finished-match {
      opacity: 0.65;
    }

    .admin-match-info {
      min-width: 0;
    }

    .admin-match-info b {
      display: block;
      overflow: hidden;
      font-size: 14px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .admin-match-info small {
      display: block;
      margin-top: 4px;
      color: #7b8590;
      font-size: 10px;
    }

    .admin-match select {
      width: 100%;
      padding: 10px 8px;
      border: 1px solid #dfe3e8;
      border-radius: 9px;
      background: #ffffff;
      font-size: 11px;
    }

    .admin-match button {
      padding: 10px 8px;
      border: 0;
      border-radius: 9px;
      background: #1468ff;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
    }

    .admin-match button:disabled {
      background: #bdc3ca;
      cursor: not-allowed;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .summary-item {
      padding: 17px;
      border: 1px solid #e6eaee;
      border-radius: 13px;
      background: #fafbfc;
    }

    .summary-item small {
      display: block;
      color: #818b96;
      font-size: 9px;
    }

    .summary-item strong {
      display: block;
      margin-top: 5px;
      font-size: 23px;
    }

    .summary-item.blue strong {
      color: #1468ff;
    }

    .summary-item.red strong {
      color: #df4141;
    }

    .admin-note {
      margin-top: 14px;
      color: #828b95;
      font-size: 10px;
      line-height: 1.6;
    }

    @media (max-width: 900px) {
      .admin-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 650px) {
      .admin-page {
        padding: 25px 14px 50px;
      }

      .admin-heading h1 {
        font-size: 32px;
      }

      .admin-match {
        grid-template-columns: 1fr;
      }

      .live-stats-title {
        align-items: flex-start;
        flex-direction: column;
        gap: 10px;
      }
    }
  </style>
</head>

<body>
  <header class="top">
    <div class="brand">
      CHALLENGER ADMIN
      <small>RESULT CONTROL</small>
    </div>

    <a
      href="./index.html"
      style="
        margin-left: auto;
        color: #77818c;
        font-size: 11px;
        text-decoration: none;
      "
    >
      학생 화면
    </a>

    <button id="login" class="account">
      관리자 로그인
    </button>
  </header>

  <main class="admin-page">
    <section class="admin-heading">
      <small>ADMIN DASHBOARD</small>

      <h1>경기 운영 관리</h1>

      <p>
        실시간 예측 비율을 확인하고 경기 결과를 확정합니다.
        결과를 확정하면 오답자 탈락, 다음 대진 반영, 랭킹
        재계산이 자동으로 진행됩니다.
      </p>
    </section>

    <div id="adminMessage">
      관리자 로그인이 필요합니다.
    </div>

    <div class="admin-grid">
      <div class="admin-column">
        <section class="panel admin-panel">
          <div id="liveStats">
            <div class="live-empty">
              관리자 로그인 후 현재 경기의 예측 현황을
              확인할 수 있습니다.
            </div>
          </div>
        </section>

        <section class="panel admin-panel">
          <div class="admin-panel-title">
            <div>
              <small>MATCH CONTROL</small>
              <h2>경기 결과 입력</h2>
            </div>
          </div>

          <div id="matches" class="match-list">
            <div class="live-empty">
              경기 정보를 불러오려면 관리자 로그인이 필요합니다.
            </div>
          </div>
        </section>
      </div>

      <aside class="admin-column">
        <section class="panel admin-panel">
          <div class="admin-panel-title">
            <div>
              <small>TOURNAMENT STATUS</small>
              <h2>대회 현황</h2>
            </div>

            <span id="liveBadge">
              대기 중
            </span>
          </div>

          <div class="summary-grid">
            <div class="summary-item">
              <small>전체 참가자</small>
              <strong id="totalUsers">0</strong>
            </div>

            <div class="summary-item blue">
              <small>현재 생존자</small>
              <strong id="aliveUsers">0</strong>
            </div>

            <div class="summary-item red">
              <small>탈락자</small>
              <strong id="outUsers">0</strong>
            </div>

            <div class="summary-item">
              <small>현재 경기 참여</small>
              <strong id="currentEntries">0</strong>
            </div>
          </div>

          <p class="admin-note">
            학생의 실시간 선택 비율은 이 관리자 화면에서만
            표시됩니다. 경기 전 학생 화면에는 공개되지 않습니다.
          </p>
        </section>

        <section class="panel admin-panel">
          <div class="admin-panel-title">
            <div>
              <small>CAUTION</small>
              <h2>결과 확정 전 확인</h2>
            </div>
          </div>

          <p class="admin-note">
            결과 확정 버튼은 실제 데이터를 즉시 변경합니다.
            승리 팀을 잘못 선택하면 오답자 처리와 다음 대진도
            잘못 반영되므로 반드시 경기 결과를 확인한 뒤
            한 번만 누르세요.
          </p>
        </section>
      </aside>
    </div>
  </main>

  <script type="module" src="./admin.js"></script>
</body>
</html>
