'use strict';
globalThis.LEDGER_SHARED=true;
document.addEventListener('DOMContentLoaded',()=>{
  const badge=document.querySelector('.local');if(badge)badge.textContent='Shared Slate';
  const footer=document.querySelector('main footer');if(footer)footer.append(document.createTextNode(globalThis.LEDGER_PC_HOSTED?' · Updates about every 30 minutes while the host is online.':' · Online updates about every 30 minutes.'));
  const labels={'reload':'Refresh','refresh-football':'Refresh','refresh-nba':'Refresh','refresh-nhl':'Refresh','refresh-mlb':'Refresh','update-inputs':'Refresh games & prices'};
  for(const [id,label]of Object.entries(labels)){const el=document.getElementById(id);if(el){el.textContent=label;el.title='Load the latest published online update';}}
  const clean=()=>{document.querySelectorAll('a[href^="desk.html"],option[value="hr"]').forEach(el=>el.remove());};
  clean();const sports=document.getElementById('sports');if(sports)new MutationObserver(clean).observe(sports,{childList:true});
  document.addEventListener('click',event=>{
    if(matchMedia('(max-width:650px)').matches&&event.target.closest?.('.game-grid [data-game]')){
      document.querySelector('.inspector')?.scrollIntoView({block:'start'});
    }
  });
});
