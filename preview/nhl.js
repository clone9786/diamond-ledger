'use strict';
(()=>{
  const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=x=>Number.isFinite(x)?x.toFixed(1):'—',pct=x=>Number.isFinite(x)?(100*x).toFixed(1)+'%':'—';
  const et=x=>new Date(x).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const day=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
  const logo=(g,s)=>`<img src="https://a.espncdn.com/i/teamlogos/nhl/500/${g[s+'_id']}.png" alt="">`;
  let slate={games:[]},quotes={},audit={},goalieInfo={},today=true,loading=false;
  const eligible=g=>g.abstract_state==='Preview'&&Date.parse(g.start_time)>Date.now();
  function selections(g){
    const q=quotes.games?.[g.game_pk],p=g.prediction,m=q?.market;
    const age=Date.now()-Date.parse(q?.retrieved_at);
    if(!eligible(g)||!p||!m||q.error||q.stale||!Number.isFinite(age)||age< -60000||age>7200000)return [];
    return [['spread','away',m.away_spread,m.away_spread_odds],['spread','home',m.home_spread,m.home_spread_odds],['total','over',m.total,m.over_odds],['total','under',m.total,m.under_odds],['moneyline','away',null,m.away_ml],['moneyline','home',null,m.home_ml]].flatMap(([kind,side,line,odds])=>{
      const v=FootballMarkets.price(p,kind,side,line,odds,20);if(!v)return [];
      const label=kind==='total'?(side==='over'?'Over ':'Under ')+line:g[side]+(kind==='spread'?' '+(line>0?'+':'')+line:' ML');
      return [{...v,label,odds,observed:q.retrieved_at}];
    });
  }
  function prices(g){
    const rows=selections(g);
    if(!rows.length)return '<p class="note">'+esc(eligible(g)?quotes.games?.[g.game_pk]?.error||'Reported pregame prices unavailable.':'Pregame prices closed.')+'</p>';
    return '<div class="table-wrap"><table><thead><tr><th>Selection</th><th>Odds</th><th>Model</th><th>Break-even</th><th>Push</th><th>Est. net / $20</th></tr></thead><tbody>'+rows.map(r=>`<tr><td>${esc(r.label)}</td><td>${r.odds>0?'+':''}${r.odds}</td><td>${pct(r.win)}</td><td>${pct(r.breakEven)}</td><td>${pct(r.push)}</td><td>${r.net<0?'−':''}$${Math.abs(r.net).toFixed(2)}</td></tr>`).join('')+'</tbody></table></div><p class="note">DraftKings via ESPN · '+esc(et(rows[0].observed))+' ET · estimated returns use model probabilities.</p>';
  }
  function render(){
    const query=$('#nhl-search').value.toLowerCase(),rows=slate.games.filter(g=>(today?day(g.start_time)===day(Date.now()):eligible(g))&&(g.away+' '+g.home).toLowerCase().includes(query));
    $('#nhl-games').innerHTML=rows.map(g=>{const p=g.prediction,w=p&&(p.home_probability>=.5?'home':'away');return `<article class="game-row"><div><div class="game-state">${esc(et(g.start_time))} ET · ${esc(g.status)}</div><button class="match-open" data-nhl="${g.game_pk}" aria-label="Review ${esc(g.away+' at '+g.home)}"><div class="pair">${['away','home'].map(s=>logo(g,s)+`<div class="team-name">${esc(g[s])}${TeamStats.line('nhl',g[s+'_id'])}${NHLGoalies.line(g,s)}</div>`).join('')}</div></button></div><div class="cell"><div class="score-number">${p?n(p.away_runs)+' – '+n(p.home_runs):g.away_runs+' – '+g.home_runs}</div><small>${p?'Projected away / home':'Live / final score'}</small><small class="mobile-total">${p?'Total '+n(p.total):'No saved pregame forecast'}</small></div><div class="cell pick-cell">${p?'<div class="pick-name">'+esc(g[w])+'</div><div class="prob-number">'+pct(Math.max(p.home_probability,1-p.home_probability))+'</div>':'<small>Already underway</small>'}</div><div class="cell total-cell">${p?'<div class="score-number">'+n(p.total)+'</div><small>80% range '+p.total_interval80.join('–')+'</small>':''}</div><div><button class="icon" data-nhl="${g.game_pk}" aria-label="Open NHL matchup">↗</button></div></article>`;}).join('')||'<p class="empty">'+(today?'No NHL games today. Turn Today off for upcoming matchups.':'No upcoming games match your search.')+'</p>';
    priceBoard.render();
    $('#nhl-updated').textContent=slate.generated_at?'Updated '+et(slate.generated_at)+' ET':'';
    const a=audit.sports?.nhl||{},w=a.winners||{},v=slate.validation||{};
    $('#nhl-results-view').innerHTML='<h2>2026–27 results</h2><div class="results-metrics"><div><b>'+(w.games?w.wins+' / '+w.games:'0')+'</b><small>Correct / graded pregame forecasts</small></div><div><b>'+(w.games?pct(w.accuracy):'—')+'</b><small>Winner accuracy</small></div></div><p class="note">First forecasts saved before puck drop. Already-started games are never backfilled.</p><div class="table-wrap"><table><thead><tr><th>Date</th><th>Matchup</th><th>Winner</th><th>Total error</th></tr></thead><tbody>'+(a.rows||[]).map(r=>'<tr><td>'+esc(r.date)+'</td><td>'+esc(r.matchup)+'</td><td>'+(r.won?'Correct':'Miss')+'</td><td>'+n(r.total_error)+'</td></tr>').join('')+'</tbody></table></div>';
    globalThis.PickRecord?.mount('nhl','#nhl-results-view');
    const upgraded=goalieInfo.record||{},evaluation=goalieInfo.validation||{};
    $('#nhl-results-view').insertAdjacentHTML('beforeend','<details><summary>Goalie-model record & evaluation</summary><p class="note">Since the October 21 upgrade: '+(upgraded.games?upgraded.wins+' / '+upgraded.games+' winners':'No graded games yet')+'. Earlier saved forecasts above keep their original model. Evaluation: '+(evaluation.evaluation_games||0)+' games; probability and scoring errors improved slightly, while winner accuracy was slightly lower. This is an exploratory comparison on previously inspected history.</p></details>');
    $('#nhl-model').textContent='Shot volume, goalie save rates, rest and Elo. Confirmed starters are used; unconfirmed starters retain a rotation mixture. Full-game overtime and shootout decisions count. Skater injuries and shot-quality expected goals are not modeled. '+(v.winner?'Original team baseline, 2025–26 holdout: '+v.holdout_games+' games, '+pct(v.winner.accuracy)+' winners, '+n(v.total_mae)+' goals total-score MAE. Historical validation is separate from this season’s record.':'');
  }
  function open(id){const g=slate.games.find(g=>String(g.game_pk)===String(id));if(!g)return;const p=g.prediction;
    $('#nhl-title').textContent=g.away+' at '+g.home;
    $('#nhl-detail').innerHTML=(p?`<section class="section"><div class="score-banner"><div>${logo(g,'away')}<b>${esc(g.away)}</b><small>${pct(1-p.home_probability)} to win</small></div><div><div class="vs">PROJECTED FINAL</div><div class="big">${n(p.away_runs)} – ${n(p.home_runs)}</div><small>${n(p.total)} goals</small></div><div>${logo(g,'home')}<b>${esc(g.home)}</b><small>${pct(p.home_probability)} to win</small></div></div><p class="note">${esc(et(g.start_time))} ET${eligible(g)?'':' · Original saved pregame forecast'}</p></section>`:'<p class="note">This game started before the NHL model was launched. No pregame forecast was fabricated.</p>')+NHLGoalies.panel(g)+'<section class="section"><h3>Team comparison</h3>'+TeamStats.comparison('nhl',g)+'</section><section class="section"><h3>DraftKings prices</h3>'+prices(g)+'</section>';
    $('#nhl-room').showModal();
  }
  async function load(){
    const get=async name=>{const r=await fetch('data/'+name+'.json',{cache:'no-store'});if(!r.ok)throw Error('NHL data unavailable. Update NHL to retry.');return r.json();};
    const [s,q,a,v]=await Promise.all([get('nhl'),get('odds-nhl'),get('nhl-forward-audit'),get('goalies-nhl'),TeamStats.load('nhl')]);slate=s;quotes=q;audit=a;goalieInfo=v;render();
  }
  async function update(){if(loading)return;loading=true;$('#refresh-nhl').disabled=true;try{
    if(!globalThis.LEDGER_SHARED){let r=await fetch('/api/nhl/update',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw Error('NHL update unavailable');let state=await r.json();while(state.running){$('#notice').textContent=state.phase;await new Promise(r=>setTimeout(r,1000));r=await fetch('/api/nhl/state',{cache:'no-store'});state=await r.json();}if(state.error)throw Error(state.error);}
    await load();$('#notice').textContent='';
  }catch(e){$('#notice').textContent=e.message;}finally{loading=false;$('#refresh-nhl').disabled=false;}}
  $('#nhl-games').onclick=e=>{const b=e.target.closest('[data-nhl]');if(b)open(b.dataset.nhl);};$('#close-nhl').onclick=()=>$('#nhl-room').close();
  $('#nhl-search').oninput=render;$('#nhl-today').onclick=()=>{today=!today;$('#nhl-today').setAttribute('aria-pressed',String(today));render();};$('#refresh-nhl').onclick=update;
  function view(name){for(const k of ['games','prices','results'])$('#nhl-'+k+'-view').hidden=name!==k;document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===name);b.setAttribute('aria-pressed',String(b.dataset.view===name));});$('.page-heading h1').textContent='NHL / '+({games:'Matchups',prices:'Prices',results:'Results'}[name]);}
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
  if(new URLSearchParams(location.search).get('period')==='upcoming')$('#nhl-today').click();
  const initial=new URLSearchParams(location.search).get('view');if(['prices','results'].includes(initial))view(initial);
  const priceBoard=SportsPrices.mount({sport:'nhl',container:$('#nhl-prices'),getGames:()=>slate.games,getQuotes:()=>quotes,onOpen:open});
  load().catch(e=>$('#notice').textContent=e.message);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load().catch(e=>$('#notice').textContent=e.message);});
})();
