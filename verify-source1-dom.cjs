// Requires jsdom (npm install --no-save jsdom). Mirrors the native DOM bridge,
// including empty Element wrappers returned when selectFirst finds nothing.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const {JSDOM} = require('jsdom');
const code = fs.readFileSync(__dirname + '/newtoki1_novel.js', 'utf8');
class Element {
  constructor(node) {this.node = node;}
  attr(key) {return this.node?.getAttribute(key) || '';}
  get text() {return this.node?.textContent || '';}
  get localName() {return this.node?.localName || '';}
  get children() {return Array.from(this.node?.children || [], node => new Element(node));}
  get nextElementSibling() {return new Element(this.node?.nextElementSibling);}
  get getHref() {return this.attr('href');}
  get getSrc() {return this.attr('src');}
  select(s) {return Array.from(this.node?.querySelectorAll(s) || [], node => new Element(node));}
  selectFirst(s) {return new Element(this.node?.querySelector(s));}
}
class Document extends Element {
  constructor(html) {super(new JSDOM(html).window.document);}
}
const prefs = new Map();
class SharedPreferences {get(k) {return prefs.get(k);} getString(k,d) {return prefs.get(k) ?? d;} setString(k,v) {prefs.set(k,v);}}
let bridge = '';
const ctx = {MProvider: class {}, Document, SharedPreferences, Date, setTimeout, clearTimeout,
  sendMessage: async (_, arg) => {bridge = JSON.parse(arg)[2][0];return '__TOKI31_OK__<p>fixture</p>';}};
vm.createContext(ctx);vm.runInContext(code + ';this.Ext=DefaultExtension;',ctx);
const e = new ctx.Ext(), base = 'https://newtoki1.org', book = base + '/novel/17709';
e._resolveBaseUrl = async () => base;
const row = n => `<li class="list-item"><div class="wr-num">${n}</div><a href="/novel/17709/${10000+n}">${n===34?'지옥같은 수련을 시작하다 2':n===6?'1998.04.13 인생 최악의 날':'회차 제목 '+n}</a><span>2021.08.22</span></li>`;
const rows = Array.from({length:36},(_,i)=>row(36-i)).join('');
const info = '<div class="view-title"><div class="view-content"><img src="https://img.example/cover.webp"><h2>미카엘 : 악을 심판하는 천사</h2><table><tr><td>작가</td><td><a href="/author/1">모노스타토스</a></td></tr><tr><td>장르</td><td>판타지, 현대, 회귀, 복수, 범죄</td></tr><tr><td>발행구분</td><td>연재중</td></tr></table></div></div>';
const html = `<h1>뉴토끼 - 웹툰 미리보기</h1><article>${info}<form id="serial-move"><ul class="serial-list">${rows}</ul></form></article><div class="recent"><a href="/novel/17709/10036">한국으로 돌아오다 2</a></div><div id="viewcomment"><table><tr><td>작가</td><td>댓글의 가짜 작가</td></tr></table></div>`;
let count = 0;
const check = (name,fn) => {fn();count++;console.log('PASS: '+name);};
(async () => {
  e._requestResult = async url => ({url,value:html});
  const detail = await e.getDetail(book);
  check('legacy serial list includes all 36 chapters, not recent widgets',()=>{assert.equal(detail.chapters.length,36);assert.equal(new Set(detail.chapters.map(c=>c.url)).size,36);assert(detail.description.includes('목차 수집 완료'));});
  check('official left row number beats title part/year',()=>{assert.equal(detail.chapters[0].name,'1화 · 회차 제목 1');assert.equal(detail.chapters[33].name,'34화 · 지옥같은 수련을 시작하다 2');assert.equal(detail.chapters[5].name,'6화 · 1998.04.13 인생 최악의 날');assert(detail.chapters.at(-1).name.startsWith('36화'));});
  check('author and five genres extracted from book table',()=>{assert.equal(detail.author,'모노스타토스');assert.equal(detail.artist,'모노스타토스');assert.equal(detail.genre.join(','),'판타지,현대,회귀,복수,범죄');assert(detail.description.startsWith('작가: 모노스타토스\n장르: 판타지, 현대, 회귀, 복수, 범죄'));});
  check('detail cover and ongoing status retained',()=>{assert.equal(detail.imageUrl,'https://img.example/cover.webp');assert.equal(detail.status,0);});
  const completed = new Document(html.replace('연재중','완결'));
  check('complete status read from book metadata',()=>assert.equal(e._detailMetadata(completed,completed.selectFirst('.novel-detail')).status,1));
  const unknown = e._detailMetadata(new Document('<div id=viewcomment><table><tr><td>작가</td><td>댓글 작성자</td></tr></table></div>'),new Element(null));
  check('missing metadata stays unknown, comments not authors',()=>{assert.equal(unknown.author,'');assert.equal(unknown.genre.length,0);});
  prefs.delete('newtoki1_toc_v25_'+encodeURIComponent(book));
  const partial = await e._collectSerialChapters(new Document(html.replace(row(17),'')),base,'17709',book,Date.now()+75000);
  check('missing middle row is incomplete, official other numbers retained',()=>{assert.equal(partial.chapters.length,35);assert(!partial.complete);assert(partial.failed.get(0).includes('17'));assert(partial.chapters.at(-1).name.startsWith('36화'));});
  const links = Array.from({length:8},(_,i)=>`<a href="/novel/17709/${20000+i}">부분 제목 ${i+1}</a>`).join('');
  e._requestResult = async url => ({url,value:info+links});
  const unscoped = await e.getDetail(book);
  check('unsupported list never claims full TOC or trailing part numbers',()=>{assert(unscoped.description.includes('목차 범위 확인 필요'));assert(!unscoped.description.includes('목차 수집 완료'));assert(unscoped.chapters.every(c=>c.name.startsWith('[회차 번호 확인 필요]')));});
  const pager = new Document('<nav class="pg_wrap"><strong class="pg_current">1</strong><a href="?epage=2">2페이지</a><a class="pg_end" href="?epage=3">맨끝</a></nav><nav class="pg_wrap"><a href="?cpage=99">99페이지</a></nav>');
  check('older episode pager identified without comment pagination',()=>{const p=e._episodePager(pager,base,'17709',book);assert.equal(p.pages.get(2),book+'?epage=2');assert.equal(p.expected,3);assert(!p.pages.has(99));});
  e._saveReport('toc','v0.2.25 · 목차 수집 미완료\n작품: '+book+'\n수집 회차: 35\n실패 페이지: 17화 누락');e._rememberTocReport(book);
  const other=base+'/novel/35155';e._saveReport('toc','v0.2.25 · 목차 수집 완료\n작품: '+other+'\n수집 회차: 3145');e._rememberTocReport(other);
  check('a successful other book cannot erase the failed book record',()=>{assert(e._report('tocHistory').includes('17화 누락'));assert(e._report('tocHistory').includes('3145'));});
  const modernRoot=new Document('<div class="novel-detail"><div class="nd-meta"><span><a>현대 작가</a></span></div><span class="hero-v2-tag">판타지</span><span class="hero-v2-tag">현대</span><span class="nv-badge--done">완결</span></div>');
  check('newer book metadata layout remains supported',()=>{const m=e._detailMetadata(modernRoot,modernRoot.selectFirst('.novel-detail'));assert.equal(m.author,'현대 작가');assert.equal(m.genre.join(','),'판타지,현대');assert.equal(m.status,1);});
  const text='첫 문단. 두 문장은 그대로 둡니다.\n"대사 문단."\n\n\n마지막 & <내용> 문단.\r\n끝.';
  const formatted=e._novelHtml('제목 & <회차>',text), dom=new JSDOM(formatted);
  check('single LF, blank lines and CRLF become indented p blocks',()=>{assert.equal(dom.window.document.querySelectorAll('p').length,4);assert.equal(dom.window.document.querySelectorAll('br').length,0);assert.equal(dom.window.document.querySelector('p').textContent,'\u00a0첫 문단. 두 문장은 그대로 둡니다.');});
  check('text and escaping retained without injected HTML',()=>{assert.equal(dom.window.document.querySelector('h2').textContent,'제목 & <회차>');assert.equal(dom.window.document.querySelectorAll('p')[2].textContent,'\u00a0마지막 & <내용> 문단.');assert(!dom.window.document.querySelector('내용'));assert(!formatted.includes('line-height'));});
  check('exactly one preserved space per paragraph',()=>{const parsed=new JSDOM(e._novelHtml('들여쓰기','  첫 문단\n\u00a0둘째 문단'));assert.deepEqual(Array.from(parsed.window.document.querySelectorAll('p'),p=>p.textContent),['\u00a0첫 문단','\u00a0둘째 문단']);parsed.window.close();});
  const divInfo = '<div class="view-title"><h2>버튜버지만, 출근합니다</h2><div><div>작가</div><div class="theme-detail-meta-text"><a>망크빵</a></div></div><div><div>장르</div><div class="theme-detail-meta-text">현대, 일상, 인터넷방송, 버튜버, TS, 나데나데</div></div><div><span>발행구분</span><span>연재중</span></div></div>';
  check('legacy div metadata returns observed author and genres',()=>{const d=new Document(divInfo);const m=e._detailMetadata(d,d.selectFirst('.novel-detail'));assert.equal(m.author,'망크빵');assert.equal(m.genre.join(','),'현대,일상,인터넷방송,버튜버,TS,나데나데');});
  check('dl metadata with nested wrappers',()=>{const d=new Document('<div class=view-title><dl><dt>작가:</dt><dd><a>맥주포션</a></dd><dt>장르</dt><dd>판타지, 액션</dd><dt>발행구분</dt><dd>완결</dd></dl></div>');const m=e._detailMetadata(d,d.selectFirst('.novel-detail'));assert.equal(m.author,'맥주포션');assert.equal(m.genre.join(','),'판타지,액션');assert.equal(m.status,1);});
  check('scoped label chain fallback excludes page comments',()=>{const d=new Document('<div class=view-title>버튜버지만, 출근합니다 작가 망크빵 장르 현대, 일상, 인터넷방송 발행구분 연재중 작품 소개</div><div id=viewcomment>작가 가짜 장르 가짜 발행구분 완결</div>');const m=e._detailMetadata(d,d.selectFirst('.novel-detail'));assert.equal(m.author,'망크빵');assert.equal(m.genre.join(','),'현대,일상,인터넷방송');});
  const datedRows='<div class=serial-list><li class=list-item><div class=wr-num>442</div><div class=wr-subject><a class=item-subject href=/novel/34207/4978892>442. IF. 천도희, 화나다! (19)</a><div class=item-details>2026.05.12 0 1</div></div><div class="wr-date hidden-xs">2026.05.12</div></li><li class=list-item><div class=wr-num>441</div><div class=wr-subject><a class=item-subject href=/novel/34207/4884328>441. IF. 천도희, 화나다! (18)</a><div class=item-details>2026.05.06 0 1</div></div><div class=wr-date></div></li><li class=list-item><div class=wr-num>440</div><a class=item-subject href=/novel/34207/4865517>440. IF. 천도희, 화나다! (17)</a><div class=item-details>오늘 0 1</div></li></div>';
  check('source upload date from desktop and mobile cells, unknown not fabricated',()=>{const c=e._serialChapters(new Document(datedRows),base,'34207');assert.equal(c.length,3);assert.equal(c[0].dateUpload,String(Date.UTC(2026,4,12)-9*3600000));assert.equal(c[1].dateUpload,String(Date.UTC(2026,4,6)-9*3600000));assert.equal(c[2].dateUpload,null);assert.equal(c[0].number,'442');});
  check('calendar dates without trailing dot and invalid dates',()=>{assert.equal(e.parseDate('2026.05.12'),String(Date.UTC(2026,4,12)-9*3600000));assert.equal(e.parseDate('21.08.22.'),String(Date.UTC(2021,7,22)-9*3600000));assert.equal(e.parseDate('2024-02-29'),String(Date.UTC(2024,1,29)-9*3600000));assert.equal(e.parseDate('2026.02.29'),null);assert.equal(e.parseDate('2026.13.01'),null);assert.equal(e.parseDate('오늘'),null);});
  e._requestResult=async url=>({url,value:'<article>'+divInfo+datedRows+'</article>'});
  const datedDetail=await e.getDetail(base+'/novel/34207');
  check('detail delivers author, genres and dates through full TOC pipeline',()=>{assert.equal(datedDetail.author,'망크빵');assert.equal(datedDetail.genre.length,6);assert.equal(datedDetail.chapters.find(c=>c.url.endsWith('/4978892')).dateUpload,String(Date.UTC(2026,4,12)-9*3600000));assert(e._report('metadata').includes('업로드 날짜 확인: 2/3'));assert(e._report('metadata').includes('2026-05-12'));const next=new ctx.Ext();const saved=JSON.parse(next._preferenceString('newtoki1_toc_v25_'+encodeURIComponent(base+'/novel/34207'),'{}'));assert.equal(saved.pages[0][1][0].dateUpload,String(Date.UTC(2026,4,12)-9*3600000));});
  e._requestResult=async()=>{throw Error('RhttpConnectionException Connection error URL: '+base+'/novel/34428?token=PRIVATE Bearer PRIVATE');};
  await assert.rejects(e.getDetail(base+'/novel/34428'),/작품 상세 연결 실패/);
  check('refresh failure names book and saves full redacted transport reason',()=>{const r=e._report('detailRequest');assert(r.includes('/novel/34428'));assert(r.includes('RhttpConnectionException'));assert(!r.includes('PRIVATE'));assert(!r.includes('?token'));});
  await e._localWebViewNovel('fixture',book+'/10001',base,8);
  const local = new JSDOM('<h3 class="theme-novel-title">테스트 회차</h3><div class="novel-viewer">'+Array.from({length:3},(_,i)=>'<p>로컬 본문 '+i+' 입니다. 문장을 변경하지 않습니다.</p>').join('')+'</div>',{url:book+'/10001',runScripts:'outside-only'});
  let sent='';local.window.flutter_inappwebview={callHandler:(_,v)=>sent=v};local.window.eval(bridge);
  check('local WebView and external server share paragraph formatter',()=>{assert(sent.startsWith('__TOKI31_OK__'));assert.equal(new JSDOM(sent.replace('__TOKI31_OK__','')).window.document.querySelectorAll('p').length,3);});
  local.window.close();dom.window.close();
  console.log('PASS: '+count+' source 1 real DOM checks');
})().catch(error=>{console.error(error);process.exitCode=1;});
