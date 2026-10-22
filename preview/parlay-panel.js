'use strict';
// Reuse the same lab inside each sport, sharing same-origin saved prices.
(()=>{
  const sport=document.body.dataset.sport==='nfl'?'nfl':document.querySelector('#football-slate')?'cfb':'mlb';
  const nav=document.querySelector('.mast nav'),button=document.createElement('button');
  button.textContent='Parlays';button.id='show-parlays';
  const price=nav.querySelector('#show-prices,[data-view="prices"]');
  price.after(button);
  const panel=document.createElement('section');panel.id='parlays';panel.hidden=true;panel.className='view parlay-panel';
  panel.innerHTML='<iframe title="'+(sport==='mlb'?'MLB':sport==='cfb'?'College football':'NFL')+' parlay builder" class="parlay-frame"></iframe>';
  document.querySelector('main footer').before(panel);
  const frame=panel.querySelector('iframe');let loaded=false;
  function show(){
    if(!loaded){frame.src='parlays.html?v=20261006-1&embed=1&sport='+sport;loaded=true;}
    else frame.contentWindow.postMessage({type:'parlay-refresh'},location.origin);
  }
  if(sport==='mlb'){
    button.dataset.view='parlays';button.addEventListener('click',show);
  }else{
    button.onclick=()=>{
      for(const id of ['football-slate','football-price-board','football-evidence'])document.getElementById(id).hidden=true;
      panel.hidden=false;nav.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===button));show();
    };
    nav.querySelectorAll('button').forEach(b=>{if(b!==button)b.addEventListener('click',()=>{panel.hidden=true;button.classList.remove('active');});});
  }
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.type!=='parlay-height')return;
    const height=Number(e.data.height);if(Number.isFinite(height)&&height>0&&height<=50000)frame.style.height=Math.max(500,Math.ceil(height))+'px';
  });
  document.querySelector('.sport-nav .lab-link')?.remove();
})();
