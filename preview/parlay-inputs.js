(function(root){
  'use strict';
  function assess(game,generated,now=Date.now()){
    const start=Date.parse(game.start_time),age=now-Date.parse(generated);
    if(game.abstract_state!=='Preview'||!Number.isFinite(start)||start<=now)return {blocked:'Closed or unknown start; no live model',flags:[]};
    if(!Number.isFinite(age)||age>86400000||age< -60000)return {blocked:'Refresh stale forecast',flags:[]};
    return {blocked:null,flags:game.postseason?['Experimental postseason: regular-season model; no validated playoff edge']:[]};
  }
  async function refresh(sports,{fetch:request=root.fetch.bind(root),sleep=ms=>new Promise(r=>setTimeout(r,ms)),progress=()=>{},now=Date.now}={}){
    const failures=[];
    async function json(url,body){const r=await request(url,body===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const v=await r.json();if(!r.ok)throw Error(v.error||'Refresh request failed');return v;}
    for(const sport of sports){
      if(!['mlb','nfl','cfb','nba','nhl'].includes(sport))throw Error('Unsupported sport');
      const route={mlb:'desk',nfl:'nfl',cfb:'football',nba:'nba',nhl:'nhl'}[sport];
      try{
        progress(sport.toUpperCase()+': updating forecasts');
        let state=await json('/api/'+route+'/update',sport==='mlb'?{light:true}:{}),deadline=now()+480000;
        while(state.running){if(now()>deadline)throw Error('Update is still running; check the sport desk');await sleep(2000);state=await json('/api/'+route+'/state');progress(sport.toUpperCase()+': '+(state.phase||'Updating'));}
        if(state.error)throw Error(state.error);
        progress(sport.toUpperCase()+': refreshing reported prices');
        const prices=await json('/api/odds/refresh',{sport});
        const slate=await json('data/'+{mlb:'desk',nfl:'nfl',cfb:'college-football',nba:'nba',nhl:'nhl'}[sport]+'.json');
        for(const game of slate.games||[]){
          if(assess(game,game.generated_at||slate.generated_at,now()).blocked)continue;
          const row=prices.games?.[game.game_pk];
          if(!row||row.error||row.stale||!row.market)failures.push(sport.toUpperCase()+': '+game.away+' at '+game.home+' — '+(row?.error||'Reported prices unavailable or stale'));
        }
      }catch(e){failures.push(sport.toUpperCase()+': '+e.message);}
    }
    return failures;
  }
  const api={assess,refresh};if(typeof module!=='undefined')module.exports=api;else root.ParlayInputs=api;
})(typeof globalThis!=='undefined'?globalThis:this);
