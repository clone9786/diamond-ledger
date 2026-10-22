'use strict';
(()=>{
 if(!globalThis.LEDGER_PC_HOSTED)return;
 const page=location.pathname.split('/').pop().replace('.html','');
 if(!['home','nfl','football','nba','nhl','mlb','parlays','record'].includes(page))return;
 let last=Date.now(),lastFeature=0,declined=false;
 // Respect earlier choices without creating new storage or identifiers.
 try{const old=JSON.parse(localStorage.getItem('ledger-usage-choice-v1'));declined=old?.allow===false;}catch{}
 const blocked=()=>declined||navigator.globalPrivacyControl===true||navigator.doNotTrack==='1';
 function send(event,sport='none',seconds=0){
  if(blocked())return;
  try{fetch('/api/usage-event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({page,event,sport,device:innerWidth<650?'phone':innerWidth<1100?'tablet':'desktop',seconds}),keepalive:true}).catch(()=>{});}catch{}
 }
 send('page');
 setInterval(()=>{const now=Date.now(),seconds=Math.min(30,Math.floor((now-last)/1000));last=now;if(!document.hidden&&document.hasFocus()&&seconds>0)send('active','none',seconds);},30000);
 document.addEventListener('visibilitychange',()=>{last=Date.now();});
 document.addEventListener('click',e=>{
  if(e.target.closest('#usage-choice,#usage-manage'))return;
  const target=e.target.closest('button,a,summary');if(!target)return;
  let event=null,sport='none';const selected=target.closest('#sports [data-sport],[data-record]');
  if(selected){event='sport';sport=selected.dataset.sport||selected.dataset.record;}
  else if(target.matches('[data-game],[data-nba],[data-nhl],[data-mlb],[data-price-open]'))event='matchup';
  else if(target.matches('#news-refresh,.news-more summary')||target.closest('.news-wire'))event='news';
  else if(target.matches('[data-sort]'))event='sort';
  else if(target.dataset.view==='prices'||target.id==='show-prices')event='prices';
  else if(target.dataset.view==='results'||target.id==='show-evidence')event='results';
  else if(target.matches('#reload,#refresh-nba,#refresh-nhl,#refresh-mlb,#refresh-football,#record-refresh'))event='refresh';
  else if(target.matches('[data-mode],#build,#update-inputs'))event='parlay';
  if(event&&Date.now()-lastFeature>400){lastFeature=Date.now();send(event,sport);}
 },true);
 document.addEventListener('change',e=>{if(e.target.matches('[data-market],#cfb-market-filter'))send('market');else if(e.target.matches('[data-ranking],#sort,#football-sort,#cfb-price-sort'))send('sort');});
})();
