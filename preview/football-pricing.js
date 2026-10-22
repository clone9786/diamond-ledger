'use strict';
const footballPrices=(()=>{
  const sport=IS_NFL?'nfl':'cfb';
  const key=IS_NFL?'diamond-nfl-prices-v1':'diamond-football-prices-v1',fields=['fh','fa','fo','fu','fs','fhs','fas','cfb-stake','cfb-line'];
  let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}');if(!saved||typeof saved!=='object'||Array.isArray(saved))saved={};}catch{}
  const signed=x=>(x>0?'+':'')+x;
  const id=g=>g.date+':'+g.game_pk;
  function form(g){const f=saved[id(g)];return f&&typeof f==='object'&&!Array.isArray(f)?Object.fromEntries(fields.filter(k=>typeof f[k]==='string').map(k=>[k,f[k]])):{};}
  function entries(f){const s=FootballMarkets.line(f.fs,'spread');return [['fh','moneyline','home',null],['fa','moneyline','away',null],['fo','total','over',f['cfb-line']],['fu','total','under',f['cfb-line']],['fhs','spread','home',f.fs],['fas','spread','away',s===null?null:-s]];}
  function label(g,kind,side,l){return kind==='total'?(side==='over'?'Over ':'Under ')+l:g[side]+(kind==='spread'?' '+signed(Number(l)):' ML');}
  function rows(g,p,f){return entries(f).flatMap(([field,kind,side,l])=>{const v=FootballMarkets.price(p,kind,side,l,f[field]);return v?[{...v,kind,side,line:l,label:label(g,kind,side,l),odds:f[field]}]:[];}).sort((a,b)=>b.ev-a.ev);}
  function mount(){
    const detail=$('#football-detail');
    const section=document.createElement('section');section.className='section';section.id='football-price-desk';
    section.innerHTML=`<div class="price-heading"><h3>DraftKings / price desk</h3><label class="field">Stake ($)<input id="cfb-stake" type="number" min="1" step="1" value="20"></label></div>
      <div class="worksheet"><div><h4>Point spread</h4><label class="field">${esc(game.away)} handicap<input id="away-spread" type="number" min="-100" max="100" step="0.5" placeholder="e.g. -14"></label>${field(game.away+' spread odds','fas')}<label class="field">${esc(game.home)} handicap<input id="fs" type="number" min="-100" max="100" step="0.5" placeholder="e.g. -24.5"></label>${field(game.home+' spread odds','fhs')}<div id="cfb-cover" class="explanation" aria-live="polite"></div></div>
      <div><h4>Total points</h4><div id="cfb-total-slot"></div>${field('Over odds','fo')}${field('Under odds','fu')}</div>
      <div><h4>Moneyline</h4>${field(game.away+' ML','fa')}${field(game.home+' ML','fh')}<p class="note">${esc(game.home)} wins ${pct(forecast.prediction.home_probability)}; winning and covering are different outcomes.</p></div></div>
      <div id="cfb-price-errors" role="status"></div><div id="cfb-prices"></div><p id="cfb-storage" class="note"></p><button id="cfb-clear" class="refresh">Clear entered prices</button>
      <p class="note">Estimated net return includes losses and refunded pushes. Break-even compares decided bets only. Prices stay in this browser, not a placed wager or a verified historical price record. Cover probabilities are experimental, not proven betting edges.</p>`;
    detail.append(section);
    const available=document.createElement('section');available.className='section';available.innerHTML='<h3>Available prices</h3><div id="football-matchup-prices"></div>';section.after(available);PricesUI.refreshButton(available,sport,game);
    const total=$('#cfb-line');total.value='';total.placeholder='e.g. 54.5';$('#cfb-total-slot').append(total.closest('label'));
    const f=form(game);for(const name of fields)if(f[name]!==undefined)$('#'+name).value=f[name];
    $('#away-spread').value=$('#fs').value.trim()?String(-Number($('#fs').value)):'';
    section.addEventListener('input',event=>{
      if(event.target.id==='away-spread')$('#fs').value=event.target.value.trim()?String(-Number(event.target.value)):'';
      if(event.target.id==='fs')$('#away-spread').value=event.target.value.trim()?String(-Number(event.target.value)):'';
    },true);
    section.querySelector('#cfb-clear').onclick=()=>{for(const name of fields)$('#'+name).value=name==='cfb-stake'?'20':'';$('#away-spread').value='';check();};
  }
  function check(){
    const f=PriceStore.stampLegacy(sport,game,Object.fromEntries(fields.map(name=>[name,$('#'+name).value])),saved[id(game)]||{},forecast.forecast_id||forecast.generated_at);saved[id(game)]=f;
    try{localStorage.setItem(key,JSON.stringify(saved));$('#cfb-storage').textContent='Entered prices saved on this browser. Updating forecasts recalculates comparisons; these are not locked quotes.';}catch{$('#cfb-storage').textContent='Browser storage unavailable; prices will not survive a reload.';}
    const p=forecast.prediction,spread=FootballMarkets.line(f.fs,'spread'),total=FootballMarkets.line(f['cfb-line'],'total'),errors=[];
    const margin=p.home_runs-p.away_runs,lead=margin>=0?game.home:game.away;
    const cover=spread===null?null:FootballMarkets.probability(p,'spread','home',spread);
    $('#cfb-cover').innerHTML=`<p>Projected margin: <b>${esc(lead)} by ${n(Math.abs(margin))}</b>.</p>`+(cover?`<p><b>${esc(game.away)} ${signed(-spread)}</b>: ${pct(cover.loss)} cover<br><b>${esc(game.home)} ${signed(spread)}</b>: ${pct(cover.win)} cover<br>Push: ${pct(cover.push)}</p>`:'<p>Enter either team’s signed handicap; the opposite line fills automatically. Negative means it must win by more than that many points; positive gives it a head start.</p>');
    if(f.fs.trim()&&spread===null)errors.push('Spread must be a whole or half point between -100 and +100.');
    if(f['cfb-line'].trim()&&total===null)errors.push('Total must be a whole or half point from 0 to 150.');
    const v=total===null?null:FootballMarkets.probability(p,'total','over',total);
    $('#cfb-split').textContent=v?`Over ${pct(v.win)} · Under ${pct(v.loss)} · Push ${pct(v.push)}`:'Enter a total line in the price desk.';
    $('#cfb-bars').innerHTML=Array.from({length:51},(_,i)=>{const value=(p.total_pmf[i*2]||0)+(p.total_pmf[i*2+1]||0);return `<button style="--h:${Math.min(100,value/.15*100)}%" class="${total!==null&&i*2>total?'selected':'under'}" title="${i*2}–${i*2+1} points: ${pct(value)}" aria-label="${i*2}–${i*2+1} points: ${pct(value)}"></button>`;}).join('');
    for(const [name,kind,side,l]of entries(f)){if(!f[name].trim())continue;if(!EngineMarkets.decimal(f[name]))errors.push(label(game,kind,side,l)+': enter American odds such as -110 or +150.');else if(kind!=='moneyline'&&FootballMarkets.line(l,kind)===null)errors.push((kind==='spread'?'Spread':'Total')+' odds need a valid line.');}
    const stake=Number(f['cfb-stake']);if(!f['cfb-stake'].trim()||!Number.isFinite(stake)||stake<=0||stake>1000000)errors.push('Enter a stake above $0 and no more than $1,000,000.');
    $('#cfb-price-errors').textContent=[...new Set(errors)].join(' ');
    const readiness=IS_NFL?NFLDay.readiness(game):null;
    const list=readiness&&!readiness.eligible?[]:rows(game,p,f),validStake=Number.isFinite(stake)&&stake>0&&stake<=1000000;
    $('#cfb-prices').innerHTML=list.length?`<div class="table-wrap"><table><thead><tr><th>Market</th><th>Odds</th><th>Win / cover</th><th>Push</th><th>Decided-bet chance / break-even</th><th>Est. net / $${validStake?n(stake,0):'—'}</th></tr></thead><tbody>${list.map(r=>`<tr><td>${esc(r.label)}</td><td>${esc(r.odds)}</td><td>${pct(r.win)}</td><td>${pct(r.push)}</td><td>${r.decisionWin===null?'—':pct(r.decisionWin)} / ${pct(r.breakEven)}</td><td class="${r.ev>0?'positive':'negative'}">${validStake?'$'+n(r.ev*stake,2):'—'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="note">Enter odds for any market to compare its estimated return. No sportsbook prices have been assumed.</p>';
    const decisive=p.home_probability/(1-(p.tie_probability||0)),m=EngineMarkets.moneyline(decisive,f.fh,f.fa);if(m)$('#cfb-prices').insertAdjacentHTML('beforeend',`<p class="note">Removing the margin from both entered moneylines gives ${esc(game.home)} a ${pct(m.marketHome)} market chance among decided bets. Model: ${pct(decisive)}; difference ${n(m.homeEdge*100)} percentage points.${IS_NFL?' Ties are treated as refunds; check your book rules.':''}</p>`);
    if(IS_NFL&&list.length&&validStake){$('#cfb-prices').insertAdjacentHTML('beforeend',`<div class="stress-readout"><h4>Five-point probability stress test</h4>${list.map(r=>{const s=FootballMarkets.stressPrice(p,r.kind,r.side,r.line,r.odds);return `<p>${esc(r.label)}: $${n(s.stressedEV*stake,2)} net per $${n(stake,0)} if its decided-bet chance is 5 percentage points lower.</p>`;}).join('')}<p class="note">A hypothetical sensitivity test, not a confidence bound or an injury adjustment.</p></div>`);}
    if(readiness&&!readiness.eligible)$('#cfb-prices').textContent=readiness.label+': '+readiness.reasons.join(' / ')+'. Estimated returns withheld.';
    board();
    matchup();PriceStore.shared.touch();
  }
  function candidates(games){return PricesUI.rows({sport,games,legacy:saved,eligible,propEstimate:(g,q)=>typeof NFLTouchdowns!=='undefined'?NFLTouchdowns.currentEstimate(g,q):null,price:(g,q)=>{const p=IS_NFL?shown(g).prediction:game&&g.game_pk===game.game_pk?forecast.prediction:shown(g).prediction;const v=FootballMarkets.price(p,q.kind,q.side,q.line,q.odds);return v?{...v,ev:v.ev*20}:null;}}).map(r=>{if(!IS_NFL)return r;const p=shown(r.g).prediction,s=r.kind==='touchdown'?null:FootballMarkets.stressPrice(p,r.kind,r.side,r.line,r.odds);return {...r,stress:!r.readiness?.eligible?null:r.kind==='touchdown'?(r.probability===null?null:20*(Math.max(0,r.probability-.05)*r.decimal-1)):s?s.stressedEV*20:null,review:r.readiness?.reasons.join(' / ')||'Ready for input review; not a verified edge'};});}
  function restore(r){
    if(saved[r.gameKey]){saved[r.gameKey]=PriceStore.clearLegacyForm(r,saved[r.gameKey]);if(game&&id(game)===r.gameKey)for(const field of fields){const input=$('#'+field);if(input&&saved[r.gameKey][field]!==undefined)input.value=saved[r.gameKey][field];}}
    if(r.playerId&&game&&String(game.game_pk)===String(r.game_pk)){const input=[...document.querySelectorAll('[data-td]')].find(el=>el.dataset.td===r.side+':'+r.playerId);if(input){input.value='';const result=$('#td-price-'+r.side+'-'+r.playerId);if(result)result.textContent='';}}
  }
  function openSelection(r){if(!game||game.game_pk!==r.game_pk||!$('#football-room').open)open(Number(r.game_pk));if(r.playerId){const input=[...document.querySelectorAll('[data-td]')].find(el=>el.dataset.td===r.side+':'+r.playerId);if(input){const details=input.closest('details');if(details)details.open=true;input.scrollIntoView({block:'center'});input.focus();}}}
  function matchup(){if(game&&$('#football-matchup-prices'))PricesUI.table($('#football-matchup-prices'),candidates([game]),{sport,id:sport+'-matchup',games:[game],onOpen:openSelection,onRestore:restore});}
  function board(){
    if(!data)return;const filter=$('#cfb-market-filter').value;
    const games=data.games.filter(g=>(eligible(g)||$('#cfb-closed').checked)&&(!IS_NFL||!$('#nfl-price-today').checked||g.date===data.date));
    const list=candidates(games).filter(r=>(filter==='all'||r.kind===filter)&&(!IS_NFL||$('#nfl-price-source').value!=='manual'||r.source==='manual'));
    PricesUI.table($('#football-price-list'),list,{sport,games,onOpen:openSelection,onRestore:restore});
  }
  function init(){
    const nav=$('#show-games').parentElement,b=document.createElement('button');b.id='show-prices';b.textContent='Prices';nav.insertBefore(b,$('#show-evidence'));
    const view=document.createElement('section');view.id='football-price-board';view.hidden=true;view.innerHTML='<h2>Compare entered prices</h2><div class="toolbar"><select id="cfb-market-filter" aria-label="Price market"><option value="spread">Point spreads</option><option value="all">All markets</option><option value="total">Totals</option><option value="moneyline">Moneylines</option></select><label><input type="checkbox" id="cfb-closed"> Include closed games</label></div><p class="section-note">Compare model chance, payout or estimated net return per $20, not certainty. Your entered prices may be out of date. Closed games are reference only; no live-betting model.</p><div id="football-price-list"></div>';$('#football-evidence').before(view);
    for(const [button,panel]of [['show-games','football-slate'],['show-prices','football-price-board'],['show-evidence','football-evidence']])$('#'+button).onclick=()=>{for(const name of ['football-slate','football-price-board','football-evidence'])$('#'+name).hidden=name!==panel;for(const name of ['show-games','show-prices','show-evidence'])$('#'+name).classList.toggle('active',name===button);board();};
    if(IS_NFL){view.querySelector('h2').textContent='Compare football prices';const extra=document.createElement('div');extra.className='nfl-price-filters';extra.innerHTML='<label>Price source <select id="nfl-price-source"><option value="reported">Reported DraftKings / ESPN</option><option value="manual">My entered prices</option></select></label><label><input id="nfl-price-today" type="checkbox" checked> Today only</label>';view.querySelector('.toolbar').append(extra);$('#nfl-price-source').onchange=$('#nfl-price-today').onchange=board;view.querySelector('.section-note').textContent='Sort by win/cover chance, payout or unadjusted return. None is verified value. Check QB flags and price age. ESPN retrieval time is not the book’s update time. The 5-point stress is a scenario, not a confidence interval.';}
    const sorter=document.createElement('label');sorter.className='price-sort';sorter.innerHTML='Sort by <select id="cfb-price-sort"><option value="ev">Estimated return</option><option value="probability">Win / cover probability</option><option value="payout">Payout multiplier</option></select>';view.querySelector('.toolbar').append(sorter);$('#cfb-price-sort').onchange=()=>{try{localStorage.setItem('diamond-price-sort-'+sport,JSON.stringify({key:{ev:'net',probability:'win',payout:'decimal'}[$('#cfb-price-sort').value],direction:'descending'}));}catch{}board();};
    if(IS_NFL){$('#nfl-price-source').firstElementChild.textContent='Reported + exact manual overrides';$('#cfb-market-filter').insertAdjacentHTML('beforeend','<option value="touchdown">Touchdowns (experimental)</option>');}
    PricesUI.refreshButton(view.querySelector('.toolbar'),sport);
    PriceStore.shared.subscribe(()=>{board();matchup();});PricesUI.load(sport);
    $('#cfb-market-filter').onchange=$('#cfb-closed').onchange=board;view.onclick=e=>{const b=e.target.closest('[data-game]');if(b)open(+b.dataset.game);};
  }
  return {mount,check,board,init};
})();
footballPrices.init();
