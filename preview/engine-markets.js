(function(root){
  'use strict';
  function distribution(pmf,offset,line,greater){
    if(!Number.isFinite(line)||!Number.isFinite(offset)||!pmf.length||pmf.some(p=>!Number.isFinite(p)||p<0)) throw Error('Invalid distribution or line.');
    const sum=pmf.reduce((a,b)=>a+b,0);if(Math.abs(sum-1)>1e-6)throw Error('Probability mass must sum to one.');
    let win=0,push=0;pmf.forEach((p,i)=>{const v=i+offset;if(Math.abs(v-line)<1e-9)push+=p;else if(greater?v>line:v<line)win+=p;});
    return {win,push,loss:Math.max(0,1-win-push)};
  }
  function decimal(value){if(value===''||value===null||typeof value==='boolean')return null;const n=Number(value);return Number.isFinite(n)&&Math.abs(n)>=100&&Math.abs(n)<=100000?(n>0?1+n/100:1+100/-n):null;}
  function moneyline(p,home,away){const h=decimal(home),a=decimal(away);if(h===null||a===null||!Number.isFinite(p)||p<=0||p>=1)return null;const fair=(1/h)/(1/h+1/a);return{marketHome:fair,overround:1/h+1/a-1,homeEV:100*(p*h-1),awayEV:100*((1-p)*a-1),homeEdge:p-fair};}
  const api={distribution,decimal,moneyline};if(typeof module!=='undefined')module.exports=api;else root.EngineMarkets=api;
})(typeof globalThis!=='undefined'?globalThis:this);
