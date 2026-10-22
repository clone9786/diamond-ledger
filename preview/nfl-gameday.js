'use strict';
const NFLDay=(()=>{
  let pipeline={};
  async function loadStatus(){try{const r=await fetch('data/nfl-refresh.json',{cache:'no-store'});if(r.ok)pipeline=await r.json();}catch{}if(typeof data!=='undefined'&&data)for(const g of data.games)g.pipeline=pipeline;}
  function updating(){pipeline={...pipeline,running:true};if(data){for(const g of data.games)g.pipeline=pipeline;render();footballPrices.board();}}
  function readiness(g){return NFLReadiness.assess(g,{pipeline,quote:PricesUI.reports.nfl?.games?.[g.game_pk]});}
  const time=t=>t?new Date(t).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Unavailable';
  const signed=x=>x==null?'—':(x>0?'+':'')+x;
  function reported(g){
    const m=PricesUI.reports.nfl?.games?.[g.game_pk]?.market;if(!m)return {};
    return Object.fromEntries(Object.entries({fh:m.home_ml,fa:m.away_ml,fs:m.home_spread,fhs:m.home_spread_odds,fas:m.away_spread_odds,'cfb-line':m.total,fo:m.over_odds,fu:m.under_odds}).filter(([,v])=>v!==null&&v!==undefined).map(([k,v])=>[k,String(v)]));
  }
  function render(){
    for(const row of document.querySelectorAll('#football-games .game-row')){
      row.querySelector('.nfl-row-context')?.remove();
      const g=data.games.find(g=>g.game_pk===Number(row.querySelector('[data-game]').dataset.game));if(!g)continue;
      const c=g.gameday,q=PricesUI.reports.nfl?.games?.[g.game_pk],m=q?.market;
      const extra=document.createElement('div');extra.className='nfl-row-context';
      const flags=(c?.qb_flags||[]).filter(q=>q.role!=='backup');
      extra.innerHTML=`<small>${m?.home_spread!=null?esc(g.home)+' '+signed(m.home_spread)+' · Total '+(m.total??'—'):'Prices pending'}${q?.stale?' · Saved quote':''}</small>${flags.length?'<small class="gold">'+flags.map(q=>esc(q.name)+' · '+esc(q.status)).join(' · ')+'</small>':''}`;
      row.firstElementChild.append(extra);
    }
  }
  function mount(){
    const c=game.gameday,state=readiness(game);
    const section=document.createElement('section');section.className='section nfl-gameday-context';
    const flags=(c?.qb_flags||[]).filter(q=>q.role!=='backup');
    section.innerHTML=`<h3>Availability</h3>${flags.length?'<p class="gold">'+flags.map(q=>esc(q.team)+': '+esc(q.name)+' ('+esc(q.status)+')').join(' · ')+'</p>':''}<details><summary>Injury listings · ${esc(time(c?.retrieved_at))}</summary>${c?.error?'<p>'+esc(c.error)+'</p>':''}<div class="two-col">${['away','home'].map(side=>`<div><h4>${esc(game[side])}</h4>${(c?.injuries||[]).filter(r=>r.side===side).map(r=>`<div class="injury-row ${r.position==='QB'?'gold':''}"><b>${esc(r.position)} ${esc(r.name)}</b><span>${esc(r.status)} · ${esc(r.injury)}</span></div>`).join('')||'<p class="muted">No entries returned.</p>'}</div>`).join('')}</div><p class="note">Listings are not final inactives and do not adjust the model. <a href="${esc(c?.source_page||game.source)}" target="_blank" rel="noreferrer">ESPN</a> · <a href="https://www.nfl.com/injuries/" target="_blank" rel="noreferrer">Official injury report</a></p></details>${state.reasons.length?'<details><summary>Input checks</summary><ul>'+state.reasons.map(r=>'<li>'+esc(r)+'</li>').join('')+'</ul></details>':''}`;
    $('#football-price-desk').before(section);
    if(c?.market&&state.eligible){
      const box=document.createElement('div');box.className='market-import';box.innerHTML=`<p>DraftKings via ESPN · ${esc(time(c.retrieved_at))}</p><button id="nfl-use-reported">Use reported prices</button>`;
      $('#football-price-desk .price-heading').after(box);
      $('#nfl-use-reported').onclick=()=>{const f=reported(game);for(const name of ['fh','fa','fs','fhs','fas','cfb-line','fo','fu'])$('#'+name).value=f[name]||'';footballPrices.check();};
    }
    NFLTouchdowns.mount();
  }
  return {reported,render,mount,time,readiness,loadStatus,updating};
})();
setInterval(async()=>{if(typeof data!=='undefined'&&data){await NFLDay.loadStatus();await PricesUI.load('nfl');NFLDay.render();footballPrices.board();}},60000);
