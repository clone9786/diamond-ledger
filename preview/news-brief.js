'use strict';
(() => {
  const host=document.createElement('section');host.id='top-stories';host.setAttribute('aria-label','Top stories');
  document.querySelector('.toolbar').before(host);
  const sport='all';let data={},error='',busy=false,request=0;
  const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stamp=s=>Number.isFinite(Date.parse(s))?new Date(s).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET':'Time unavailable';
  const url=s=>{try{const u=new URL(s);return u.protocol==='https:'&&['espn.com','www.espn.com'].includes(u.hostname)&&!u.username&&!u.password?u.href:null;}catch{return null;}};
  function draw(){
    const rows=(data.headlines||[]).filter(a=>url(a.url)).slice(0,10);
    const row=(a,i)=>`<li><span class="news-number">${String(i+1).padStart(2,'0')}</span><a href="${safe(url(a.url))}" target="_blank" rel="noopener noreferrer">${safe(a.title)}</a><span class="news-source">ESPN</span><time datetime="${safe(a.published_at)}">${safe(stamp(a.published_at))}</time></li>`;
    host.innerHTML=`<div class="news-bar"><h2>Top Stories <span>Across sports</span></h2><button id="news-refresh" ${busy?'disabled':''}>${busy?'Updating…':'Refresh News'}</button></div><p class="news-meta" role="status">ESPN top stories · ${error?safe(error)+' · Saved headlines retained':data.stale?'Saved headlines · Refresh for latest':data.generated_at?'Updated '+safe(stamp(data.generated_at)):'Publisher headlines'}${busy?' · Loading headlines…':''}</p><ol class="news-wire">${rows.slice(0,3).map(row).join('')}</ol>${rows.length>3?`<details class="news-more"><summary>More headlines (${rows.length-3})</summary><ol class="news-wire" start="4">${rows.slice(3).map((a,i)=>row(a,i+3)).join('')}</ol></details>`:''}${!rows.length&&!busy?'<p class="news-empty">No headlines available. Refresh News to check the feed.</p>':''}`;
  }
  async function load(refresh=false){
    if(globalThis.LEDGER_SHARED)refresh=false;
    const id=++request,chosen=sport;busy=true;error='';draw();
    try{
      const response=await fetch(globalThis.LEDGER_SHARED?'data/headlines-'+chosen+'.json':refresh?'/api/headlines/refresh':'/api/headlines?sport='+chosen,refresh?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sport:chosen})}:{cache:'no-store'});
      const value=await response.json();if(!response.ok)throw Error(value.error||'News feed unavailable');
      if(id===request)data=value;
    }catch(e){if(id===request)error=e.message;}
    finally{if(id===request){busy=false;draw();}}
  }
  host.addEventListener('click',e=>{if(e.target.id==='news-refresh'&&!busy)load(true);});
  load();
})();
