'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {WebSocketServer,WebSocket}=require('ws');
const PORT=Number(process.env.PORT||3000);const rooms=new Map(), TTL=4*60*60*1000;
const roles=['emissor','espiao','receptor'];
const rand=n=>crypto.randomInt(n),coin=()=>rand(2),code=()=>crypto.randomBytes(4).toString('hex').toUpperCase();
const photon=()=>({base:coin(),bit:coin()});
const symbol=p=>(p.base===0?(p.bit?'|':'—'):(p.bit?'/':'\\'));
function safe(ws,msg){if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(msg));}
function peer(room,role,msg){safe(room.members[role]?.ws,msg)}
function note(room){return {type:'status',code:room.code,stage:room.stage,mode:room.mode,connected:Object.fromEntries(roles.map(r=>[r,Boolean(room.members[r]?.ws?.readyState===WebSocket.OPEN)])),counts:{emissor:room.original.length,espiao:room.spy.length,receptor:room.receiver.length},revelado:room.stage==='results'};}
function broadcast(room){for(let role of roles){peer(room,role,note(room));sendRole(room,role)}}
function sendRole(room,role){let data={type:'view',role,stage:room.stage,mode:room.mode,code:room.code};
 if(role==='emissor'){data.own=room.original; if(['reveal','results'].includes(room.stage))data.receiverBases=room.receiver.map(x=>x.base); if(room.stage==='results')data.result={...room.result.public,key:room.result.senderKey};}
 if(role==='espiao'){data.incoming=room.original.length===10&&room.mode==='attack'?room.original.map(()=>"◈"):[];data.own=room.spy.map(({base,bit})=>({base,bit})); if(room.stage==='results')data.result={...room.result.public};}
 if(role==='receptor'){data.incoming=room.mode==='direct'?room.original.length===10?room.original.map(()=>"◈"):[]:room.spy.length===10?room.spy.map(()=>"◈"):[];data.own=room.receiver; if(['reveal','results'].includes(room.stage))data.senderBases=room.original.map(x=>x.base); if(room.stage==='results')data.result={...room.result.public,key:room.result.receiverKey};}
 peer(room,role,data);
}
function err(ws,msg){safe(ws,{type:'error',message:msg})}
function validateRoom(code){return typeof code==='string'&&/^[A-F0-9]{8}$/.test(code)}
function stage(room){if(room.original.length<10)return 'emit';if(room.mode==='attack'&&room.spy.length<10)return 'spy';if(room.receiver.length<10)return 'receive';return room.stage==='results'?'results':'reveal'}
function result(room){
 const kept=[],discarded=[],tested=[];
 for(let i=0;i<10;i++)(room.original[i].base===room.receiver[i].base?kept:discarded).push(i);
 const sample=kept.slice(0,2),keyPositions=kept.slice(2);
 for(const i of sample){const a=room.original[i].bit,b=room.receiver[i].bit;tested.push({pos:i+1,emissor:a,receptor:b,error:a!==b});}
 const senderKey=keyPositions.map(i=>room.original[i].bit).join('');
 const receiverKey=keyPositions.map(i=>room.receiver[i].bit).join('');
 const mismatchPositions=keyPositions.filter(i=>room.original[i].bit!==room.receiver[i].bit).map(i=>i+1);
 const alteredPositions=room.mode==='attack'?room.spy.map((p,i)=>p.bit!==room.original[i].bit?i+1:null).filter(Boolean):[];
 const spyWrongPositions=room.mode==='attack'?room.spy.map((p,i)=>!p.correct?i+1:null).filter(Boolean):[];
 const samples=sample.length,errors=tested.filter(t=>t.error).length;
 const status=keyPositions.length===0?'insufficient':mismatchPositions.length?'divergent':'matching';
 return {senderKey,receiverKey,public:{kept:kept.map(i=>i+1),discarded:discarded.map(i=>i+1),tested,errors,samples,rate:samples?100*errors/samples:null,
  keyPositions:keyPositions.map(i=>i+1),status,mismatchPositions,alteredPositions,spyWrongPositions,mode:room.mode,
  spyWrong:spyWrongPositions.length,altered:alteredPositions.length}};
}
function handle(ws,m){if(!m||typeof m!=='object'||Array.isArray(m))return err(ws,'Mensagem inválida.');
 if(m.action==='join'){
  let role=m.role,room,roomCode=String(m.code||'').trim().toUpperCase();if(!roles.includes(role))return err(ws,'Selecione um papel válido.');
  if(m.create){if(role!=='emissor')return err(ws,'Somente o Emissor cria a sala.');roomCode=code();while(rooms.has(roomCode))roomCode=code();room={code:roomCode,mode:m.mode==='direct'?'direct':'attack',members:{},original:[],spy:[],receiver:[],stage:'emit',created:Date.now()};rooms.set(roomCode,room)}
  else {if(!validateRoom(roomCode)||!(room=rooms.get(roomCode)))return err(ws,'Sala inexistente ou expirada.');}
  const existing=room.members[role];let token=typeof m.token==='string'?m.token:'';
  if(existing&&existing.token!==token)return err(ws,'Esse papel já foi reservado. Use outra sala ou retorne no navegador que entrou primeiro.');
  if(existing&&existing.ws&&existing.ws!==ws)try{existing.ws.close(4000,'Reconectado')}catch{}
  const t=existing?existing.token:crypto.randomBytes(24).toString('hex');room.members[role]={token:t,ws};ws.room=roomCode;ws.role=role;
  safe(ws,{type:'joined',role,code:roomCode,token:t,mode:room.mode});broadcast(room);return;
 }
 if(!ws.room||!ws.role)return err(ws,'Entre em uma sala antes.');const room=rooms.get(ws.room);if(!room||room.members[ws.role]?.ws!==ws)return err(ws,'Sua sessão expirou.');let r=ws.role;
 if(m.action==='flip'){
  if(room.stage!==({emissor:'emit',espiao:'spy',receptor:'receive'}[r]))return err(ws,'Aguarde sua etapa.');
  if(r==='emissor')room.original.push(photon());
  else {let source=r==='espiao'?room.original:room.mode==='direct'?room.original:room.spy;let basis=coin(),p=source[(r==='espiao'?room.spy:room.receiver).length],correct=p.base===basis;let bit=correct?p.bit:coin();(r==='espiao'?room.spy:room.receiver).push({base:basis,bit,...(r==='espiao'?{correct}:{})});}
  room.stage=stage(room);broadcast(room);return;
 }
 if(m.action==='flipAll'){
  if(room.stage!==({emissor:'emit',espiao:'spy',receptor:'receive'}[r]))return err(ws,'Aguarde sua etapa.');
  while(room.stage===({emissor:'emit',espiao:'spy',receptor:'receive'}[r])&&([room.original,room.spy,room.receiver][roles.indexOf(r)].length)<10){
   if(r==='emissor')room.original.push(photon());else {let source=r==='espiao'?room.original:room.mode==='direct'?room.original:room.spy;let target=r==='espiao'?room.spy:room.receiver,basis=coin(),p=source[target.length],correct=p.base===basis;target.push({base:basis,bit:correct?p.bit:coin(),...(r==='espiao'?{correct}:{})})}room.stage=stage(room);
  }broadcast(room);return;
 }
 if(m.action==='finish'){
  if(r!=='receptor'||room.stage!=='reveal')return err(ws,'Aguardando a conclusão da medição e revelação de bases.');room.result=result(room);room.stage='results';broadcast(room);return;
 }
 err(ws,'Ação desconhecida.');
}
const server=http.createServer((req,res)=>{
 if(req.url==='/health'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end('ok')}
 let file=req.url==='/'?'/index.html':String(req.url||'').split('?')[0];if(!['/','/index.html','/style.css','/app.js'].includes(file)){res.writeHead(404);return res.end('Not found')}
 const absolute=path.join(__dirname,file==='/'?'index.html':file.slice(1));fs.readFile(absolute,(e,bytes)=>{if(e){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; connect-src 'self' ws: wss:; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'"});res.end(bytes)})
});const wss=new WebSocketServer({server,maxPayload:4096});wss.on('connection',ws=>{ws.on('message',data=>{try{handle(ws,JSON.parse(data.toString()))}catch(e){err(ws,'Não foi possível processar a ação.')}});ws.on('close',()=>{let room=rooms.get(ws.room);if(room&&room.members[ws.role]?.ws===ws){room.members[ws.role].ws=null;broadcast(room)}})});
setInterval(()=>{let now=Date.now();for(let [k,v] of rooms)if(now-v.created>TTL){for(let role of roles)try{v.members[role]?.ws?.close(4001,'Sala expirada')}catch{};rooms.delete(k)}},60000).unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`Missão 3 ouvindo porta ${PORT}`));
