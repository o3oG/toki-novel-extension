const fs=require('fs'), vm=require('vm'), assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/toki31_novel.js','utf8');
function setup(){
 let now=0,next=1;const timers=new Map(),prefs=new Map();
 const context=vm.createContext({MProvider:class{},console,Date:class extends Date{static now(){return now;}},setTimeout:(fn,ms)=>{const id=next++;timers.set(id,{fn,time:now+ms});return id;},clearTimeout:id=>timers.delete(id),SharedPreferences:class{get(k){return prefs.get(k);}getString(k,d){return prefs.get(k)??d;}setString(k,v){prefs.set(k,v);}}});
 vm.runInContext(source+'\nglobalThis.Extension=DefaultExtension;',context);
 const ext=new context.Extension();
 const advance=async ms=>{now+=ms;for(const[id,t]of [...timers])if(t.time<=now){timers.delete(id);t.fn();}await Promise.resolve();};
 ext._pause=advance;
 return {ext,advance,timers,prefs,context,now:()=>now};
}
const ids=['11111111-1111-4111-a111-111111111111','22222222-2222-4222-a222-222222222222','33333333-3333-4333-a333-333333333333'];
const target='https://toki33.com/novel/123/456';
function server(env,failures,options={}){
 const calls=[],requestIds=[],targets=[];let created=0;
 env.ext._externalAuthEndpoint=()=> 'http://127.0.0.1:9898';
 env.ext._externalAuthJson=async(ep,path,body,ignore,seconds)=>{
  calls.push({path,seconds});
  if(path==='/health')return {service:'rabbit-auth-server',protocol:1,ready:true};
  if(path==='/v1/jobs'){requestIds.push(body.requestId);targets.push(body.url);return{id:ids[created++]};}
  if(path.endsWith('/close')){if(options.closeThrows)throw Error('close down');return{state:'closed'};}
  if(path.endsWith('/manifest'))return{id:ids[created-1],chapterUrl:options.mismatch?'other':targets[created-1],kind:'novel',text:'본문 텍스트',title:'제목'};
  await env.advance(options.delay||8000);
  const code=failures[created-1];return code?{state:'failed',error:code}:{state:'ready'};
 };
 return {calls,requestIds,targets,created:()=>created};
}
async function main(){
 let count=0;
 {const e=setup(),s=server(e,['javascript_timeout','main_thread_timeout']); const html=await e.ext._externalAuthNovel('회차',target);assert.match(html,/본문 텍스트/);assert.equal(s.created(),3);assert.equal(s.calls.filter(x=>x.path.endsWith('/close')).length,3);assert.equal(new Set(s.requestIds).size,3);assert(s.calls.every(x=>x.seconds>0&&x.seconds<=15));count++;}
 {const e=setup(),s=server(e,['javascript_timeout','javascript_timeout','javascript_timeout']);await assert.rejects(e.ext._externalAuthNovel('회차',target),err=>/attempt=3\/3/.test(err.message)&&/진행 기록/.test(err.message)&&/자동 재시도 2\/2/.test(err.message));assert.equal(s.created(),3);assert.equal(s.calls.filter(x=>x.path.endsWith('/close')).length,3);count++;}
 for(const code of ['auth_required','job_cancelled','request_origin_not_allowed','novel_text_empty','server_code_missing']){const e=setup(),s=server(e,[code]);await assert.rejects(e.ext._externalAuthNovel('회차',target));assert.equal(s.created(),1);count++;}
 {const e=setup(),s=server(e,[],{mismatch:true});await assert.rejects(e.ext._externalAuthNovel('회차',target),/현재 회차/);assert.equal(s.created(),1);assert.equal(s.calls.filter(x=>x.path.endsWith('/close')).length,1);count++;}
 {const e=setup(),s=server(e,[],{closeThrows:true});assert.match(await e.ext._externalAuthNovel('회차',target),/본문 텍스트/);assert.equal(s.created(),1);count++;}
 {const e=setup();e.prefs.set('toki_novel_external_auth_access_key','SECRETKEY');e.ext._externalAuthEndpoint=()=>{throw Error('SECRETKEY invalid')};await assert.rejects(e.ext._externalAuthNovel('회차',target),err=>!err.message.includes('SECRETKEY'));count++;}
 {const e=setup(),s=server(e,['javascript_timeout'],{delay:110000});await assert.rejects(e.ext._externalAuthNovel('회차',target));assert.equal(s.created(),1);count++;}
 {const e=setup();let scoped;e.ext._listForRule=async function(){scoped=this;return new Promise(()=>{});};const pending=e.ext.getLatestUpdates(1);await e.advance(20000);await assert.rejects(pending,/20초/);assert.equal(scoped._listContext.closed,true);assert.equal(e.ext._listContext,undefined);assert.equal(e.timers.size,0);count++;}
 {const e=setup(),caps=[];e.ext._resolveBaseUrl=async()=> 'https://toki33.com';e.ext._validateNovelResponse=()=>{};e.ext._rawText=async(u,r,seconds)=>{caps.push(seconds);await e.advance(7000);return'{"novels":[]}';};const result=await e.ext.search('검색',1,[]);assert.equal(result.list.length,0);assert(caps.every(x=>x<=20));assert.equal(e.ext.domainRequestBudgetMs,120000);count++;}
 {const e=setup();let resolveCard;e.ext._listForRule=async()=>({list:[{name:'작품'}],hasNextPage:false});e.ext._tabCard=()=>new Promise(r=>resolveCard=r);const pending=e.ext.getPopular(1);for(let i=0;i<5;i++)await Promise.resolve();await e.advance(1500);const result=await pending;assert.equal(result.list[0].name,'작품');resolveCard({name:'늦은 카드'});await Promise.resolve();assert.equal(result.list.length,1);count++;}
 {const e=setup();e.context.setTimeout=undefined;e.context.clearTimeout=undefined;e.ext._listForRule=async()=>{await e.advance(20001);return{list:[]}};await assert.rejects(e.ext.getPopular(2),/20초/);count++;}
 {const e=setup();for(const detail of ['HandshakeException: TLS timeout','certificate expired','AUTH_REQUIRED','Failed to bypass Cloudflare']){assert.equal(e.ext._domainFailure(Error(detail)).candidate,false);}count++;}

 const http=n=>Object.assign(Error('HTTP '+n),{statusCode:n});
 const unconfirmed=()=>Object.assign(Error('no normal page'),{invalidNovelResponse:true});
 function bridge(e, scenarios) {
  const visits=[];
  e.context.sendMessage=async(type,payload)=>{
   const args=JSON.parse(payload),origin=e.ext._origin(args[0]),scenario=scenarios[origin]||{},start=e.now();
   visits.push({url:args[0],start,seconds:args[3]});
   if(scenario.noLoad){await e.advance(args[3]*1000);return '';}
   let result,scheduled;
   const doc={body:{innerText:scenario.cert?'ERR_CERT_DATE_INVALID':''},documentElement:{outerHTML:'valid'},
    querySelector:selector=>selector.includes('challenge-form')?(e.now()-start>=(scenario.authAt??Infinity)?{}:null):selector.includes('novel-card')?(e.now()-start>=(scenario.normalAt??Infinity)?{}:null):null};
   Object.defineProperty(doc,'title',{get:()=>e.now()-start>=(scenario.authAt??Infinity)?'Just a moment':'Page'});
   vm.runInNewContext(args[2][0],{document:doc,location:{href:args[0]},Date:class extends Date{static now(){return e.now();}},window:{setTimeout:(fn,ms)=>{scheduled={fn,ms}},flutter_inappwebview:{callHandler:(name,value)=>{result=value}}}});
   while(result===undefined&&scheduled){const t=scheduled;scheduled=null;await e.advance(t.ms);t.fn();}
   return result;
  };
  e.ext._validateNovelResponse=()=>{};
  return visits;
 }
 for(const key of ['toki_novel_domain_url_v2','toki_novel_domain_url','toki_novel_auto_domain_base','toki_novel_resolved_base']){
  const e=setup();e.prefs.set(key,'https://toki33.com');assert.equal(await e.ext._resolveBaseUrl(),'https://toki33.com');count++;
 }
 {const e=setup();e.prefs.set('toki_novel_domain_url_v2','https://custom.example');assert.equal(await e.ext._resolveBaseUrl(),'https://custom.example');count++;}
 {const e=setup();e.prefs.set('toki_novel_domain_url_v2','https://toki33.com');e.prefs.set('toki_novel_auto_domain_base','https://toki34.com');assert.equal(await e.ext._resolveBaseUrl(),'https://toki34.com');count++;}
 {const e=setup();e.ext._requestText=async()=>JSON.stringify({domains:{toki:{baseUrl:'https://unrelated.example'}}});assert.equal(await e.ext._resolveBaseUrl(),'https://toki34.com');count++;}
 {const e=setup(),visits=bridge(e,{'https://toki33.com':{normalAt:0}});const r=await e.ext._withDomainFallback(target,'https://toki33.com/novel',async()=> 'chapter');assert.equal(r.url,target);assert.equal(e.ext.autoDomainBase,'https://toki33.com');assert.equal(visits.length,1);assert.equal(e.now(),0);count++;}
 {const e=setup(),visits=bridge(e,{'https://toki33.com':{normalAt:19750}});assert.equal((await e.ext._withDomainFallback(target,'',async()=> 'chapter')).url,target);assert.equal(visits.length,1);assert.equal(e.now(),19750);count++;}
 for(const authAt of [0,19750,20000]){
  const e=setup(),visits=bridge(e,{'https://toki33.com':{authAt}});let calls=0;await assert.rejects(e.ext._withDomainFallback(target,'',async()=>{calls++;return 'chapter'}),/사람 인증/);assert.equal(visits.length,1);assert.equal(calls,0);assert.equal(e.prefs.get('toki_novel_pending_auth_base'),'https://toki33.com');assert.equal(e.now(),authAt);count++;
 }
 {const e=setup(),visits=bridge(e,{'https://toki33.com':{},'https://toki34.com':{normalAt:0}});e.prefs.set('toki_novel_scan_after','999999');const r=await e.ext._withDomainFallback(target+'?view=1','https://toki33.com/novel',async u=>u);assert.equal(r.url,'https://toki34.com/novel/123/456?view=1');assert.deepEqual(visits.map(v=>v.start),[0,20000]);assert.equal(e.ext.autoDomainBase,'https://toki34.com');count++;}
 {const e=setup(),visits=bridge(e,{'https://toki33.com':{noLoad:true},'https://toki34.com':{normalAt:0}});const r=await e.ext._withDomainFallback(target,'',async()=> 'chapter');assert.equal(r.url,'https://toki34.com/novel/123/456');assert.equal(visits[1].start,21000);count++;}
 {const e=setup(),visits=bridge(e,{'https://toki33.com':{},'https://toki34.com':{},'https://toki35.com':{normalAt:0}});const r=await e.ext._withDomainFallback(target,'',async()=> 'chapter');assert.equal(r.url,'https://toki35.com/novel/123/456');assert.deepEqual(visits.map(v=>v.start),[0,20000,40000]);count++;}
 {const e=setup(),visits=bridge(e,{'https://toki33.com':{},'https://toki34.com':{authAt:15000}});await assert.rejects(e.ext._withDomainFallback(target,'',async()=> 'chapter'),/사람 인증/);assert.equal(visits.length,2);assert.equal(e.now(),35000);count++;}
 {const e=setup(),visits=bridge(e,{'https://toki33.com':{cert:true}});await assert.rejects(e.ext._withDomainFallback(target,'',async()=> 'chapter'),/CERTIFICATE/);assert.equal(visits.length,1);assert.equal(e.now(),0);count++;}
 for(const error of [http(404),unconfirmed(),Error('본문 실패'),http(503)]) {
  const e=setup(),visits=bridge(e,{'https://toki33.com':{normalAt:0}});await assert.rejects(e.ext._withDomainFallback(target,'',async()=>{throw error}),err=>err===error&&err.message.includes('정상 페이지 확인'));assert.equal(visits.length,1);assert.equal(e.ext.autoDomainBase,'https://toki33.com');count++;
 }
 {const e=setup();e.ext.maxDomainAdvances=2;e.ext._verifyCandidate=async b=>{if(!b.includes('35'))throw http(451)};const r=await e.ext._withDomainFallback(target,'',async()=> 'chapter');assert.equal(r.url,'https://toki35.com/novel/123/456');assert.equal(e.now(),40000);count++;}
 {const e=setup(),s=server(e,[]);bridge(e,{'https://toki33.com':{authAt:0}});e.ext._resolveBaseUrl=async()=> 'https://toki33.com';e.ext._externalAuthEnabled=()=>true;assert.match(await e.ext.getHtmlContent('회차',target),/본문 텍스트/);assert.deepEqual(s.targets,[target]);assert.equal(s.calls.filter(v=>v.path.endsWith('/close')).length,1);count++;}
 {const e=setup(),s=server(e,[]);bridge(e,{'https://toki33.com':{},'https://toki34.com':{normalAt:0}});e.ext._resolveBaseUrl=async()=> 'https://toki33.com';e.ext._externalAuthEnabled=()=>true;assert.match(await e.ext.getHtmlContent('회차',target+'?view=1'),/본문 텍스트/);assert.deepEqual(s.targets,['https://toki34.com/novel/123/456?view=1']);count++;}
 {const e=setup(),s=server(e,['manual_viewer_confirmation_required']);const visits=bridge(e,{'https://toki33.com':{normalAt:0}});e.ext._resolveBaseUrl=async()=> 'https://toki33.com';e.ext._externalAuthEnabled=()=>true;await assert.rejects(e.ext.getHtmlContent('회차',target),err=>err.externalAuthCode==='manual_viewer_confirmation_required'&&err.message.includes('v0.2.20'));assert.equal(visits.length,1);assert.equal(s.created(),1);count++;}
 {const e=setup();bridge(e,{'https://toki33.com':{},'https://toki34.com':{normalAt:0}});let requested;
  const r=await e.ext._withListBudget(async scoped=>{scoped._validateNovelResponse=()=>{};const result=await scoped._withDomainFallback('https://toki33.com/rank','',async(u,r,c)=>{requested=u;await e.advance(19000);scoped._checkListBudget();return 'list';});return result;});assert.equal(requested,'https://toki34.com/rank');assert.equal(r.value,'list');assert.equal(e.now(),39000);assert.equal(e.timers.size,0);count++;
 }
 {const e=setup();bridge(e,{'https://toki33.com':{},'https://toki34.com':{normalAt:0}});await assert.rejects(e.ext._withListBudget(async scoped=>scoped._withDomainFallback(target,'',async()=>{await e.advance(20001);scoped._checkListBudget();})),/20초/);assert.equal(e.now(),40001);assert.equal(e.timers.size,0);count++;}
 {const e=setup(),visits=bridge(e,{});await assert.rejects(e.ext._withDomainFallback(target,'',async()=> 'chapter'),err=>err.message.includes('20초 동안')&&err.message.includes('toki34.com'));assert.equal(visits.length,6);assert.equal(e.now(),120000);assert.equal(e.ext.autoDomainBase,'');count++;}
 {const e=setup();e.prefs.set('toki_novel_pending_auth_base','https://toki33.com');bridge(e,{'https://toki34.com':{normalAt:0}});const r=await e.ext._withDomainFallback('https://toki34.com/novel/123/456','',async()=> 'chapter');assert.equal(r.url,'https://toki34.com/novel/123/456');count++;}
 {const e=setup();e.ext._verifyCandidate=async b=>{if(b.includes('33'))throw Object.assign(Error('redirect'),{redirectBase:'https://toki34.com'})};const r=await e.ext._withDomainFallback(target+'?view=1','',async()=> 'chapter');assert.equal(r.url,'https://toki34.com/novel/123/456?view=1');assert.equal(e.now(),0);count++;}
 {const e=setup();e.ext._pause=async()=>{};e.ext._verifyCandidate=async()=>{throw unconfirmed()};await assert.rejects(e.ext._withDomainFallback(target,'',async()=> 'chapter'),/20초 주소 확인을 완료하지/);assert.equal(e.ext.autoDomainBase,'');assert.equal(e.now(),0);count++;}
 const index=JSON.parse(fs.readFileSync(__dirname+'/index.min.json','utf8'));assert.equal(index[0].sourceCode,source);assert.equal(index[0].version,'0.2.20');assert.equal(index[0].id,780920260913901);count++;
 console.log('PASS: '+count+' checks — 20-second domain observation, live/challenge retention, delayed and missing navigation, sequential next domains, separate list budget, external job cleanup, chapter matching, certificates, index identity');
}
main().catch(e=>{console.error(e);process.exitCode=1});
