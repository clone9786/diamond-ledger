'use strict';
(()=>{
  const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=x=>Number.isFinite(x)?x.toFixed(1):'—',pct=x=>Number.isFinite(x)?(100*x).toFixed(1)+'%':'—';
  const et=x=>new Date(x).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  let slate={games:[]},quotes={},record={games:[]},busy=false;
  const board=SportsPrices.mount({sport:'mlb',container:$('#mlb-prices'),getGames:()=>slate.games,getQuotes:()=>quotes,onOpen:open});
  function results(){
    const phase=$('#mlb-phase').value,date=$('#mlb-result-date').value;
    const rows=(record.games||[]).filter(g=>(!date||g.date===date)&&(phase==='all'||!!g.postseason===(phase==='playoffs'))).sort((a,b)=>b.date.localeCompare(a.date)||b.game_pk-a.game_pk);
    const wins=rows.filter(g=>g.winner_correct).length;
    $('#mlb-record').textContent=rows.length?`${wins} / ${rows.length} correct winners · ${pct(wins/rows.length)} · average total error ${n(rows.reduce((s,g)=>s+Math.abs(g.predicted_total-g.actual_total),0)/rows.length)} runs. Original pregame forecasts; regular season and postseason can be viewed separately.`:'No saved results match these filters.';
    $('#mlb-results').innerHTML='<table><thead><tr><th>Date</th><th>Matchup</th><th>Final</th><th>Original winner chance (home)</th><th>Winner</th><th>Projected / actual total</th></tr></thead><tbody>'+rows.map(g=>`<tr><td>${esc(g.date)}${g.postseason?'<small>Postseason</small>':''}</td><td>${esc(g.away+' at '+g.home)}</td><td>${g.away_score} – ${g.home_score}</td><td>${pct(g.home_probability)}</td><td>${g.winner_correct?'Correct':'Miss'}</td><td>${n(g.predicted_total)} / ${g.actual_total}</td></tr>`).join('')+'</tbody></table>';
  }
  function render(){
    $('#mlb-updated').textContent=slate.generated_at?'Updated '+et(slate.generated_at)+' ET':'';
    $('#mlb-games').innerHTML=(slate.games||[]).map(g=>{const p=g.prediction,w=p?.home_probability>=.5?'home':'away';return `<article class="game-row"><div><p class="game-state">${esc(et(g.start_time))} ET · ${esc(g.status)}${g.postseason?' · Postseason':''}</p><button class="match-open" data-mlb="${g.game_pk}"><div class="pair">${['away','home'].map(s=>`<img src="https://www.mlbstatic.com/team-logos/${g[s+'_id']}.svg" alt=""><div class="team-name">${esc(g[s])}<small class="pitcher-line">${esc(g[s+'_pitcher']||'Starter pending')}</small></div>`).join('')}</div></button></div><div class="cell"><b class="score-number">${n(p?.away_runs)} – ${n(p?.home_runs)}</b><small>Projected away / home</small></div><div class="cell pick-cell">${esc(g[w])}<b class="prob-number">${pct(p?Math.max(p.home_probability,1-p.home_probability):null)}</b></div><div class="cell total-cell"><b>${n(p?.total)}</b><small>Total runs</small></div><button class="icon" data-mlb="${g.game_pk}" aria-label="Review ${esc(g.away+' at '+g.home)}">↗</button></article>`;}).join('')||'<p class="empty">No games in the latest MLB slate. Saved forecasts remain in Results.</p>';
    board.render();results();
  }
  function open(id){
    const g=slate.games.find(g=>String(g.game_pk)===String(id));if(!g)return;const p=g.prediction;
    $('#mlb-title').textContent=g.away+' at '+g.home;
    const rows=PriceStore.fromReported('mlb',g,quotes.games?.[g.game_pk]);
    $('#mlb-detail').innerHTML='<p>'+esc(et(g.start_time))+' ET · '+esc(g.status)+'</p><h3>Projected '+n(p?.away_runs)+' – '+n(p?.home_runs)+'</h3><p>'+esc(g.away)+' '+pct(p?1-p.home_probability:null)+' · '+esc(g.home)+' '+pct(p?.home_probability)+'</p><p>Total '+n(p?.total)+' runs</p><p class="note">'+esc(g.away_pitcher||'Starter pending')+' / '+esc(g.home_pitcher||'Starter pending')+'</p>'+(g.postseason?'<p class="note">Postseason matchup using the existing regular-season model.</p>':'')+'<h3>Reported prices</h3>'+(SportsPrices.current(g,quotes.games?.[g.game_pk])?'<div class="table-wrap"><table><thead><tr><th>Selection</th><th>Odds</th><th>Model chance</th></tr></thead><tbody>'+rows.map(q=>{const v=DeskMath.price(p,q,20);return v?'<tr><td>'+esc(q.label)+'</td><td>'+q.odds+'</td><td>'+pct(v.win)+'</td></tr>':'';}).join('')+'</tbody></table></div>':'<p class="note">Current pregame prices unavailable. Refresh MLB for the latest inputs.</p>');$('#mlb-room').showModal();
  }
  async function load(){const get=async name=>{const r=await fetch('data/'+name+'.json',{cache:'no-store'});if(!r.ok)throw Error('MLB data unavailable. Refresh to retry.');return r.json();};[slate,quotes,record]=await Promise.all([get('desk'),get('odds-mlb'),get('mlb-results')]);render();}
  $('#refresh-mlb').onclick=async()=>{if(busy)return;busy=true;$('#refresh-mlb').disabled=true;try{if(!globalThis.LEDGER_SHARED){let r=await fetch('/api/desk/update',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});let s=await r.json();if(!r.ok)throw Error(s.error||'MLB update unavailable');while(s.running){$('#notice').textContent=s.phase;await new Promise(r=>setTimeout(r,1000));r=await fetch('/api/desk/state',{cache:'no-store'});s=await r.json();}if(s.error)throw Error(s.error);}await load();$('#notice').textContent='';}catch(e){$('#notice').textContent=e.message;}finally{busy=false;$('#refresh-mlb').disabled=false;}};
  function view(name){for(const key of ['games','prices','results'])$('#mlb-'+key+'-view').hidden=name!==key;document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===name);b.setAttribute('aria-pressed',String(b.dataset.view===name));});$('.page-heading h1').textContent='MLB / '+({games:'Matchups',prices:'Prices',results:'Results'}[name]);}
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
  $('#mlb-games').onclick=e=>{const b=e.target.closest('[data-mlb]');if(b)open(b.dataset.mlb);};$('#close-mlb').onclick=()=>$('#mlb-room').close();
  $('#mlb-phase').onchange=$('#mlb-result-date').onchange=results;$('#mlb-clear-date').onclick=()=>{$('#mlb-result-date').value='';results();};
  const initial=new URLSearchParams(location.search).get('view');view(['prices','results'].includes(initial)?initial:'games');load().catch(e=>$('#notice').textContent=e.message);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load().catch(e=>$('#notice').textContent=e.message);});
})();
