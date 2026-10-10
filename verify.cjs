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
 const external=e=>{e.ext._resolveBaseUrl=async()=> 'https://toki33.com';e.ext._externalAuthEnabled=()=>true;e.ext._validateNovelResponse=()=>{};};
 for(const status of [403,404,410]){
  const e=setup(),visited=[];e.ext._verifyCandidate=async()=>{};
  const result=await e.ext._withDomainFallback('https://toki33.com/novel','https://toki33.com/novel',async u=>{visited.push(u);if(u.includes('toki33.'))throw http(status);return 'site';});
  assert.equal(result.url,'https://toki34.com/novel');assert.equal(visited.length,2);assert.equal(e.ext.autoDomainBase,'https://toki34.com');count++;
 }
 {const e=setup();let jobs=0;e.ext._verifyCandidate=async()=>{};await assert.rejects(e.ext._withDomainFallback(target,'https://toki33.com/novel',async()=>{jobs++;throw http(404)}),/404/);assert.equal(jobs,1);assert.equal(e.ext.autoDomainBase,'');count++;}
 {const e=setup();let jobs=0;await assert.rejects(e.ext._withDomainFallback(target,'https://toki33.com/novel',async()=>{jobs++;throw Object.assign(http(403),{authenticationRequired:true})}),/사람 인증/);assert.equal(jobs,1);assert.equal(e.ext.autoDomainBase,'');count++;}
 {const e=setup(),s=server(e,[]),checks=[];external(e);
  e.ext._rawText=async u=>{checks.push(u);if(u.includes('toki33.'))throw http(410);return 'valid';};
  assert.match(await e.ext.getHtmlContent('회차',target+'?view=1'),/본문 텍스트/);
  assert.deepEqual(s.targets,['https://toki34.com/novel/123/456?view=1']);assert.equal(e.ext.autoDomainBase,'https://toki34.com');assert.equal(checks.filter(u=>u.includes('toki33.')).length,1);assert.equal(s.calls.filter(x=>x.path.endsWith('/close')).length,1);count++;
 }
 {const e=setup(),s=server(e,[]);external(e);e.ext._rawText=async()=>{throw Object.assign(http(403),{authenticationRequired:true})};assert.match(await e.ext.getHtmlContent('회차',target),/본문 텍스트/);assert.deepEqual(s.targets,[target]);assert.equal(e.ext.autoDomainBase,'');count++;}
 {const e=setup(),s=server(e,['manual_viewer_confirmation_required']);external(e);e.ext._rawText=async()=> 'valid';await assert.rejects(e.ext.getHtmlContent('회차',target),err=>err.externalAuthCode==='manual_viewer_confirmation_required'&&err.message.includes(target)&&err.message.includes('v0.2.19'));assert.equal(s.created(),1);assert.equal(e.ext.autoDomainBase,'');count++;}
 {const e=setup(),s=server(e,['manual_viewer_confirmation_required']);external(e);e.ext._rawText=async()=>{throw e.ext._invalidNovelResponse()};await assert.rejects(e.ext.getHtmlContent('회차',target),/manual_viewer/);assert.equal(s.created(),1);assert.equal(e.ext.autoDomainBase,'');count++;}
 {const e=setup(),s=server(e,['manual_viewer_confirmation_required']);external(e);e.prefs.set('toki_novel_external_checked_base','https://toki33.com');e.prefs.set('toki_novel_external_checked_time','1');e.ext._rawText=async u=>{if(u.includes('toki33.'))throw Error('__TOKI31_ERR__NETWORK');return 'valid';};assert.match(await e.ext.getHtmlContent('회차',target),/본문 텍스트/);assert.deepEqual(s.targets,[target,'https://toki34.com/novel/123/456']);assert.equal(s.calls.filter(x=>x.path.endsWith('/close')).length,2);count++;}
 {const e=setup(),s=server(e,[]);external(e);e.ext.maxDomainAdvances=2;e.ext._rawText=async u=>{if(!u.includes('toki35.'))throw Error('__TOKI31_ERR__NETWORK');return 'valid';};assert.match(await e.ext.getHtmlContent('회차',target),/본문 텍스트/);assert.deepEqual(s.targets,['https://toki35.com/novel/123/456']);count++;}
 {const e=setup(),s=server(e,[]);external(e);e.ext.maxDomainAdvances=1;e.ext._rawText=async u=>{if(u.includes('toki33.'))throw http(410);return 'valid';};e.ext._externalAuthNovel=async()=>{throw Error('manifest chapter mismatch')};await assert.rejects(e.ext.getHtmlContent('회차',target),/mismatch/);assert.equal(e.ext.autoDomainBase,'');assert.equal(s.created(),0);count++;}
 {const e=setup(),s=server(e,[]);await e.advance(100000);await assert.rejects(e.ext._externalAuthNovel('회차',target,105000),/대기시간/);assert.equal(s.created(),1);assert.equal(s.calls.filter(x=>x.path.endsWith('/close')).length,1);assert(s.calls.filter(x=>!x.path.endsWith('/close')).every(x=>x.seconds<=5));count++;}
 {const e=setup();e.ext._listContext={deadline:20000};e.ext.maxDomainAdvances=20;e.ext._verifyCandidate=async()=>{};let calls=0;await assert.rejects(e.ext._withDomainFallback(target,'https://toki33.com/novel',async()=>{calls++;await e.advance(10000);throw Error('__TOKI31_ERR__NETWORK')}));assert.equal(calls,2);assert.equal(e.now(),20000);assert.equal(e.ext.autoDomainBase,'');count++;}

 for(const key of ['toki_novel_domain_url_v2','toki_novel_domain_url','toki_novel_auto_domain_base','toki_novel_resolved_base']) {
  const e=setup();e.prefs.set(key,'https://toki33.com');e.ext._requestText=async()=>JSON.stringify({domains:{toki:{baseUrl:'https://toki33.com'}}});assert.equal(await e.ext._resolveBaseUrl(),'https://toki34.com');count++;
 }
 {const e=setup();e.prefs.set('toki_novel_domain_url_v2','https://toki33.com');e.prefs.set('toki_novel_auto_domain_base','https://toki35.com');assert.equal(await e.ext._resolveBaseUrl(),'https://toki35.com');count++;}
 {const e=setup();e.prefs.set('toki_novel_domain_url_v2','https://custom.example');assert.equal(await e.ext._resolveBaseUrl(),'https://custom.example');count++;}
 {const e=setup();e.ext._requestText=async()=>JSON.stringify({domains:{toki:{baseUrl:'https://toki35.com'}}});assert.equal(await e.ext._resolveBaseUrl(),'https://toki35.com');count++;}
 {const e=setup();e.ext._requestText=async()=>JSON.stringify({domains:{toki:{baseUrl:'https://unrelated.example'}}});assert.equal(await e.ext._resolveBaseUrl(),'https://toki34.com');count++;}
 {const e=setup();e.prefs.set('toki_novel_pending_auth_base','https://toki33.com');const r=await e.ext._withDomainFallback('https://toki34.com/novel/123/456','https://toki34.com/novel',async u=>u);assert.equal(r.url,'https://toki34.com/novel/123/456');count++;}
 {const e=setup(),visited=[];e.ext._verifyCandidate=async()=>{};const r=await e.ext._withDomainFallback('https://toki33.com/novel','',async u=>{visited.push(u);if(u.includes('toki33.'))throw http(451);return 'site';});assert.equal(r.url,'https://toki34.com/novel');assert.equal(visited.length,2);count++;}
 {const e=setup(),calls=[];e.ext._listContext={deadline:20000};e.ext._validateNovelResponse=()=>{};
  e.ext._rawText=async(u,r,cap)=>{calls.push({u,cap});if(u.includes('toki34.')){await e.advance(cap*1000);throw Object.assign(Error('WebView no response'),{webViewNoResponse:true});}await e.advance(1000);return 'valid';};
  const r=await e.ext._requestResult('https://toki34.com/rank','https://toki34.com/novel',30);assert.equal(r.url,'https://toki35.com/rank');assert.equal(e.ext.autoDomainBase,'https://toki35.com');assert(e.now()<20000);assert(calls.every(c=>c.cap<=6));assert.equal(calls.filter(c=>c.u==='https://toki34.com/rank').length,1);count++;
 }
 {const e=setup(),visited=[];e.prefs.set('toki_novel_previous_base','https://toki33.com');e.ext._verifyCandidate=async b=>visited.push(b);const r=await e.ext._withDomainFallback('https://toki34.com/novel','',async u=>{if(u.includes('toki34.'))throw http(410);return 'valid';});assert.equal(visited[0],'https://toki35.com');assert.equal(r.url,'https://toki35.com/novel');count++;}
 {const e=setup(),s=server(e,[]);e.prefs.set('toki_novel_domain_url','https://toki33.com');e.ext._externalAuthEnabled=()=>true;e.ext._validateNovelResponse=()=>{};e.ext._rawText=async()=> 'valid';e.ext._requestText=async()=>JSON.stringify({domains:{toki:{baseUrl:'https://toki33.com'}}});assert.match(await e.ext.getHtmlContent('회차',target+'?view=1'),/본문 텍스트/);assert.deepEqual(s.targets,['https://toki34.com/novel/123/456?view=1']);count++;}
 {const e=setup();e.context.sendMessage=async(type,payload)=>{const args=JSON.parse(payload);let response;vm.runInNewContext(args[2][0],{window:{flutter_inappwebview:{callHandler:(name,value)=>{response=value}}},document:{title:'451 Unavailable For Legal Reasons',querySelector:()=>null,body:{innerText:''}},location:{href:'https://toki33.com/novel'},Date});return response;};await assert.rejects(e.ext._webViewText('https://toki33.com/novel','',3),err=>err.statusCode===451);count++;}
 const index=JSON.parse(fs.readFileSync(__dirname+'/index.min.json','utf8'));assert.equal(index[0].sourceCode,source);assert.equal(index[0].version,'0.2.19');assert.equal(index[0].id,780920260913901);count++;
 console.log('PASS: '+count+' checks — domain migration, external server integration, auth/certificate guards, bounded retry, job cleanup, chapter match, key redaction, list deadline, index identity');
}
main().catch(e=>{console.error(e);process.exitCode=1});
