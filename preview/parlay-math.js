(function(root){
  'use strict';
  const em=typeof module!=='undefined'?require('./engine-markets.js'):root.EngineMarkets;
  function valid(l,now=Date.now()){
    return l&&l.id&&l.gameKey&&l.book&&l.state==='Preview'&&Date.parse(l.start)>now&&
      Number.isFinite(l.win)&&Number.isFinite(l.push)&&l.win>0&&l.push>=0&&l.win+l.push<=1+1e-8&&!!em.decimal(l.odds)&&!l.stale;
  }
  function combine(legs,now=Date.now()){
    if(legs.length<2||legs.length>11||legs.some(l=>!valid(l,now)))throw Error('Use 2–11 valid pregame selections.');
    if(new Set(legs.map(l=>l.gameKey)).size!==legs.length)throw Error('Choose one selection per game, or switch to Same game.');
    if(new Set(legs.map(l=>l.book.trim().toLowerCase())).size!==1)throw Error('A ticket must use one sportsbook.');
    let hit=1,decimal=1,returnFactor=1,stressFactor=1,stressHit=1,allPush=1,noLoss=1;
    for(const l of legs){const d=em.decimal(l.odds),w=Math.max(0,l.win-.05*(1-l.push));hit*=l.win;decimal*=d;returnFactor*=l.win*d+l.push;stressFactor*=w*d+l.push;stressHit*=w;allPush*=l.push;noLoss*=l.win+l.push;}
    return {legs,hit,decimal,ev:returnFactor-1,stressEV:stressFactor-1,stressHit,allPush,noLoss,anyLoss:1-noLoss,
      american:decimal>=2?100*(decimal-1):-100/(decimal-1)};
  }
  function search(input,opts={},now=Date.now()){
    const count=Number(opts.count??2),minHit=Number(opts.minHit??.25),minLeg=Number(opts.minLeg??.5),sort=opts.sort||'hit';
    if(!Number.isInteger(count)||count<2||count>11||!Number.isFinite(minHit)||minHit<0||minHit>1||!Number.isFinite(minLeg)||minLeg<0||minLeg>1)throw Error('Invalid search limits.');
    const compare=(a,b)=>(sort==='payout'?b.decimal-a.decimal:sort==='ev'?b.ev-a.ev:sort==='stress'?b.stressEV-a.stressEV:b.hit-a.hit)||b.hit-a.hit||a.legs.map(l=>l.id).join().localeCompare(b.legs.map(l=>l.id).join());
    const seen=new Set();const all=input.filter(l=>valid(l,now)&&l.win>=minLeg&&(opts.includeFlags||!l.flags?.length)&&!seen.has(l.id)&&seen.add(l.id));
    // Bound the search, explicitly reporting truncation instead of claiming a global optimum.
    const ranked=all.sort((a,b)=>(sort==='payout'?em.decimal(b.odds)-em.decimal(a.odds):sort==='ev'||sort==='stress'?(b.win*em.decimal(b.odds)+b.push)-(a.win*em.decimal(a.odds)+a.push):b.win-a.win)||a.id.localeCompare(b.id));
    let pool=ranked.slice(0,32);
    if(opts.mode==='mixed'){
      const groups=[...new Set(ranked.map(l=>l.sport))].sort().map(s=>ranked.filter(l=>l.sport===s));pool=[];
      for(let i=0;pool.length<32&&groups.some(g=>g.length>i);i++)for(const g of groups)if(g[i]&&pool.length<32)pool.push(g[i]);
    }
    let evaluated=0,visited=0,accepted=0,limited=false;let results=[];
    function walk(start,legs,hit){
      if(evaluated>=150000||visited>=200000){limited=true;return;}visited++;
      if(legs.length===count){evaluated++;if(hit+1e-12>=minHit&&(opts.mode!=='mixed'||new Set(legs.map(l=>l.sport)).size>=2)){accepted++;results.push(combine(legs,now));if(results.length>500)results=results.sort(compare).slice(0,100);}return;}
      if(hit<minHit)return;
      // Prune incomplete branches too: long tickets otherwise explore huge trees
      // even when no complete combination can satisfy unique-game constraints.
      const used=new Set(legs.map(l=>l.gameKey)),best=new Map();
      for(let i=start;i<pool.length;i++){const l=pool[i];if(used.has(l.gameKey)||legs.length&&l.book.trim().toLowerCase()!==legs[0].book.trim().toLowerCase())continue;best.set(l.gameKey,Math.max(best.get(l.gameKey)||0,l.win));}
      const need=count-legs.length,remaining=[...best.values()].sort((a,b)=>b-a);
      if(remaining.length<need||hit*remaining.slice(0,need).reduce((a,b)=>a*b,1)+1e-12<minHit)return;
      for(let i=start;i<=pool.length-(count-legs.length);i++){const l=pool[i];if(legs.some(x=>x.gameKey===l.gameKey||x.book.trim().toLowerCase()!==l.book.trim().toLowerCase()))continue;walk(i+1,[...legs,l],hit*l.win);if(limited)break;}
    }
    walk(0,[],1);return {results:results.sort(compare).slice(0,30),evaluated,visited,accepted,available:all.length,pool:pool.length,truncated:limited||all.length>pool.length};
  }
  const api={valid,combine,search};if(typeof module!=='undefined')module.exports=api;else root.ParlayMath=api;
})(typeof globalThis!=='undefined'?globalThis:this);
