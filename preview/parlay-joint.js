(function(root){
  'use strict';
  const base=typeof module!=='undefined'?require('./parlay-math.js'):root.ParlayMath;
  const em=typeof module!=='undefined'?require('./engine-markets.js'):root.EngineMarkets;
  const signature=legs=>JSON.stringify(legs.map(l=>[l.id,l.odds,l.observed,l.forecast,l.win,l.push]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
  function outcome(l,h,a){
    let v;
    if(l.kind==='moneyline')v=l.side==='home'?h-a:a-h;
    else if(l.kind==='total')v=(h+a-Number(l.line))*(l.side==='over'?1:-1);
    else if(['spread','runline'].includes(l.kind))v=(l.side==='home'?h-a:a-h)+Number(l.line);
    else throw Error('Player props are not supported in parlays.');
    return Math.abs(v)<1e-9?0:v>0?1:-1;
  }
  function combine(legs,grid,quote=null,now=Date.now()){
    if(legs.some(l=>['hr','touchdown'].includes(l.kind)))throw Error('Same-game player props need a player/game joint model. Use different matchups instead.');
    if(legs.length<2||legs.length>3||new Set(legs.map(l=>l.gameKey)).size!==1)throw Error('Use 2 or 3 selections from one matchup.');
    if(legs.some(l=>!base.valid(l,now)))throw Error('A selection is closed, stale or invalid.');
    if(new Set(legs.map(l=>l.book.trim().toLowerCase())).size!==1)throw Error('Use one sportsbook.');
    if(new Set(legs.map(l=>l.kind)).size!==legs.length)throw Error('Use one selection per market; duplicate and opposing markets are excluded.');
    if(!Array.isArray(grid)||!grid.length)throw Error('Refresh this sport to retain matching joint score scenarios.');
    const ml=legs.find(l=>l.kind==='moneyline'),sp=legs.find(l=>['spread','runline'].includes(l.kind));
    if(ml&&sp){
      let mOnly=false,sOnly=false;
      const bound=Math.max(100,Math.ceil(Math.abs(Number(sp.line)))+3);
      for(let margin=-bound;margin<=bound;margin++){
        const h=Math.max(0,margin),a=Math.max(0,-margin),m=outcome(ml,h,a)===1,s=outcome(sp,h,a)===1;
        mOnly ||= m&&!s;sOnly ||= s&&!m;
      }
      if(!mOnly||!sOnly)throw Error('These winner/spread selections are redundant or contradictory.');
    }
    let mass=0,hit=0,noLoss=0,allPush=0;
    const marginal=legs.map(()=>({win:0,push:0}));
    for(let h=0;h<grid.length;h++){
      if(!Array.isArray(grid[h]))throw Error('Invalid score scenarios.');
      for(let a=0;a<grid[h].length;a++){
        const w=grid[h][a];if(!Number.isFinite(w)||w<0)throw Error('Invalid score probability.');
        mass+=w;if(!w)continue;
        const outcomes=legs.map((l,i)=>{const v=outcome(l,h,a);if(v===1)marginal[i].win+=w;if(v===0)marginal[i].push+=w;return v;});
        if(outcomes.every(v=>v===1))hit+=w;
        if(outcomes.every(v=>v>=0))noLoss+=w;
        if(outcomes.every(v=>v===0))allPush+=w;
      }
    }
    if(Math.abs(mass-1)>1e-7)throw Error('Score scenarios do not sum to one.');
    if(marginal.some((m,i)=>Math.abs(m.win-legs[i].win)>1e-6||Math.abs(m.push-legs[i].push)>1e-6))throw Error('Joint scenarios do not match displayed probabilities. Refresh the forecast.');
    if(hit<1e-12)throw Error('No supported score wins every selection.');
    const decimal=em.decimal(quote),pushPossible=marginal.some(m=>m.push>1e-12),independent=legs.reduce((p,l)=>p*l.win,1);
    return {legs,mode:'same',hit,noLoss,anyLoss:1-noLoss,allPush,pushProbability:noLoss-hit,pushPossible,
      independent,correlation:hit-independent,decimal:decimal||null,american:decimal?Number(quote):null,
      ev:decimal&&!pushPossible?hit*decimal-1:null,stressEV:null,stressHit:null,signature:signature(legs)};
  }
  function search(input,opts={},now=Date.now()){
    const count=Number(opts.count??2),sort=opts.sort||'hit',minHit=Number(opts.minHit??.25),minLeg=Number(opts.minLeg??.5);
    if(![2,3].includes(count)||!Number.isFinite(minHit)||minHit<0||minHit>1||!Number.isFinite(minLeg)||minLeg<0||minLeg>1)throw Error('Same-game search supports 2 or 3 legs and valid probability limits.');
    const seen=new Set(),all=input.filter(l=>base.valid(l,now)&&l.win>=minLeg&&(opts.includeFlags||!l.flags?.length)&&!seen.has(l.id)&&seen.add(l.id));
    const games=[...new Set(all.map(l=>l.gameKey))].sort();let results=[],evaluated=0,accepted=0,limited=false;
    for(const key of games){
      const pool=all.filter(l=>l.gameKey===key).sort((a,b)=>b.win-a.win||a.id.localeCompare(b.id)).slice(0,12);
      function walk(start,legs){
        if(evaluated>=150000){limited=true;return;}
        if(legs.length===count){evaluated++;try{
          const t=combine(legs,opts.grids?.[key],opts.quotes?.[signature(legs)],now);
          if(t.hit>=minHit&&(sort==='hit'||t[sort==='payout'?'decimal':sort==='stress'?'stressEV':'ev']!=null)){accepted++;results.push(t);}
        }catch{}return;}
        for(let i=start;i<=pool.length-(count-legs.length);i++){walk(i+1,[...legs,pool[i]]);if(limited)break;}
      }
      walk(0,[]);if(limited)break;
    }
    results.sort((a,b)=>(sort==='payout'?b.decimal-a.decimal:sort==='ev'?b.ev-a.ev:b.hit-a.hit)||signature(a.legs).localeCompare(signature(b.legs)));
    return {results:results.slice(0,30),evaluated,accepted,available:all.length,pool:all.length,truncated:limited||games.some(k=>all.filter(l=>l.gameKey===k).length>12)};
  }
  const api={combine,search,outcome,signature};if(typeof module!=='undefined')module.exports=api;else root.ParlayJoint=api;
})(typeof globalThis!=='undefined'?globalThis:this);
