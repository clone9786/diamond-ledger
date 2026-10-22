'use strict';
(()=>{
  const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=x=>Number.isFinite(x)?x.toFixed(1):'—',pct=x=>Number.isFinite(x)?(100*x).toFixed(1)+'%':'—';
  const et=x=>new Date(x).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const day=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
  const logo=(g,s)=>`<img src="https://a.espncdn.com/i/teamlogos/nba/500/${g[s+'_id']}.png" alt="">`;
  let slate={games:[]},quotes={},audit={},totalsInfo={},today=true,loading=false;
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
    const query=$('#nba-search').value.toLowerCase(),rows=slate.games.filter(g=>(today?day(g.start_time)===day(Date.now()):eligible(g))&&(g.away+' '+g.home).toLowerCase().includes(query));
    $('#nba-games').innerHTML=rows.map(g=>{const p=g.prediction,w=p&&(p.home_probability>=.5?'home':'away');return `<article class="game-row"><div><div class="game-state">${esc(et(g.start_time))} ET · ${esc(g.status)}</div><button class="match-open" data-nba="${g.game_pk}" aria-label="Review ${esc(g.away+' at '+g.home)}"><div class="pair">${['away','home'].map(s=>logo(g,s)+`<div class="team-name">${esc(g[s])}${TeamStats.line('nba',g[s+'_id'])}</div>`).join('')}</div></button></div><div class="cell"><div class="score-number">${p?n(p.away_runs)+' – '+n(p.home_runs):g.away_runs+' – '+g.home_runs}</div><small>${p?'Projected away / home':'Live / final score'}</small><small class="mobile-total">${p?'Total '+n(p.total):'No saved pregame forecast'}</small></div><div class="cell pick-cell">${p?'<div class="pick-name">'+esc(g[w])+'</div><div class="prob-number">'+pct(Math.max(p.home_probability,1-p.home_probability))+'</div>':'<small>Already underway</small>'}</div><div class="cell total-cell">${p?'<div class="score-number">'+n(p.total)+'</div><small>80% range '+p.total_interval80.join('–')+'</small>':''}</div><div><button class="icon" data-nba="${g.game_pk}" aria-label="Open NBA matchup">↗</button></div></article>`;}).join('')||'<p class="empty">'+(today?'No NBA games today. Turn Today off for upcoming matchups.':'No upcoming games match your search.')+'</p>';
    priceBoard.render();
    $('#nba-updated').textContent=slate.generated_at?'Updated '+et(slate.generated_at)+' ET':'';
    const a=audit.sports?.nba||{},w=a.winners||{},v=slate.validation||{};
    $('#nba-results-view').innerHTML='<h2>2026–27 results</h2><div class="results-metrics"><div><b>'+(w.games?w.wins+' / '+w.games:'0')+'</b><small>Correct / graded pregame forecasts</small></div><div><b>'+(w.games?pct(w.accuracy):'—')+'</b><small>Winner accuracy</small></div></div><p class="note">First forecasts saved before tip-off. Already-started games are never backfilled.</p><div class="table-wrap"><table><thead><tr><th>Date</th><th>Matchup</th><th>Winner</th><th>Total error</th></tr></thead><tbody>'+(a.rows||[]).map(r=>'<tr><td>'+esc(r.date)+'</td><td>'+esc(r.matchup)+'</td><td>'+(r.won?'Correct':'Miss')+'</td><td>'+n(r.total_error)+'</td></tr>').join('')+'</tbody></table></div>';
    globalThis.PickRecord?.mount('nba','#nba-results-view');
    const evaluation=totalsInfo.evaluation||{};
    $('#nba-results-view').insertAdjacentHTML('beforeend','<details><summary>Totals model comparison</summary><p class="note">Tested on '+(evaluation.evaluation_games||0)+' later games. Original model average total-score error: '+n(evaluation.baseline?.mae)+' points. Pace/efficiency challenger: '+n(evaluation.challenger?.mae)+' points. '+(totalsInfo.baseline_retained?'The original model stays active.':'The totals challenger is active.')+' These are score-forecast errors, not an over/under betting win rate.</p></details>');
    $('#nba-model').textContent='Team scoring, shooting, Elo and rest. Opening-week estimates use prior-season history; roster and injury changes are not modeled. '+(v.winner?'2025–26 chronological holdout: '+v.holdout_games+' games, '+pct(v.winner.accuracy)+' winners, '+n(v.total_mae)+' points total-score MAE. Historical validation is separate from this season’s record.':'');
  }
  function open(id){const g=slate.games.find(g=>String(g.game_pk)===String(id));if(!g)return;const p=g.prediction;
    $('#nba-title').textContent=g.away+' at '+g.home;
    $('#nba-detail').innerHTML=(p?`<section class="section"><div class="score-banner"><div>${logo(g,'away')}<b>${esc(g.away)}</b><small>${pct(1-p.home_probability)} to win</small></div><div><div class="vs">PROJECTED FINAL</div><div class="big">${n(p.away_runs)} – ${n(p.home_runs)}</div><small>${n(p.total)} points</small></div><div>${logo(g,'home')}<b>${esc(g.home)}</b><small>${pct(p.home_probability)} to win</small></div></div><p class="note">${esc(et(g.start_time))} ET${eligible(g)?'':' · Original saved pregame forecast'}</p></section>`:'<p class="note">This game started before the NBA model was launched. No pregame forecast was fabricated.</p>')+NBATotals.panel(g)+'<section class="section"><h3>Team comparison</h3>'+TeamStats.comparison('nba',g)+'</section><section class="section"><h3>DraftKings prices</h3>'+prices(g)+'</section>';
    $('#nba-room').showModal();
  }
  async function load(){
    const get=async name=>{const r=await fetch('data/'+name+'.json',{cache:'no-store'});if(!r.ok)throw Error('NBA data unavailable. Update NBA to retry.');return r.json();};
    const [s,q,a,v]=await Promise.all([get('nba'),get('odds-nba'),get('nba-forward-audit'),get('nba-totals-study'),TeamStats.load('nba')]);slate=s;quotes=q;audit=a;totalsInfo=v;render();
  }
  async function update(){if(loading)return;loading=true;$('#refresh-nba').disabled=true;try{
    if(!globalThis.LEDGER_SHARED){let r=await fetch('/api/nba/update',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw Error('NBA update unavailable');let state=await r.json();while(state.running){$('#notice').textContent=state.phase;await new Promise(r=>setTimeout(r,1000));r=await fetch('/api/nba/state',{cache:'no-store'});state=await r.json();}if(state.error)throw Error(state.error);}
    await load();$('#notice').textContent='';
  }catch(e){$('#notice').textContent=e.message;}finally{loading=false;$('#refresh-nba').disabled=false;}}
  $('#nba-games').onclick=e=>{const b=e.target.closest('[data-nba]');if(b)open(b.dataset.nba);};$('#close-nba').onclick=()=>$('#nba-room').close();
  $('#nba-search').oninput=render;$('#nba-today').onclick=()=>{today=!today;$('#nba-today').setAttribute('aria-pressed',String(today));render();};$('#refresh-nba').onclick=update;
  function view(name){for(const k of ['games','prices','results'])$('#nba-'+k+'-view').hidden=name!==k;document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===name);b.setAttribute('aria-pressed',String(b.dataset.view===name));});$('.page-heading h1').textContent='NBA / '+({games:'Matchups',prices:'Prices',results:'Results'}[name]);}
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
  if(new URLSearchParams(location.search).get('period')==='upcoming')$('#nba-today').click();
  const initial=new URLSearchParams(location.search).get('view');if(['prices','results'].includes(initial))view(initial);
  const priceBoard=SportsPrices.mount({sport:'nba',container:$('#nba-prices'),getGames:()=>slate.games,getQuotes:()=>quotes,onOpen:open});
  load().catch(e=>$('#notice').textContent=e.message);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load().catch(e=>$('#notice').textContent=e.message);});
})();
