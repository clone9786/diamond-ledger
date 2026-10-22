'use strict';
const NFLTouchdowns=(()=>{
  let payload=null,unavailable=false;
  const signed=x=>(x>0?'+':'')+Math.round(x);
  function mount(){
    document.querySelector('#td-watch')?.remove();const section=document.createElement('section');section.id='td-watch';section.className='section td-heading';
    section.innerHTML='<details><summary>Player touchdown estimates</summary><div class="td-content"></div></details>';const content=section.querySelector('.td-content');
    $('#football-detail').append(section);
    const entry=payload?.games?.[String(game.game_pk)],age=Date.now()-Date.parse(payload?.generated_at);
    if(!NFLDay.readiness(game).eligible||game.pipeline?.components?.touchdowns?.status!=='ok'||entry?.forecast_at!==game.generated_at){content.innerHTML+='<p class="note">Touchdown estimates unavailable until game readiness and current player data are verified.</p>';return;}
    if(!eligible(game)){content.innerHTML+='<p class="note">Closed matchup. No live touchdown model; pregame watch is not shown after kickoff.</p>';return;}
    if(!entry||!Number.isFinite(age)||age>86400000||age< -60000||entry.start_time!==game.start_time){content.innerHTML+=`<p class="note">${unavailable?'Touchdown source unavailable.':payload?'No current pregame touchdown watch for this matchup. Update NFL to rebuild.':'Loading saved touchdown watch...'}</p>`;return;}
    content.innerHTML+=`<p class="section-note">Scored touchdowns, not passing touchdowns. ${payload.history_season} history with shrinkage and a modest team-scoring adjustment. No current snap-share or red-zone model. Experimental estimates; supported in different-game parlays only.</p><p class="note">Player data retrieved ${esc(NFLDay.time(payload.generated_at))}. Team forecast ${esc(NFLDay.time(entry.forecast_at))}. Confirm participation in the book; inactive settlement rules vary.</p><div class="td-grid">${['away','home'].map(side=>{
      const rows=entry[side]||[],ready=rows.filter(r=>!r.unavailable&&r.estimate).sort((a,b)=>(a.position==='QB')-(b.position==='QB')||b.estimate.probability-a.estimate.probability),blocked=rows.filter(r=>r.unavailable||!r.estimate);
      const row=r=>`<div class="td-player">${r.headshot?`<img src="${esc(r.headshot)}" alt="" loading="lazy">`:''}<div><a href="${esc(r.source)}" target="_blank" rel="noreferrer"><b>${esc(r.name)}</b></a><small>${esc(r.position+' · '+r.status+' · role unverified')}</small><small>${r.estimate.scored_td} scored TD / ${r.stats.games} games · ${r.stats.carries} carries / ${r.stats.targets} targets</small><small>Heuristic fair odds ${signed(r.estimate.fair_american)}</small><label class="field">Your anytime odds<input data-td="${esc(side+':'+r.id)}" aria-label="${esc(r.name)} anytime touchdown odds" placeholder="e.g. +150" inputmode="text"></label><div class="td-price-result" id="td-price-${side}-${r.id}"></div></div><b>${pct(r.estimate.probability)}</b></div>`;
      return `<div><h4>${esc(game[side])}</h4>${ready.slice(0,4).map(row).join('')||'<p class="note">No eligible candidates with prior-season history.</p>'}<details><summary>More players / availability</summary>${ready.slice(4).map(row).join('')}${blocked.map(r=>`<p class="note">${esc(r.name)} · ${esc(r.status)} · ${esc(r.error||'Not shown as an eligible candidate')}</p>`).join('')}</details></div>`;
    }).join('')}</div><p class="note">An anytime prop can include unusual scoring events our historical estimate does not fully cover. These are not validated prop probabilities. Fair odds are a heuristic comparison, not a target price or recommendation.</p>`;
    section.querySelectorAll('[data-td]').forEach(input=>{
      const [side,id]=input.dataset.td.split(':'),r=entry[side].find(r=>String(r.id)===id),box=$('#td-price-'+side+'-'+id);
      PricesUI.propInput(input,{sport:'nfl',gameKey:PriceStore.gameKey(game),game_pk:game.game_pk,kind:'touchdown',side,playerId:id,line:.5,book:'DraftKings',forecast:entry.forecast_at,probability:r.estimate?.probability??null,label:r.name+' anytime TD (experimental)'},box);
    });
  }
  function currentEstimate(g,q){
    const entry=payload?.games?.[String(g.game_pk)],age=Date.now()-Date.parse(payload?.generated_at);
    if(!NFLDay.readiness(g).eligible||g.pipeline?.components?.touchdowns?.status!=='ok'||entry?.forecast_at!==g.generated_at)return null;
    if(unavailable||!eligible(g)||!entry||!Number.isFinite(age)||age>86400000||age< -60000||entry.start_time!==g.start_time)return null;
    const player=[...(entry.away||[]),...(entry.home||[])].find(p=>String(p.id)===String(q.playerId));
    return player&&!player.unavailable&&player.estimate?{probability:player.estimate.probability,forecast:entry.forecast_at}:null;
  }
  async function load(){payload=null;try{const r=await fetch('data/nfl-touchdowns.json',{cache:'no-store'});if(!r.ok)throw Error();payload=await r.json();unavailable=false;}catch{unavailable=true;}if($('#td-watch')&&game)mount();PriceStore.shared.touch();}
  load();return{mount,load,currentEstimate};
})();
