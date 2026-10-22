(function(root){
  'use strict';
  function conditions(legs){
    let low=-Infinity,high=Infinity;const totals=[];
    for(const l of legs){
      if(l.kind==='moneyline'){if(l.side==='home')low=Math.max(low,1);else high=Math.min(high,-1);}
      if(['spread','runline'].includes(l.kind)){if(l.side==='home')low=Math.max(low,Math.floor(-Number(l.line))+1);else high=Math.min(high,Math.ceil(Number(l.line))-1);}
      if(l.kind==='total')totals.push(l.side==='over'?'Total at least '+(Math.floor(Number(l.line))+1):'Total at most '+(Math.ceil(Number(l.line))-1));
    }
    const home=legs[0]?.home||'Home team',away=legs[0]?.away||'Away team';
    let margin='';
    if(Number.isFinite(low)&&Number.isFinite(high))margin=low>high?'No winning margin':low>0?home+' by '+low+(low===high?'':'–'+high):high<0?away+' by '+(-high)+(low===high?'':'–'+(-low)):'Home minus away score: '+low+' to '+high;
    else if(Number.isFinite(low))margin=low>0?home+' by at least '+low:home+' wins, ties, or loses by at most '+(-low);
    else if(Number.isFinite(high))margin=high<0?away+' by at least '+(-high):away+' wins, ties, or loses by at most '+high;
    return [margin,...totals].filter(Boolean).join('; ');
  }
  function overlap(t,tickets){return tickets.filter(other=>other!==t&&other.legs.some(l=>t.legs.some(x=>x.gameKey===l.gameKey))).length;}
  function emptyReason(pool,opts){
    if(!pool.length)return 'No eligible priced selections for these dates and markets. Check the exclusions below.';
    const unflagged=pool.filter(l=>opts.includeFlags||!l.flags?.length);
    if(!unflagged.length)return 'All matching selections need review. Include flagged inputs to inspect experimental scenarios; unavailable data stays blocked.';
    const eligible=unflagged.filter(l=>l.win>=opts.minLeg);
    if(!eligible.length)return 'No selections meet the minimum leg chance.';
    if(opts.mode==='same')return 'No supported joint-score ticket meets these limits. Same-game prices need a combined quote for payout or return ranking.';
    if(opts.mode==='mixed'&&new Set(eligible.map(l=>l.sport)).size<2)return 'Mixed sports needs eligible selections from at least two sports.';
    if(new Set(eligible.map(l=>l.gameKey)).size<opts.count)return 'Not enough distinct matchups for '+opts.count+' legs after filters. Same game mode supports multiple game-market legs from one matchup.';
    return 'No tickets meet the ticket-chance threshold within the bounded search. Longer tickets have lower joint hit chances.';
  }
  function comparison(t){
    if(t.mode!=='same'||![t.hit,t.independent].every(p=>Number.isFinite(p)&&p>=0&&p<=1))return '';
    return '<figure class="joint-comparison"><figcaption>Same-game connection <small>Experimental estimate</small></figcaption>'+[[t.hit,'Together in the score model'],[t.independent,'If the legs were independent']].map(([p,label])=>'<div><span>'+label+'</span><b>'+(p*100).toFixed(1)+'%</b><span class="comparison-track" aria-hidden="true"><i style="width:'+(p*100)+'%"></i></span></div>').join('')+'</figure>';
  }
  const api={conditions,overlap,emptyReason,comparison};if(typeof module!=='undefined')module.exports=api;else root.ParlayDisplay=api;
})(typeof globalThis!=='undefined'?globalThis:this);
