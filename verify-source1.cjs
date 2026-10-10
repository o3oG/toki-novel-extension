const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync(__dirname+'/newtoki1_novel.js','utf8');
class Element{
 constructor(attrs={},text='',nodes={}){this.attrs=attrs;this.text=text;this.nodes=nodes;this.children=[];this.localName=attrs.tag||'a'}
 attr(k){return this.attrs[k]||null} get getHref(){return this.attr('href')} get getSrc(){return this.attr('src')}
 selectFirst(s){return this.nodes[s]||null} select(s){return Array.isArray(this.nodes[s])?this.nodes[s]:[]}
}
const link=(href,text,attrs={},nodes={})=>new Element({href,...attrs},text,nodes);
let fixture={links:[],title:'테스트 작품'};
class Document{
 constructor(html){this.html=html} select(s){if(s==='a[href]'||s==='a')return fixture.links;if(s==='[class]')return fixture.links.filter(e=>e.attr('class'));return []}
 selectFirst(s){return s==='main h1, h1'?new Element({},fixture.title):null}
}
const prefs=new Map();
class SharedPreferences{get(k){return prefs.get(k)}getString(k,d){return prefs.get(k)??d}setString(k,v){prefs.set(k,v)}}
let plan=[],calls=[],now=Date.now(),script='';
class FakeDate extends Date{static now(){return now}}
class Client{constructor(options){this.options=options}async get(url,headers){calls.push({options:this.options,url,headers});const step=plan.shift();if(!step)throw Error('Unexpected HTTP');now+=step.elapsed||0;if(step.error)throw Error(step.error);return step.response}}
const c={MProvider:class{},Document,SharedPreferences,Client,Date:FakeDate,setTimeout,clearTimeout,sendMessage:async(name,arg)=>{assert.equal(name,'evaluateJavascriptViaWebview');script=JSON.parse(arg)[2][0];return '__TOKI31_OK__<p>본문</p>'}};
vm.createContext(c);vm.runInContext(code+';this.Ext=DefaultExtension;',c);
let count=0;const check=(name,f)=>{f();count++};
(async()=>{
 const e=new c.Ext(),base='https://newtoki1.org';
 fixture.links=[link('/novel/12','작품명'),link('/novel/12/','작품명'),link('/novel/13','다른 작품'),link('https://evil.test/novel/14','광고'),link('/novel/12/101','1화'),link('/novel/12/101','중복'),link('/novel/12/102?from=list','2화'),link('/novel/13/99','다른 회차'),link('/novel/15','')];
 check('book isolation',()=>{const a=e._listFromNovelLinks(new Document(''),base);assert.equal(a.length,2);assert.equal(a[0].link,base+'/novel/12')});
 check('chapter isolation',()=>{const a=e._chaptersFromNovelLinks(new Document(''),base,'12');assert.equal(a.length,2);assert.equal(a[0].name,'Episode 1 · 1화')});
 check('foreign links',()=>{assert.equal(e._novelLinkPath(base,'https://evil.test/novel/12'),'');assert.equal(e._novelLinkPath(base,'data:text/html,x'),'')});
 check('polluted titles',()=>{for(const [a,b] of [['+36 방금전 1 미카엘 : 악을 심판하는 천사','미카엘 : 악을 심판하는 천사'],['+1178 6시간전 3 야생에서','야생에서'],['+11100.6만 창작물 속으로','창작물 속으로'],['+4638.3만 천하제일인의 소꿉친구','천하제일인의 소꿉친구']])assert.equal(e._cleanNovelLabel(a),b)});
 check('numeric title preservation',()=>{for(const s of ['1998.04.13 인생 최악의 날','1레벨 플레이어','1984','5시간 후의 세계','+5강해짐'])assert.equal(e._cleanNovelLabel(s),s);assert.equal(e._cleanNovelLabel('+10 방금전 1984 세계'),'1984 세계')});
 fixture.links=[link('/novel/12','',{}, {img:new Element({'data-src':'//img.test/a.webp',alt:'표지'})}),link('/novel/12','+36 방금전 1 미카엘')];
 check('split cover merge',()=>{const a=e._listFromNovelLinks(new Document(''),base);assert.equal(a.length,1);assert.equal(a[0].name,'미카엘');assert.equal(a[0].imageUrl,'https://img.test/a.webp')});
 check('cover candidates',()=>{assert.equal(e._imageFromNode(new Element({'data-src':'data:image/gif;base64,AAA',src:'/cover.jpg'}),base),base+'/cover.jpg');assert.equal(e._imageFromNode(new Element({srcset:'//img.test/b.webp 400w, //img.test/c.webp 800w'}),base),'https://img.test/b.webp')});
 check('episode numbering',()=>{assert.equal(e._chapterName('1998.04.13 인생 최악의 날',e._episodeNumber('1998.04.13 인생 최악의 날',new Element({'data-ep':'6'}))),'Episode 6 · 1998.04.13 인생 최악의 날');assert.equal(e._episodeNumber('짜고치는 고스톱 5'),'5');assert.equal(e._episodeNumber('1998.04.13 인생 최악의 날'),'');assert.equal(e._episodeNumber('1부 끝'),'')});
 check('unknown year false positives',()=>{const s=e._chapterName('1998.04.13 인생 최악의 날','');assert(s.startsWith('[회차 번호 확인 필요]'));assert(!/[0-9]/.test(s))});
 e._resolveBaseUrl=async()=>base;const native=e._requestResult;e._requestResult=async()=>({url:base+'/novel/12',value:'<html>fixture</html>'});fixture.title='뉴토끼 - 웹툰 미리보기';fixture.links=[link('/novel/12/101','한국으로 돌아오다 1'),link('/novel/12/102','1998.04.13 인생 최악의 날')];
 const d=await e.getDetail('/novel/12');
 check('cached actual title/cover',()=>{assert.equal(d.name,'미카엘');assert.equal(d.imageUrl,'https://img.test/a.webp')});
 check('identify unnumbered episode',()=>{assert.equal(d.chapters.length,2);assert(d.chapters[1].name.startsWith('[회차 번호 확인 필요]'));assert(d.description.includes(base+'/novel/12/102'));assert(d.description.includes('다운로드 실패를 뜻하지 않습니다'))});
 fixture.links=[];const empty=await e.getDetail('/novel/12');check('empty TOC error',()=>assert(empty.description.includes('목차 추출 실패')));
 fixture.links=[link('/novel/12?token=SECRET','작품',{class:'novel-link'})];e._captureStructure('rank',base+'/rank?access=SECRET','fixture');
 check('diagnostic redaction',()=>{const r=prefs.get('newtoki1_novel_report_rank');assert(r.includes('novel-link'));assert(!r.includes('SECRET'))});
 const cmd=await e.search('::진단',1,[]),report=await e.getDetail(cmd.list[0].link);
 check('offline report entry',()=>{assert.equal(cmd.list.length,1);assert(report.description.includes('링크 구조'));assert.equal(report.chapters.length,0)});
 e._requestResult=native;plan=[{error:'RhttpConnectionException InvalidMessage(InvalidContentType)',elapsed:7000},{response:{statusCode:200,body:'{}'}}];calls=[];e._listContext={deadline:now+20000,closed:false};
 const raw=await e._rawText(base+'/api/novel-list?q=private',base+'/novel',20);
 check('TLS fallback deadline',()=>{assert.equal(raw,'{}');assert.equal(calls.length,2);assert.equal(calls[1].options.useDartHttpClient,true);assert.equal(calls[1].options.timeout,13);assert.equal(calls[0].options.verifyCertificates,true)});
 plan=[{response:{statusCode:403,body:'<form id="challenge-form">verify you are human</form>'}}];calls=[];await assert.rejects(e._rawText(base+'/api/novel-list',base,20),err=>err.authenticationRequired===true);check('challenge not retried',()=>assert.equal(calls.length,1));
 plan=[{error:'NETWORK_FAILURE'}];calls=[];await assert.rejects(e._rawText(base+'/api/novel-list',base,20),/NETWORK_FAILURE/);check('other errors not retried',()=>assert.equal(calls.length,1));
 plan=[{error:'InvalidContentType',elapsed:20000}];calls=[];await assert.rejects(e._rawText(base+'/api/novel-list',base,20),/20초/);check('expired deadline',()=>assert.equal(calls.length,1));e._listContext=null;
 await e._localWebViewNovel('회차 제목',base+'/novel/12/101',base,8);
 const runReader=({href=base+'/novel/12/101',gate=null,challenge=false,tts='',shadow=false})=>{
  let sent='';const paragraphs={querySelectorAll:()=>[{textContent:'유효한 본문 '.repeat(12)}]},viewer=shadow?{shadowRoot:paragraphs}:paragraphs;
  const dom={readyState:'complete',title:'회차',body:{innerText:''},querySelector:s=>s==='#challenge-form, #cf-challenge-running'?(challenge?{}:null):s.includes('[data-novel-unlock-status]')?gate:s==='.novel-viewer'?viewer:null};
  vm.runInNewContext(script,{document:dom,location:{href},window:{__novelTTSText:tts,setTimeout:()=>{},addEventListener:()=>{},flutter_inappwebview:{callHandler:(_,value)=>{sent=value}}},Date});return sent;
 };
 check('scoped reader and shadow DOM',()=>{assert(runReader({}).startsWith('__TOKI31_OK__'));assert(runReader({shadow:true}).startsWith('__TOKI31_OK__'))});
 check('manual gates before extraction',()=>{assert.equal(runReader({gate:{textContent:'로그인 또는 포인트 결제'},tts:'오래된 캐시 '.repeat(20)}),'__TOKI31_ERR__MANUAL_GATE');assert.equal(runReader({challenge:true,tts:'오래된 캐시 '.repeat(20)}),'');assert.equal(runReader({href:'https://evil.test/novel/12/101'}),'__TOKI31_ERR__ORIGIN_MISMATCH');assert.equal(runReader({href:base+'/novel/12/102'}),'__TOKI31_ERR__PAGE_MISMATCH')});
 e._externalAuthEnabled=()=>true;e._externalAuthNovel=async()=>{throw Error('manual_viewer_confirmation_required https://newtoki1.org/novel/12/101?key=SECRET')};
 await assert.rejects(e.getHtmlContent('한국으로 돌아오다 1','/novel/12/101'),/한국으로 돌아오다 1/);
 check('body failure identity/redaction',()=>{const r=prefs.get('newtoki1_novel_report_body');assert(r.includes('한국으로 돌아오다 1'));assert(r.includes('/novel/12/101'));assert(!r.includes('SECRET'))});
 await assert.rejects(e._boundedGet({get:()=>new Promise(()=>{})},base,{},0.01),/대기시간 초과/);count++;
 e._rememberNovels([{name:'미카엘',link:base+'/novel/12',imageUrl:e.generatedCover('12')}]);
 check('preserve cover across API cache refresh',()=>assert.equal(e._rememberedNovel(base+'/novel/12').imageUrl,'https://img.test/a.webp'));
 const idx=JSON.parse(fs.readFileSync(__dirname+'/index.min.json'));
 check('source identity/isolation',()=>{assert.equal(idx[1].sourceCode,code);assert.equal(idx[1].version,'0.2.20');assert.equal(idx[1].id,780920261010903);assert.equal(idx[0].version,'0.2.17')});
 console.log('PASS: '+count+' source 1 checks — polluted titles, merged covers, numbering/year handling, transport fallback/deadline, gates, scoped reader, visible diagnostics, redaction, source isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
