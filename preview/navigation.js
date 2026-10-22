'use strict';
// Keep the selected workspace legible without replacing any sport's controls.
(()=>{
  const nav=document.querySelector('.mast nav');if(!nav)return;
  const sport=document.body.dataset.sport==='nfl'?'NFL':document.querySelector('#football-slate')?'College football':document.querySelector('#games')?'MLB':null;
  const heading=document.querySelector('.page-heading h1');
  const labels={'show-games':'Matchups','show-prices':'Prices','show-parlays':'Parlays','show-evidence':'Results',today:'Matchups',prices:'Prices',league:'League',results:'Results',parlays:'Parlays'};
  function sync(){
    nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.classList.contains('active'))));
    if(!heading||!sport)return;
    const active=nav.querySelector('button.active');
    const view=active?.id||active?.dataset.view;
    if(labels[view])heading.textContent=sport+' / '+labels[view];
  }
  new MutationObserver(sync).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
  sync();
  const sports=document.querySelector('.sport-nav');
  if(sports){const home=document.createElement('a');home.href='home.html';home.textContent='Home';sports.prepend(home);}
  const requested=new URLSearchParams(location.search).get('view');
  if(['prices','evidence'].includes(requested))nav.querySelector('#show-'+requested+', [data-view="'+requested+'"]')?.click();
})();
