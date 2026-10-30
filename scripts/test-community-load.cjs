const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),http=require("node:http"),crypto=require("node:crypto");
const {once}=require("node:events"),assert=require("node:assert/strict");
const {createCommunityApp}=require("../community/app");
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),"nichodev-load-"));fs.chmodSync(directory,0o700);
 const app=createCommunityApp({dbPath:path.join(directory,"isolated.sqlite"),origin:"http://isolated.test"});
 const socket=process.platform==="win32"?null:path.join(directory,"load.sock"),server=socket?app.listen(socket):app.listen(0,"127.0.0.1");await once(server,"listening");
 let peak=process.memoryUsage().rss;const timer=setInterval(()=>{peak=Math.max(peak,process.memoryUsage().rss);},20);
 function call(endpoint,body){return new Promise((resolve,reject)=>{
  const started=performance.now(),bytes=body?Buffer.from(JSON.stringify(body)):null;
  const request=http.request({...(socket?{socketPath:socket}:{host:"127.0.0.1",port:server.address().port}),path:"/api/community"+endpoint,method:bytes?"POST":"GET",headers:{Origin:"http://isolated.test","X-Nichodev-Client":"1",...(bytes?{"Content-Type":"application/json","Content-Length":bytes.length}:{})}},response=>{response.resume();response.on("end",()=>resolve({status:response.statusCode,ms:performance.now()-started}));});
  request.setTimeout(30000,()=>request.destroy(new Error("Tempo de resposta excedido.")));request.on("error",reject);request.end(bytes);
 });}
 try{
  const password=crypto.randomBytes(24).toString("hex"),body={username:"isolated_load",password};
  assert.equal((await call("/register",body)).status,201);
  // Authentication confirmation is internal only in this disposable load fixture.
  app.locals.db.exec("UPDATE users SET active=1,confirmation=NULL,confirmation_expiry=NULL");
  const timings=[];await Promise.all(Array.from({length:8},async()=>{for(let i=0;i<12;i++){const r=await call("/session");assert.equal(r.status,200);timings.push(r.ms);}}));
  const logins=await Promise.all(Array.from({length:4},()=>call("/login",body)));
  assert.ok(logins.every(r=>[200,503].includes(r.status)));assert.ok(logins.some(r=>r.status===200));
  timings.sort((a,b)=>a-b);
  console.log(JSON.stringify({isolated:true,requests:timings.length,concurrency:8,p95ms:Math.round(timings[Math.floor(timings.length*.95)]),loginSuccess:logins.filter(r=>r.status===200).length,loginBusy:logins.filter(r=>r.status===503).length,peakRssMB:Math.round(peak/1048576)}));
 }finally{
  clearInterval(timer);await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});app.locals.close();
  assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));fs.rmSync(directory,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
