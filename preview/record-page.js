'use strict';
let recordSport=new URLSearchParams(location.search).get('sport')||'nfl';
if(!['nfl','cfb','nba','nhl'].includes(recordSport))recordSport='nfl';
function renderRecord(){document.querySelectorAll('[data-record]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.record===recordSport)));PickRecord.mount(recordSport,'#record-content',false);}
document.querySelectorAll('[data-record]').forEach(b=>b.onclick=()=>{recordSport=b.dataset.record;renderRecord();});
document.querySelector('#record-refresh').onclick=()=>location.reload();
renderRecord();
