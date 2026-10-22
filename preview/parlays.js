'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=x=>Number.isFinite(x)?(100*x).toFixed(1)+'%':'Unavailable',cash=x=>Number.isFinite(x)?(x<0?'-$':'$')+Math.abs(x).toFixed(2):'Needs quote',signed=x=>(x>0?'+':'')+x;
const local=k=>{try{return JSON.parse(localStorage.getItem(k)||'{}');}catch{return {};}};
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}};
const eastern=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(t);
const stamp=t=>new Date(t).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
let candidates=[],excluded=[],disabled=new Set(),tickets=[],selected=-1,grids={},mode='different',loading=false,reloadQueued=false;
let manual=Object.values(local('diamond-ticket-v2')),quotes=local('diamond-sgp-quotes-v2');
const params=new URLSearchParams(location.search),initialSport=params.get('sport');
if(['nfl','mlb','cfb','nba','nhl','all'].includes(initialSport))$('#sport').value=initialSport;
const preferenceKey='diamond-parlay-filters-'+(initialSport||'all'),preferences=local(preferenceKey);
for(const id of ['sport','rank','legs','min-hit','min-leg','stake','market','flags','today']){const el=$('#'+id),value=preferences[id];if(value===undefined)continue;if(el.type==='checkbox')el.checked=!!value;else if(el.tagName!=='SELECT'||[...el.options].some(o=>o.value===String(value)))el.value=String(value);}
if(['different','same','mixed'].includes(preferences.mode))mode=preferences.mode;
if(['nfl','mlb','cfb','nba','nhl','all'].includes(initialSport))$('#sport').value=initialSport;
function remember(){const state={mode};for(const id of ['sport','rank','legs','min-hit','min-leg','stake','market','flags','today']){const el=$('#'+id);state[id]=el.type==='checkbox'?el.checked:el.value;}save(preferenceKey,state);}
if(params.get('embed')==='1'){
  document.body.classList.add('embedded-lab');
  const toolbar=document.createElement('div');toolbar.className='embedded-refresh';
  toolbar.style.flexWrap='wrap';toolbar.style.gap='8px';
  toolbar.append($('#reload'),$('#update-inputs'));document.querySelector('main').prepend(toolbar);
  let lastHeight=0;
  new ResizeObserver(()=>{const height=Math.ceil(document.body.getBoundingClientRect().height);if(height!==lastHeight){lastHeight=height;parent.postMessage({type:'parlay-height',height},location.origin);}}).observe(document.body);
  window.addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data?.type==='parlay-refresh')load();});
}
async function read(path,optional=false){const r=await fetch(path,{cache:'no-store'});if(!r.ok){if(optional)return {};throw Error('Saved slate unavailable');}return r.json();}
function gameQuotes(sport,g,forms,reported){
  // The shared store owns manual/report precedence; no separate parlay price copy.
  return PriceStore.gameSelections(sport,g,forms,reported);
}
async function load(){
  if(loading){reloadQueued=true;return;}loading=true;$('#reload').disabled=true;candidates=[];excluded=[];grids={};
  for(const [sport,path]of Object.entries({nfl:'data/nfl.json',cfb:'data/college-football.json',nba:'data/nba.json',nhl:'data/nhl.json',mlb:'data/desk.json'})){
    if(mode!=='mixed'&&['nfl','cfb','nba','nhl','mlb'].includes($('#sport').value)&&sport!==$('#sport').value)continue;
    try{
      const slate=await read(path),reported=await read('data/odds-'+sport+'.json',true),joint=sport==='mlb'||mode!=='same'?{}:await read('data/joint-'+sport+'.json',true);
      const pipeline=sport==='nfl'?await read('data/nfl-refresh.json',true):null;
      const props=['cfb','nba','nhl'].includes(sport)?{}:await read(sport==='mlb'?'data/home-runs.json':'data/nfl-touchdowns.json',true);
      const forms=local(sport==='mlb'?'diamond-prices':sport==='nfl'?'diamond-nfl-prices-v1':sport==='cfb'?'diamond-football-prices-v1':'diamond-'+sport+'-prices-v1');
      for(const g of slate.games){
        if(sport==='nfl'){g.pipeline=pipeline;g.reported_quote=reported.games?.[g.game_pk];const readiness=NFLReadiness.assess(g);if(readiness.state==='unavailable'){excluded.push('NFL: '+g.away+' at '+g.home+' - '+readiness.label+': '+readiness.reasons.join('; '));continue;}}
        const generated=g.generated_at||slate.generated_at,age=Date.now()-Date.parse(generated),gameKey=sport+':'+g.game_pk;
        const input=ParlayInputs.assess(g,generated);
        if(input.blocked){excluded.push(sport.toUpperCase()+': '+g.away+' at '+g.home+' — '+input.blocked);continue;}
        const p=g.prediction,j=joint.games?.[g.game_pk];if(!p)continue;
        if(sport==='nba'&&mode==='same'&&j?.marginals_verified&&j.generated_at===generated&&j.model_sha256===g.model_sha256&&j.start_time===g.start_time){const size=1+Math.max(...j.grid.flatMap(r=>r.slice(0,2)));const grid=Array.from({length:size},()=>Array(size).fill(0));for(const[h,a,v]of j.grid)grid[h][a]=v;grids[gameKey]=grid;}else if(sport==='mlb'&&p.score_grid)grids[gameKey]=p.score_grid;
        else if(j?.marginals_verified&&j.generated_at===generated&&j.model_sha256===g.model_sha256&&j.start_time===g.start_time)grids[gameKey]=j.score_grid;
        const reportedGame=reported.games?.[g.game_pk]||g.gameday;
        const selections=gameQuotes(sport,g,forms[g.date+':'+g.game_pk]||{},reportedGame);
        if(!selections.length)excluded.push(sport.toUpperCase()+': '+g.away+' at '+g.home+' — no reported or manually entered prices; update prices or enter them in the sport desk');
        for(const q of selections){
          const readiness=sport==='nfl'?NFLReadiness.selection(g,q):null;
          if(readiness?.state==='unavailable'){excluded.push('NFL: '+q.label+' - '+readiness.reasons.join('; '));continue;}
          const prop=ParlayProps.isProp(q);
          if(sport==='nfl'&&prop&&(pipeline.components?.touchdowns?.status!=='ok'||props.games?.[g.game_pk]?.forecast_at!==g.generated_at)){excluded.push('NFL: player forecast refresh failed or mismatched');continue;}
          if(!prop&&!['moneyline','total','spread','runline'].includes(q.kind))continue;
          if(q.stale){excluded.push(sport.toUpperCase()+': '+q.label+' — refresh stale price');continue;}
          try{
            const v=prop?ParlayProps.estimate(sport,g,q,props):sport==='mlb'?DeskMath.probability(p,q.kind,q.side,q.line):FootballMarkets.probability(p,q.kind,q.side,q.line);
            if(!v||!EngineMarkets.decimal(q.odds))continue;
            const flags=sport==='nfl'?[...readiness.reasons]:[...input.flags];
            const experts=Object.values(p.experts||{}).filter(Number.isFinite);
            if(sport!=='nfl'&&experts.length>1&&Math.max(...experts)-Math.min(...experts)>.1)flags.push('Models disagree');
            candidates.push({...q,...(prop?v:{}),id:q.id||[sport,g.game_pk,q.kind,q.side,q.line].join(':'),gameKey,sport,matchup:g.away+' at '+g.home,
              home:g.home,away:g.away,start:g.start_time,date:g.date,state:g.abstract_state,win:v.win,push:v.push||0,flags,forecast:generated,
              observed:q.observed||q.enteredAt||null,logo:sport==='mlb'?`https://www.mlbstatic.com/team-logos/${g[q.side==='away'?'away_id':'home_id']}.svg`:`https://a.espncdn.com/i/teamlogos/${sport==='nfl'?'nfl':sport==='nba'?'nba':sport==='nhl'?'nhl':'ncaa'}/500/${g[q.side==='away'?'away_id':'home_id']}.png`});
          }catch(e){excluded.push(sport.toUpperCase()+': '+q.label+' - '+e.message);}
        }
      }
    }catch(e){excluded.push(sport.toUpperCase()+': '+e.message);}
  }
  loading=false;$('#reload').disabled=false;$('#input-status').textContent='Saved inputs read '+stamp(new Date())+'. Update Games & Prices contacts the feeds; Reload Saved Inputs does not.';draw();
  if(reloadQueued){reloadQueued=false;load();}
}
function active(){const market=$('#market').value;return candidates.filter(l=>(mode==='mixed'||$('#sport').value==='all'||l.sport===$('#sport').value)&&(!$('#today').checked||l.date===eastern(new Date()))&&(mode==='same'?!ParlayProps.isProp(l):market==='all'||market==='props'&&ParlayProps.isProp(l)||market==='games'&&!ParlayProps.isProp(l)||market===l.kind));}
function ticketResult(legs){
  if(!$('#flags').checked&&legs.some(l=>l.flags?.length))throw Error('This ticket needs review. Include flagged inputs explicitly to inspect its experimental estimate.');
  if(mode==='same')return ParlayJoint.combine(legs,grids[legs[0]?.gameKey],quotes[ParlayJoint.signature(legs)]);
  if(mode==='mixed'&&new Set(legs.map(l=>l.sport)).size<2)throw Error('Add selections from at least two sports.');
  return ParlayMath.combine(legs);
}
function showStats(t){const stake=+$('#stake').value;return `<dl class="ticket-stats"><dt>Estimated full-hit chance</dt><dd>${pct(t.hit)}</dd><dt>Full-win payout / $${stake}</dt><dd>${t.decimal?cash(stake*t.decimal):'Enter combined odds'}</dd><dt>Estimated net / $${stake}</dt><dd>${t.ev==null?'Unavailable':cash(stake*t.ev)}</dd><dt>Chance any leg loses</dt><dd>${pct(t.anyLoss)}</dd>${t.mode==='same'?`<dt>No loss, but at least one push</dt><dd>${pct(t.pushProbability)}</dd><dt>If independent (comparison only)</dt><dd>${pct(t.independent)}</dd><dt>Joint minus independent</dt><dd>${signed((t.correlation*100).toFixed(1))} percentage points</dd>`:`<dt>Stressed full-hit chance</dt><dd>${pct(t.stressHit)}</dd><dt>Stressed net</dt><dd>${cash(stake*t.stressEV)}</dd>`}</dl>`;}
function sgpNote(t){const warning=t.legs.some(ParlayProps.isProp)?'<p class="note gold">Experimental player-prop ticket. HR/TD estimates are not calibrated against betting results. Payout and expected net assume every player participates; inactive/void settlement is not modeled. Confirm the actual ticket and rules with the book.</p>':'';return warning+(t.mode==='same'?`<p class="note">Experimental joint-score estimate. These outcomes ${t.correlation>0?'occur together more often':t.correlation<0?'occur together less often':'occur together about as often'} than multiplying their separate chances suggests. This does not prove value. ${t.pushPossible?'Pushes are possible; expected net is withheld because reduced-ticket settlement prices are unknown.':'Expected net requires your actual combined quote.'}</p>`:'<p class="note">Distinct games are assumed independent. Multiplied odds are an illustrative payout, not an accepted sportsbook ticket.</p>');}
function reviewLabel(l){return [...(l.experimental?['Experimental player estimate']:[]),...(l.flags||[]),...(l.propWarnings||[])].join(' · ');}
function winningConditions(t){return t.mode==='same'&&new Set(t.legs.map(l=>l.gameKey)).size===1?ParlayDisplay.comparison(t)+'<p class="winning-conditions"><b>Every leg wins when:</b> '+esc(ParlayDisplay.conditions(t.legs))+'.</p>':'';}
function quoteInput(t,context){return t.mode==='same'?`<div class="sgp-quote"><label class="field">Actual combined DraftKings odds<input data-sgp="${context}" inputmode="text" placeholder="e.g. +250" value="${esc(quotes[ParlayJoint.signature(t.legs)]||'')}"></label><button data-quote-save="${context}">Apply combined quote</button></div>`:'';}
function renderManual(){
  const resolved=manual.map(old=>({old,current:candidates.find(c=>c.id===old.id)}));
  const rows=resolved.map(({old,current})=>`<div class="ticket-leg"><div><b>${esc((current||old).label)}</b><small>${esc((current||old).sport.toUpperCase()+' · '+(current||old).matchup)}</small>${!current?'<small class="negative">Unavailable, closed or stale. Remove or refresh this selection.</small>':ParlayJoint.signature([old])!==ParlayJoint.signature([current])?'<small class="gold">Price or forecast changed; using current inputs.</small>':''}</div><button data-remove="${esc(old.id)}" aria-label="Remove ${esc(old.label)}">Remove</button></div>`).join('');
  let result='';
  if(manual.length>=2){try{if(resolved.some(r=>!r.current))throw Error('Some saved legs are no longer eligible.');const t=ticketResult(resolved.map(r=>r.current));result=quoteInput(t,'manual')+showStats(t)+ParlayDisplay.comparison(t)+sgpNote(t);}catch(e){result='<p class="note">'+esc(e.message)+'</p>';}}
  $('#manual-ticket').innerHTML=rows+result||'<p class="empty">Add selections from the candidate table or a suggested ticket.</p>';
  if(mode==='same'&&resolved.length>=2&&resolved.every(r=>r.current)&&!resolved.some(r=>ParlayProps.isProp(r.current)))$('#manual-ticket').insertAdjacentHTML('beforeend',winningConditions({mode,legs:resolved.map(r=>r.current)}));
}
function draw(){
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  $('#sport').disabled=mode==='mixed';
  $('#market').disabled=mode==='same';
  for(const o of $('#legs').options)o.disabled=mode==='same'&&Number(o.value)>3;
  if(mode==='same'&&+$('#legs').value>3)$('#legs').value='2';
  remember();
  $('#mode-note').textContent=mode==='same'?'Same-game suggestions use experimental final-score scenarios. Combined prices are entered separately.':mode==='mixed'?'Every suggested ticket includes at least two sports, with one selection per matchup.':'One selection per matchup. Different games are assumed independent.';
  $('#lab-error').textContent='';const stake=Number($('#stake').value);
  if(!Number.isFinite(stake)||stake<=0||stake>100000){$('#lab-error').textContent='Use a stake between $1 and $100,000.';$('#tickets').textContent='';return;}
  const pool=active(),opts={mode,count:+$('#legs').value,minHit:+$('#min-hit').value,minLeg:+$('#min-leg').value,sort:$('#rank').value,includeFlags:$('#flags').checked,grids,quotes};
  const relevant=excluded.filter(s=>mode==='mixed'||$('#sport').value==='all'||s.startsWith($('#sport').value.toUpperCase()+':'));
  $('#availability').innerHTML='<p>'+pool.length+' current priced selections match this view.</p>'+(relevant.length?'<details><summary>Unavailable games & prices</summary><ul>'+relevant.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul></details>':'');
  const result=(mode==='same'?ParlayJoint:ParlayMath).search(pool.filter(l=>!disabled.has(l.id)),opts);tickets=result.results;selected=-1;
  $('#lab-summary').innerHTML=`<div><small>Priced selections</small><b>${pool.length}</b></div><div><small>Search pool</small><b>${result.pool}</b></div><div><small>Qualifying combinations</small><b>${result.accepted}</b></div><div><small>Search scope</small><b>${result.truncated?'Bounded subset':'Full filtered pool'}</b></div>`;
  $('#tickets').innerHTML=tickets.length?`<div class="table-wrap"><table class="ticket-table"><thead><tr><th>Ticket</th><th>Full-hit chance</th><th>Full-win payout</th><th>Est. net</th><th>Stressed net</th></tr></thead><tbody>${tickets.map((t,i)=>`<tr><td><button data-ticket="${i}" class="match-open"><b>${i+1}</b> ${t.legs.length} legs <small>${esc([...new Set(t.legs.map(l=>l.sport.toUpperCase()))].join(' + '))} · ${t.american==null?'Needs combined quote':signed(Math.round(t.american))}</small></button></td><td><b>${pct(t.hit)}</b><div class="prob-track"><i style="width:${100*t.hit}%"></i></div></td><td>${t.decimal?cash(stake*t.decimal):'Needs quote'}</td><td>${t.ev==null?'Unavailable':cash(stake*t.ev)}</td><td>${t.stressEV==null?'Unavailable':cash(stake*t.stressEV)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">No tickets meet these limits. '+(mode==='mixed'?'At least two sports need eligible prices. ':mode==='same'?'Matching joint scenarios are required; unpriced tickets appear only under hit-chance ranking. ':'')+'Check date, price availability and review flags.</p>';
  $('#ticket-detail').innerHTML='<p class="empty">Choose a ticket from the shortlist.</p>';
  $('#candidate-list').innerHTML=`<table><thead><tr><th>Search</th><th>Your ticket</th><th>Selection</th><th>Odds</th><th>Model chance</th><th>Input review</th></tr></thead><tbody>${pool.map(l=>`<tr><td><input type="checkbox" data-candidate="${esc(l.id)}" aria-label="Search with ${esc(l.label)}" ${disabled.has(l.id)?'':'checked'}></td><td><button data-add="${esc(l.id)}" ${manual.some(m=>m.id===l.id)?'disabled':''}>Add</button></td><td>${esc(l.label)}<small>${esc(l.sport.toUpperCase()+' · '+l.matchup)}<br>${esc(stamp(l.start))}</small></td><td>${signed(l.odds)}</td><td>${pct(l.win)}</td><td>${esc(reviewLabel(l)||'No automatic flag')}<small>${esc(l.source||'manual')} · ${l.observed?esc(stamp(l.observed)):'Price time unknown'}</small>${mode==='same'&&!grids[l.gameKey]?'<small class="gold">Refresh forecast for joint scenarios</small>':''}</td></tr>`).join('')}</tbody></table><p class="note">${excluded.map(esc).join('<br>')||'No additional exclusions.'}</p>`;
  document.querySelectorAll('[data-ticket]').forEach(b=>{const t=tickets[+b.dataset.ticket],list=document.createElement('ul');list.className='shortlist-legs';for(const l of t.legs){const item=document.createElement('li');item.textContent=l.label+(l.kind==='total'?' / '+l.matchup:'');list.append(item);}b.append(list);const overlap=ParlayDisplay.overlap(t,tickets);if(overlap){const note=document.createElement('small');note.className='overlap-note';note.textContent='Shares games with '+overlap+' other shortlisted tickets';b.append(note);}});
  if(!tickets.length)$('#tickets').textContent=ParlayDisplay.emptyReason(pool.filter(l=>!disabled.has(l.id)),opts);
  $('#search-scope').textContent=(result.visited??result.evaluated).toLocaleString()+' search steps; '+result.evaluated.toLocaleString()+' complete combinations checked. '+(result.truncated?'Bounded shortlist, not a global optimum.':'Filtered search complete.');
  renderManual();if(tickets.length)inspect(0);else $('#tradeoff-map').hidden=true;
}
function inspect(i){const t=tickets[i];if(!t)return;selected=i;
  $('#ticket-detail').innerHTML=`<div class="ticket-head"><span>${t.mode==='same'?'EXPERIMENTAL SAME GAME':'HYPOTHETICAL'} / ${t.legs.length} LEGS</span><b>${pct(t.hit)}</b></div>${t.legs.map(l=>`<div class="ticket-leg">${l.logo?`<img src="${esc(l.logo)}" alt="" loading="lazy">`:''}<div><b>${esc(l.label)}</b><small>${esc(l.sport.toUpperCase()+' · '+l.matchup)}</small><small>${esc(stamp(l.start))}</small><small class="gold">${esc(reviewLabel(l))}</small></div><strong>${signed(l.odds)}<small>${pct(l.win)}</small></strong></div>`).join('')}<button id="use-ticket">Use as my ticket</button>${quoteInput(t,'selected')}${showStats(t)}${sgpNote(t)}`;
  $('#ticket-detail').insertAdjacentHTML('beforeend',winningConditions(t));
  document.querySelectorAll('[data-ticket]').forEach(b=>b.closest('tr').classList.toggle('ticket-selected',+b.dataset.ticket===i));plot();
}
let dots=[];
function plot(){
  const priced=tickets.map((t,i)=>({t,i})).filter(x=>x.t.decimal);$('#tradeoff-map').hidden=!priced.length;if(!priced.length)return;
  const canvas=$('#tradeoff'),w=canvas.clientWidth,h=190,dpr=window.devicePixelRatio||1;if(!w)return;
  canvas.width=w*dpr;canvas.height=h*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);c.clearRect(0,0,w,h);
  const stake=+$('#stake').value,max=Math.max(...priced.map(x=>x.t.decimal*stake))*1.1,left=45,right=w-25,top=15,bottom=h-35,skin=getComputedStyle(document.documentElement);
  c.font='11px Arial';c.fillStyle=skin.getPropertyValue('--muted');c.strokeStyle=skin.getPropertyValue('--line');
  for(const v of [0,.25,.5,.75,1]){const y=bottom-v*(bottom-top);c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.stroke();c.fillText(pct(v),0,y+4);const x=left+v*(right-left);c.fillText(cash(max*v),Math.min(w-60,x),h-10);}
  dots=priced.map(({t,i})=>({x:left+t.decimal*stake/max*(right-left),y:bottom-t.hit*(bottom-top),i}));
  for(const dot of dots){c.beginPath();c.arc(dot.x,dot.y,dot.i===selected?7:4,0,Math.PI*2);c.fillStyle=skin.getPropertyValue(dot.i===selected?'--text':tickets[dot.i].stressEV>0?'--accent':'--gold');c.fill();}
}
$('#tradeoff').onclick=e=>{const r=e.currentTarget.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,d=dots.reduce((best,d)=>Math.hypot(d.x-x,d.y-y)<Math.hypot(best.x-x,best.y-y)?d:best,{x:Infinity,y:Infinity});if(d.i!==undefined&&Math.hypot(d.x-x,d.y-y)<20)inspect(d.i);};
window.addEventListener('resize',plot);
document.querySelectorAll('.lab-controls select,.lab-controls input,.lab-toggles input').forEach(el=>el.addEventListener('change',el.id==='sport'?load:draw));
$('#market').addEventListener('change',()=>{if(['props','hr','touchdown'].includes($('#market').value)){$('#min-leg').value='0';$('#min-hit').value='0';}draw();});
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));load();});
$('#reload').onclick=load;$('#tickets').onclick=e=>{const b=e.target.closest('[data-ticket]');if(b)inspect(+b.dataset.ticket);};
$('#update-inputs').onclick=async()=>{
  if(globalThis.LEDGER_SHARED){await load();$('#refresh-status').textContent='Latest published games and prices loaded.';return;}
  const button=$('#update-inputs');button.disabled=true;
  const sports=mode==='mixed'||$('#sport').value==='all'?['nfl','cfb','nba','nhl']:[$('#sport').value];
  try{const failures=await ParlayInputs.refresh(sports,{progress:s=>$('#refresh-status').textContent=s});await load();$('#refresh-status').textContent=failures.length?'Update incomplete. '+failures.join(' | '):'Forecast and price refresh finished. Availability and exclusions are shown above.';}
  catch(e){$('#refresh-status').textContent=e.message;}
  finally{button.disabled=false;}
};
$('#candidate-list').onchange=e=>{const id=e.target.dataset.candidate;if(id){e.target.checked?disabled.delete(id):disabled.add(id);draw();}};
$('#candidate-list').onclick=e=>{const b=e.target.closest('[data-add]');if(!b)return;const limit=mode==='same'?3:11;if(manual.length>=limit){$('#lab-error').textContent='This mode supports up to '+limit+' legs.';return;}const l=candidates.find(l=>l.id===b.dataset.add);if(l&&!manual.some(x=>x.id===l.id)){manual.push(l);save('diamond-ticket-v2',manual);draw();}};
$('#manual-ticket').onclick=e=>{const b=e.target.closest('[data-remove]');if(b){manual=manual.filter(l=>l.id!==b.dataset.remove);save('diamond-ticket-v2',manual);draw();}};
$('#clear-ticket').onclick=()=>{manual=[];save('diamond-ticket-v2',manual);draw();};
$('#ticket-detail').onclick=e=>{if(e.target.id==='use-ticket'&&tickets[selected]){manual=tickets[selected].legs.map(l=>({...l}));save('diamond-ticket-v2',manual);draw();}};
document.addEventListener('click',e=>{const b=e.target.closest('[data-quote-save]');if(!b)return;const input=document.querySelector('[data-sgp="'+b.dataset.quoteSave+'"]'),legs=b.dataset.quoteSave==='selected'?tickets[selected]?.legs:manual.map(l=>candidates.find(c=>c.id===l.id));if(!legs||legs.some(l=>!l))return;const value=input.value.trim(),key=ParlayJoint.signature(legs);if(value&&!EngineMarkets.decimal(value)){input.setCustomValidity('Use valid American odds, such as +250.');input.reportValidity();return;}input.setCustomValidity('');if(value)quotes[key]=Number(value);else delete quotes[key];save('diamond-sgp-quotes-v2',quotes);draw();});
window.addEventListener('storage',e=>{if(e.key!=='diamond-ticket-v2'&&e.key!=='diamond-sgp-quotes-v2')load();});
window.addEventListener('prices-changed',load);
document.addEventListener('error',e=>{if(e.target.tagName==='IMG')e.target.style.visibility='hidden';},true);
setInterval(()=>{load();},60000);
load();
