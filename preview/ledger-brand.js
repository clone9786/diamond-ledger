'use strict';
(() => {
  const brand=document.querySelector('.mast .brand');
  const sport=['nfl','nba','nhl','mlb'].includes(document.body.dataset.sport)?document.body.dataset.sport:document.querySelector('#football-slate')?'cfb':document.querySelector('#ticker')?'mlb':null;
  if(sport)document.querySelectorAll('a[href="parlays.html"]').forEach(a=>a.href='parlays.html?sport='+sport);
  if(brand){
    brand.href='home.html';
    brand.innerHTML='<span class="ledger-mark" aria-hidden="true">d</span><span class="ledger-wordmark">Diamond <b>Ledger</b></span>';
  }
  const navigation=document.querySelector('.sport-nav')||document.querySelector('.mast nav');
  if(navigation){
    navigation.setAttribute('aria-label','Sports and workspace');
    const page=location.pathname.split('/').pop();
    navigation.replaceChildren(...[
      ['home.html','Home'],['nfl.html','NFL'],['football.html','College football'],
      ['nba.html','NBA'],['nhl.html','NHL'],['mlb.html','MLB'],
      ['parlays.html'+(sport?'?sport='+sport:''),'Parlay Lab'],['record.html','Pick record']
    ].map(([href,label])=>{const a=document.createElement('a');a.href=href;a.textContent=label;
      if(href.split('?')[0]===page||sport==='mlb'&&page==='desk.html'&&href==='mlb.html'){a.className='active';a.setAttribute('aria-current','page');}return a;}));
  }
})();
