(function(root,factory){const api=factory(typeof module==='object'?require('./engine-markets.js'):root.EngineMarkets);if(typeof module==='object')module.exports=api;else root.FootballMarkets=api;})(typeof globalThis!=='undefined'?globalThis:this,function(M){
  'use strict';
  function line(value,kind,maxTotal=150){
    if(value===null||value===undefined||typeof value==='boolean'||String(value).trim()==='')return null;
    const x=Number(value),min=kind==='total'?0:-100,max=kind==='total'?maxTotal:100;
    return Number.isFinite(x)&&x>=min&&x<=max&&Number.isInteger(x*2)?x:null;
  }
  function probability(p,kind,side,value){
    if(kind==='moneyline'){const tie=p.tie_probability||0,away=1-p.home_probability-tie;return ['home','away'].includes(side)?{win:side==='home'?p.home_probability:away,push:tie,loss:side==='home'?away:p.home_probability}:null;}
    const x=line(value,kind,p.sport==='nba'?400:150);if(x===null)return null;
    if(kind==='total'&&['over','under'].includes(side))return M.distribution(p.total_pmf,0,x,side==='over');
    if(kind==='spread'&&['home','away'].includes(side))return M.distribution(p.margin_pmf,p.margin_offset,side==='home'?-x:x,side==='home');
    return null;
  }
  function price(p,kind,side,value,odds,stake=100){
    const d=M.decimal(odds),v=probability(p,kind,side,value);
    if(!d||!v||!Number.isFinite(stake)||stake<=0)return null;
    const ev=v.win*(d-1)-v.loss;
    return {...v,ev,net:stake*ev,breakEven:1/d,decisionWin:v.win+v.loss?v.win/(v.win+v.loss):null};
  }
  function stressPrice(p,kind,side,value,odds,adverse=.05){
    const base=price(p,kind,side,value,odds);if(!base||!Number.isFinite(adverse)||adverse<0||adverse>1)return null;
    const decision=Math.max(0,(base.decisionWin||0)-adverse),decided=1-base.push,d=M.decimal(odds);
    return {...base,stressedEV:decided*(decision*(d-1)-(1-decision)),adverse};
  }
  function review(g,p,now=Date.now()){
    const flags=[],c=g.gameday;
    if(g.abstract_state!=='Preview'||!Number.isFinite(Date.parse(g.start_time))||now>=Date.parse(g.start_time))flags.push('Closed / not pregame');
    const generated=Date.parse(g.generated_at);
    if(!Number.isFinite(generated)||now-generated>86400000||generated>now+60000)flags.push('Forecast date needs refresh');
    if(!c||c.error||!c.injury_feed_present)flags.push('Context incomplete');
    if(c){
      const checked=Date.parse(c.retrieved_at);
      if(!Number.isFinite(checked)||now-checked>7200000||checked>now+60000)flags.push('Context needs refresh');
      if(c.status!=='pre')flags.push('Source does not confirm pregame');
      if(c.qb_flags?.length)flags.push('QB availability review');
      const market=c.market?.home_no_vig;
      if(Number.isFinite(market)&&Math.abs(p.home_probability/(1-(p.tie_probability||0))-market)>=.1)flags.push('Large model / market gap');
    }
    const experts=Object.values(p.experts||{}).filter(Number.isFinite);
    if(experts.length>1&&Math.max(...experts)-Math.min(...experts)>=.1)flags.push('Models disagree');
    return flags;
  }
  return {line,probability,price,stressPrice,review};
});
