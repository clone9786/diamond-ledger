(function(root){'use strict';
  const em=typeof module!=='undefined'?require('./engine-markets.js'):root.EngineMarkets;
  function probability(p,kind,side,line){
    if(!({moneyline:['home','away'],total:['over','under'],runline:['home','away']}[kind]||[]).includes(side))throw Error('Invalid market side.');
    if(kind==='moneyline')return{win:side==='home'?p.home_probability:1-p.home_probability,push:0};
    if(line===''||line==null||!Number.isFinite(Number(line))||Number(line)*2!==Math.round(Number(line)*2)||Math.abs(Number(line))>40||kind==='total'&&Number(line)<0)throw Error('Invalid run line.');
    if(kind==='total')return em.distribution(p.total_pmf,0,Number(line),side==='over');
    return em.distribution(p.margin_pmf,p.margin_offset,side==='home'?-Number(line):Number(line),side==='home');
  }
  function price(p,q,stake=100){const d=em.decimal(q.odds);if(!d)return null;const v=probability(p,q.kind,q.side,q.line),loss=1-v.win-v.push;return{...q,...v,loss,decimal:d,breakEven:1/d,ev:stake*(v.win*(d-1)-loss),conditionalWin:v.win/Math.max(1e-10,1-v.push)};}
  function parse(text){return text.trim().split(/\r?\n/).filter(Boolean).map((s,i)=>{const a=s.split(/[|,\t]/).map(x=>x.trim().toLowerCase());if(a.length!==4)throw Error('Row '+(i+1)+': use market | side | line | odds.');const[kind,side,line,odds]=a;if(!({moneyline:['home','away'],total:['over','under'],runline:['home','away']}[kind]||[]).includes(side))throw Error('Row '+(i+1)+': unknown market or side.');if(!em.decimal(odds))throw Error('Row '+(i+1)+': invalid American odds.');if(kind!=='moneyline'&&(!line||!Number.isFinite(Number(line))||Number(line)*2!==Math.round(Number(line)*2)||Math.abs(Number(line))>40||kind==='total'&&Number(line)<0))throw Error('Row '+(i+1)+': invalid run line.');return{kind,side,line:kind==='moneyline'?null:Number(line),odds:Number(odds)};});}
  const api={probability,price,parse};if(typeof module!=='undefined')module.exports=api;else root.DeskMath=api;
})(typeof globalThis!=='undefined'?globalThis:this);
