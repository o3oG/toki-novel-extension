const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const {createHash} = require('crypto');
const {JSDOM} = require('jsdom');

// Observable results captured before the cleanup, at commit d2d35e7.
// Production code does not depend on this fixture or on Node/jsdom.
const fixturePath = __dirname + '/refactor-contract.json';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
class Element {
  constructor(node) { this.node = node; }
  attr(key) { return this.node?.getAttribute(key) || ''; }
  get text() { return this.node?.textContent || ''; }
  get getHref() { return this.attr('href'); }
  get getSrc() { return this.attr('src'); }
  select(selector) { return Array.from(this.node?.querySelectorAll(selector) || [], node => new Element(node)); }
  selectFirst(selector) { return new Element(this.node?.querySelector(selector)); }
}
class Document extends Element {
  constructor(html) { super(new JSDOM(html).window.document); }
}
function setup(file) {
  const writes = [], prefs = new Map();
  const context = vm.createContext({MProvider: class {}, Document, Date, setTimeout, clearTimeout,
    SharedPreferences: class {
      get(key) { return prefs.get(key); }
      getString(key, fallback) { return prefs.get(key) ?? fallback; }
      setString(key, value) { writes.push([key, value]); prefs.set(key, value); }
    }});
  vm.runInContext(fs.readFileSync(__dirname + '/' + file, 'utf8') + ';this.Ext = DefaultExtension;', context);
  return {extension: new context.Ext(), writes};
}
async function capture(file) {
  const {extension: e, writes} = setup(file), result = {};
  const save = (name, value) => { result[name] = digest(value); };
  const filters = e.getFilterList();
  save('filter labels, order and defaults', filters);
  save('preference keys, labels and defaults', e.getSourcePreferences());
  const choices = ['Status', 'Genre', 'Platform', 'Sort'].map(field => filters.find(filter => filter.type === 'novel' + field).values.map(option => option.value));
  const rules = [];
  for (const status of choices[0]) for (const genre of choices[1]) for (const platform of choices[2]) for (const sort of choices[3]) {
    const rule = {mode: 'filter', status, genre, platform, sort};
    rules.push([e._normalizeRule(rule), e._ruleSummary(rule), e._encodeRule(rule), e._decodeRule(e._encodeRule(rule))]);
  }
  save('all 1200 supported filter combinations', rules);
  const invalid = [null, {}, 'invalid', {mode: 'rank'}, {status: 'completed ', genre: null, platform: 1, sort: 'HOT'},
    {status: 'all', genre: 'invalid', platform: 'invalid', sort: 'invalid'}, {mode: 'rank', status: 'completed', genre: 'fantasy', platform: 'series', sort: 'hot'}];
  save('invalid filters and saved-rule decoding', invalid.map(rule => [e._normalizeRule(rule), e._ruleSummary(rule), e._encodeRule(rule)])
    .concat(['', '2|rank|completed|||hot', '1|invalid|bad|bad|bad|bad', '1|rank|completed|||hot'].map(value => e._decodeRule(value, e._defaultPopularRule()))));
  const actions = [];
  e.loadApiList = async (page, rule, query) => ({page, rule, query});
  for (let action = 0; action <= 6; action++) {
    for (const [query, page] of [['', 1], ['', 2], [' 제목 ', 1]]) {
      writes.length = 0;
      const selected = filters.filter(filter => filter.type_name === 'SelectFilter').map(filter => ({...filter,
        state: filter.type === 'tabRuleAction' ? action : filter.values.length - 1}));
      actions.push([action, query, page, await e._searchList(query, page, selected), [...writes]]);
    }
  }
  save('search and all tab save/reset actions', actions);
  const doc = new Document('<a class="novel-card" href="/novel/1"><span class="nv-title">첫 작품</span><div class="nv-thumb"><img src="https://img.test/1.jpg"></div></a>'
    + '<a class="novel-card" href="/novel/1"><span class="nv-title">중복</span></a><a class="novel-card" href="/novel/2"><span class="nv-title"></span></a>'
    + '<div class="search-results-grid"><a class="card" href="/novel/1"><span class="subject">중복 검색</span></a>'
    + '<a class="card" href="novel/3"><span class="subject">검색 작품</span><div class="thumb"><img src="https://img.test/3.jpg"></div></a>'
    + '<a class="card" href="/webtoon/4"><span class="subject">소설 외 항목</span></a></div>');
  save('list selector order, duplicate removal and covers', e.listFromDocument(doc, e.fallbackBaseUrl));
  e._officialCardSet = async () => ({cards: [{name: '공식 카드', imageUrl: 'https://img.test/card.jpg'}]});
  e._customCardSource = () => 'https://cards.test/config.json';
  e._customCards = async () => ['https://img.test/custom.jpg'];
  e._activeEventCard = async () => ({name: '이벤트', imageUrl: 'https://img.test/event.jpg'});
  const prefix = file === 'toki31_novel.js' ? '__toki_novel_card__' : '__newtoki1_novel_card__';
  const cards = [];
  for (const key of ['official-1', 'official-99', 'reading-1', 'reading-9', 'custom-1', 'custom-9', 'event', 'unknown']) cards.push(await e.getDetail('/' + prefix + '/' + key));
  save('official, custom, legacy and event card detail', cards);
  save('escaped body, titles and paragraph formatting', e._novelHtml('작품명 10화', '글자16px\n첫 & <문단>.\r\n"대사"\n\n마지막 문단.', {bookTitle: '작품명', chapterTitle: '10화 · 회차명'}));
  return result;
}
(async () => {
  const actual = {};
  for (const file of ['toki31_novel.js', 'newtoki1_novel.js']) actual[file] = await capture(file);
  if (process.argv.includes('--record')) {
    fs.writeFileSync(fixturePath, JSON.stringify(actual, null, 2) + '\n');
    console.log('Recorded pre-refactor observable results.');
    return;
  }
  const expected = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  let count = 0;
  for (const [file, results] of Object.entries(expected)) for (const [name, hash] of Object.entries(results)) {
    assert.equal(actual[file][name], hash, file + ': ' + name);
    count++;
  }
  console.log('PASS: ' + count + ' pre-refactor behavior comparisons');
})().catch(error => {console.error(error); process.exitCode = 1;});
