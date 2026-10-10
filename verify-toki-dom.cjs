const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(__dirname+'/toki31_novel.js','utf8');
class Element {
 constructor(node){this.node=node;}
 attr(k){return this.node?.getAttribute(k)||'';}
 get text(){return this.node?.textContent||'';}
 get getHref(){return this.attr('href');}
 get getSrc(){return this.attr('src');}
 select(s){return Array.from(this.node?.querySelectorAll(s)||[],n=>new Element(n));}
 selectFirst(s){return new Element(this.node?.querySelector(s));}
}
class Document extends Element {constructor(html){super(new JSDOM(html).window.document);}}
const prefs=new Map();let bridge='';
const ctx=vm.createContext({MProvider:class{},Document,Date,setTimeout,clearTimeout,
 SharedPreferences:class{get(k){return prefs.get(k);}getString(k,d){return prefs.get(k)??d;}setString(k,v){prefs.set(k,v);}},
 sendMessage:async(_,arg)=>{bridge=JSON.parse(arg)[2][0];return '__TOKI31_OK__<p>fixture</p>';}});
vm.runInContext(source+'\nthis.Ext=DefaultExtension;this.meta=mangayomiSources[0];',ctx);
const e=new ctx.Ext(),base='https://toki34.com',book=base+'/novel/57317',target=book+'/5809517';
let count=0;
function check(name,fn){fn();count++;}
// These are the actual native detail WebView's URL composition rules.
function nativeDetailUrl(baseUrl,link){
 const path=link.replace(/^https?:\/\/[^/]+/,'');
 return baseUrl.endsWith('/')&&path.startsWith('/')?baseUrl+path.slice(1)
  :!baseUrl.endsWith('/')&&!path.startsWith('/')?baseUrl+'/'+path:baseUrl+path;
}
const nativeClean=html=>{
 const d=new JSDOM(html),out=d.window.document.body.innerHTML;d.window.close();
 return out.replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&nbsp;/g,' ');
};
function leadingTrim(node){
 if(node.nodeType===3){node.textContent=node.textContent.trimStart();return;}
 if(node.nodeType!==1||node.style.whiteSpace==='pre')return;
 if(node.firstChild)leadingTrim(node.firstChild);
}
(async()=>{
 check('display name changes without replacing the source identity',()=>{
  const index=JSON.parse(fs.readFileSync(__dirname+'/index.min.json','utf8'));
  assert.equal(ctx.meta.name,'toki xx 소설');assert.equal(index[0].name,ctx.meta.name);
  assert.equal(index[0].id,780920260913901);
 });
 check('leading viewer font controls disappear before real prose',()=>{
  const d=new JSDOM(e._novelHtml('제목','글자16px\n폰트 크기: 18pt\n첫 문단\n둘째 문단'));
  assert.deepEqual(Array.from(d.window.document.querySelectorAll('p'),p=>p.textContent),['\u2060\u3000첫 문단','\u2060\u3000둘째 문단']);d.window.close();
 });
 check('font words in quoted or later story lines remain unchanged',()=>{
  for(const text of ['"글자16px"라고 말했다.\n다음 문단','시작 문단\n글자16px\n마지막 문단','글자16px이 보였다.']){
   const d=new JSDOM(e._novelHtml('제목',text));assert.deepEqual(Array.from(d.window.document.querySelectorAll('p'),p=>p.textContent.slice(2)),text.split('\n'));d.window.close();
  }
 });
 check('old native detail URL reproduces screenshot',()=>assert.equal(nativeDetailUrl(base+'/novel',book),base+'/novel/novel/57317'));
 check('new source metadata opens saved absolute and relative books once',()=>{
  assert.equal(ctx.meta.baseUrl,base);
  for(const link of [book,'/novel/57317','novel/57317','https://toki33.com/novel/57317'])
   assert.equal(nativeDetailUrl(ctx.meta.baseUrl,link),book);
 });
 check('old duplicate paths are repaired and query values retained',()=>{
  for(const link of [base+'/novel/novel/57317','/novel/novel/57317','novel/novel/57317'])
   assert.equal(e.siteUrl(base+'/novel',link+'?epage=2#toc'),book+'?epage=2#toc');
  assert.equal(e.siteUrl(base,book+'?q=/novel/novel/123'),book+'?q=/novel/novel/123');
  assert.equal(e.siteUrl(base,'/novel/novel/57317/5809517'),target);
 });
 check('numbered origins rebase without changing chapter or query',()=>assert.equal(e.siteUrl('https://toki35.com',target+'?mode=text#body'),'https://toki35.com/novel/57317/5809517?mode=text#body'));
 const heading={bookTitle:'와인의 신',chapterTitle:'42화 · 제목 & 회차'};
 const text=' 첫 문단. 문장은 변경하지 않습니다.\n"대사 문단."\n\n\n마지막 & <내용> 문단.\r\n끝.';
 const html=e._novelHtml('와인의 신 42화',text,heading),d=new JSDOM(html);
 check('book and chapter use separate first and second headings',()=>{
  assert.equal(d.window.document.querySelector('h2').textContent,'와인의 신');
  assert.equal(d.window.document.querySelector('h3').textContent,'42화 · 제목 & 회차');
  assert.equal(d.window.document.querySelector('h2').nextElementSibling.tagName,'H3');
 });
 check('single LF, blank lines and CRLF become individual paragraphs',()=>{assert.equal(d.window.document.querySelectorAll('p').length,4);assert.equal(d.window.document.querySelectorAll('br').length,0);});
 check('each paragraph starts with exactly one full-width space',()=>{
  const p=Array.from(d.window.document.querySelectorAll('p'));
  assert.deepEqual(p.map(n=>n.textContent),['\u2060\u3000첫 문단. 문장은 변경하지 않습니다.','\u2060\u3000"대사 문단."','\u2060\u3000마지막 & <내용> 문단.','\u2060\u3000끝.']);
 });
 check('body and headings are HTML escaped without changing words',()=>{assert(!d.window.document.querySelector('내용'));assert(html.includes('&lt;내용&gt;'));assert(html.includes('제목 &amp; 회차'));});
 check('plain NBSP reproduces lost indentation after native cleaning',()=>{const x=new JSDOM(nativeClean('<p>&#160;첫 문단</p>'));leadingTrim(x.window.document.querySelector('p'));assert.equal(x.window.document.querySelector('p').textContent,'첫 문단');x.window.close();});
 check('new indent survives native cleaner and block trimming',()=>{
  const x=new JSDOM(nativeClean(html));for(const p of x.window.document.querySelectorAll('p')){leadingTrim(p);assert(p.textContent.startsWith('\u2060\u3000'));assert.equal(p.firstElementChild.style.whiteSpace,'pre');}x.window.close();
 });
 check('pagination string trim also preserves the first-line space',()=>{
  const line=d.window.document.querySelector('p').textContent.trim().match(/[^.!?\n…]+[.!?\n…]*/)[0].trim();assert(line.startsWith('\u2060\u3000'));
 });
 check('only an exact known book prefix is stripped from server title',()=>{
  for(const [title,bookTitle,expected] of [['1984 세계 1998.04.13 인생 최악의 날','1984 세계','1998.04.13 인생 최악의 날'],['와인의 신에게','와인의 신','와인의 신에게']]){
   const x=new JSDOM(e._novelHtml(title,'본문',{bookTitle}));assert.equal(x.window.document.querySelector('h3').textContent,expected);x.window.close();
  }
 });
 e._resolveBaseUrl=async()=>base;
 e._requestResult=async()=>({url:book,value:'<div class="novel-detail"><div class="nd-info"><h1>와인의 신</h1></div></div><div class="novel-ep-row" data-episode-id="5809517"><a class="novel-ep-link" href="/novel/57317/5809517"></a><span class="ne-num">42화</span><span class="ne-title">제목 &amp; 회차</span></div>'});
 const detail=await e.getDetail(book);
 check('full detail collection stores known book and chapter labels',()=>{
  assert.equal(detail.name,'와인의 신');assert.equal(detail.chapters.length,1);
  assert.equal(e._readerHeading('오래된 제목',target).chapterTitle,'42화 - 제목 & 회차');
 });
 check('saved headings survive new extension instance and domain advance',()=>{
  const fresh=new ctx.Ext(),h=fresh._readerHeading('오래된 제목',target.replace('toki34','toki35'));assert.equal(h.bookTitle,'와인의 신');assert.equal(h.chapterTitle,'42화 - 제목 & 회차');
 });
 check('current headings are available before asynchronous preference writes finish',()=>{
  const fresh=new ctx.Ext();fresh._setPreferenceString=()=>{};
  fresh._rememberReaderHeadings(base+'/novel/888','새 작품',[{url:base+'/novel/888/999',name:'1화 - 새 회차'}]);
  const h=fresh._readerHeading('이전 작품',base+'/novel/888/999');assert.equal(h.bookTitle,'새 작품');assert.equal(h.chapterTitle,'1화 - 새 회차');
 });
 check('a chapter from another book cannot pollute the stored heading',()=>{
  e._rememberReaderHeadings(book,'와인의 신',[{url:base+'/novel/999/5809517',name:'다른 작품 회차'}]);
  assert.equal(e._readerHeading('와인의 신',target).chapterTitle,'');
  e._rememberReaderHeadings(book,detail.name,detail.chapters);
 });
 check('imported books use app book name without inventing a chapter',()=>{
  const h=e._readerHeading('1984 세계',base+'/novel/999/123');assert.equal(h.bookTitle,'1984 세계');assert.equal(h.chapterTitle,'');
 });
 e._externalAuthEnabled=()=>true;e._withDomainFallback=async(url,ref,op)=>({url,value:await op(url,ref,{remainingSeconds:100})});
 const id='11111111-1111-4111-a111-111111111111';let closed=0;
 e._externalAuthJson=async(ep,path)=>path==='/health'?{service:'rabbit-auth-server',protocol:1,ready:true}
  :path==='/v1/jobs'?{id}:path.endsWith('/manifest')?{id,chapterUrl:target,kind:'novel',title:'와인의 신 42화',text}
  :path.endsWith('/close')?(closed++,{state:'closed'}):{state:'ready'};
 e._externalAuthEndpoint=()=> 'http://127.0.0.1:9898';
 const external=await e.getHtmlContent('오래된 제목',target),x=new JSDOM(external);
 check('external server returns saved headings, paragraphs, indent and cleanup',()=>{
  assert.equal(x.window.document.querySelector('h2').textContent,'와인의 신');assert.equal(x.window.document.querySelector('h3').textContent,'42화 - 제목 & 회차');assert.equal(x.window.document.querySelectorAll('p').length,4);assert.equal(closed,1);
 });
 await e._localWebViewNovel('와인의 신',target,base,8,e._readerHeading('와인의 신',target));
 const local=new JSDOM('<h3 class="ne-h1">와인의 신 42화</h3>',{url:target,runScripts:'outside-only'});
 let sent='';local.window.__novelTTSText=text;local.window.flutter_inappwebview={callHandler:(_,v)=>sent=v};local.window.eval(bridge);
 check('local WebView uses the identical paragraph and heading formatter',()=>assert.equal(sent,'__TOKI31_OK__'+external));
 check('manifest contains matching source code, root URL and preserved ID',()=>{
  const index=JSON.parse(fs.readFileSync(__dirname+'/index.min.json','utf8'));assert.equal(index[0].sourceCode,source);assert.equal(index[0].baseUrl,base);assert.equal(index[0].version,'0.2.25');assert.equal(index[0].id,780920260913901);
 });
 d.window.close();x.window.close();local.window.close();
 console.log('PASS: '+count+' Toki reader DOM checks — separate headings, paragraph preservation, native indent cleaning, cached IDs, both reader modes, native WebView URL composition');
})().catch(error=>{console.error(error);process.exitCode=1;});
