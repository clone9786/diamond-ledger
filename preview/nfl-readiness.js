(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.NFLReadiness=api;})(globalThis,function(){
  'use strict';
  const labels={ready:'Ready for review',review:'Needs review',unavailable:'Unavailable'};
  function assess(g,{quote=null,pipeline=g?.pipeline,now=Date.now()}={}){
    const blocked=[],review=[],components={};
    function fresh(name,value,limit){const t=Date.parse(value),age=now-t;components[name]={timestamp:value??null,ageMs:Number.isFinite(age)?age:null};return Number.isFinite(age)&&age>=-60000&&age<=limit;}
    if(!g||g.abstract_state!=='Preview'||!Number.isFinite(Date.parse(g.start_time))||now>=Date.parse(g.start_time))blocked.push('Closed or unknown kickoff');
    if(!fresh('forecast',g?.generated_at,86400000))blocked.push('Forecast missing or expired');
    if(!g?.prediction)blocked.push('Forecast missing');
    if(!pipeline?.started_at)blocked.push('Unified refresh not verified');
    else {
      if(pipeline.running)blocked.push('Refresh in progress');
      if(pipeline.components?.forecast?.status!=='ok'||pipeline.forecast_generated_at!==g?.generated_at)blocked.push('Forecast refresh failed or mismatched');
      for(const name of ['context','odds'])if(!['ok','partial'].includes(pipeline.components?.[name]?.status))blocked.push(name+' refresh failed or missing');
    }
    const c=g?.gameday;
    if(!c||c.error||c.status!=='pre'||String(c.game_pk)!==String(g?.game_pk))blocked.push('Context unavailable or wrong event');
    if(!fresh('context',c?.retrieved_at,7200000))blocked.push('Context missing or expired');
    if(!c?.injury_feed_present)review.push('Injury coverage unknown');
    const qbs=(c?.qb_flags||[]).filter(q=>q.role!=='backup');
    if(qbs.length)review.push(qbs.some(q=>q.role==='starter')?'Listed starting QB needs review':'QB listing; starter role unverified');
    const q=quote||g?.reported_quote;
    if(!q||q.stale||q.error||!q.market)blocked.push('Reported prices unavailable');
    if(!fresh('odds',q?.retrieved_at,7200000))blocked.push('Reported prices missing or expired');
    const identity=q?.checked_slate;
    if(!identity||String(identity[0])!==String(g?.home_id)||String(identity[1])!==String(g?.away_id)||Date.parse(identity[2])!==Date.parse(g?.start_time)||String(q?.game_pk)!==String(g?.game_pk))blocked.push('Price identity unverified');
    const m=q?.market;
    if(m&&['home_ml','away_ml','home_spread','away_spread','home_spread_odds','away_spread_odds','total','over_odds','under_odds'].some(k=>!Number.isFinite(m[k])))review.push('Some market fields missing');
    if(m&&Number.isFinite(m.home_spread)&&Number.isFinite(m.away_spread)&&Math.abs(m.home_spread+m.away_spread)>1e-9)blocked.push('Spread sides inconsistent');
    const experts=Object.values(g?.prediction?.experts||{}).filter(Number.isFinite);
    if(experts.length>1&&Math.max(...experts)-Math.min(...experts)>=.1)review.push('Models disagree');
    const dec=o=>Number.isFinite(o)&&Math.abs(o)>=100?(o>0?1+o/100:1+100/-o):null;
    const h=dec(m?.home_ml),a=dec(m?.away_ml),p=g?.prediction;
    if(h&&a&&p&&Math.abs(p.home_probability/(1-(p.tie_probability||0))-(1/h)/(1/h+1/a))>=.1)review.push('Large model / market gap');
    const state=blocked.length?'unavailable':review.length?'review':'ready';
    return {state,label:labels[state],reasons:[...new Set([...blocked,...review])],components,eligible:state==='ready'};
  }
  function selection(g,q,options={}){
    const result=assess(g,options),t=Date.parse(q?.enteredAt||q?.observed||q?.retrieved_at),age=(options.now??Date.now())-t;
    if(!Number.isFinite(age)||age< -60000||age>7200000||q?.stale||q?.error)return {...result,state:'unavailable',label:labels.unavailable,eligible:false,reasons:[...result.reasons,'Selected price stale or undated']};
    return result;
  }
  return {assess,selection};
});
