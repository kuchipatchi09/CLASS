import{auth,db,ADMIN}from'./firebase-config.js';import{GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged}from'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';import{collection,query,orderBy,getDocs,doc,writeBatch,serverTimestamp}from'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';const $=s=>document.querySelector(s),provider=new GoogleAuthProvider();provider.setCustomParameters({hd:'g.cnees.kr',prompt:'select_account'});let admin=false,all=[];
$('#login').onclick=async()=>auth.currentUser?signOut(auth):signInWithPopup(auth,provider).catch(e=>$('#msg').textContent=e.message);onAuthStateChanged(auth,async u=>{admin=u?.email?.toLowerCase()===ADMIN;$('#login').textContent=u?'로그아웃':'관리자 로그인';if(u&&!admin){await signOut(auth);alert('관리자 계정이 아닙니다.')}if(admin){$('#msg').textContent='관리자 인증 완료';load()}});
async function load(){const s=await getDocs(query(collection(db,'matches'),orderBy('matchNo')));all=s.docs.map(d=>({id:d.id,...d.data()}));$('#matches').innerHTML=all.map(m=>`<article class="admin-match"><div><b>${m.matchNo}. ${m.teamA} vs ${m.teamB}</b><small style="display:block;color:#7b8590">${m.round} · ${m.status}${m.winner?' · '+m.winner+' 승':''}</small></div><select id="w-${m.id}"><option value="">승자 선택</option><option>${m.teamA}</option><option>${m.teamB}</option></select><button data-id="${m.id}" ${m.winner?'disabled':''}>결과 확정</button></article>`).join('');document.querySelectorAll('.admin-match button').forEach(b=>b.onclick=()=>finish(b.dataset.id))}
async function finish(id){if(!admin)return;const m=all.find(x=>x.id===id),winner=$(`#w-${id}`).value;if(!winner||!confirm(`${winner} 승리로 확정할까요?`))return;try{const [ps,us]=await Promise.all([getDocs(collection(db,'predictions')),getDocs(collection(db,'users'))]),batch=writeBatch(db),current=ps.docs.filter(x=>x.data().matchId===id);batch.update(doc(db,'matches',id),{winner,status:'finished'});current.forEach(p=>{const d=p.data(),ok=d.selectedTeam===winner;batch.update(p.ref,{correct:ok});if(!ok)batch.update(doc(db,'users',d.uid),{alive:false,eliminatedAt:serverTimestamp(),eliminatedMatchId:id})});const nextMap={1:5,2:6,3:7,4:8,5:9,6:9,7:10,8:10,9:11,10:11},nextNo=nextMap[m.matchNo];if(nextNo){const n=all.find(x=>x.matchNo===nextNo),data={};if(n.teamA===`W${m.matchNo}`)data.teamA=winner;if(n.teamB===`W${m.matchNo}`)data.teamB=winner;if(Object.keys(data).length)batch.update(doc(db,'matches',n.id),data)}const next=all.find(x=>x.matchNo===m.matchNo+1);if(next)batch.update(doc(db,'matches',next.id),{status:'open'});
const score=new Map();ps.docs.forEach(p=>{const d=p.data(),ok=d.matchId===id?d.selectedTeam===winner:d.correct===true;if(ok)score.set(d.uid,(score.get(d.uid)||0)+1)});const entries=us.docs.map(u=>{const d=u.data(),lost=current.some(p=>p.data().uid===u.id&&p.data().selectedTeam!==winner);return{uid:u.id,name:d.name||'',email:d.email||'',hits:score.get(u.id)||0,alive:lost?false:d.alive!==false}}).sort((a,b)=>b.hits-a.hits||Number(b.alive)-Number(a.alive)||a.name.localeCompare(b.name,'ko'));let last=-1,rank=0;entries.forEach((x,i)=>{if(x.hits!==last){rank=i+1;last=x.hits}x.rank=rank});batch.set(doc(db,'publicStats','leaderboard'),{entries,updatedAt:serverTimestamp()});await batch.commit();$('#msg').textContent=`${winner} 승리·랭킹 반영 완료`;load()}catch(e){$('#msg').textContent='처리 실패: '+e.message}}

import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
let stopPredictionListener = null;

function watchCurrentMatchPredictions(match) {
  if (stopPredictionListener) {
    stopPredictionListener();
  }

  if (!match) {
    return;
  }

  const predictionQuery = query(
    collection(db, "predictions"),
    where("matchId", "==", match.id)
  );

  stopPredictionListener = onSnapshot(
    predictionQuery,
    snapshot => {
      let teamACount = 0;
      let teamBCount = 0;

      snapshot.forEach(predictionDocument => {
        const prediction = predictionDocument.data();

        if (prediction.selectedTeam === match.teamA) {
          teamACount += 1;
        }

        if (prediction.selectedTeam === match.teamB) {
          teamBCount += 1;
        }
      });

      const total = teamACount + teamBCount;

      const teamAPercent =
        total === 0
          ? 0
          : Math.round(teamACount / total * 100);

      const teamBPercent =
        total === 0
          ? 0
          : 100 - teamAPercent;

      renderLivePredictionStats({
        match,
        total,
        teamACount,
        teamBCount,
        teamAPercent,
        teamBPercent
      });
    },
    error => {
      document.getElementById("liveStats").innerHTML =
        `<p>실시간 집계를 불러오지 못했습니다.</p>
         <small>${error.message}</small>`;
    }
  );
}

function renderLivePredictionStats(stats) {
  const {
    match,
    total,
    teamACount,
    teamBCount,
    teamAPercent,
    teamBPercent
  } = stats;

  document.getElementById("liveStats").innerHTML = `
    <div class="live-stats-title">
      <div>
        <small>LIVE PREDICTION</small>
        <h2>
          ${match.teamA}
          <span>VS</span>
          ${match.teamB}
        </h2>
      </div>

      <strong>${total}명 참여</strong>
    </div>

    <div class="prediction-stat">
      <div class="prediction-label">
        <b>${match.teamA}</b>
        <span>
          ${teamACount}명 · ${teamAPercent}%
        </span>
      </div>

      <div class="prediction-bar">
        <i
          style="width: ${teamAPercent}%"
        ></i>
      </div>
    </div>

    <div class="prediction-stat">
      <div class="prediction-label">
        <b>${match.teamB}</b>
        <span>
          ${teamBCount}명 · ${teamBPercent}%
        </span>
      </div>

      <div class="prediction-bar team-b">
        <i
          style="width: ${teamBPercent}%"
        ></i>
      </div>
    </div>
  `;
}
const currentMatch =
  all.find(match => match.status === "open");

watchCurrentMatchPredictions(currentMatch);
