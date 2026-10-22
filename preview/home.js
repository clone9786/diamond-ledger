'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=1)=>Number.isFinite(n)?n.toFixed(d):'—',pct=n=>Number.isFinite(n)?Math.round(n*100)+'%':'—',odd=n=>Number.isFinite(n)?(n>0?'+':'')+n:'—';
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const time=t=>t&&Number.isFinite(Date.parse(t))?new Date(t).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET':'Unknown';
const SPORTS={nfl:{label:'NFL',path:'nfl.html',file:'nfl.json'},cfb:{label:'College Football',path:'football.html',file:'college-football.json'},nba:{label:'NBA',path:'nba.html',file:'nba.json'},nhl:{label:'NHL',path:'nhl.html',file:'nhl.json'},mlb:{label:'MLB',path:'mlb.html',file:'desk.json'}};
let sport='all',period='today',saved={},reports={},pipeline={},audit={},selected=null,errors=[],updating=false,loading=false,lastAutoAttempt=0,updateMessage='';
const gameSport=g=>g.ledger_sport||sport,gameKey=g=>gameSport(g)+':'+g.game_pk;
function confidence(g){const p=g.prediction;if(!p||!Number.isFinite(p.home_probability))return -Infinity;const away=p.away_probability??1-p.home_probability-(p.tie_probability||0);return Number.isFinite(away)&&away>=0&&p.home_probability>=0&&away<=1&&p.home_probability<=1?Math.max(p.home_probability,away):-Infinity;}
const allGames=()=>Object.entries(SPORTS).filter(([key])=>sport==='all'||key===sport).flatMap(([key])=>(saved[key]?.games||[]).map(g=>({...g,ledger_sport:key})));
const logo=(g,side)=>{const sport=gameSport(g);return sport==='mlb'?`https://www.mlbstatic.com/team-logos/${g[side+'_id']}.svg`:`https://a.espncdn.com/i/teamlogos/${sport==='nfl'?'nfl':sport==='nba'?'nba':sport==='nhl'?'nhl':'ncaa'}/500/${g[side+'_id']}.png`;};
function readiness(g){
  const sport=gameSport(g);
  if(sport==='nfl')return NFLReadiness.assess(g,{pipeline,quote:reports.nfl?.games?.[g.game_pk]});
  const age=Date.now()-Date.parse(g.generated_at||saved[sport]?.generated_at),q=reports[sport]?.games?.[g.game_pk];
  const reasons=[];
  if(g.abstract_state!=='Preview'||!Number.isFinite(Date.parse(g.start_time))||Date.parse(g.start_time)<=Date.now())reasons.push('Closed or unknown kickoff');
  if(!Number.isFinite(age)||age>86400000||age< -60000)reasons.push('Forecast missing or expired');
  if(!q?.market||q.error||q.stale||!Number.isFinite(Date.parse(q.retrieved_at))||Date.now()-Date.parse(q.retrieved_at)>7200000)reasons.push('Reported prices unavailable or expired');
  return {state:reasons.length?'unavailable':'review',label:reasons.length?'Unavailable':'Needs review',reasons:reasons.length?reasons:['Sport-specific readiness not yet audited on Home']};
}
async function get(path){if(globalThis.LEDGER_SHARED&&path==='/api/home')path='data/home-summary.json';try{const r=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}catch(e){errors.push(path+': '+e.message);return null;}}
async function load(){
  if(loading)return;loading=true;errors=[];
  try{
    await Promise.all(Object.keys(SPORTS).map(async key=>{const [slate,odds]=await Promise.all([get('data/'+SPORTS[key].file),get('data/odds-'+key+'.json'),...(key==='mlb'?[]:[TeamStats.load(key)])]);if(Array.isArray(slate?.games))saved[key]=slate;if(odds)reports[key]=odds;}));
    const [status,results]=await Promise.all([get('data/nfl-refresh.json'),get('/api/home')]);
    if(status)pipeline=status;if(results)audit=results;render();renderPerformance();
  }finally{loading=false;}
}
async function updateAll(resume=false){
  if(globalThis.LEDGER_SHARED){await load();updateMessage='Latest published data loaded.';render();return;}
  if(updating)return;updating=true;$('#reload').disabled=true;$('#reload').textContent='Updating…';
  try{
    if(!resume){const r=await fetch('/api/home/update',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Update unavailable. Check that the local server is running.');}
    let state;
    do{state=await get('/api/home/state');if(!state)throw Error('Connection interrupted. Updates continue on the server; return Home to check.');updateMessage=state.phase;render();if(state.running)await new Promise(r=>setTimeout(r,1500));}while(state.running);
    updateMessage=state.error||'NFL, college football, NBA, NHL and MLB updated.';await load();
  }catch(e){updateMessage=e.message;render();}
  finally{updating=false;$('#reload').disabled=false;$('#reload').textContent='↻ Update All';}
}
async function returnHome(){
  await load();if(updating)return;
  if(globalThis.LEDGER_SHARED)return;
  const state=await get('/api/home/state');if(state?.running){await updateAll(true);return;}
  const stale=['nfl','cfb','nba','nhl'].some(key=>!saved[key]?.generated_at||Date.now()-Date.parse(saved[key].generated_at)>900000||saved[key].date!==day());
  if(stale&&Date.now()-lastAutoAttempt>60000){lastAutoAttempt=Date.now();await updateAll();}
}
function render(){
  $('.heading h1').textContent=period==='today'?'Today’s Slate':'Upcoming Slate';
  $('#today-label').textContent=new Date().toLocaleDateString('en-US',{timeZone:'America/New_York',weekday:'long',month:'long',day:'numeric'})+' · Sports Research';
  $('#sports').innerHTML='<button data-sport="all" aria-pressed="'+(sport==='all')+'">All sports</button>'+Object.entries(SPORTS).map(([key,s])=>`<button data-sport="${key}" aria-pressed="${key===sport}">${s.label}<span>${(saved[key]?.games||[]).filter(periodMatch).length}</span></button>`).join('');
  const all=allGames(),query=$('#search').value.toLowerCase();
  const rows=all.filter(g=>(!['nba','nhl'].includes(gameSport(g))||g.prediction)&&periodMatch(g)&&(g.home+' '+g.away).toLowerCase().includes(query));
  rows.sort((a,b)=>($('#sort').value==='probability'?confidence(b)-confidence(a):$('#sort').value==='total'?(b.prediction?.total??-Infinity)-(a.prediction?.total??-Infinity):$('#sort').value==='readiness'?['ready','review','unavailable'].indexOf(readiness(a).state)-['ready','review','unavailable'].indexOf(readiness(b).state):0)||Date.parse(a.start_time)-Date.parse(b.start_time));
  $('#slate-title').textContent=(sport==='all'?'All sports':SPORTS[sport].label)+' / '+(period==='today'?'Today':'Upcoming');$('#open-desk').hidden=sport==='all';$('#open-desk').href=sport==='all'?'#slate':SPORTS[sport].path+(period==='today'?'':'?period=upcoming');
  $('.top nav a:nth-child(2)').href=sport==='all'?'#slate':SPORTS[sport].path;$('.top nav a:nth-child(3)').href=sport==='all'?'#sports':SPORTS[sport].path+'?view=prices';
  const stamps=Object.keys(SPORTS).filter(key=>sport==='all'||key===sport).map(key=>saved[key]?.generated_at).filter(Boolean).sort(),stamp=stamps[0],stale=!stamp||Date.now()-Date.parse(stamp)>86400000;
  $('#notice').textContent=(globalThis.LEDGER_SHARED&&stale?'Forecast update pending. ':'')+(updateMessage||(stale&&!globalThis.LEDGER_SHARED?'Update All to load the current slate.':errors.length?'Some feeds could not load; showing saved games.':''));
  $('#summary').innerHTML=`<div><b>${rows.length}</b><small>${period==='today'?'Games today':'Upcoming games'}</small></div><div><b>${all.filter(g=>g.abstract_state==='Preview'&&Date.parse(g.start_time)>Date.now()).length}</b><small>Games ahead</small></div><div><b>${stamp?new Date(stamp).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}):'—'}</b><small>Last update · ET</small></div>`;
  document.querySelectorAll('[data-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.period===period)));
  if(!rows.some(g=>gameKey(g)===selected))selected=rows.length?gameKey(rows[0]):null;
  $('#slate').innerHTML=rows.map(g=>{
    const sport=gameSport(g);
    const p=g.prediction||{},q=reports[sport]?.games?.[g.game_pk],m=q?.market||{},state=readiness(g);
    const buttons=(values)=>'<div class="market">'+values.map(([label,price])=>`<button data-game="${gameKey(g)}" title="Review ${esc(g.away+' at '+g.home)}"><span>${esc(label)}</span><em>${odd(price)}</em></button>`).join('')+'</div>';
    return `<article class="game ${selected===gameKey(g)?'selected':''}"><div class="game-meta"><span>${SPORTS[sport].label} · ${esc(time(g.start_time))}</span><span class="${state.state}">${state.label}</span></div><div class="game-grid"><button class="teams" data-game="${gameKey(g)}" aria-label="Review ${esc(g.away+' at '+g.home)}">${['away','home'].map(side=>`<span class="team"><img src="${logo(g,side)}" alt=""><span class="home-team-copy"><strong>${esc(g[side])}</strong>${TeamStats.line(sport,g[side+'_id'])}</span><b>${fmt(p[side+'_runs'])}</b></span>`).join('')}</button>${buttons([[odd(m.away_spread),m.away_spread_odds],[odd(m.home_spread),m.home_spread_odds]])}${buttons([['O '+fmt(m.total),m.over_odds],['U '+fmt(m.total),m.under_odds]])}${buttons([['',m.away_ml],['',m.home_ml]])}</div><div class="game-note">${esc(q?.source||'Reported market')} · ${esc(time(q?.retrieved_at))}</div></article>`;
  }).join('')||`<div class="empty">${period==='today'?'No matching games today.':'No upcoming games in the saved slate.'}${period==='today'?'<br><button id="show-upcoming">View Upcoming Games</button>':''}</div>`;
  document.querySelectorAll('#slate .game-note').forEach((note,index)=>{const g=rows[index],p=g.prediction,chance=confidence(g);if(Number.isFinite(chance)){const side=p.home_probability>=(p.away_probability??1-p.home_probability-(p.tie_probability||0))?'home':'away';note.insertAdjacentHTML('afterbegin','<strong>Model winner: '+esc(g[side])+' · '+(100*chance).toFixed(1)+'%</strong><br>');}});
  detail(rows.find(g=>gameKey(g)===selected));
  if(document.querySelector('.column-head span:nth-child(2)'))document.querySelector('.column-head span:nth-child(2)').textContent=sport==='nhl'?'Puck line':'Spread';
}
function detail(g){
  if(!g){$('#detail').innerHTML='<p class="empty">No matchup selected.</p>';return;}
  const sport=gameSport(g);
  const p=g.prediction||{},state=readiness(g),q=reports[sport]?.games?.[g.game_pk],m=q?.market||{};
  const dec=x=>Number.isFinite(x)&&Math.abs(x)>=100?x>0?1+x/100:1+100/-x:null;
  const hd=dec(m.home_ml),ad=dec(m.away_ml),market=hd&&ad?(1/hd)/(1/hd+1/ad):null;
  const model=Number.isFinite(p.home_probability)?p.home_probability/(1-(p.tie_probability||0)):null;
  const bar=(title,a,b,percent=false)=>`<div class="comparison-row"><div><b>${percent?pct(a):fmt(a)}</b><span>${title}</span><b>${percent?pct(b):fmt(b)}</b></div><div class="track"><i style="width:${Number.isFinite(a)&&Number.isFinite(b)&&a+b>0?100*a/(a+b):0}%"></i><i style="flex:${Number.isFinite(a)&&Number.isFinite(b)?1:0}"></i></div></div>`;
  $('#detail').innerHTML=`<div class="vs">${['away','home'].map(side=>`<div><img src="${logo(g,side)}" alt="">${esc(g[side])}</div>`).join('<small>AT</small>')}</div><div class="scoreline">${fmt(p.away_runs)} <span class="muted">:</span> ${fmt(p.home_runs)}</div><div class="score-caption">Projected Score · ${esc(time(g.generated_at||saved[sport]?.generated_at))}</div><h3>Team Comparison</h3>${bar(sport==='nhl'?'Projected goals':'Projected points',p.away_runs,p.home_runs)}${bar('Win probability',p.away_probability??(Number.isFinite(model)?1-model:null),p.home_probability,true)}${sport==='nhl'?NHLGoalies.panel(g):sport==='nba'?NBATotals.panel(g):''}${TeamStats.comparison(sport,g)}<details class="status-block"><summary>Input checks</summary><ul>${state.reasons.map(r=>'<li>'+esc(r)+'</li>').join('')||'<li>Input readiness is not evidence of an edge.</li>'}</ul></details><h3>Model vs. Reported Market</h3><p class="meta">Home win, excluding ties · 1 matchup<br>${esc(time(q?.retrieved_at))}${state.state==='unavailable'?' · Historical snapshot':''}</p>${bar('Model / market',model,market,true)}<p class="meta">Market probability removes two-sided moneyline margin. ${market===null?'Both prices required.':''}</p><div class="detail-links"><a href="${SPORTS[sport].path}">Full Matchup Desk ↗</a><a href="parlays.html?sport=${sport}">Parlay Lab ↗</a></div>`;
}
function canvas(id,height){const el=$(id),r=el.getBoundingClientRect(),dpr=window.devicePixelRatio||1;el.width=Math.max(1,r.width)*dpr;el.height=height*dpr;const c=el.getContext('2d');c.scale(dpr,dpr);c.font='11px Segoe UI';return {c,w:r.width,h:height};}
function graph(id,series,height,max){
  const {c,w,h}=canvas(id,height),left=30,right=w-12,top=15,bottom=h-25;
  c.fillStyle='#9ea8ac';c.strokeStyle='#303537';for(let i=0;i<=4;i++){const y=bottom-(bottom-top)*i/4;c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.stroke();c.fillText(String(Math.round(max*i/4)),0,y+3);}
  if(!series.length){c.fillText('No paired observations available',left,50);return;}
  for(let k=0;k<2;k++){c.strokeStyle=k?'#f49b83':'#6ad8cc';c.beginPath();series.forEach((s,i)=>{const x=left+(right-left)*(series.length===1?.5:i/(series.length-1)),y=bottom-(bottom-top)*s[k]/max;i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();series.forEach((s,i)=>{const x=left+(right-left)*(series.length===1?.5:i/(series.length-1)),y=bottom-(bottom-top)*s[k]/max;c.fillStyle=k?'#f49b83':'#6ad8cc';c.beginPath();c.arc(x,y,2.5,0,Math.PI*2);c.fill();});}
  c.fillStyle='#9ea8ac';c.fillText('First',left,h-6);c.fillText('Latest',right-30,h-6);
}
function renderPerformance(){
  $('#performance').hidden=sport==='mlb';
  if(sport==='mlb')return;
  const combined=sport==='all';
  document.querySelectorAll('#performance .chart-head,#performance canvas,#performance > details,#period,#cal-period,#performance > .pick-record-panel').forEach(el=>el.hidden=combined);
  if(combined){
    $('#performance > .section-title h2').textContent='Model results by sport';
    $('#metrics').innerHTML=Object.entries(SPORTS).map(([key,s])=>{const w=audit.sports?.[key]?.winners||{};return '<div><small>'+s.label+'</small><strong>'+(w.games?w.wins+' / '+w.games:'—')+'</strong><small>'+(w.games?'Correct winners':'See saved results')+'</small><a href="'+s.path+'?view=results">Results ↗</a></div>';}).join('');
    return;
  }
  globalThis.PickRecord?.mount(sport,'#performance');
  const performance=audit.sports?.[sport]||{};
  $('#performance > .section-title h2').textContent=SPORTS[sport].label+' Model Performance';
  const rows=performance.totals||[],w=performance.winners||{},bins=(performance.bins||[]).filter(b=>b.games&&Number.isFinite(b.accuracy)),t=audit.tickets||{};
  const metric=(name,value)=>`<div><small>${name}</small><strong>${value}</strong></div>`;
  const bias=rows.length?rows.reduce((s,r)=>s+r.projected-r.actual,0)/rows.length:null;
  $('#metrics').innerHTML=metric('Outright Winners',w.games?`${w.wins} / ${w.games}`:'—')+metric('Brier Score',fmt(w.brier,3))+metric('Total Bias',bias===null?'—':(bias>0?'+':'')+fmt(bias)+' pts');
  $('#period').textContent=rows.length?`${rows[0].date} – ${rows.at(-1).date} · n=${rows.length} paired games · audit ${time(performance.generated_at)}`:['nba','nhl'].includes(sport)?'No graded '+SPORTS[sport].label+' games yet. Results appear after saved pregame forecasts finish.':'No paired totals available. The saved audit may be missing.';
  $('#totals').setAttribute('aria-label','Observed and projected '+SPORTS[sport].label+' total points');
  $('#result-table').innerHTML='<table><thead><tr><th>Date / matchup</th><th>Observed</th><th>Projected</th></tr></thead><tbody>'+rows.map(r=>`<tr><td>${esc(r.date+' / '+r.matchup)}</td><td>${r.actual}</td><td>${fmt(r.projected)}</td></tr>`).join('')+'</tbody></table>';
  $('#cal-period').textContent=`${rows.length?rows[0].date+' – '+rows.at(-1).date:'Period unavailable'} · n=${bins.reduce((s,b)=>s+b.games,0)} · bins in ascending predicted probability`;
  graph('#totals',rows.map(r=>[r.actual,r.projected]),190,Math.max(80,...rows.flatMap(r=>[r.actual,r.projected])));
  graph('#calibration',bins.map(b=>[b.mean_chance*100,b.accuracy*100]),150,100);
  $('#calibration').setAttribute('aria-label','Favorite calibration. '+bins.map(b=>`n=${b.games}: predicted ${pct(b.mean_chance)}, observed ${pct(b.accuracy)}`).join('; '));
  if($('#ticket-metrics'))$('#ticket-metrics').innerHTML=metric('Recorded Tickets',String(audit.ticket_count??'—'))+metric('Stake',Number.isFinite(t.stake)?'$'+fmt(t.stake,2):'—')+metric('Net Before Credits',Number.isFinite(t.net_before_external_credits)?(t.net_before_external_credits<0?'−$':'$')+fmt(Math.abs(t.net_before_external_credits),2):'—');
}
$('#sports').onclick=e=>{const b=e.target.closest('[data-sport]');if(b){sport=b.dataset.sport;selected=null;render();renderPerformance();}};
function periodMatch(g){const date=Number.isFinite(Date.parse(g.start_time))?new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(g.start_time)):g.date;return period==='today'?date===day():g.abstract_state==='Preview'&&Date.parse(g.start_time)>Date.now();}
document.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{period=period==='today'?'upcoming':'today';render();});
$('#slate').onclick=e=>{if(e.target.id==='show-upcoming'){period='upcoming';render();return;}const b=e.target.closest('[data-game]');if(b){selected=b.dataset.game;render();}};
$('#search').oninput=render;$('#sort').onchange=render;$('#reload').onclick=()=>updateAll();
window.addEventListener('resize',renderPerformance);document.addEventListener('error',e=>{if(e.target.tagName==='IMG')e.target.style.visibility='hidden';},true);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)returnHome();});
window.addEventListener('pageshow',e=>{if(e.persisted)returnHome();});
setInterval(()=>{render();},60000);returnHome();
