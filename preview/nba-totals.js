(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.NBATotals=api;})(globalThis,function(){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const n=x=>Number.isFinite(x)?x.toFixed(1):'—';
 function panel(g){
  const t=g.context?.totals;if(!t)return '';
  const a=t.away,h=t.home;
  const metrics=[['pace','Estimated possessions / 48 min'],['offense','Points scored / 100 possessions'],['defense','Points allowed / 100 possessions'],['three_rate','Three-point attempt share'],['ft_rate','FTA / FGA']];
  const cell=(v,k)=>['three_rate','ft_rate'].includes(k)?n(v*100)+'%':n(v);
  const availability=t.availability||{};
  const injury=['away','home'].map(side=>{
   const rows=availability.teams?.[g[side+'_id']]||[];
   return '<div><strong>'+esc(g[side])+'</strong>'+(availability.error?'<p class="meta">Availability feed unavailable.</p>':rows.length?'<ul>'+rows.map(r=>'<li><a href="'+esc(r.source)+'" target="_blank" rel="noreferrer">'+esc(r.name)+'</a><small>'+esc(r.status)+'</small></li>').join('')+'</ul>':'<p class="meta">No players listed by this feed.</p>')+'</div>';
  }).join('');
  return '<section class="nba-totals-panel"><h3>Totals matchup</h3><p class="meta">Estimated matchup pace: '+n(t.estimated_pace)+' possessions / 48 min · rolling estimates</p><div class="stat-team-head"><span>'+esc(g.away)+'</span><span>'+esc(g.home)+'</span></div>'+
   metrics.map(([k,label])=>'<div class="season-stat"><div><b>'+cell(a[k],k)+'</b><span>'+label+'</span><b>'+cell(h[k],k)+'</b></div></div>').join('')+
   '<details><summary>Reported player availability</summary><div class="nba-availability">'+injury+'</div><p class="meta">ESPN report checked '+(availability.retrieved_at?esc(new Date(availability.retrieved_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'}))+' ET':'—')+'. Player absences are context; they do not quantitatively adjust this forecast.</p></details><details><summary>How these totals inputs are used</summary><p class="meta">'+esc(t.method)+' '+(t.model_upgraded?'Pace challenger active.':'The original forecast model remains active: the pace/efficiency challenger did not improve later-game total-score error.')+'</p></details></section>';
 }
 return {panel};
});
