const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const {JSDOM} = require('jsdom');
class Element {
  constructor(node) { this.node = node; }
  attr(key) { return this.node?.getAttribute(key) || ''; }
  get text() { return this.node?.textContent || ''; }
  get getHref() { return this.attr('href'); }
  get getSrc() { return this.attr('src'); }
  select(selector) { return Array.from(this.node?.querySelectorAll(selector) || [], n => new Element(n)); }
  selectFirst(selector) { return new Element(this.node?.querySelector(selector)); }
}
class Document extends Element { constructor(html) { super(new JSDOM(html).window.document); } }
const ctx = vm.createContext({MProvider: class {}, Document, Date, setTimeout, clearTimeout,
  SharedPreferences: class { getString(key, fallback) { return fallback; } setString() {} }});
vm.runInContext(fs.readFileSync(__dirname + '/toki31_novel.js', 'utf8') + ';this.Ext=DefaultExtension;', ctx);
const e = new ctx.Ext();
// Same priority as native ChapterRecognition: Ep, then Ch., then bare digits.
function nativeNumber(name) {
  const text = name.toLowerCase().replaceAll('-', '.');
  const match = text.match(/\b(?:folge|episode|ep\.?)\s*([0-9]+(?:\.[0-9]+)?)/)
    || text.match(/(?<=ch\.) *([0-9]+)(\.[0-9]+)?/)
    || text.match(/([0-9]+)(\.[0-9]+)?/);
  return match ? Number(match[1]) : null;
}
let count = 0;
const check = fn => { fn(); count++; };
(async () => {
  const examples = [[142, '020번 업무 기록 - Ep 6. 본업으로 돌아갈 때 (2)', 6],
    [133, '020번 업무 기록 - Ep 2. 민들레 뿌리 뽑기 (2)', 2],
    [130, '020번 업무 기록 - Ep 1. 잔디밭 정리 (2)', 1],
    [42, '이야기 Ch. 3', 3], [51, '이야기 Episode 4', 4], [52, '이야기 Folge 5', 5]];
  for (const [number, title, wrong] of examples) check(() => {
    assert.equal(nativeNumber(number + '화 - ' + title), wrong);
    const fixed = number + '화 - ' + e._chapterTitle(title);
    assert.equal(nativeNumber(fixed), number);
    assert.equal(fixed.replaceAll('\u2060', ''), number + '화 - ' + title);
  });
  check(() => {
    for (const title of ['Season 2', 'S2', 'Staffel 3', 'Saison 4', 'Temporada 5'])
      assert.equal(/\b(?:staffel|season|saison|temporada|s)\s*([0-9]+)/i.test(e._chapterTitle(title)), false);
  });
  check(() => {
    for (const title of ['002번 근무 기록 - 마땅한 결과 (3)', '1998.04.13 인생 최악의 날', '에필로그', 'step 6'])
      assert.equal(e._chapterTitle(title), title);
  });
  const base = 'https://toki34.com', book = base + '/novel/123';
  e._resolveBaseUrl = async () => base;
  const html = '<div class="novel-detail"><div class="nd-info"><h1>작품</h1></div></div>'
    + '<div class="novel-ep-row" data-ep="142" data-episode-id="1420"><a class="novel-ep-link" href="/novel/123/1420"></a><span class="ne-num">142화</span><span class="ne-title">020번 업무 기록 - Ep 6. 본업으로 돌아갈 때 (2)</span><span class="ne-date">2024.02.22</span></div>'
    + '<div class="novel-ep-row" data-ep="7" data-episode-id="70"><a class="novel-ep-link" href="/novel/123/70"></a><span class="ne-num">7화</span><span class="ne-title">001번 근무 기록 (1)</span><span class="ne-date">2023.10.08</span></div><script>({"hasOlder":true})</script>';
  const api = {ok: true, hasOlder: false, items: [{id: '60', number: 6, episodeLabel: '6화', title: '마지막 근무 기록 (4)', publishedAtLabel: '2023.10.07'},
    {id: '1330', number: 133, episodeLabel: '133화', title: '020번 업무 기록 - Ep 2. 민들레 뿌리 뽑기 (2)', publishedAtLabel: '2024.02.11'}]};
  e._requestResult = async url => ({url, value: url.includes('/api/') ? JSON.stringify(api) : html});
  const detail = await e.getDetail(book);
  check(() => assert.deepEqual(Array.from(detail.chapters, c => nativeNumber(c.name)), [142, 7, 6, 133]));
  check(() => assert.deepEqual(Array.from(detail.chapters, c => nativeNumber(c.name)).sort((a,b) => b-a), [142, 133, 7, 6]));
  check(() => assert.equal(new Set(Array.from(detail.chapters, c => nativeNumber(c.name))).size, 4));
  check(() => {
    assert.equal(detail.chapters[0].url, book + '/1420');
    assert.equal(detail.chapters[0].dateUpload, e.parseDate('2024.02.22'));
    assert.equal(detail.chapters[3].url, book + '/1330');
    assert.equal(detail.chapters[3].dateUpload, e.parseDate('2024.02.11'));
  });
  check(() => assert.equal(e._readerHeading('', book + '/1420').chapterTitle, detail.chapters[0].name));
  console.log('PASS: ' + count + ' toki numbering regression checks');
})().catch(error => { console.error(error); process.exitCode = 1; });
