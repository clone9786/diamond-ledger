(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.NHLGoalies=api;})(globalThis,function(){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const sv=x=>Number.isFinite(x)?x.toFixed(3).replace(/^0/,''):'—';
 const record=g=>g&&[g.wins,g.losses,g.ot].every(Number.isFinite)?g.wins+'–'+g.losses+'–'+g.ot:'Unavailable';
 function line(g,side){
  const c=g.context?.goalies?.[side];if(!c)return '';
  const p=c.goalie;
  return '<small class="goalie-line">'+esc(c.status==='unannounced'?'Starter unannounced':c.status+' · '+p.name+' · '+sv(p.save_percentage)+' SV%')+'</small>';
 }
 function panel(g){
  const data=g.context?.goalies;if(!data)return '<p class="meta">Goalie information updates with the NHL slate.</p>';
  const cards=['away','home'].map(side=>{
   const c=data[side],p=c?.goalie;
   if(!p)return '<div class="goalie-card"><strong>'+esc(g[side])+'</strong><span class="goalie-status">Starter unannounced</span></div>';
   const row=(name,value)=>'<div><dt>'+name+'</dt><dd>'+esc(value)+'</dd></div>';
   return '<div class="goalie-card"><small>'+esc(g[side])+'</small><strong><a href="'+esc(p.source)+'" target="_blank" rel="noreferrer">'+esc(p.name)+'</a></strong><span class="goalie-status">'+esc(c.status)+'</span><dl>'+
    row('W–L–OT',record(p))+row('Save %',sv(p.save_percentage))+row('Shots faced',p.shots_faced??'—')+row('Starts',p.starts??'—')+row('Last 5 appearances SV%',sv(p.recent_save_percentage))+
    row('Rest',p.rest_days===null?'—':p.rest_days+' days')+row('Last 7 days',Number.isFinite(p.starts_last7)?p.starts_last7+' starts · '+p.shots_last7+' shots':'Unavailable')+'</dl></div>';
  }).join('');
  const stamp=new Date(data.retrieved_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'});
  return '<section class="goalie-panel"><h3>Starting goalies</h3><div class="goalie-grid">'+cards+'</div><p class="goalie-source">ESPN · checked '+esc(stamp)+' ET · stats through the prior game day</p><details><summary>Goalie model</summary><p class="meta">'+esc(data.model_applied?'Goalie and shot-volume model active. '+data.method:'Team baseline retained for this matchup.')+' Save percentages use shots faced; the model reduces the weight of small samples. W–L is shown as context. These are not shot-quality-adjusted expected-goals statistics.</p></details></section>';
 }
 return {line,panel,sv};
});
