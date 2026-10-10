const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
function setup(file){
 let now=0;const prefs=new Map(),pauses=[];
 const ctx=vm.createContext({MProvider:class{},console,Date:class extends Date{static now(){return now;}},
 SharedPreferences:class{get(k){return prefs.get(k);}getString(k,d){return prefs.get(k)??d;}setString(k,v){prefs.set(k,v);}}});
 vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8')+'\nthis.Ext=DefaultExtension',ctx);
 const ext=new ctx.Ext();ext._pause=async ms=>{pauses.push(ms);now+=ms;};
 return {ext,prefs,pauses,now:()=>now,advance:ms=>{now+=ms;}};
}
const base='https://toki34.com',target=base+'/novel/123/456';
let count=0;
async function check(name,fn){await fn();count++;console.log('PASS: '+name);}
(async()=>{
 await check('normal list confirmation removes the second list request before a chapter',async()=>{
  const e=setup('toki31_novel.js');let probes=0,bodies=0;
  e.ext._verifyCandidate=async()=>{probes++;e.advance(2500);};
  await e.ext._withDomainFallback(base+'/rank',base,async()=> 'list');
  e.ext._resolveBaseUrl=async()=>base;e.ext._externalAuthEnabled=()=>true;
  e.ext._externalAuthNovel=async()=>{bodies++;e.advance(1000);return '<p>본문</p>';};
  assert.match(await e.ext.getHtmlContent('작품',target),/본문/);
  assert.equal(probes,1);assert.equal(bodies,1);assert.equal(e.now(),3500);
 });
 await check('persisted recent confirmation is reused by a new extension instance',async()=>{
  const e=setup('toki31_novel.js');e.prefs.set('toki_novel_verified_domain_v23',JSON.stringify({base,time:0}));
  e.ext._observeDomain=async()=>{throw Error('unnecessary domain request');};
  const r=await e.ext._withDomainFallback(target,base,async()=> 'body',{reuseVerifiedDomain:true});
  assert.equal(r.value,'body');assert.equal(e.now(),0);
 });
 await check('a successful authenticated body also removes the next chapter preflight',async()=>{
  const e=setup('toki31_novel.js');let probes=0,bodies=0;
  e.ext._resolveBaseUrl=async()=>base;e.ext._externalAuthEnabled=()=>true;
  e.ext._verifyCandidate=async()=>{probes++;throw Error('AUTH_REQUIRED');};
  e.ext._externalAuthNovel=async()=>{bodies++;return '<p>본문</p>';};
  await e.ext.getHtmlContent('작품',target);await e.ext.getHtmlContent('작품',target);
  assert.equal(probes,1);assert.equal(bodies,2);assert.equal(e.prefs.get('toki_novel_pending_auth_base'),'');
 });
 await check('expired, future-dated and different-origin confirmations require observation',async()=>{
  for(const record of [{base,time:-600000},{base,time:1},{base:'https://toki33.com',time:0}]){
   const e=setup('toki31_novel.js');let probes=0;e.prefs.set('toki_novel_verified_domain_v23',JSON.stringify(record));
   e.ext._verifyCandidate=async()=>{probes++;};
   await e.ext._withDomainFallback(target,base,async()=> 'body',{reuseVerifiedDomain:true});assert.equal(probes,1);
  }
 });
 await check('cached connection failure restores the full 20-second next-domain rule',async()=>{
  const e=setup('toki31_novel.js');e.ext._rememberVerifiedDomain(base);const probes=[];let bodies=0;
  e.ext._verifyCandidate=async b=>{probes.push({base:b,time:e.now()});if(b===base)throw Error('SocketException');};
  const r=await e.ext._withDomainFallback(target,base,async()=>{if(++bodies===1)throw Error('SocketException');return 'body';},{reuseVerifiedDomain:true});
  assert.equal(r.url,'https://toki35.com/novel/123/456');assert.equal(bodies,2);
  assert.deepEqual(probes,[{base,time:0},{base:'https://toki35.com',time:20000}]);
 });
 await check('cached challenge retains the current domain and requests authentication',async()=>{
  const e=setup('toki31_novel.js');e.ext._rememberVerifiedDomain(base);let probes=0;
  e.ext._verifyCandidate=async()=>{probes++;};
  await assert.rejects(e.ext._withDomainFallback(target,base,async()=>{throw Error('AUTH_REQUIRED');},{reuseVerifiedDomain:true}),/사람 인증/);
  assert.equal(probes,0);assert.equal(e.prefs.get('toki_novel_pending_auth_base'),base);
 });
 await check('pending authentication prevents cached-domain reuse',async()=>{
  const e=setup('toki31_novel.js');e.ext._rememberVerifiedDomain(base);e.prefs.set('toki_novel_pending_auth_base',base);let probes=0;
  e.ext._verifyCandidate=async()=>{probes++;throw Error('AUTH_REQUIRED');};
  await assert.rejects(e.ext._withDomainFallback(target,base,async()=> 'body',{reuseVerifiedDomain:true}),/사람 인증/);assert.equal(probes,1);
 });
 await check('missing chapters, TLS errors and server errors do not scan other domains',async()=>{
  for(const error of [Object.assign(Error('HTTP 404'),{statusCode:404}),Error('TLS timeout'),Object.assign(Error('javascript_timeout'),{externalAuthDiagnostic:true})]){
   const e=setup('toki31_novel.js');e.ext._rememberVerifiedDomain(base);let probes=0,bodies=0;e.ext._verifyCandidate=async()=>{probes++;};
   await assert.rejects(e.ext._withDomainFallback(target,base,async()=>{bodies++;throw error;},{reuseVerifiedDomain:true}),x=>x===error);
   assert.equal(probes,0);assert.equal(bodies,1);assert.equal(e.prefs.get('toki_novel_verified_domain_v23'),'');
  }
 });
 for(const file of ['toki31_novel.js','newtoki1_novel.js']){
  for(const readyAt of [400,7000])await check(file+' detects fast completion quickly and limits long-wait polling',async()=>{
   const e=setup(file);const id='11111111-1111-4111-a111-111111111111';let statuses=0,closed=0;
   e.ext._externalAuthEndpoint=()=> 'http://127.0.0.1:9898';
   e.ext._externalAuthJson=async(ep,path)=>{
    if(path==='/health')return {service:'rabbit-auth-server',protocol:1,ready:true};
    if(path==='/v1/jobs')return {id};
    if(path.endsWith('/manifest'))return {id,chapterUrl:target,kind:'novel',title:'제목',text:'본문 텍스트'};
    if(path.endsWith('/close')){closed++;return {state:'closed'};}
    statuses++;return {state:e.now()>=readyAt?'ready':'authenticating'};
   };
   assert.match(await e.ext._externalAuthNovel('작품',target),/본문 텍스트/);assert.equal(closed,1);
   if(readyAt===400){assert.equal(e.now(),500);assert.equal(statuses,3);assert.deepEqual(e.pauses,[250,250]);}
   else {assert.equal(e.now(),7250);assert(e.pauses.slice(0,20).every(ms=>ms===250));assert(e.pauses.slice(20).every(ms=>ms===750));}
  });
 }
 console.log('PASS: '+count+' reader latency checks');
})().catch(e=>{console.error(e);process.exitCode=1;});
