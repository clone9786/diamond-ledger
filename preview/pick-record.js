(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.PickRecord=api;})(globalThis,function(){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const names={nfl:'NFL',cfb:'College football',nba:'NBA',nhl:'NHL'},pct=x=>Number.isFinite(x)?(100*x).toFixed(1)+'%':'—';
 const units=x=>Number.isFinite(x)?(x>0?'+':'')+x.toFixed(2)+'u':'—';
 const odds=d=>d>=2?'+'+Math.round((d-1)*100):String(Math.round(-100/(d-1)));
 function label(r){const s=r.selection;return r.kind==='total'?(s.side==='over'?'Over ':'Under ')+s.line:(s.side==='home'?r.home:r.away)+' '+(s.line>0?'+':'')+s.line;}
 function html(data,sport,compact=false){
  const a=data.sports?.[sport]||{},rows=a.rows||[],flagged=rows.filter(r=>r.selected),pending=flagged.filter(r=>r.result==='pending');
  const ordered=[...flagged].sort((a,b)=>(a.result==='pending'?0:1)-(b.result==='pending'?0:1)||(a.result==='pending'?a.start_time.localeCompare(b.start_time):b.start_time.localeCompare(a.start_time)));
  const cards=['spread','total'].map(k=>{const r=a[k]||{};return '<div><strong>'+ (k==='spread'?(sport==='nhl'?'Puck line':'Spread'):'Total')+'</strong><b>'+(r.wins||0)+'–'+(r.losses||0)+'–'+(r.pushes||0)+'</b><small>Wins · losses · pushes</small><small>'+pct(r.hit_rate)+' hit rate · '+units(r.net_units)+' · '+pct(r.roi)+' ROI</small><small>'+(r.pending||0)+' pending · '+(r.passes||0)+' passes'+(r.void?' · '+r.void+' void':'')+'</small></div>';}).join('');
  const table=items=>'<div class="table-wrap"><table><thead><tr><th>Game / saved pick</th><th>Odds</th><th>Result</th><th>Net</th></tr></thead><tbody>'+items.map(r=>'<tr><td>'+esc(r.away+' at '+r.home)+'<small>'+esc(label(r))+'</small><small>Game '+esc(new Date(r.start_time).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'}))+' ET · saved '+esc(new Date(r.captured_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'}))+' ET</small></td><td>'+esc(odds(r.selection.decimal))+'</td><td class="pick-state '+esc(r.result)+'">'+esc(r.result)+(r.final?'<small>'+r.final.away+'–'+r.final.home+'</small>':'')+(r.settlement_note?'<small>'+esc(r.settlement_note)+'</small>':'')+'</td><td>'+units(r.net_units)+'</td></tr>').join('')+'</tbody></table></div>';
  return '<h2>'+esc(names[sport]||sport)+' / Pick record</h2><p class="meta">Locked spread and total selections · flat 1-unit singles · starts '+(data.activated_at?esc(new Date(data.activated_at).toLocaleDateString('en-US',{timeZone:'America/New_York'})):'with this release')+'</p><div class="pick-record-summary">'+cards+'</div>'+
   (flagged.length?table(compact?ordered.filter(r=>r.result==='pending').slice(0,4):ordered):'<p class="meta">No flagged picks recorded yet. Only selections saved before the game count.</p>')+
   (compact?'<p><a href="record.html?sport='+sport+'">All picks, results & passes ↗</a></p>':'<details><summary>Passes ('+rows.filter(r=>!r.selected).length+')</summary><p class="meta">These markets did not meet the fixed selection rule at their first eligible price.</p>'+table(rows.filter(r=>!r.selected))+'</details>')+
   '<details><summary>How the record works</summary><p class="meta">Within 24 hours of the game, the first valid DraftKings price is locked for each market. The model flags the side with the highest estimated return only if it reaches 3%; otherwise it records a pass. Later line moves never rewrite that decision. Hit rate excludes pushes; ROI includes every settled unit risked. Reported prices, not your actual betting history. Full-game overtime counts; NHL includes the shootout decision. Same-day start-time corrections up to one hour count only when the pick preceded both times; larger reschedules are void.</p></details>';
 }
 let cache=null,loaded=0;
 async function mount(sport,selector,compact=true){
  const parent=document.querySelector(selector);if(!parent)return;
  let host=parent.querySelector(':scope > .pick-record-panel');if(!host){host=document.createElement('section');host.className='pick-record-panel';parent.prepend(host);}
  host.dataset.sport=sport;
  try{
   if(!cache||Date.now()-loaded>10000){const r=await fetch('data/pick-record.json',{cache:'no-store'});if(!r.ok)throw Error('Pick record unavailable');cache=await r.json();loaded=Date.now();}
   if(host.dataset.sport===sport)host.innerHTML=html(cache,sport,compact);
  }catch{host.innerHTML='<h2>Pick record</h2><p class="meta">Pick record is updating. Refresh to retry.</p>';}
 }
 return {html,label,mount};
});
