(function(root){
  'use strict';
  function eligible(g,now=Date.now()){return g.abstract_state==='Preview'&&Number.isFinite(Date.parse(g.start_time))&&Date.parse(g.start_time)>now;}
  function current(g,q,now=Date.now()){
    const age=now-Date.parse(q?.retrieved_at),forecastAge=now-Date.parse(g.generated_at);
    return eligible(g,now)&&!!g.prediction&&Number.isFinite(forecastAge)&&forecastAge>=-60000&&forecastAge<=86400000&&
      !!q?.market&&!q.error&&!q.stale&&Number.isFinite(age)&&age>=-60000&&age<=7200000;
  }
  function mount({sport,container,getGames,getQuotes,onOpen}){
    const key='diamond-price-sort-'+sport;let sort={key:'win',direction:'descending'};
    try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&['ascending','descending'].includes(saved.direction))sort=saved;}catch{}
    container.innerHTML='<div class="toolbar sports-price-controls"><label>Market <select data-market aria-label="Price market"><option value="all">All markets</option><option value="spread">'+(sport==='nhl'?'Puck lines':sport==='mlb'?'Run lines':'Point spreads')+'</option><option value="moneyline">Moneylines</option><option value="total">Totals</option></select></label><label>Sort by <select data-ranking aria-label="Sort prices"><option value="win">Win / cover probability</option><option value="net">Estimated return</option><option value="decimal">Payout multiplier</option><option value="odds">American odds</option><option value="matchup">Matchup</option></select></label><label><input data-today type="checkbox"> Today only</label><input data-search type="search" placeholder="Find a team" aria-label="Search priced games"></div><p data-count class="note" role="status"></p><div data-price-table></div>';
    const select=s=>container.querySelector(s),ranking=select('[data-ranking]');
    function syncSort(){ranking.value=sort.key;}
    function draw(){
      const now=Date.now(),day=x=>new Date(x).toLocaleDateString('en-CA',{timeZone:'America/New_York'}),query=select('[data-search]').value.toLowerCase();
      const games=getGames().filter(g=>eligible(g,now)&&(!select('[data-today]').checked||day(g.start_time)===day(now))&&(g.away+' '+g.home).toLowerCase().includes(query));
      const quotes=getQuotes();root.PricesUI.reports[sport]=quotes;
      const ready=games.filter(g=>current(g,quotes.games?.[g.game_pk],now));
      let list=root.PricesUI.rows({sport,games:ready,eligible,price:(g,q)=>{
        if(q.stale||q.error)return null;
        const p=g.prediction,v=sport==='mlb'?root.DeskMath.price(p,q,20):root.FootballMarkets.price(p,q.kind,q.side,q.line,q.odds,20);
        return v?{...v,ev:sport==='mlb'?v.ev:v.net}:null;
      }}).filter(r=>Number.isFinite(r.win));
      const market=select('[data-market]').value;
      list=list.filter(r=>market==='all'||r.kind===(sport==='mlb'&&market==='spread'?'runline':market));
      select('[data-count]').textContent=list.length+' selections · '+new Set(list.map(r=>r.game_pk)).size+' games'+(games.length>ready.length?' · '+(games.length-ready.length)+' games awaiting current forecasts or prices':'');
      root.PricesUI.table(select('[data-price-table]'),list,{sport,games,sort,compact:true,onSort:value=>{sort=value;syncSort();},onOpen:r=>onOpen(r.game_pk)});
      syncSort();
    }
    ranking.onchange=()=>{sort={key:ranking.value,direction:ranking.value==='matchup'?'ascending':'descending'};try{localStorage.setItem(key,JSON.stringify(sort));}catch{}draw();};
    select('[data-market]').onchange=select('[data-today]').onchange=select('[data-search]').oninput=draw;
    root.PriceStore.shared.subscribe(draw);return {render:draw};
  }
  const api={eligible,current,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.SportsPrices=api;
})(typeof globalThis!=='undefined'?globalThis:this);
