(function(root){
  'use strict';
  const isProp=q=>['hr','touchdown'].includes(q.kind);
  const fresh=(value,now)=>{const age=now-Date.parse(value);return Number.isFinite(age)&&age>=-60000&&age<=86400000;};
  function estimate(sport,g,q,payload,now=Date.now()){
    if(!isProp(q))throw Error('Not a player market.');
    if((sport==='mlb'&&q.kind!=='hr')||(sport==='nfl'&&q.kind!=='touchdown')||!['mlb','nfl'].includes(sport))throw Error('Unsupported player market for this sport.');
    if(!['home','away'].includes(q.side)||Number(q.line)!==.5)throw Error('Only a named player scoring at least once is supported.');
    if(g.abstract_state!=='Preview'||!(Date.parse(g.start_time)>now))throw Error('Player matchup has started or is closed.');
    const entry=payload?.games?.[g.game_pk];
    if(!entry||Date.parse(entry.start_time)!==Date.parse(g.start_time))throw Error('No matching player forecast; refresh this sport.');
    let player,probability,forecast,warnings=[];
    if(sport==='mlb'){
      if(payload.date!==g.date||entry.abstract_state!=='Preview'||!fresh(entry.generated_at,now))throw Error('Home-run forecast is stale or closed.');
      player=entry.players?.find(p=>String(p.id)===String(q.playerId)&&p.side===q.side);
      probability=player?.probability;forecast=entry.generated_at;
      if(player?.lineup_status!=='Confirmed')warnings.push('Projected lineup; participation unconfirmed');
    }else{
      if(!fresh(payload.generated_at,now)||!fresh(entry.forecast_at,now))throw Error('Touchdown forecast is stale.');
      player=entry[q.side]?.find(p=>String(p.id)===String(q.playerId));
      probability=player?.estimate?.probability;forecast=entry.forecast_at;
      if(player?.unavailable||/^(out|inactive|injured reserve|suspended)$/i.test(player?.status||''))throw Error('Player unavailable.');
      warnings.push('Role and participation unconfirmed');
      if(player?.status&&player.status.toLowerCase()!=='active')warnings.push(player.status);
    }
    if(!player||!Number.isFinite(probability)||probability<=0||probability>=1)throw Error('Current player probability unavailable.');
    return {win:probability,push:0,experimental:true,propForecast:forecast,propRetrieved:payload.generated_at||entry.generated_at,propWarnings:warnings,
      label:player.name+(sport==='mlb'?' 1+ HR':' anytime TD')+' (experimental)'};
  }
  const api={isProp,estimate};if(typeof module!=='undefined')module.exports=api;else root.ParlayProps=api;
})(typeof globalThis!=='undefined'?globalThis:this);
