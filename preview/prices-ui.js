(function(root){
  'use strict';
  const P=root.PriceStore,store=P.shared,reports={},errors={};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=x=>x?new Date(x).toLocaleString():'Unavailable',pct=x=>Number.isFinite(x)?(x*100).toFixed(1)+'%':'Unavailable',cash=x=>Number.isFinite(x)?(x<0?'-$':'$')+Math.abs(x).toFixed(2):'Unavailable';
  function noticesHTML(notices){const items=notices.map(s=>'<p role="status">'+esc(s)+'</p>').join('');return notices.length>1?'<details class="odds-warnings"><summary>Reported odds need attention ('+notices.length+')</summary>'+items+'</details>':items;}
  function warnings(sport,games){
    const ids=games?new Set(games.map(g=>String(g.game_pk))):null;
    return Object.entries(reports[sport]?.games||{}).filter(([id,e])=>(!ids||ids.has(id))&&(e.error||e.stale)).map(([id,e])=>{
      const g=games?.find(g=>String(g.game_pk)===id),label=g?g.away+' at '+g.home:'Game '+id;
      return label+': '+[e.stale?'Reported prices stale':'',e.error].filter(Boolean).join(' / ')+'; retrieved '+date(e.retrieved_at);
    });
  }
  async function load(sport){try{const r=await fetch('data/odds-'+sport+'.json',{cache:'no-store'});if(!r.ok)throw Error('Reported prices unavailable');reports[sport]=await r.json();delete errors[sport];}catch(e){errors[sport]=e.message;if(sport==='nfl')delete reports[sport];}store.touch();}
  function refreshButton(parent,sport,g){
    if(parent.querySelector('[data-refresh-odds]'))return;
    const b=document.createElement('button'),status=document.createElement('span');b.dataset.refreshOdds='';b.textContent=g?'Refresh matchup odds':'Refresh slate odds';b.className='refresh';status.setAttribute('role','status');parent.append(b,status);
    b.onclick=async()=>{if(globalThis.LEDGER_SHARED){await load(sport);status.textContent='Latest published prices loaded.';return;}b.disabled=true;status.textContent='Refreshing odds...';try{const r=await fetch('/api/odds/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sport,...(g?{game_pk:g.game_pk}:{})})});let body={};try{body=await r.json();}catch{}if(!r.ok)throw Error(body.error||'Odds refresh failed');await load(sport);const notices=warnings(sport,g?[g]:undefined);status.textContent=errors[sport]||(notices.length?`Refresh finished; ${notices.length} cached matchup(s) have stale or unavailable odds. See source details. Forecast unchanged.`:'Odds refreshed. Forecast unchanged.');}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};
  }
  // propEstimate returns CURRENT {probability,forecast}, or null. Saved probability is provenance only.
  function rows({sport,games,legacy,price,eligible,propEstimate}){
    if(!games.length)return [];
    return store.list({sport,games,legacy,reported:reports[sport]||{}}).map(saved=>{
      const g=games.find(g=>P.gameKey(g)===saved.gameKey),prop=['hr','touchdown'].includes(saved.kind);let r={...saved},v=null;
      if(prop){let current=null;try{current=propEstimate?.(g,saved);}catch{}const p=current?.probability;r={...r,savedForecast:r.forecast,forecast:current?.forecast??null,probability:Number.isFinite(p)&&p>=0&&p<=1?p:null};}
      try{v=prop?(r.probability===null?null:{win:r.probability,push:0,ev:20*(r.probability*P.decimal(r.odds)-1)}):price(g,r);}catch{}
      const decimal=P.decimal(r.odds);
      const readiness=sport==='nfl'&&root.NFLReadiness?root.NFLReadiness.selection(g,r,{quote:reports.nfl?.games?.[g?.game_pk]}):null;
      return {...r,g,readiness,forecast:prop?r.forecast:r.forecast??g?.forecast_id??g?.generated_at??null,matchup:g?g.away+' at '+g.home:r.gameKey,win:v?.win??null,push:v?.push??null,net:readiness&&!readiness.eligible?null:v?.ev??null,decimal,breakEven:1/decimal,payout:20*decimal,state:readiness?.label??((g?.postseason?'Experimental postseason / ':prop?'Experimental / ':'')+(g&&eligible(g)?'Pregame':'Closed')),provenance:r.source+(r.stale?' / stale':'')+(r.error?' / '+r.error:''),timestamp:r.enteredAt||r.observed};
    });
  }
  function table(container,list,{sport,id=sport,onOpen,onRestore,games,sort:initialSort,onSort,compact=false}={}){
    const key='diamond-price-sort-'+id;let sort={key:'net',direction:'descending'};try{const value=JSON.parse(localStorage.getItem(key));if(value&&typeof value.key==='string'&&['ascending','descending'].includes(value.direction))sort=value;}catch{}
    if(initialSort)sort={...initialSort};
    const columns=[['matchup','Matchup'],['label','Selection'],['odds','Odds'],['win','Model win / cover'],['breakEven','Break-even'],['push','Push'],['decimal','Payout multiplier'],['payout','Payout / $20 (incl. stake)'],['net','Est. net / $20'],['state','State'],['provenance','Source'],['timestamp','Observed / entered']];
    if(sport==='nfl')columns.push(['stress','5-point stress / $20'],['review','Review']);
    function cell(k,r,i){
      if(k==='matchup'||k==='label')return `<button data-price-open="${i}">${compact&&k==='label'?'<small class="price-mobile-matchup">'+esc(r.matchup)+(r.g?.start_time?' · '+esc(date(r.g.start_time)):'')+'</small>':''}${esc(r[k])}${compact&&k==='matchup'&&r.g?.start_time?'<small>'+esc(date(r.g.start_time))+'</small>':''}</button>`;
      if(k==='win')return `<span class="price-chance">${pct(r.win)}</span>${Number.isFinite(r.win)?`<span class="price-meter" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,r.win*100))}%"></i></span>`:''}${['hr','touchdown'].includes(r.kind)?'<small class="experimental-tag">Experimental</small>':''}`;
      if(['push','breakEven'].includes(k))return pct(r[k]);
      if(['payout','net','stress'].includes(k))return `<span class="price-value ${k!=='payout'&&Number.isFinite(r[k])?(r[k]<0?'negative':r[k]>0?'positive':''):''}">${cash(r[k])}</span>`;
      if(k==='decimal')return Number.isFinite(r.decimal)?r.decimal.toFixed(2)+'x':'Unavailable';
      if(k==='provenance')return `<span class="price-source ${r.source==='manual'?'manual':''}">${r.source==='manual'?`Manual override<small>${esc(r.book)}</small>`:`Reported ${esc(r.book)}<small>via ${esc(r.source)}</small>`}${r.stale?'<small class="negative">Stale quote</small>':''}${r.error?'<small>'+esc(r.error)+'</small>':''}</span>${r.source==='manual'?`<button data-price-restore="${i}">Restore reported / clear manual</button>`:''}`;
      if(k==='timestamp')return `<details class="quote-details"><summary>${esc(date(r.timestamp))}</summary><small>Retrieved: ${esc(date(r.retrieved_at))}</small><small>Book updated: ${esc(date(r.quote_updated_at))}</small></details>`;
      return esc(r[k]??'Unavailable');
    }
    function clear(r){onRestore?.(r);store.remove(r);}
    function draw(){
      const ordered=P.sortRows(list,sort.key,sort.direction),notices=[errors[sport],...warnings(sport,games)].filter(Boolean);
      if(sport==='nfl')ordered.sort((a,b)=>({ready:0,review:1,unavailable:2}[a.readiness?.state]??2)-({ready:0,review:1,unavailable:2}[b.readiness?.state]??2));
      container.innerHTML=noticesHTML(notices)+(list.length?'<div class="table-wrap"><table><thead><tr>'+columns.map(([k,label])=>`<th aria-sort="${sort.key===k?sort.direction:'none'}"><button type="button" data-sort="${k}">${label}${sort.key===k?(sort.direction==='ascending'?' &#8593;':' &#8595;'):''}</button></th>`).join('')+'</tr></thead><tbody>'+ordered.map((r,i)=>'<tr>'+columns.map(([k])=>'<td>'+cell(k,r,i)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'<p class="empty">No available prices for this market.</p>');
      container.querySelectorAll('tbody tr').forEach((tr,i)=>{const r=ordered[i],input=document.createElement('input');input.value=String(r.odds);input.inputMode='text';input.size=7;input.setAttribute('aria-label','Manual odds for '+r.label);input.onchange=()=>{
        if(!input.value.trim()){input.setCustomValidity('');clear(r);return;}
        if(!P.decimal(input.value)){input.setCustomValidity('Enter American odds such as -110 or +150.');input.reportValidity();return;}
        input.setCustomValidity('');const record={};for(const k of ['sport','gameKey','game_pk','kind','side','playerId','line','book','forecast','probability','label','legacyField'])record[k]=r[k];store.save({...record,odds:input.value});
      };tr.children[2].replaceChildren(input);});
      container.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.sort){const k=b.dataset.sort;sort={key:k,direction:sort.key===k&&sort.direction==='ascending'?'descending':'ascending'};try{localStorage.setItem(key,JSON.stringify(sort));}catch{}onSort?.(sort);draw();container.querySelector('[data-sort="'+k+'"]')?.focus();}if(b.dataset.priceOpen!==undefined)onOpen?.(ordered[+b.dataset.priceOpen]);if(b.dataset.priceRestore!==undefined)clear(ordered[+b.dataset.priceRestore]);};
    }draw();
  }
  function propInput(input,record,result){
    const saved=store.get(record);input.value=String(saved?.odds??'');
    function show(){const d=P.decimal(input.value),p=record.probability;result.textContent=!input.value.trim()?'':!d?'Enter American odds such as +150 or -110.':`Break-even ${pct(1/d)}. Payout / $20: ${cash(20*d)} including stake. Experimental net / $20: ${cash(Number.isFinite(p)?20*(p*d-1):null)}.${store.persisted?'':' Browser storage unavailable; not saved across reloads.'}`;}
    input.oninput=()=>{if(!input.value.trim())store.remove(record);else if(P.decimal(input.value))store.save({...record,odds:input.value});show();};show();
  }
  root.PricesUI={load,refreshButton,rows,table,propInput,reports,warnings};
})(globalThis);
