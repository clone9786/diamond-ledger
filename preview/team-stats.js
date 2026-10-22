(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.TeamStats=api;})(globalThis,function(){
  'use strict';
  const feeds={},escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function load(sport){try{const r=await fetch('data/team-stats-'+sport+'.json',{cache:'no-store'});if(r.ok)feeds[sport]=await r.json();}catch{}return feeds[sport];}
  function team(sport,id){const f=feeds[sport];const year=new Date().getFullYear(),end=year+(new Date().getMonth()>=6?1:0);return (['nba','nhl'].includes(sport)?f?.model_season===end:f?.season===year)?f.teams?.[id]:null;}
  function line(sport,id){const t=team(sport,id);if(!t||t.stale)return '';const a=t.offense.points_rank,b=t.defense.points_rank;return a&&b?`<small class="season-ranks">${escape(feeds[sport].season_label||feeds[sport].season)} scoring ranks · OFF <b>#${a}</b> · DEF <b>#${b}</b></small>`:'';}
  function comparison(sport,g){
    const f=feeds[sport],a=team(sport,g.away_id),b=team(sport,g.home_id);if(!a||!b)return '<p class="meta">Season comparison loads with Update All.</p>';
    const metrics=sport==='nhl'?[['points','Final-score goals / game']]:sport==='nba'?[['points','Points / game'],['rebounds','Rebounds / game'],['assists','Assists / game'],['fg','Field goal %'],['three','Three-point %']]:[['yards','Total yards'],['passing','Passing yards'],['rushing','Rushing yards'],['points','Points'],['third_down','3rd down %']];
    const cell=(t,side,key)=>{const v=t[side]?.[key],rank=t[side]?.[key+'_rank'];return Number.isFinite(v)?`${v.toFixed(1)}${['third_down','fg','three'].includes(key)?'%':''} <small>${rank?'(#'+rank+')':''}</small>`:'—';};
    const stamp=new Date(f.generated_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'});
    return `<div class="season-comparison"><p class="meta">${escape(f.season_label||f.season+' regular season')} · ${f.team_count} ${sport==='nfl'?'NFL':sport==='nba'?'NBA':sport==='nhl'?'NHL':'FBS'} teams · per game · #1 is best</p>${['offense','defense'].map(side=>`<h3>${side==='offense'?'Offensive':'Defensive'} stats</h3><div class="stat-team-head"><span>${escape(g.away)}</span><span>${escape(g.home)}</span></div>${metrics.map(([key,label])=>`<div class="season-stat"><div><b>${cell(a,side,key)}</b><span>${label}</span><b>${cell(b,side,key)}</b></div><div class="stat-bars">${[a,b].map(t=>{const v=t[side]?.[key],other=(t===a?b:a)[side]?.[key],sum=(v||0)+(other||0);return `<i style="--fill:${sum>0?100*v/sum:0}%"></i>`;}).join('')}</div></div>`).join('')}`).join('')}<p class="meta">${a.stale||b.stale?'Saved stats; refresh pending. ':''}Updated ${escape(stamp)} ET · <a href="${escape(a.source)}" target="_blank" rel="noreferrer">ESPN</a></p></div>`;
  }
  return {load,line,comparison,team,feeds};
});
