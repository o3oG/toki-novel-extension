const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync(__dirname+'/newtoki1_novel.js','utf8');
class Element{
 constructor(attrs={},text='',nodes={}){this.attrs=attrs;this.text=text;this.nodes=nodes;this.children=[];this.localName=attrs.tag||'a'}
 attr(k){return this.attrs[k]||null} get getHref(){return this.attr('href')} get getSrc(){return this.attr('src')}
 selectFirst(s){return this.nodes[s]||null} select(s){return Array.isArray(this.nodes[s])?this.nodes[s]:[]}
}
const link=(href,text,attrs={},nodes={})=>new Element({href,...attrs},text,nodes);
let fixture={links:[],title:'테스트 작품'};
const documents=new Map();
class Document{
 constructor(html){this.html=html;this.fixture=documents.get(html)||fixture}
 select(s){const f=this.fixture;if(s==='a[href]'||s==='a')return f.links;if(s==='a.item-subject[href]')return f.links.filter(e=>e.attr('class')==='item-subject');if(s==='[class]')return f.links.filter(e=>e.attr('class'));return f.nodes?.[s]||[]}
 selectFirst(s){const f=this.fixture;return s==='main h1, h1'?new Element({},f.title):s==='article h2, .view-title h2'&&f.bookTitle?new Element({},f.bookTitle):(f.nodes?.[s]||[])[0]||null}
}
const prefs=new Map();let preferenceReads=0;
class SharedPreferences{get(k){return prefs.get(k)}getString(k,d){preferenceReads++;return prefs.get(k)??d}setString(k,v){prefs.set(k,v)}}
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
 check('chapter isolation',()=>{const a=e._chaptersFromNovelLinks(new Document(''),base,'12');assert.equal(a.length,2);assert.equal(a[0].name,'1화')});
 check('foreign links',()=>{assert.equal(e._novelLinkPath(base,'https://evil.test/novel/12'),'');assert.equal(e._novelLinkPath(base,'data:text/html,x'),'')});
 check('polluted titles',()=>{for(const [a,b] of [['+36 방금전 1 미카엘 : 악을 심판하는 천사','미카엘 : 악을 심판하는 천사'],['+1178 6시간전 3 야생에서','야생에서'],['+11100.6만 창작물 속으로','창작물 속으로'],['+4638.3만 천하제일인의 소꿉친구','천하제일인의 소꿉친구']])assert.equal(e._cleanNovelLabel(a),b)});
 check('numeric title preservation',()=>{for(const s of ['1998.04.13 인생 최악의 날','1레벨 플레이어','1984','5시간 후의 세계','+5강해짐'])assert.equal(e._cleanNovelLabel(s),s);assert.equal(e._cleanNovelLabel('+10 방금전 1984 세계'),'1984 세계')});
 check('observed rank child metadata',()=>{
  const a=link('/novel/17709','+36 방금전 1 1984 세계',{class:'ellipsis'});
  a.children=[new Element({class:'pull-right gray font-12'},'+36 방금전'),new Element({class:'rank-icon en bg-violet'},'1')];
  assert.equal(e._titleWithoutRankMetadata(a),'1984 세계');
  fixture.links=[a];assert.equal(e._listFromNovelLinks(new Document(''),base)[0].name,'1984 세계');
 });
 fixture.links=[link('/novel/12','',{}, {img:new Element({'data-src':'//img.test/a.webp',alt:'표지'})}),link('/novel/12','+36 방금전 1 미카엘')];
 check('split cover merge',()=>{const a=e._listFromNovelLinks(new Document(''),base);assert.equal(a.length,1);assert.equal(a[0].name,'미카엘');assert.equal(a[0].imageUrl,'https://img.test/a.webp');e._rememberNovels(a)});
 check('cover candidates',()=>{assert.equal(e._imageFromNode(new Element({'data-src':'data:image/gif;base64,AAA',src:'/cover.jpg'}),base),base+'/cover.jpg');assert.equal(e._imageFromNode(new Element({srcset:'//img.test/b.webp 400w, //img.test/c.webp 800w'}),base),'https://img.test/b.webp')});
 check('episode numbering',()=>{assert.equal(e._chapterName('1998.04.13 인생 최악의 날',e._episodeNumber('1998.04.13 인생 최악의 날',new Element({'data-ep':'6'}))),'6화 · 1998.04.13 인생 최악의 날');assert.equal(e._episodeNumber('짜고치는 고스톱 5'),'5');assert.equal(e._episodeNumber('1998.04.13 인생 최악의 날'),'');assert.equal(e._episodeNumber('1부 끝'),'')});
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
 const beforeReads=preferenceReads;e._rememberNovels([{name:'독립 작품',link:base+'/novel/99',imageUrl:'https://img.test/99.webp'}]);
 check('metadata write without racing default read',()=>assert.equal(preferenceReads,beforeReads));
 check('metadata across provider instances',()=>{const next=new c.Ext();assert.equal(next._rememberedNovel(base+'/novel/99').name,'독립 작품');assert.equal(next._rememberedNovel(base+'/novel/99').imageUrl,'https://img.test/99.webp')});
 const book=base+'/novel/29689',tocRequests=[];
 const makePage=(page,total=407)=>{
   const links=[];for(let index=(page-1)*100;index<Math.min(page*100,total);index++) links.push(link('/novel/29689/'+(4062173-index),index===0?'역배기사 외전 : Weltanschauung (2)':index===1?'1998.04.13 인생 최악의 날':'회차 제목 ('+(index+1)+')',{class:'item-subject'}));
   links.push(link('/novel/17709/9','다른 작품',{class:'item-subject'}),link('/novel/29689/10','다음 회차 버튼',{class:'btn'}));
   const anchors=[1,2,3,4,5].map(n=>link(n%2?'?page='+n:book+'?page='+n,n+'페이지'));
   anchors.push(link('https://evil.test/novel/29689?page=9','9페이지'),link('/novel/17709?page=9','9페이지'));
   const pager=new Element({tag:'nav',class:'pg_wrap theme-comment-pager theme-episode-pager'},'현재'+page+'페이지2페이지3페이지4페이지5페이지 맨끝',{'a[href]':anchors});
   return {links,title:'뉴토끼 - 웹툰 미리보기',bookTitle:'귀쟁이 투기장의 역배 기사님',nodes:{'.theme-episode-pager':[pager]}};
 };
 for(let page=1;page<=5;page++)documents.set('TOC'+page,makePage(page));
 e._requestResult=async(url)=>{tocRequests.push(url);const page=e._pageNumber(url)||1;return {url,value:'TOC'+page}};
 const complete=await e.getDetail(book);
 check('all five pages and 407 entries',()=>{assert.equal(complete.chapters.length,407);assert.equal(tocRequests.length,5);assert(complete.description.includes('5페이지 · 407개 항목'));assert(complete.description.includes('사이트 회차 번호를 우선'))});
 check('stable complete TOC order',()=>{assert(complete.chapters[0].name.startsWith('1화 · '));assert(complete.chapters.at(-1).name.startsWith('407화 · 역배기사 외전'));assert(complete.chapters.at(-2).name.startsWith('406화 · 1998.04.13'));assert.equal(new Set(complete.chapters.map(ch=>ch.url)).size,407)});
 check('observed book heading',()=>assert.equal(complete.name,'귀쟁이 투기장의 역배 기사님'));
 check('scope pagination to same book',()=>{assert(tocRequests.every(url=>url.startsWith(book)));assert(!tocRequests.some(url=>url.includes('page=9')))});
 prefs.delete("newtoki1_toc_v23_"+encodeURIComponent(book));e._requestResult=async(url)=>{const page=e._pageNumber(url)||1;if(page===3)throw Error('HTTP 503');return {url,value:'TOC'+page}};
 const partial=await e.getDetail(book);
 check('failed page remains visible, no invented numbering',()=>{assert.equal(partial.chapters.length,307);assert(partial.description.includes('3페이지 · HTTP 503'));assert(partial.description.includes('목차 수집 미완료'));assert(partial.chapters.every(ch=>ch.name.startsWith('[회차 번호 확인 필요]')));assert(!partial.description.includes('목차 수집 완료'))});
 prefs.delete("newtoki1_toc_v23_"+encodeURIComponent(book));e._requestResult=async(url)=>({url,value:'TOC1'});
 const repeat=await e.getDetail(book);
 check('repeated first page is not completion',()=>{assert.equal(repeat.chapters.length,100);assert(repeat.description.includes('같은 목차'));assert(repeat.description.includes('목차 수집 미완료'))});
 prefs.delete("newtoki1_toc_v23_"+encodeURIComponent(book));let authCalls=0;e._requestResult=async()=>{authCalls++;const error=Error('AUTH_REQUIRED');error.authenticationRequired=true;throw error};
 const authToc=await e._collectSerialChapters(new Document('TOC1'),base,'29689',book,now+75000);
 check('manual authentication stops collection',()=>{assert.equal(authCalls,1);assert(!authToc.complete);assert.equal(authToc.failed.size,4)});
 e._requestResult=async(url)=>({url:base+'/',value:'HOME'});
 const redirected=await e._collectSerialChapters(new Document('TOC1'),base,'29689',book,now+75000);
 check('homepage redirects are rejected',()=>{assert(!redirected.complete);assert.equal(redirected.chapters.length,100);assert(Array.from(redirected.failed.values()).every(reason=>reason.includes('초기 화면')))});
 let deadlineCalls=0;e._requestResult=async()=>{deadlineCalls++;throw Error('Unexpected request')};
 const expired=await e._collectSerialChapters(new Document('TOC1'),base,'29689',book,now);
 check('whole TOC deadline',()=>{assert.equal(deadlineCalls,0);assert(!expired.complete);assert.equal(expired.failed.size,4)});
 const singleFixture=makePage(1,3);singleFixture.nodes={};const singleDoc=new Document('SINGLE');singleDoc.fixture=singleFixture;
 const single=await e._collectSerialChapters(singleDoc,base,'29689',book,now+75000);
 check('single-page numbering includes epilogues',()=>{assert(single.complete);assert.equal(single.chapters.length,3);assert(single.chapters[0].name.startsWith('1화 · '));assert(single.chapters.at(-1).name.startsWith('3화 · '))});
 e._requestResult=async(url)=>({url,value:'TOC'+(e._pageNumber(url)||1)});
 const middle=await e.getDetail(book+'?page=3');
 check('starting in middle collects both directions',()=>{assert.equal(middle.chapters.length,407);assert(middle.description.includes('목차 수집 완료'));assert(middle.chapters[0].name.startsWith('1화 · '));assert(middle.chapters.at(-1).name.startsWith('407화 · '))});
 const deferred=new c.Ext();deferred._setPreferenceString=()=>{};prefs.set('newtoki1_novel_report_bodyStructure','old v0.2.20');deferred._saveReport('bodyStructure','new v0.2.22');
 check('current diagnostics win over pending preference writes',()=>assert.equal(deferred._report('bodyStructure'),'new v0.2.22'));

 check('API and explicit labels remove count cluster',()=>{
  assert.equal(e.novelFromApi(base,{id:35155,title:'+11100.6만 창작물 속으로',thumbnailUrl:'https://img.test/35155.webp'}).name,'창작물 속으로');
  fixture.links=[link('/novel/35155','+11100.6만 창작물 속으로',{title:'+11100.6만 창작물 속으로'},{img:new Element({src:'https://img.test/35155.webp'})})];
  assert.equal(e._listFromNovelLinks(new Document(''),base)[0].name,'창작물 속으로');
 });
 check('official chapter number is leftmost',()=>{
  assert.equal(e._chapterName('3145화',e._episodeNumber('3145화')),'3145화');
  assert.equal(e._chapterName('2146. 이터널 에덴',e._episodeNumber('2146. 이터널 에덴')),'2146화 · 이터널 에덴');
  assert.equal(e._episodeNumber('역배기사 외전 : Weltanschauung (2)'),'');assert.equal(e._episodeNumber('한국으로 돌아오다 1',new Element({}),false),'');
  assert.equal(e._episodeNumber('1998.04.13 인생 최악의 날'),'');
 });
 const largeBook=base+'/novel/35155';
 const largePage=(page,{navigation=true,domCurrent=page}={})=>{
  const links=[];for(let index=(page-1)*100;index<Math.min(page*100,3145);index++)links.push(link('/novel/35155/'+(8168483-index),(3145-index)+'화',{class:'item-subject'}));
  const first=Math.floor((page-1)/10)*10+1,last=Math.min(32,first+9);
  const anchors=Array.from({length:last-first+1},(_,i)=>link('?epage='+(first+i), (first+i)+'페이지',{class:'pg_page'}));
  if(navigation&&last<32)anchors.push(link(largeBook,'다음',{class:'pg_next','data-page':String(last+1)}));
  if(navigation&&page<32)anchors.push(link(largeBook,'맨끝',{class:'pg_end','data-page':'32'}));
  const pager=new Element({tag:'nav'},'현재'+page+'페이지'+Array.from({length:last-first+1},(_,i)=>(first+i)+'페이지').join(''),{'a[href]':anchors,'.pg_current':new Element({tag:'strong'},String(domCurrent))});
  return {links,bookTitle:'창작물 속으로',nodes:{'.theme-episode-pager':[pager]}};
 };
 for(let page=1;page<=32;page++)documents.set('LARGE'+page,largePage(page));
 let largeCalls=[];
 e._requestResult=async(url)=>{largeCalls.push(url);return {url,value:'LARGE'+(e._pageNumber(url)||1)}};
 const large=await e.getDetail(largeBook);
 check('32 pages and 3145 chapters, not first ten',()=>{assert.equal(large.chapters.length,3145);assert.equal(largeCalls.length,32);assert(large.description.includes('목차 수집 완료'));assert.equal(large.chapters[0].name,'1화');assert.equal(large.chapters.at(-1).name,'3145화');assert.equal(new Set(large.chapters.map(ch=>ch.url)).size,3145)});
 prefs.delete('newtoki1_toc_v23_'+encodeURIComponent(largeBook));
 for(let page=1;page<=10;page++)documents.set('TRUNCATED'+page,largePage(page,{navigation:false}));
 e._requestResult=async(url)=>({url,value:'TRUNCATED'+e._pageNumber(url)});
 const incomplete=await e._collectSerialChapters(new Document('TRUNCATED1'),base,'35155',largeBook,now+75000);
 check('1000 chapters never claimed complete for 3145',()=>{assert.equal(incomplete.chapters.length,1000);assert(!incomplete.complete);assert(incomplete.failed.has(0));assert.equal(incomplete.chapters[0].name,'2146화');assert.equal(incomplete.chapters.at(-1).name,'3145화')});
 prefs.delete('newtoki1_toc_v23_'+encodeURIComponent(largeBook));
 const resumptions=[];e._requestResult=async(url)=>{resumptions.push(e._pageNumber(url));now+=2000;return {url,value:'LARGE'+e._pageNumber(url)}};
 const pauseAt=now+5000;
 const short=await e._collectSerialChapters(new Document('LARGE1'),base,'35155',largeBook,pauseAt);
 check('partial checkpoint is incomplete',()=>{assert(!short.complete);assert(short.chapters.length<3145)});
 const alreadyCollected=new Set(resumptions);resumptions.length=0;
 const resumed=await e._collectSerialChapters(new Document('LARGE1'),base,'35155',largeBook,now+150000);
 check('refresh resumes collected pages',()=>{assert(resumed.complete);assert.equal(resumed.chapters.length,3145);assert(resumptions.every(page=>!alreadyCollected.has(page)))});
 prefs.delete('newtoki1_toc_v23_'+encodeURIComponent(largeBook));
 documents.set('WRONGPAGE',largePage(2,{domCurrent:1}));
 e._requestResult=async(url)=>({url,value:e._pageNumber(url)===2?'WRONGPAGE':'LARGE'+e._pageNumber(url)});
 const wrong=await e._collectSerialChapters(new Document('LARGE1'),base,'35155',largeBook,now+75000);
 check('DOM page mismatch rejected',()=>{assert(!wrong.complete);assert(wrong.failed.get(2).includes('表示')||wrong.failed.get(2).includes('표시'));assert.equal(wrong.chapters.length,3045)});
 const coverDoc={links:[],bookTitle:'실제 작품',nodes:{'.view-title .view-content img':[new Element({src:'https://img.test/real-cover.webp'})]}};
 documents.set('COVER',coverDoc);let coverCalls=0;e._listContext={deadline:now+20000,closed:false};
 e._requestResult=async(url)=>{coverCalls++;now+=400;return {url,value:'COVER'}};
 const hydrated=[{name:'+4638.3만 표지 작품',link:base+'/novel/777',imageUrl:e.generatedCover('777')}];await e._hydrateCovers(hydrated,base);
 check('rank text-only entries get detail covers',()=>{assert.equal(coverCalls,1);assert.equal(hydrated[0].imageUrl,'https://img.test/real-cover.webp');assert.equal(hydrated[0].name,'표지 작품')});
 now=e._listContext.deadline;const noTime=[{name:'남은 표지',link:base+'/novel/778',imageUrl:e.generatedCover('778')}];await e._hydrateCovers(noTime,base);
 check('cover enrichment never extends list deadline',()=>assert.equal(coverCalls,1));e._listContext=null;
 check('cover diagnostic identifies each missing title',()=>assert(e._report('covers').includes('남은 표지 · '+base+'/novel/778')));
 const idx=JSON.parse(fs.readFileSync(__dirname+'/index.min.json'));
 check('source identity/isolation',()=>{assert.equal(idx[1].sourceCode,code);assert.equal(idx[1].version,'0.2.23');assert.equal(idx[1].id,780920261010903);assert.equal(idx[0].version,'0.2.17')});
 check('Mangayomi WebView joins without duplicate novel path',()=>{assert.equal(idx[1].baseUrl,'https://newtoki1.org');for(const path of ['/novel/17709','/novel/29689','/novel/29689/4062173'])assert.equal(idx[1].baseUrl+path,base+path);assert(code.includes('baseUrl: "https://newtoki1.org"'))});
 console.log('PASS: '+count+' source 1 checks — polluted titles, merged covers, numbering/year handling, transport fallback/deadline, gates, scoped reader, visible diagnostics, redaction, source isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
