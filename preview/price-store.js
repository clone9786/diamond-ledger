(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {root.PriceStore=api;let storage;try{storage=root.localStorage;}catch{}api.shared=api.create({storage,notify:detail=>root.dispatchEvent(new CustomEvent('prices-changed',{detail}))});root.addEventListener('storage',e=>{if(e.key===null||e.key===api.KEY||Object.values(api.legacyKeys).includes(e.key))api.shared.touch();});}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // list({sport,games,reported,legacy}) is the shared candidate interface. No forecast is mutated.
  // Identity deliberately includes the line: a manual -3 quote never replaces reported -3.5.
  const KEY='diamond-selections-v1',legacyKeys={mlb:'diamond-prices',nfl:'diamond-nfl-prices-v1',cfb:'diamond-football-prices-v1'};
  const number=x=>x===null||x===undefined||typeof x==='boolean'||String(x).trim()===''?null:Number.isFinite(Number(x))?Number(x):null;
  const decimal=x=>{const n=number(x);return n!==null&&Math.abs(n)>=100?(n>0?1+n/100:1-100/n):null;};
  const gameKey=g=>(g.date||String(g.start_time||'').slice(0,10))+':'+g.game_pk;
  function identity(r){return [r.sport,r.gameKey,r.kind,r.side,r.playerId??'',r.line??''].map(encodeURIComponent).join('|');}
  function normalize(r){
    const sport=r.sport==='college-football'?'cfb':String(r.sport||'').toLowerCase(),kind=r.kind;
    const rawLine=number(r.line),line=kind==='moneyline'?null:rawLine===0?0:rawLine,odds=number(r.odds),probability=number(r.probability);
    const v={...r,sport,gameKey:r.gameKey||gameKey(r),game_pk:r.game_pk,kind,side:r.side||'yes',playerId:r.playerId==null?null:String(r.playerId),line,odds,book:r.book||'DraftKings',source:r.source||'manual',enteredAt:r.enteredAt||null,observed:r.observed||r.quote_updated_at||r.retrieved_at||null,forecast:r.forecast??null,probability:probability!==null&&probability>=0&&probability<=1?probability:null,label:r.label||kind};
    v.stale=!!r.stale;v.id=identity(v);return v;
  }
  function fromLegacy(sport,g,f={}){
    if(!f||typeof f!=='object')return [];
    const mlb=sport==='mlb',spread=number(mlb?f.homeLine:f.fs),total=number(mlb?f.total:f['cfb-line']);
    return [['moneyline','away',mlb?'awayML':'fa',null],['moneyline','home',mlb?'homeML':'fh',null],['total','over',mlb?'overOdds':'fo',total],['total','under',mlb?'underOdds':'fu',total],[mlb?'runline':'spread','away',mlb?'awayRL':'fas',spread===null?null:-spread],[mlb?'runline':'spread','home',mlb?'homeRL':'fhs',spread]].flatMap(([kind,side,key,line])=>{
      if(!decimal(f[key])||(kind!=='moneyline'&&line===null))return [];
      return [normalize({sport,gameKey:gameKey(g),game_pk:g.game_pk,kind,side,line,odds:f[key],book:f.book,source:'manual',enteredAt:Object.prototype.hasOwnProperty.call(f.selectionEnteredAt||{},key)?f.selectionEnteredAt[key]:f.enteredAt,forecast:f.forecast,label:kind==='total'?side+' '+line:g[side]+(kind==='moneyline'?' ML':' '+(line>0?'+':'')+line),legacyField:key})];
    });
  }
  function fromReported(sport,g,entry){
    const e=entry===undefined&&sport==='nfl'?g.gameday:entry,m=e?.market;if(!m)return [];
    const f={book:m.book,awayML:m.away_ml,homeML:m.home_ml,homeLine:m.home_spread,total:m.total,awayRL:m.away_spread_odds,homeRL:m.home_spread_odds,overOdds:m.over_odds,underOdds:m.under_odds,fa:m.away_ml,fh:m.home_ml,fs:m.home_spread,fas:m.away_spread_odds,fhs:m.home_spread_odds,'cfb-line':m.total,fo:m.over_odds,fu:m.under_odds};
    return fromLegacy(sport,g,f).map(r=>normalize({...r,line:r.side==='away'&&['spread','runline'].includes(r.kind)?number(m.away_spread)??r.line:r.line,source:e.source||'ESPN',observed:e.quote_updated_at||e.retrieved_at,retrieved_at:e.retrieved_at,quote_updated_at:e.quote_updated_at||null,source_url:e.source_url||null,stale:!!e.stale,error:e.error||null,legacyField:undefined}));
  }
  const reportedTime=r=>Date.parse(r.quote_updated_at||r.observed||r.retrieved_at)||0;
  function resolve(records){const map=new Map();for(const raw of records){const r=normalize(raw);if(!decimal(r.odds))continue;const old=map.get(r.id),manual=r.source==='manual',oldManual=old?.source==='manual';if(!old||manual&&!oldManual||manual&&oldManual&&(Date.parse(r.enteredAt)||0)>=(Date.parse(old.enteredAt)||0)||!manual&&!oldManual&&reportedTime(r)>=reportedTime(old))map.set(r.id,r);}return [...map.values()];}
  function stampLegacy(sport,g,form,previous={},forecast=null,now=new Date().toISOString()){
    const timestamps={...previous.selectionEnteredAt},old=fromLegacy(sport,g,previous),next=fromLegacy(sport,g,form);let changed=false;
    for(const q of old)if(!Object.prototype.hasOwnProperty.call(timestamps,q.legacyField))timestamps[q.legacyField]=q.enteredAt;
    for(const q of next){const before=old.find(p=>p.id===q.id);if(!before||before.odds!==q.odds||before.book!==q.book){timestamps[q.legacyField]=now;changed=true;}}
    return {...form,enteredAt:changed?now:previous.enteredAt||null,selectionEnteredAt:timestamps,forecast:changed?forecast??previous.forecast??null:previous.forecast??null};
  }
  function clearLegacyForm(record,form={}){
    const r=normalize(record),g={game_pk:r.game_pk,date:r.gameKey.slice(0,r.gameKey.lastIndexOf(':'))};
    const match=fromLegacy(r.sport,g,form).find(q=>q.id===r.id);
    return match?{...form,[match.legacyField]:''}:{...form};
  }
  function sortRows(rows,key,direction='ascending'){
    const sign=direction==='descending'?-1:1;
    return rows.map((r,i)=>({r,i})).sort((a,b)=>{const x=a.r[key],y=b.r[key],nx=x==null||x===''||typeof x==='number'&&!Number.isFinite(x),ny=y==null||y===''||typeof y==='number'&&!Number.isFinite(y);if(nx||ny)return nx===ny?a.i-b.i:nx?1:-1;const v=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),undefined,{numeric:true});return v*sign||a.i-b.i;}).map(x=>x.r);
  }
  function create({storage,notify=()=>{}}={}){
    const read=(key,fallback)=>{try{return JSON.parse(storage?.getItem(key))??fallback;}catch{return fallback;}};
    let saved=read(KEY,{});if(!saved||typeof saved!=='object'||Array.isArray(saved))saved={};
    const listeners=new Set();let persisted=true;
    function sync(){if(!persisted||!storage)return;try{const value=JSON.parse(storage.getItem(KEY)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))saved=value;}catch{}}
    function emit(){const detail={persisted};listeners.forEach(fn=>fn(detail));notify(detail);}
    function write(){try{if(!storage)throw Error();storage.setItem(KEY,JSON.stringify(saved));persisted=true;}catch{persisted=false;}emit();return persisted;}
    function save(record){sync();const r=normalize({...record,source:'manual',enteredAt:new Date().toISOString()});if(!decimal(r.odds))throw Error('Enter American odds such as -110 or +150.');saved[r.id]=r;write();return r;}
    function remove(record){sync();const r=typeof record==='string'?saved[record]:record,id=typeof record==='string'?record:identity(normalize(record));delete saved[id];
      if(r){const key=legacyKeys[r.sport],forms=read(key,{});if(forms[r.gameKey]){forms[r.gameKey]=clearLegacyForm(r,forms[r.gameKey]);try{storage?.setItem(key,JSON.stringify(forms));}catch{persisted=false;}}}write();}
    function list({sport,games=[],reported={},legacy}={}){
      sync();
      sport=sport==='college-football'?'cfb':sport;const forms=legacy??read(legacyKeys[sport],{}),base=[];
      for(const g of games){if(sport==='nfl')base.push(...fromReported(sport,g,g.gameday));base.push(...fromReported(sport,g,reported.games?.[g.game_pk]),...fromLegacy(sport,g,forms?.[gameKey(g)]));}
      const keys=new Set(games.map(gameKey));base.push(...Object.values(saved).filter(r=>r.sport===sport&&(!games.length||keys.has(r.gameKey))));return resolve(base);
    }
    function get(record){sync();return saved[typeof record==='string'?record:identity(normalize(record))]||null;}
    function gameSelections(sport,game,legacyForm,reportedRecord){return list({sport,games:[game],...(legacyForm===undefined?{}:{legacy:{[gameKey(game)]:legacyForm}}),reported:{games:{[game.game_pk]:reportedRecord}}});}
    return {save,remove,list,get,gameSelections,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},touch:emit,get persisted(){return persisted;}};
  }
  const api={KEY,legacyKeys,normalize,identity,gameKey,decimal,fromLegacy,fromReported,resolve,clearLegacyForm,stampLegacy,sortRows,create};
  // Browser wrapper includes shared persistent props. Node callers inject storage with create().
  api.gameSelections=(sport,game,legacyForm,reportedRecord)=>(api.shared||create()).gameSelections(sport,game,legacyForm,reportedRecord);
  return api;
});
