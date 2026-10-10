const mangayomiSources = [{
  name: "toki xx 소설",
  lang: "ko",
  baseUrl: "https://toki34.com",
  apiUrl: "",
  iconUrl: "https://dc-toki-mangayomi-novel.pages.dev/icon/ko.toki-novel.png",
  typeSource: "single",
  itemType: 2,
  version: "0.2.25",
  dateFormat: "",
  dateFormatLocale: "ko_KR",
  pkgPath: "novel/src/ko/toki31_novel.js",
  isNsfw: true,
  hasCloudflare: false,
  appMinVerReq: "0.9.2",
  notes: "작품명/회차명 표시 · 문단 줄바꿈·한 칸 들여쓰기 · 글자 크기 문구 제거 · 최근 정상 주소 재확인 생략 · 초기 완료 확인 단축 · 20초 주소 전환 · 웹뷰 경로 수정"
}];

const dcNovelFilterOptions = {
  status: [
    ["소설 (연재중)","ongoing"],
    ["완결 소설","completed"]
  ],
  genre: [
    ["전체",""],
    ["판타지","fantasy"],
    ["무협","wuxia"],
    ["19금","adult19"],
    ["현대","modern"],
    ["로맨스","romance"],
    ["로맨스 판타지","romance_fantasy"],
    ["BL","bl"],
    ["라노벨","light_novel"],
    ["기타","etc"]
  ],
  platform: [
    ["전체",""],
    ["직접 업로드","user"],
    ["노벨피아","novelpia"],
    ["북토끼","booktoki"],
    ["문피아","munpia"],
    ["조아라","joara"],
    ["카카오페이지","kakaopage"],
    ["네이버 시리즈","series"],
    ["리디북스","ridi"],
    ["기타","etc"]
  ],
  sort: [
    ["최신순","new"],
    ["신작순","fresh"],
    ["북마크순","hot"],
    ["조회순","views"],
    ["평점순","rating"],
    ["화수순","episodes"]
  ]
};

let tokiNovelDomainRequestActive = false;

function dcNovelReadableHtml(title, text, heading) {
  const escape = value => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  // Source line breaks are paragraph boundaries. The app converts NBSP to an
  // ordinary space, then flutter_html trims block-leading whitespace. Preserve
  // one full-width character space in an inline pre span. A zero-width word
  // joiner also keeps the paginated reader's trim/split path from stripping it.
  // Do not change wrapping, line height or the original wording.
  const lines = String(text || "").replace(/\r\n?/g, "\n").split(/\n+/)
    .map(line => line.trim()).filter(Boolean);
  // A leading viewer font-size label is a control, not chapter prose.
  // Remove only exact labels before the first paragraph; preserve quoted
  // labels and every matching line later in the actual story.
  while (lines.length && /^(?:글자(?:\s*크기)?|글씨(?:\s*크기)?|폰트(?:\s*크기)?)\s*[:：]?\s*\d{1,3}(?:\.\d+)?\s*(?:px|pt)$/i.test(lines[0])) lines.shift();
  const paragraphs = lines.map(line => '<p><span style="white-space: pre">&#8288;&#12288;</span>' + escape(line) + "</p>").join("");
  const titles = heading || {};
  const book = String(titles.bookTitle || "").trim();
  const combined = String(title || "").trim();
  let chapter = String(titles.chapterTitle || "").trim();
  if (!chapter && book && combined !== book) {
    // Strip only an exact, known book prefix; never guess where a title splits.
    chapter = combined.startsWith(book) && /^[\s·|:-]/.test(combined.slice(book.length))
      ? combined.slice(book.length).replace(/^[\s·|:-]+/, "") : combined;
  }
  // Absolute CSS sizes avoid relative font-size compounding in flutter_html 3.
  const mainTitle = book || (chapter ? "[작품명 확인 필요]" : (combined || "Chapter"));
  const header = '<h2 class="toki-novel-book-title" style="font-size: 24px; margin: 0 0 8px 0">'
    + escape(mainTitle) + '</h2>'
    + (chapter ? '<h3 class="toki-novel-chapter-title" style="font-size: 19.2px; margin: 0 0 12px 0">'
      + escape(chapter) + '</h3>' : "");
  return header + '<hr><div class="toki-novel-paragraphs">' + paragraphs + "</div>";
}

function dcResolveListCardManifest(data, scope, tab) {
  const source = data && typeof data === "object" ? data : {};
  const currentScope = String(scope || "default").trim().toLowerCase();
  const currentTab = String(tab || "all").trim().toLowerCase();
  const groupByScope = {
    xtoon: "manga", toon11: "manga", goodtoon: "manga", blacktoon: "manga", wolf_manga: "manga", wolf_webtoon: "manga",
    ani24: "media", anilife: "media", dc_iptv: "media", dc_live: "media", samsung_tv_plus: "media", linkkf_anime: "media", tvroom: "media",
    toki31_novel: "novel"
  };
  const currentGroup = groupByScope[currentScope] || "";
  const values = function(value) {
    if (Array.isArray(value)) return value.map(function(item) { return String(item || "").trim().toLowerCase(); }).filter(Boolean);
    const one = String(value || "").trim().toLowerCase();
    return one ? [one] : [];
  };
  let selected = null, selectedIndex = -1, selectedScore = -Infinity;
  const rules = Array.isArray(source.rules) ? source.rules : [];
  for (let index = 0; index < rules.length; index++) {
    const rule = rules[index];
    if (!rule || typeof rule !== "object" || rule.enabled === false) continue;
    const match = rule.match && typeof rule.match === "object" ? rule.match : {};
    const targets = values(rule.targets || rule.extensions || rule.scopes || match.targets || match.extensions || match.scopes);
    const groups = values(rule.groups || match.groups);
    const tabs = values(rule.tabs || rule.tab || match.tabs || match.tab);
    let targetScore = 0;
    if (targets.length) {
      if (targets.indexOf(currentScope + ":" + currentTab) >= 0) targetScore = 600;
      else if (targets.indexOf(currentScope) >= 0) targetScore = 500;
      else continue;
    } else if (groups.length) {
      if (!currentGroup || groups.indexOf(currentGroup) < 0) continue;
      targetScore = 300;
    }
    let tabScore = 0;
    if (tabs.length && tabs.indexOf("*") < 0 && tabs.indexOf("all") < 0 && tabs.indexOf("both") < 0) {
      if (tabs.indexOf(currentTab) < 0) continue;
      tabScore = 50;
    }
    const priority = Number(rule.priority) || 0;
    const score = priority * 10000 + targetScore + tabScore;
    if (score > selectedScore) { selected = rule; selectedIndex = index; selectedScore = score; }
  }
  const selectedCards = selected && Array.isArray(selected.cards) && selected.cards.length ? selected.cards : source.cards;
  const rootRotation = source.rotation && typeof source.rotation === "object" ? source.rotation : {};
  const ruleRotation = selected && selected.rotation && typeof selected.rotation === "object" ? selected.rotation : {};
  const revisionParts = [source.revision];
  if (selected) revisionParts.push(selected.revision, selected.id || ("rule-" + selectedIndex));
  return {
    cards: Array.isArray(selectedCards) ? selectedCards : [],
    name: String(selected && (selected.name || selected.title) || source.name || source.title || "").trim(),
    revision: revisionParts.map(function(value) { return String(value || "").trim(); }).filter(Boolean).join(":"),
    rotation: Object.assign({}, rootRotation, ruleRotation)
  };
}

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.fallbackBaseUrl = "https://toki34.com";
    this.signalUrl = "https://wankyo83.github.io/tokki-traffic-light/domains.json";
    this.assetBaseUrl = "https://dc-toki-mangayomi-novel.pages.dev";
    this.eventManifestUrl = this.assetBaseUrl + "/assets/official-event-card.json";
    this.cardManifestUrl = this.assetBaseUrl + "/assets/official-random-cards.json";
    this.popularRulePreference = "toki_novel_popular_rule_v1";
    this.latestRulePreference = "toki_novel_latest_rule_v1";
    this.domainPreference = "toki_novel_domain_url_v2";
    this.customCardPreference = "toki_novel_custom_card_json_url_v2";
    this.autoDomainBase = "";
    this.maxDomainAdvances = 20;
    this.domainRequestBudgetMs = 120000;
    this.domainObservationMs = 20000;
    this.listRequestBudgetMs = 20000;
    this.domainScanCooldownMs = 60000;
    this.domainCacheMs = 10 * 60 * 1000;
    this.pageSize = 49;
    this.requestSequence = 0;
    this.readerHeadings = new Map();
  }

  get supportsLatest() {
    return true;
  }

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      Referer: `${this.fallbackBaseUrl}/novel`
    };
  }

  _text(value) {
    return value === null || value === undefined ? "" : String(value);
  }

  _trimSlash(value) {
    return this._text(value).trim().replace(/\/+$/, "");
  }

  _origin(value) {
    const match = this._text(value).match(/^(https?:\/\/[^/]+)/i);
    return match ? match[1] : "";
  }

  _isHttpsOrigin(value) {
    return /^https:\/\/[^\s/]+\/?$/i.test(this._text(value).trim());
  }

  _preference(key, fallback) {
    try {
      const value = new SharedPreferences().get(key);
      return value === null || value === undefined ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  _preferenceString(key, fallback) {
    try {
      const value = new SharedPreferences().getString(key, fallback);
      return value === null || value === undefined ? fallback : this._text(value);
    } catch (_) {
      return fallback;
    }
  }

  _setPreferenceString(key, value) {
    if (this._listContext?.closed) return;
    try {
      new SharedPreferences().setString(key, this._text(value));
    } catch (_) {}
  }

  _migratedPreferenceString(key, legacyKey) {
    const marker = key + "_legacy_migrated";
    let current = this._preferenceString(key, "");
    if (this._preferenceString(marker, "") !== "1") {
      const legacy = this._preferenceString(legacyKey, "");
      if (!current.trim() && legacy.trim()) {
        this._setPreferenceString(key, legacy);
        current = legacy;
      }
      this._setPreferenceString(marker, "1");
    }
    return current;
  }

  getHeaders(url, referer) {
    const origin = this._origin(url) || this.fallbackBaseUrl;
    return {
      ...this.headers,
      Referer: referer || origin + "/novel"
    };
  }

  _numberedTokiOrigin(url) {
    const match = this._text(url).match(/^https:\/\/toki(\d+)\.com(?=[/?#]|$)/i);
    return match ? { origin: match[0], number: Number(match[1]) } : null;
  }

  _rememberDomain(base, previous) {
    this._checkListBudget();
    if (previous && previous !== base) this._setPreferenceString("toki_novel_previous_base", previous);
    this._setPreferenceString("toki_novel_pending_auth_base", "");
    this.autoDomainBase = base;
    this._setPreferenceString("toki_novel_auto_domain_base", base);
    this._setPreferenceString("toki_novel_resolved_base", base);
    this._setPreferenceString("toki_novel_resolved_base_time", String(Date.now()));
    this._setPreferenceString("toki_novel_scan_after", "0");
  }

  _authenticationRequired(error, url) {
    const detail = this._text(error && (error.message || error));
    if (!error?.authenticationRequired && !/AUTH_REQUIRED|Failed to bypass Cloudflare|Cloudflare.*(?:challenge|verification)|인증이 필요/i.test(detail)) return null;
    const base = this._numberedTokiOrigin(url)?.origin;
    if (base) this._setPreferenceString("toki_novel_pending_auth_base", base);
    const blocked = new Error("Cloudflare 사람 인증이 필요합니다: " + (base || url) + "/novel — 해당 주소를 WebView에서 인증한 뒤 다시 시도하세요. 다음 번호로 이동하지 않습니다.");
    blocked.authenticationRequired = true;
    return blocked;
  }

  _isChallengeResponse(response) {
    const headers = response.headers || {};
    const header = name => {
      for (const key of Object.keys(headers)) if (key.toLowerCase() === name) return this._text(headers[key]).toLowerCase();
      return "";
    };
    const body = this._text(response.body);
    return header("cf-mitigated") === "challenge"
      || /cf-chl-|challenge-platform|cf-turnstile|challenge-form|verify you are human|verifying you are human/i.test(body)
     ;
  }

  _domainFailure(error) {
    if (error?.listDeadline) return { retry: false, candidate: false };
    const detail = this._text(error && (error.message || error));
    const match = detail.match(/^(?:HTTP |__TOKI31_ERR__HTTP_)(\d{3})(?:$|\b)/);
    const status = Number(error && error.statusCode) || Number(match && match[1]);
    if (/__TOKI31_ERR__INCOMPLETE/.test(detail)) return {retry: false, candidate: error?.invalidNovelResponse === true};
    const network = /SocketException|TimeoutException|timed? out|timeout|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|Failed host lookup|Network is unreachable|Connection refused|__TOKI31_ERR__NETWORK/i.test(detail)
      && !/HandshakeException|certificate|CERT_|SSL|TLS/i.test(detail);
    if (error?.authenticationRequired || /AUTH_REQUIRED|Failed to bypass Cloudflare/i.test(detail)) return { retry: false, candidate: false };
    return {
      retry: [502, 503, 504].indexOf(status) >= 0 || network,
      candidate: [403, 404, 410, 451, 502, 503, 504].indexOf(status) >= 0 || network || error?.invalidNovelResponse === true || error?.webViewNoResponse === true
    };
  }

  _invalidNovelResponse() {
    const error = new Error("소설 페이지 구조를 확인할 수 없습니다. 주소를 저장하지 않았습니다.");
    error.invalidNovelResponse = true;
    return error;
  }

  _validateNovelResponse(url, body) {
    const path = this._text(url).slice(this._origin(url).length).split(/[?#]/)[0];
    if (path === "/api/novel-list") {
      try {
        const data = JSON.parse(body);
        if (!Array.isArray(data?.novels) || !data.novels.every(item =>
          item && /^\d+$/.test(this._text(item.id)) && typeof item.title === "string" && item.title.trim())) {
          throw this._invalidNovelResponse();
        }
        return;
      } catch (_) { throw this._invalidNovelResponse(); }
    }
    if (/^\/api\/novel\/\d+\/episodes\/window$/.test(path)) {
      try {
        const data = JSON.parse(body);
        if (data?.ok === true && Array.isArray(data.items) && data.items.every(item =>
          item && /^\d+$/.test(this._text(item.id)) && typeof item.title === "string")) return;
      } catch (_) {}
      throw this._invalidNovelResponse();
    }
    const doc = new Document(body);
    if (/^\/novel\/\d+\/?$/.test(path)) {
      if (doc.selectFirst(".novel-detail") && this.firstText(doc, ".nd-info h1")) return;
    } else if (path === "/rank") {
      if (this.listFromRankDocument(doc, this._origin(url)).length > 0) return;
    } else if (path === "/novel" || path === "/novel/") {
      if (this.listFromDocument(doc, this._origin(url)).some(item => /\/novel\/\d+/.test(item.link))) return;
    }
    throw this._invalidNovelResponse();
  }

  _webViewHeaders(referer) {
    // Let WebView use its own user agent and cookie store from manual authentication.
    return referer ? { Referer: referer } : {};
  }

  async _webViewText(target, referer, timeoutSeconds, domainProbe) {
    const base = this._origin(target);
    const path = this._text(target).slice(base.length);
    const isApi = /^\/api\//.test(path);
    const landing = isApi ? base + "/novel" : target;
    const seconds = Math.max(1, Math.floor(timeoutSeconds || 35));
    const script = `(function () {
      if (window.__tokiReadInstalled) return;
      window.__tokiReadInstalled = true;
      var started = ${Date.now()}, delivered = false, fetching = false;
      var domainProbe = ${!!domainProbe};
      var origin = ${JSON.stringify(base)}, requestPath = ${JSON.stringify(path)}, api = ${isApi};
      function send(value) {
        if (delivered) return;
        delivered = true;
        window.flutter_inappwebview.callHandler("setResponse", String(value));
      }
      function challenge() {
        return !!document.querySelector("#challenge-form, #cf-challenge-running")
          || /just a moment|verify you are human|verifying you are human|checking your browser/i.test(String(document.title));
      }
      function siteReady() {
        if (api || /^\\/novel\\/?(?:[?#]|$)/.test(requestPath)) return !!document.querySelector("a.novel-card, .search-results-grid > a.card");
        if (/^\\/rank(?:[?#]|$)/.test(requestPath)) return !!document.querySelector("a.rank-v2-champion, a.rank-v2-runner, a.rank-v2-row");
        if (/^\\/novel\\/\\d+\\/?(?:[?#]|$)/.test(requestPath)) return !!document.querySelector(".novel-detail .nd-info h1");
        return false;
      }
      function check() {
        if (delivered) return;
        if (domainProbe && challenge()) { send("__TOKI_READ_ERR__AUTH_REQUIRED"); return; }
        if (domainProbe && /ERR_CERT_|ERR_SSL_/.test(String(document.body?.innerText || ""))) { send("__TOKI_READ_ERR__CERTIFICATE"); return; }
        var expired = Date.now() - started >= ${domainProbe ? seconds * 1000 : Math.max(500, seconds * 1000 - 3000)};
        if (domainProbe && expired && !siteReady()) { send("__TOKI_READ_ERR__DOMAIN_UNCONFIRMED"); return; }
        if (!domainProbe && (/chrome-error:|chromewebdata/i.test(String(location.href)) || /ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|ERR_TIMED_OUT/.test(String(document.body?.innerText || "")))) { send("__TOKI_READ_ERR__NETWORK"); return; }
        // Resolve the rendered URL: some WebViews report a missing/opaque origin.
        var href = String(location.href || "");
        var match = href.match(/^https:\\/\\/([^/?#]+)/i);
        var currentOrigin = match ? "https://" + match[1].toLowerCase() : "";
        function canonical(value) { return String(value).toLowerCase().replace("https://www.", "https://"); }
        if (!currentOrigin && /^(?:about:blank|about:srcdoc)?$/.test(href)) {
          if (domainProbe) { window.setTimeout(check, 250); return; }
          if (Date.now() - started < ${Math.max(500, seconds * 1000 - 3000)}) { window.setTimeout(check, 250); return; }
          send("__TOKI_READ_ERR__NOT_LOADED"); return;
        }
        if (canonical(currentOrigin) !== canonical(origin)) {
          if (domainProbe && /chrome-error:|chromewebdata/i.test(href)) { window.setTimeout(check, 250); return; }
          send("__TOKI_READ_ERR__REDIRECT|expected=" + origin + "|actual=" + (currentOrigin || href.split(/[?#]/)[0]).slice(0, 160)); return;
        }
        if (siteReady()) {
          if (!api) { send("__TOKI_READ_OK__" + document.documentElement.outerHTML); return; }
          if (fetching) return;
          fetching = true;
          // API requests run in the authenticated browser on the same origin.
          fetch(requestPath, {credentials: "same-origin", redirect: "error", headers: {Accept: "application/json"}}).then(function (response) {
            return response.text().then(function (body) {
              if (response.headers.get("cf-mitigated") === "challenge" || (/^\\s*</.test(body) && /challenge-form|cf-chl-|just a moment|verify you are human/i.test(body))) { send("__TOKI_READ_ERR__AUTH_REQUIRED"); return; }
              if (!response.ok) { send("__TOKI_READ_ERR__HTTP_" + response.status); return; }
              send("__TOKI_READ_OK__" + body);
            });
          }).catch(function () { send("__TOKI_READ_ERR__FETCH_FAILED"); });
          return;
        }
        if (domainProbe && expired) { send("__TOKI_READ_ERR__DOMAIN_UNCONFIRMED"); return; }
        var heading = String(document.title || "") + " " + String(document.querySelector("h1")?.textContent || "");
        if (!domainProbe && !challenge()) {
          var status = heading.match(/\\b(403|404|410|451|502|503|504)\\b/);
          if (status && /gateway|time.?out|unavailable|forbidden|not found|gone|legal reasons/i.test(heading)) { send("__TOKI_READ_ERR__HTTP_" + status[1]); return; }
          if (/chrome-error:|chromewebdata/i.test(String(location.href)) || /ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|ERR_TIMED_OUT/.test(String(document.body?.innerText || ""))) { send("__TOKI_READ_ERR__NETWORK"); return; }
        }
        if (!domainProbe && expired) {
          send(challenge() ? "__TOKI_READ_ERR__AUTH_REQUIRED" : "__TOKI_READ_ERR__INCOMPLETE"); return;
        }
        window.setTimeout(check, 250);
      }
      check();
    })();`;
    const raw = await sendMessage("evaluateJavascriptViaWebview", JSON.stringify([landing, this._webViewHeaders(referer), [script], domainProbe ? seconds + 1 : seconds]));
    if (typeof raw === "string" && raw.startsWith("__TOKI_READ_OK__")) return raw.slice("__TOKI_READ_OK__".length);
    const detail = this._text(raw);
    if (/AUTH_REQUIRED/.test(detail)) {
      const error = new Error("AUTH_REQUIRED"); error.authenticationRequired = true; throw error;
    }
    const status = detail.match(/^__TOKI_READ_ERR__HTTP_(\d{3})$/);
    if (status) { const error = new Error("HTTP " + status[1]); error.statusCode = Number(status[1]); throw error; }
    if (detail === "__TOKI_READ_ERR__NETWORK") throw new Error("__TOKI31_ERR__NETWORK");
    if (detail === "__TOKI_READ_ERR__INCOMPLETE") throw this._invalidNovelResponse();
    if (detail === "__TOKI_READ_ERR__DOMAIN_UNCONFIRMED") {
      const error = this._invalidNovelResponse(); error.domainUnconfirmed = true; throw error;
    }
    const redirected = detail.match(/^__TOKI_READ_ERR__REDIRECT\|expected=[^|]+\|actual=(https:\/\/toki\d+\.com)$/i);
    if (redirected && this._numberedTokiOrigin(redirected[1])) {
      const error = new Error(detail);
      error.redirectBase = redirected[1].toLowerCase();
      throw error;
    }
    // A transport timeout or fetch error is not proof of a changed domain.
    const error = new Error("WebView 응답을 가져오지 못했습니다. 앱 WebView에서 해당 주소를 확인한 뒤 다시 시도하세요. " + detail.slice(0, 150));
    error.webViewNoResponse = !detail;
    error.domainUnconfirmed = !!domainProbe && !detail;
    throw error;
  }

  async _rawText(url, referer, timeout, domainProbe) {
    if (this._numberedTokiOrigin(url)) return await this._webViewText(url, referer, timeout, domainProbe);
    const response = await new Client({
      persistentConnection: false, noProxy: true,
      timeout, connectTimeout: Math.min(8, timeout)
    }).get(url, this.getHeaders(url, referer));
    if (this._isChallengeResponse(response)) {
      const error = new Error("AUTH_REQUIRED");
      error.authenticationRequired = true;
      throw error;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      const error = new Error("HTTP " + response.statusCode);
      error.statusCode = Number(response.statusCode);
      throw error;
    }
    return this._text(response.body);
  }

  async _verifyCandidate(base, deadline, capSeconds) {
    const seconds = Math.min(capSeconds || 20, Math.floor((deadline - Date.now()) / 1000));
    if (seconds < 1) throw new Error("DOMAIN_SCAN_BUDGET_EXCEEDED");
    const body = await this._rawText(base + "/novel", base + "/novel", seconds, true);
    this._validateNovelResponse(base + "/novel", body);
  }

  async _withDomainFallback(url, referer, operation, options) {
    if (tokiNovelDomainRequestActive) throw new Error("소설 요청이 진행 중입니다. 인증 또는 현재 요청이 끝난 뒤 다시 시도하세요.");
    tokiNovelDomainRequestActive = true;
    try { return await this._runDomainFallback(url, referer, operation, options); }
    finally { tokiNovelDomainRequestActive = false; }
  }

  _rememberVerifiedDomain(base) {
    const record = {base, time:Date.now()};
    this.verifiedDomain = record;
    this._setPreferenceString("toki_novel_verified_domain_v23", JSON.stringify(record));
  }

  _recentVerifiedDomain(base) {
    try {
      const record = this.verifiedDomain || JSON.parse(this._preferenceString("toki_novel_verified_domain_v23", "{}"));
      const age = Date.now() - Number(record.time);
      return record.base === base && Number.isFinite(age) && age >= 0 && age < this.domainCacheMs;
    } catch (_) { return false; }
  }

  _forgetVerifiedDomain() {
    this.verifiedDomain = null;
    this._setPreferenceString("toki_novel_verified_domain_v23", "");
  }

  async _observeDomain(base, deadline) {
    const started = Date.now();
    const allotted = Math.min(this.domainObservationMs, Math.max(0, deadline - started));
    if (allotted < this.domainObservationMs) throw new Error("DOMAIN_SCAN_BUDGET_EXCEEDED");
    const list = this._listContext;
    // Domain observation is separate from the 20-second list response budget.
    if (list) { this._checkListBudget(); list.deadline += allotted + 1000; }
    try {
      await this._verifyCandidate(base, started + allotted, allotted / 1000);
      this._rememberVerifiedDomain(base);
      return;
    } catch (error) {
      if (error?.authenticationRequired || error?.redirectBase || !this._domainFailure(error).candidate) throw error;
      const wait = started + allotted - Date.now();
      if (wait > 0) await this._pause(wait);
      if (Date.now() < started + allotted) throw new Error("20초 주소 확인을 완료하지 못했습니다. 현재 번호를 유지합니다.");
      error.domainUnconfirmed = true;
      throw error;
    } finally {
      if (list) list.deadline -= Math.max(0, allotted + 1000 - (Date.now() - started));
    }
  }

  async _runDomainFallback(url, referer, operation, options) {
    const requested = this._numberedTokiOrigin(url);
    if (!requested) return {value: await operation(url, referer, {candidate:false, remainingSeconds:120}), url};
    const pending = this._numberedTokiOrigin(this._preferenceString("toki_novel_pending_auth_base", ""));
    const original = pending && pending.number >= requested.number ? pending : requested;
    const path = this._text(url).slice(requested.origin.length);
    const refererPath = this._numberedTokiOrigin(referer) ? this._text(referer).slice(this._origin(referer).length) : "/novel";
    const deadline = Date.now() + this.domainRequestBudgetMs;
    // A recent normal list/body response already proves this origin is live.
    // Try the chapter directly; transport failures restore normal observation.
    if (options?.reuseVerifiedDomain && !pending && this._recentVerifiedDomain(original.origin)) {
      try {
        const target = original.origin + path;
        const value = await operation(target, original.origin + refererPath, {
          candidate:false, remainingSeconds:Math.floor((deadline - Date.now()) / 1000),
          domainVerified:true, authenticationObserved:false
        });
        this._rememberVerifiedDomain(original.origin);
        return {value, url:target};
      } catch (error) {
        this._forgetVerifiedDomain();
        const authentication = this._authenticationRequired(error, original.origin + path);
        if (authentication) throw authentication;
        // Authentication-server failures are not target-domain failures.
        if (error?.externalAuthDiagnostic || !this._domainFailure(error).retry) throw error;
      }
    }
    const candidates = [original.origin];
    const visited = [], records = [];
    let redirects = 0;
    for (let step = 1; step <= this.maxDomainAdvances; step++) candidates.push("https://toki" + (original.number + step) + ".com");
    for (const base of candidates) {
      if (visited.indexOf(base) >= 0) continue;
      if (deadline - Date.now() < this.domainObservationMs) break;
      visited.push(base);
      const target = base + path;
      let authenticated = false;
      try {
        await this._observeDomain(base, deadline);
        records.push(base + " · 정상 페이지 확인 · 번호 유지");
        this._rememberDomain(base, requested.origin);
      } catch (error) {
        const authentication = this._authenticationRequired(error, target);
        if (authentication) {
          // A challenge is a live response. Never scan another number to avoid it.
          if (!options?.allowAuthenticatedServer) throw authentication;
          authenticated = true;
          records.push(base + " · 인증 요구 확인 · 번호 유지");
        } else if (error?.redirectBase) {
          if (++redirects > 3 || visited.indexOf(error.redirectBase) >= 0) throw new Error("소설 주소 이동이 반복됩니다. 주소 확인이 필요합니다.");
          candidates.splice(candidates.indexOf(base) + 1, 0, error.redirectBase);
          records.push(base + " · 사이트 주소 이동: " + error.redirectBase);
          continue;
        } else {
          records.push(base + " · " + this._text(error?.message || error).split("\n")[0].slice(0,180));
          if (!error?.domainUnconfirmed) throw error;
          records.push(base + " · 20초 동안 정상 페이지 및 인증 요구 미확인 · 다음 번호 요청");
          continue;
        }
      }
      // Once a normal page or challenge is observed, chapter/API errors cannot
      // trigger migration. Missing chapters do not mean that this site moved.
      try {
        const value = await operation(target, base + refererPath, {
          candidate:base !== requested.origin, remainingSeconds:Math.floor((deadline - Date.now()) / 1000),
          domainVerified:!authenticated, authenticationObserved:authenticated
        });
        if (authenticated) this._rememberDomain(base, requested.origin);
        if (options?.reuseVerifiedDomain) this._rememberVerifiedDomain(base);
        return {value, url:target};
      } catch (error) {
        const authentication = this._authenticationRequired(error, target);
        if (authentication) throw authentication;
        error.message += "\n주소 확인 v0.2.20:\n" + records.join("\n");
        throw error;
      }
    }
    this._setPreferenceString("toki_novel_scan_after", String(Date.now() + this.domainScanCooldownMs));
    throw new Error("주소 확인 v0.2.20 · 정상 페이지 또는 인증 요구를 확인하지 못했습니다. 기존 주소 유지: " + requested.origin + "\n" + records.join("\n"));
  }

  async _requestResult(url, referer, timeout) {
    this._checkListBudget();
    timeout = Math.min(timeout || 30, this._listContext ? Math.floor((this._listContext.deadline - Date.now()) / 1000) : Infinity);
    const result = await this._withDomainFallback(url, referer, async (target, currentReferer, context) => {
      const seconds = Math.min(timeout || 30, this._listContext && this._numberedTokiOrigin(target) ? 20 : Infinity, this._numberedTokiOrigin(target) ? (context.candidate ? 20 : 35) : (timeout || 30), context.remainingSeconds);
      if (seconds < 1) throw new Error("DOMAIN_SCAN_BUDGET_EXCEEDED");
      const body = await this._rawText(target, currentReferer, seconds);
      if (this._numberedTokiOrigin(target)) this._validateNovelResponse(target, body);
      return body;
    });
    this._checkListBudget();
    return result;
  }

  async _requestText(url, referer, timeout) {
    return (await this._requestResult(url, referer, timeout)).value;
  }

  async _resolveBaseUrl() {
    const manual = this._trimSlash(this._migratedPreferenceString(this.domainPreference, "toki_novel_domain_url"));
    const recovered = this.autoDomainBase || this._preferenceString("toki_novel_auto_domain_base", "");
    const cached = this._trimSlash(this._preferenceString("toki_novel_resolved_base", ""));
    if (this._isHttpsOrigin(manual)) {
      const manualToki = this._numberedTokiOrigin(manual), recoveredToki = this._numberedTokiOrigin(recovered);
      if (manualToki && recoveredToki && recoveredToki.number > manualToki.number) return recovered;
      return manual;
    }
    if (this._isHttpsOrigin(recovered) && this._numberedTokiOrigin(recovered)) return recovered;
    if (this._isHttpsOrigin(cached) && this._numberedTokiOrigin(cached)) return cached;
    try {
      const join = this.signalUrl.includes("?") ? "&" : "?";
      const data = JSON.parse(await this._requestText(this.signalUrl + join + "toki=" + Date.now(), this.signalUrl, this._listContext ? 2 : 4));
      const candidate = this._trimSlash(data?.domains?.toki?.baseUrl);
      if (this._isHttpsOrigin(candidate) && this._numberedTokiOrigin(candidate)) {
        const resolved = candidate;
        this._setPreferenceString("toki_novel_resolved_base", resolved);
        this._setPreferenceString("toki_novel_resolved_base_time", String(Date.now()));
        return resolved;
      }
    } catch (_) {}
    return this.fallbackBaseUrl;
  }

  absoluteUrl(base, url) {
    const value = this._text(url).trim();
    if (!value) return this._trimSlash(base || this.fallbackBaseUrl);
    if (/^https?:\/\//i.test(value)) return value;
    return `${this._trimSlash(base || this.fallbackBaseUrl)}${value.startsWith("/") ? "" : "/"}${value}`;
  }

  siteUrl(base, url) {
    // Old source metadata included /novel, while the app appends the full
    // /novel/{book} path. Repair only duplicated novel paths, not query values.
    const value = this._text(url).trim().replace(
      /^(https?:\/\/[^/?#]+\/|\/?)novel\/(?:novel\/)+(?=\d+(?:[/?#]|$))/i, "$1novel/");
    base = this._origin(base) || this._trimSlash(base);
    if (!value) return base;
    if (/^https?:\/\//i.test(value)) {
      const match = value.match(/^https?:\/\/[^/]+(\/.*)$/i);
      return match ? this.absoluteUrl(base, match[1]) : value;
    }
    return this.absoluteUrl(base, value);
  }

  cleanText(value) {
    return this._text(value)
      .replace(/\u00c2\s*\u00b7?/g, " ")
      .replace(/\s*UP\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  hasElement(element, selector) {
    try {
      const matches = element?.select(selector);
      return Boolean(matches && Number(matches.length) > 0);
    } catch (_) {
      return false;
    }
  }

  isTrueFlag(value) {
    if (value === true || value === 1) return true;
    return /^(?:true|1|yes|y)$/i.test(this._text(value).trim());
  }

  isPaidGate(value) {
    const gate = this._text(value).trim().toLowerCase();
    return Boolean(gate) && !["none", "free", "false", "0", "null", "undefined"].includes(gate);
  }

  firstText(element, selector) {
    const node = element?.selectFirst(selector);
    return node?.text?.trim() || "";
  }

  generatedCover(key) {
    const value = String(key || "novel");
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash * 31) + value.charCodeAt(index)) >>> 0;
    }
    return `${this.assetBaseUrl}/cover/auto-novel-${(hash % 8) + 1}.png`;
  }

  firstImage(element, selector, key = "") {
    const node = element?.selectFirst(selector);
    return node?.getSrc || node?.attr("src") || this.generatedCover(key);
  }

  listFromDocument(doc, base) {
    const list = [], seen = new Set();
    const groups = [
      ["a.novel-card", ".nv-title", ".nv-thumb img", false],
      [".search-results-grid > a.card", ".subject", ".thumb img", true]
    ];
    for (const [selector, titleSelector, imageSelector, checkPath] of groups) {
      for (const element of doc.select(selector)) {
        const rawLink = element.getHref || element.attr("href");
        if (checkPath && !/^\/?novel\/\d+/.test(rawLink || "")) continue;
        const link = this.siteUrl(base, rawLink);
        if (!link || seen.has(link)) continue;
        const name = this.firstText(element, titleSelector);
        if (!name) continue;
        seen.add(link);
        list.push({ name, link, imageUrl: this.firstImage(element, imageSelector, name) });
      }
    }
    return list;
  }

  listFromRankDocument(doc, base) {
    const list = [];
    const seen = new Set();
    const groups = [
      ["a.rank-v2-champion", "h2"],
      ["a.rank-v2-runner", ".rank-v2-runner-body strong"],
      ["a.rank-v2-row", ".rank-v2-row-title strong"]
    ];
    for (const group of groups) {
      for (const element of doc.select(group[0])) {
        const rawLink = element.getHref || element.attr("href");
        const link = this.siteUrl(base, rawLink);
        if (!/\/novel\/\d+/.test(link) || seen.has(link)) continue;
        const name = this.cleanText(this.firstText(element, group[1]));
        if (!name) continue;
        seen.add(link);
        list.push({
          name,
          link,
          imageUrl: this.firstImage(element, ".rank-v2-cover img", name)
        });
      }
    }
    return list.slice(0, 50).map((item, index) => ({
      ...item,
      name: `${index + 1}\uC704 \u00B7 ${item.name}`
    }));
  }

  novelFromApi(base, item) {
    const id = this._text(item?.id);
    const name = this.cleanText(item?.title || ("소설 " + id));
    return {
      name,
      link: `${this._trimSlash(base)}/novel/${encodeURIComponent(id)}`,
      imageUrl: this._text(item?.thumbnailUrl).trim() || this.generatedCover(id || name)
    };
  }

  async loadApiList(page, criteria, query) {
    let base = await this._resolveBaseUrl();
    const current = Math.max(1, Number(page) || 1);
    const params = [
      `page=${current}`,
      `pageSize=${this.pageSize}`
    ];
    const selected = criteria || {};
    if (query) params.push("q=" + encodeURIComponent(query));
    if (selected.genre) params.push("g=" + encodeURIComponent(selected.genre));
    if (selected.platform) params.push("p=" + encodeURIComponent(selected.platform));
    if (selected.sort && selected.sort !== "new") params.push("sort=" + encodeURIComponent(selected.sort));
    params.push("status=" + encodeURIComponent(selected.status || "ongoing"));
    const apiUrl = `${base}/api/novel-list?${params.join("&")}`;
    const result = await this._requestResult(apiUrl, `${base}/novel`, 30);
    base = this._origin(result.url);
    const body = result.value;
    const data = JSON.parse(body);
    const novels = Array.isArray(data?.novels) ? data.novels : [];
    return {
      list: novels.map((item) => this.novelFromApi(base, item)),
      hasNextPage: novels.length >= this.pageSize
    };
  }

  _driveDirect(url, image) {
    const value = this._text(url).trim();
    const match = value.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
    return match ? "https://drive.google.com/uc?export=" + (image ? "view" : "download") + "&id=" + match[1] : value;
  }

  _customCardSource() {
    return this._migratedPreferenceString(this.customCardPreference, "toki_novel_custom_card_json_url").trim();
  }

  async _customCards(source) {
    if (!source) return [];
    const cacheKey = "toki_novel_custom_card_cache";
    const sourceKey = cacheKey + "_source";
    const timeKey = cacheKey + "_time";
    const cached = this._preferenceString(sourceKey, "") === source ? this._preferenceString(cacheKey, "") : "";
    const cachedAt = Number(this._preferenceString(timeKey, "0"));
    let data = null;
    if (cached && cachedAt > 0 && Date.now() - cachedAt < 5 * 60 * 1000) {
      try { data = JSON.parse(cached); } catch (_) {}
    }
    if (!data) {
      try {
        const direct = this._driveDirect(source, false);
        const join = direct.includes("?") ? "&" : "?";
        data = JSON.parse(await this._requestText(direct + join + "card_json=" + Date.now(), source, 10));
        this._setPreferenceString(cacheKey, JSON.stringify(data));
        this._setPreferenceString(sourceKey, source);
        this._setPreferenceString(timeKey, String(Date.now()));
      } catch (_) {
        if (cached) {
          try { data = JSON.parse(cached); } catch (_) {}
        }
      }
    }
    if (!data || typeof data !== "object") return [];
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    let values = [];
    if (Array.isArray(data.cards)) values = data.cards;
    else if (data.cards && typeof data.cards === "object") {
      values = days.map((day) => data.cards[day]).filter(Boolean);
      if (!values.length) values = Object.keys(data.cards).sort().map((key) => data.cards[key]);
    }
    if (!values.length && (data.default || data.card)) values = [data.default || data.card];
    const revision = this._text(data.revision).trim();
    return values.map((value) => {
      let image = this._driveDirect(value, true);
      if (revision) image += (image.includes("?") ? "&" : "?") + "revision=" + encodeURIComponent(revision);
      return image;
    }).filter((value) => /^https:\/\//i.test(value));
  }

  _parseTime(value) {
    const time = Date.parse(this._text(value));
    return Number.isFinite(time) ? time : null;
  }

  async _activeEventCard() {
    try {
      const join = this.eventManifestUrl.includes("?") ? "&" : "?";
      const data = JSON.parse(await this._requestText(this.eventManifestUrl + join + "event_manifest=" + Date.now(), this.eventManifestUrl, 8));
      if (!data || data.enabled !== true) return null;
      const now = Date.now();
      const startsAt = this._parseTime(data.startsAt);
      const endsAt = this._parseTime(data.endsAt);
      if (startsAt !== null && now < startsAt) return null;
      if (endsAt !== null && now >= endsAt) return null;
      let imageUrl = this._text(data.imageUrl || data.image).trim();
      if (!/^https:\/\//i.test(imageUrl)) return null;
      const revision = this._text(data.revision).trim();
      if (revision) imageUrl += (imageUrl.includes("?") ? "&" : "?") + "revision=" + encodeURIComponent(revision);
      return { name: this.cleanText(data.name || data.title || "특별 이벤트"), imageUrl };
    } catch (_) {
      return null;
    }
  }

  _nextCardIndex(total, scope, holdMinutes, revision) {
    const count = Math.max(1, Number(total) || 1);
    const suffix = this._text(scope || "default").replace(/[^a-z0-9_-]/gi, "_");
    const key = "toki_novel_last_card_index_" + suffix;
    const timeKey = key + "_time";
    const revisionKey = key + "_revision";
    const previous = Number(this._preferenceString(key, "0"));
    const previousAt = Number(this._preferenceString(timeKey, "0"));
    const previousRevision = this._preferenceString(revisionKey, "");
    const minutes = Math.max(0, Number(holdMinutes) || 0);
    const currentRevision = this._text(revision);
    if (
      minutes > 0 &&
      previous >= 1 &&
      previous <= count &&
      previousAt > 0 &&
      Date.now() - previousAt < minutes * 60 * 1000 &&
      previousRevision === currentRevision
    ) {
      return previous;
    }
    let index = Math.floor(Math.random() * count) + 1;
    if (count > 1 && index === previous) index = (index % count) + 1;
    this._setPreferenceString(key, String(index));
    this._setPreferenceString(timeKey, String(Date.now()));
    this._setPreferenceString(revisionKey, currentRevision);
    return index;
  }

  _cardRotationMinutes(data) {
    const override = this._preferenceString("toki_novel_card_rotation_minutes", "").trim();
    if (/^\d+$/.test(override)) return Math.max(0, Number(override) || 0);
    const rotation = data && typeof data.rotation === "object" ? data.rotation : {};
    if (this._text(rotation.mode).toLowerCase() !== "interval") return 0;
    return Math.max(1, Number(rotation.intervalMinutes) || 60);
  }

  _manifestCards(data) {
    const values = Array.isArray(data?.cards) ? data.cards : [];
    const defaultName = this.cleanText(data?.name || data?.title || "오늘의 독서");
    const revision = this._text(data?.revision).trim();
    return values.map((value) => {
      const rawUrl = typeof value === "string" ? value : value?.imageUrl || value?.image || value?.url;
      let imageUrl = this._text(rawUrl).trim();
      if (imageUrl.startsWith("/")) imageUrl = this.assetBaseUrl + imageUrl;
      if (!/^https:\/\//i.test(imageUrl)) return null;
      if (revision) imageUrl += (imageUrl.includes("?") ? "&" : "?") + "revision=" + encodeURIComponent(revision);
      return {
        name: this.cleanText(typeof value === "object" ? value.name || value.title || defaultName : defaultName),
        imageUrl
      };
    }).filter(Boolean);
  }

  async _officialCardSet(tab) {
    let data = null;
    try {
      const join = this.cardManifestUrl.includes("?") ? "&" : "?";
      data = JSON.parse(await this._requestText(this.cardManifestUrl + join + "card_manifest=" + Date.now(), this.cardManifestUrl, 8));
    } catch (_) {}
    const config = dcResolveListCardManifest(data, "toki31_novel", tab);
    let cards = this._manifestCards(config);
    if (!cards.length) {
      cards = Array.from({ length: 20 }, (_, offset) => ({
        name: "오늘의 독서",
        imageUrl: `${this.assetBaseUrl}/card/shared-random/card-${String(offset + 1).padStart(2, "0")}.jpg`
      }));
    }
    return {
      cards,
      revision: this._text(config.revision),
      holdMinutes: this._cardRotationMinutes(config)
    };
  }

  async _tabCard(tab) {
    const customSource = this._customCardSource();
    if (customSource) {
      const cards = await this._customCards(customSource);
      if (cards.length) {
        const index = this._nextCardIndex(cards.length, "custom", 0, customSource);
        return { name: "오늘의 독서", link: `/__toki_novel_card__/custom-${index}`, imageUrl: cards[index - 1] };
      }
    }
    const event = await this._activeEventCard();
    if (event) return { name: event.name, link: "/__toki_novel_card__/event", imageUrl: event.imageUrl };
    const official = await this._officialCardSet(tab);
    const index = this._nextCardIndex(official.cards.length, "official-" + String(tab || "all"), official.holdMinutes, official.revision);
    const card = official.cards[index - 1];
    return {
      name: card.name,
      link: `/__toki_novel_card__/official-${index}`,
      imageUrl: card.imageUrl
    };
  }

  _defaultPopularRule() {
    return { mode: "rank", status: "ongoing", genre: "", platform: "", sort: "hot" };
  }

  _defaultLatestRule() {
    return { mode: "filter", status: "ongoing", genre: "", platform: "", sort: "new" };
  }

  _allowedRuleValue(value, pairs, fallback) {
    const text = this._text(value);
    return pairs.some(([, option]) => option === text) ? text : fallback;
  }

  _normalizeRule(rule, fallback) {
    const source = rule || fallback || this._defaultLatestRule();
    return {
      mode: source.mode === "rank" ? "rank" : "filter",
      status: this._allowedRuleValue(source.status, dcNovelFilterOptions.status, "ongoing"),
      genre: this._allowedRuleValue(source.genre, dcNovelFilterOptions.genre, ""),
      platform: this._allowedRuleValue(source.platform, dcNovelFilterOptions.platform, ""),
      sort: this._allowedRuleValue(source.sort, dcNovelFilterOptions.sort, "new")
    };
  }

  _encodeRule(rule) {
    const value = this._normalizeRule(rule, this._defaultLatestRule());
    return ["1", value.mode, value.status, value.genre, value.platform, value.sort].join("|");
  }

  _decodeRule(value, fallback) {
    const parts = this._text(value).split("|");
    if (parts.length !== 6 || parts[0] !== "1") return this._normalizeRule(fallback, this._defaultLatestRule());
    return this._normalizeRule({ mode: parts[1], status: parts[2], genre: parts[3], platform: parts[4], sort: parts[5] }, fallback);
  }

  _tabRule(key, fallback) {
    const value = this._preferenceString(key, "");
    return value ? this._decodeRule(value, fallback) : this._normalizeRule(fallback, this._defaultLatestRule());
  }

  _ruleName(value, pairs, fallback) {
    const found = pairs.find((pair) => pair[1] === value);
    return found ? found[0] : fallback;
  }

  _ruleSummary(rule) {
    const value = this._normalizeRule(rule, this._defaultLatestRule());
    if (value.mode === "rank") return "6시간 소설 TOP 50";
    return Object.entries(dcNovelFilterOptions).map(([field, pairs]) =>
      this._ruleName(value[field], pairs, pairs[0][0])).join(" + ");
  }

  async _rankList(page) {
    if (Number(page) > 1) return { list: [], hasNextPage: false };
    const base = await this._resolveBaseUrl();
    const target = `${base}/rank?kind=novel`;
    const result = await this._requestResult(target, `${base}/rank`, 30);
    return { list: this.listFromRankDocument(new Document(result.value), this._origin(result.url)), hasNextPage: false };
  }

  async _listForRule(page, rule) {
    const value = this._normalizeRule(rule, this._defaultLatestRule());
    if (value.mode === "rank") return this._rankList(page);
    return this.loadApiList(page, value, "");
  }

  _listTimeoutError() {
    const error = new Error("소설 목록 응답 대기 20초를 초과했습니다. 재시도하거나 웹뷰에서 인증 상태를 확인하세요.");
    error.listDeadline = true;
    return error;
  }

  _checkListBudget() {
    if (this._listContext && (this._listContext.closed || Date.now() >= this._listContext.deadline)) {
      throw this._listTimeoutError();
    }
  }

  async _withListBudget(action) {
    // One isolated context per list call; no deadline leaks into chapter requests.
    const scoped = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    const context = { deadline: Date.now() + this.listRequestBudgetMs, closed: false };
    scoped._listContext = context;
    let timer;
    try {
      const work = action(scoped);
      if (typeof setTimeout !== "function" || typeof clearTimeout !== "function") {
        const result = await work;
        scoped._checkListBudget();
        return result;
      }
      return await Promise.race([work, new Promise((_, reject) => {
        const expire = () => {
          const remaining = context.deadline - Date.now();
          if (remaining > 0) { timer = setTimeout(expire, remaining); return; }
          context.closed = true;
          reject(scoped._listTimeoutError());
        };
        timer = setTimeout(expire, Math.max(1, context.deadline - Date.now()));
      })]);
    } finally {
      context.closed = true;
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  async _listWithOptionalCard(result, page, tab) {
    if (Number(page) !== 1) return result;
    const available = this._listContext.deadline - Date.now();
    if (available < 1500 || typeof setTimeout !== "function" || typeof clearTimeout !== "function") return result;
    // A decorative card must not turn a successfully fetched list into a timeout.
    const cardSource = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    const cardContext = { deadline: Date.now() + Math.min(1500, available - 250), closed: false };
    cardSource._listContext = cardContext;
    let timer;
    try {
      const card = await Promise.race([
        cardSource._tabCard(tab).catch(() => null),
        new Promise(resolve => { timer = setTimeout(() => resolve(null), cardContext.deadline - Date.now()); })
      ]);
      return card ? { list: [card].concat(result.list || []), hasNextPage: result.hasNextPage === true } : result;
    } finally {
      cardContext.closed = true;
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  async getPopular(page) {
    return this._withListBudget(async source => source._listWithOptionalCard(
      await source._listForRule(page, source._tabRule(source.popularRulePreference, source._defaultPopularRule())), page, "popular"));
  }

  async getLatestUpdates(page) {
    return this._withListBudget(async source => source._listWithOptionalCard(
      await source._listForRule(page, source._tabRule(source.latestRulePreference, source._defaultLatestRule())), page, "latest"));
  }

  _filterValue(filters, type, fallback) {
    if (!Array.isArray(filters)) return fallback;
    for (const filter of filters) {
      if (!filter || filter.type !== type || !Array.isArray(filter.values)) continue;
      const option = filter.values[Number(filter.state) || 0];
      if (!option || option.value === undefined) return fallback;
      const value = this._text(option.value);
      return value === "__unset__" ? fallback : value;
    }
    return fallback;
  }

  async search(query, page, filters) {
    return this._withListBudget(source => source._searchList(query, page, filters));
  }

  async _searchList(query, page, filters) {
    const rule = this._normalizeRule({
      mode: "filter",
      status: this._filterValue(filters, "novelStatus", "ongoing"),
      genre: this._filterValue(filters, "novelGenre", ""),
      platform: this._filterValue(filters, "novelPlatform", ""),
      sort: this._filterValue(filters, "novelSort", "new")
    }, this._defaultLatestRule());
    if (!this.cleanText(query) && Number(page) === 1) {
      const action = Number(this._filterValue(filters, "tabRuleAction", "0"));
      const preferences = new SharedPreferences();
      for (const [key, save, reset] of [[this.popularRulePreference, 1, 3], [this.latestRulePreference, 2, 4]]) {
        if (action === save) preferences.setString(key, this._encodeRule(rule));
        else if (action === reset || action === 5) preferences.setString(key, "");
      }
    }
    return this.loadApiList(page, rule, this.cleanText(query));
  }

  parseDate(value) {
    const match = String(value || "").match(/(\d{2,4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
    if (!match) return null;
    let year = Number(match[1]);
    if (year < 100) year += 2000;
    const date = new Date(year, Number(match[2]) - 1, Number(match[3]));
    return String(date.valueOf());
  }

  _chapterTitle(title) {
    // Native recognition prioritizes Ep/Ch and season tokens over the
    // leading site number. A word joiner keeps the title visually intact
    // while preventing those story-internal labels from overriding it.
    return this.cleanText(title).replace(
      /\b(folge|episode|ep|ch|staffel|season|saison|temporada|s)(?=\.?\s*\d)/gi,
      token => token[0] + "\u2060" + token.slice(1)
    );
  }

  async getDetail(url) {
    const cardMatch = this._text(url).match(/\/__toki_novel_card__\/([\w-]+)/);
    if (cardMatch) {
      const key = cardMatch[1];
      let item = null;
      const officialMatch = key.match(/^official-(\d+)$/);
      const reading = key.match(/^reading-(\d+)$/);
      const custom = key.match(/^custom-(\d+)$/);
      if (officialMatch) {
        const official = await this._officialCardSet();
        const index = Math.max(1, Number(officialMatch[1]) || 1);
        item = official.cards[index - 1] || official.cards[0];
      } else if (reading) {
        const index = Math.min(7, Math.max(1, Number(reading[1]) || 1));
        item = { name: "오늘의 독서", imageUrl: `${this.assetBaseUrl}/card/novel-reading-${String(index).padStart(2, "0")}.gif` };
      } else if (custom) {
        const cards = await this._customCards(this._customCardSource());
        const index = Math.max(1, Number(custom[1]) || 1);
        if (cards[index - 1]) item = { name: "오늘의 독서", imageUrl: cards[index - 1] };
      } else if (key === "event") {
        item = await this._activeEventCard();
      }
      if (!item) item = { name: "오늘의 독서", imageUrl: `${this.assetBaseUrl}/card/novel-reading-01.gif` };
      return {
        name: item.name,
        link: this._text(url),
        imageUrl: item.imageUrl,
        description: "목록을 구분하는 공용 독서 안내 카드입니다. 뒤로 돌아가 작품을 선택해 주세요.",
        genre: [cardMatch[1] === "event" ? "이벤트 안내" : "독서 카드"],
        author: "토끼 소설",
        artist: "",
        status: 0,
        chapters: []
      };
    }

    let base = await this._resolveBaseUrl();
    let target = this.siteUrl(base, url);
    const result = await this._requestResult(target, `${base}/novel`, 45);
    target = result.url;
    base = this._origin(target);
    const doc = new Document(result.value);
    const root = doc.selectFirst(".novel-detail");
    const name = this.firstText(root, ".nd-info h1");
    const description = this.firstText(root, ".nd-desc");
    const author = this.firstText(root, ".nd-meta span a");
    const genre = root
      ? root.select(".hero-v2-tag").map((element) => element.text.trim()).filter(Boolean)
      : [];
    const imageUrl = this.firstImage(root, ".nd-thumb img", name);
    const status = this.hasElement(root, ".nv-badge--done") ? 1 : 0;
    const chapters = [];
    const chapterIds = new Set();
    const novelIdMatch = target.match(/\/novel\/(\d+)/);
    const novelId = novelIdMatch ? novelIdMatch[1] : "";

    for (const row of doc.select(".novel-ep-row")) {
      const anchor = row.selectFirst("a.novel-ep-link");
      const chapterUrl = this.siteUrl(base, anchor?.getHref || anchor?.attr("href"));
      if (!chapterUrl) continue;
      const episodeId = row.attr("data-episode-id") || chapterUrl.split("/").pop();
      if (episodeId) chapterIds.add(String(episodeId));
      const number = this.cleanText(this.firstText(row, ".ne-num"));
      const title = this._chapterTitle(this.firstText(row, ".ne-title"));
      const rowText = this.cleanText(row.text);
      const rowClass = this._text(row.attr("class"));
      const isNotReady = this.hasElement(row, ".ep-badge-not-ready") || /novel-ep--not-ready/.test(rowClass);
      const gateMode = this._text(anchor?.attr("data-novel-episode-gate"));
      const isPaid = this.hasElement(row, ".ep-badge-paid, .ne-unlock-cost") || /novel-ep--paid/.test(rowClass) || this.isPaidGate(gateMode) || /(?:\uD83D\uDC8E|\uD83D\uDD12|\uC720\uB8CC|\uD3EC\uC778\uD2B8|\uACB0\uC81C|\d+P)/.test(rowText);
      const markers = [isNotReady ? "⏳ 준비중" : "", isPaid ? "🔒 유료" : ""].filter(Boolean).join(" ");
      chapters.push({
        name: `${markers ? markers + " · " : ""}${title ? `${number} - ${title}` : number}`,
        url: chapterUrl,
        dateUpload: this.parseDate(this.firstText(row, ".ne-date")),
        scanlator: null
      });
    }

    // The new site server-renders only the newest 100 episodes. Older
    // episodes are exposed through a cursor API, so follow the same windows
    // the website's "이전 회차 더 보기" button uses.
    if (novelId && chapters.length > 0) {
      const lastRow = doc.select(".novel-ep-row").slice(-1)[0];
      const lastNumber = Number(lastRow?.attr("data-ep") || 0);
      const lastId = String(lastRow?.attr("data-episode-id") || "");
      let cursor = lastNumber > 0 && lastId ? `${lastNumber}:${lastId}` : null;
      let hasOlder = Boolean(cursor) && /(?:\\"|")hasOlder(?:\\"|")\s*:\s*true/.test(result.value);
      let windows = 0;

      while (hasOlder && cursor && windows < 150) {
        const apiUrl = `${base}/api/novel/${encodeURIComponent(novelId)}/episodes/window?direction=older&cursor=${encodeURIComponent(cursor)}`;
        let windowResult;
        try {
          windowResult = await this._requestResult(apiUrl, target, 30);
        } catch (_) { break; }
        base = this._origin(windowResult.url);
        target = this.siteUrl(base, target);

        let data;
        try {
          data = JSON.parse(windowResult.value);
        } catch (_) {
          break;
        }
        if (!data?.ok || !Array.isArray(data.items)) break;

        for (const item of data.items) {
          const episodeId = String(item?.id || "");
          if (!episodeId || chapterIds.has(episodeId)) continue;
          chapterIds.add(episodeId);
          const number = this.cleanText(item.episodeLabel || (item.number ? `${item.number}\uD654` : "회차"));
          const title = this._chapterTitle(item.title || "");
          const markers = [
            this.isTrueFlag(item.isNotReady) ? "⏳ 준비중" : "",
            this.isTrueFlag(item.isPaid) || this.isPaidGate(item.gateMode) ? "🔒 유료" : ""
          ].filter(Boolean).join(" ");
          chapters.push({
            name: `${markers ? markers + " · " : ""}${title ? `${number} - ${title}` : number}`,
            url: `${base}/novel/${novelId}/${episodeId}`,
            dateUpload: this.parseDate(item.publishedAtLabel),
            scanlator: null
          });
        }

        hasOlder = this.isTrueFlag(data.hasOlder);
        cursor = typeof data.olderCursor === "string" ? data.olderCursor : null;
        windows += 1;
      }
    }

    this._rememberReaderHeadings(target, name, chapters);
    return {
      name,
      link: target,
      imageUrl,
      description,
      genre,
      author,
      artist: author,
      status,
      chapters: chapters.map(chapter => ({ ...chapter, url: this.siteUrl(base, chapter.url) }))
    };
  }

  _externalAuthEnabled() {
    const value = this._preference("toki_novel_external_auth_enabled", false);
    return value === true || this._text(value).toLowerCase() === "true" || this._text(value) === "1";
  }

  _externalAuthEndpoint() {
    const raw = this._trimSlash(this._preference("toki_novel_external_auth_endpoint", ""));
    if (!raw) throw new Error("외부인증 서버 주소가 비어 있습니다.");
    if (!/^https?:\/\/(?:\[[0-9a-f:]+\]|[a-z0-9.-]+)(?::\d{1,5})?$/i.test(raw)) {
      throw new Error("외부인증 서버 주소 형식이 잘못됐습니다.");
    }
    return raw;
  }

  _externalAuthHeaders(jsonBody) {
    const headers = { Accept: "application/json", "X-Lab-Request": "1" };
    if (jsonBody) headers["Content-Type"] = "application/json";
    const key = this._text(this._preference("toki_novel_external_auth_access_key", "")).trim();
    if (key) headers.Authorization = "Bearer " + key;
    return headers;
  }

  async _externalAuthJson(endpoint, path, body, ignoreFailure, timeoutSeconds) {
    try {
      const timeout = Math.max(1, Math.min(30, Math.floor(timeoutSeconds || 30)));
      const client = new Client({ persistentConnection: false, timeout, connectTimeout: Math.min(10, timeout) });
      const response = body === undefined
        ? await client.get(endpoint + path, this._externalAuthHeaders(false))
        : await client.post(endpoint + path, this._externalAuthHeaders(true), body);
      if ([401, 403].indexOf(Number(response.statusCode)) >= 0) {
        throw new Error("접속 키가 틀렸거나 서버 설정과 다릅니다.");
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        if (ignoreFailure) return {};
        throw new Error("외부인증 서버 요청 실패 (HTTP " + response.statusCode + ").");
      }
      return JSON.parse(this._text(response.body));
    } catch (error) {
      if (ignoreFailure) return {};
      const detail = this._text(error && (error.message || error));
      if (/\uC811\uC18D \uD0A4|\uC678\uBD80\uC778\uC99D \uC11C\uBC84 \uC694\uCCAD/.test(detail)) throw error;
      throw new Error("외부인증 서버에 연결할 수 없습니다. 주소, 포트, 방화벽을 확인하세요.");
    }
  }

  _newRequestId() {
    this.requestSequence += 1;
    let seed = Date.now().toString(16).padStart(12, "0")
      + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0")
      + Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0")
      + this.requestSequence.toString(16).padStart(4, "0");
    seed = (seed + "00000000000000000000000000000000").slice(0, 32);
    return seed.slice(0, 8) + "-" + seed.slice(8, 12) + "-4" + seed.slice(13, 16) + "-a" + seed.slice(17, 20) + "-" + seed.slice(20, 32);
  }

  async _pause(milliseconds) {
    if (typeof setTimeout === "function") {
      await new Promise((resolve) => setTimeout(resolve, milliseconds));
    }
  }

  _rememberReaderHeadings(target, name, chapters) {
    const bookId = this._text(target).match(/\/novel\/(\d+)(?:[/?#]|$)/)?.[1];
    if (!bookId || !this.cleanText(name)) return;
    const titles = {};
    for (const chapter of chapters || []) {
      const match = this._text(chapter.url).match(/\/novel\/(\d+)\/(\d+)(?:[?#]|$)/);
      if (match && match[1] === bookId && this.cleanText(chapter.name)) titles[match[2]] = this.cleanText(chapter.name);
    }
    // IDs survive numbered domain changes. Store only headings, not body text.
    const record = {bookTitle:this.cleanText(name), chapters:titles};
    this.readerHeadings.set(bookId, record);
    while (this.readerHeadings.size > 50) this.readerHeadings.delete(this.readerHeadings.keys().next().value);
    this._setPreferenceString("toki_novel_reader_headings_v21_" + bookId, JSON.stringify(record));
  }

  _readerHeading(name, target) {
    const match = this._text(target).match(/\/novel\/(\d+)\/(\d+)(?:[?#]|$)/);
    let cached = {};
    if (match) {
      try { cached = this.readerHeadings.get(match[1])
        || JSON.parse(this._preferenceString("toki_novel_reader_headings_v21_" + match[1], "{}")) || {}; }
      catch (_) {}
    }
    return {
      bookTitle:this.cleanText(cached.bookTitle || name).replace(/^\d+위\s*·\s*/, ""),
      chapterTitle:this.cleanText(match && cached.chapters?.[match[2]])
    };
  }

  _novelHtml(title, text, heading) {
    return dcNovelReadableHtml(title, text, heading);
  }

  async _externalAuthNovel(name, target, requestDeadline, heading) {
    const started = Date.now(), deadline = Math.min(started + 115000, requestDeadline || Infinity);
    let stage = "health", jobId = "", lastState = "", attempt = 0;
    const history = [];
    const record = value => {
      const line = Math.floor((Date.now() - started) / 1000) + "초 · " + value;
      if (history.length && history[history.length - 1].split(" · ").slice(1).join(" · ") === value) return;
      history.push(line);
      if (history.length > 18) history.shift();
    };
    const seconds = cap => {
      const remaining = Math.floor((deadline - Date.now()) / 1000);
      if (remaining < 1) throw new Error("전체 인증 요청 대기시간 초과");
      return Math.min(cap, remaining);
    };
    try {
      const endpoint = this._externalAuthEndpoint();
      record("인증서버 연결 확인");
      const health = await this._externalAuthJson(endpoint, "/health", undefined, false, seconds(8));
      if (!health || health.service !== "rabbit-auth-server" || Number(health.protocol) !== 1) {
        throw new Error("호환되는 외부인증 서버(protocol v1)가 아닙니다.");
      }
      if (health.ready !== true) throw new Error("외부인증 서버가 아직 준비되지 않았습니다.");
      record("인증서버 연결 완료");
      for (attempt = 1; attempt <= 3; attempt++) {
        jobId = "";
        lastState = "";
        stage = "create";
        record("시도 " + attempt + "/3 · 작업 요청");
        const opened = await this._externalAuthJson(endpoint, "/v1/jobs", {
          url: target, requestId: this._newRequestId(), kind: "novel"
        }, false, seconds(8));
        const id = this._text(opened && opened.id);
        if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error("외부인증 작업 번호가 잘못됐습니다.");
        jobId = id;
        let retryCode = "";
        try {
          while (Date.now() < deadline) {
            stage = "status";
            const state = await this._externalAuthJson(endpoint, "/v1/jobs/" + id, undefined, false, seconds(8));
            lastState = this._text(state && state.state);
            record("시도 " + attempt + "/3 · 상태 " + (lastState || "unknown"));
            if (lastState === "failed") {
              const rawCode = this._text(state.error || state.errorCode || "server_code_missing");
              const code = /^[a-z0-9_]{1,64}$/i.test(rawCode) ? rawCode : "server_code_invalid";
              record("시도 " + attempt + "/3 · 실패 " + code);
              if (["javascript_timeout", "main_thread_timeout"].includes(code)
                  && attempt < 3 && deadline - Date.now() >= 10000) {
                retryCode = code;
                break;
              }
              const failed = new Error("서버 작업 실패 | code=" + code);
              failed.externalAuthCode = code;
              throw failed;
            }
            if (lastState === "ready") {
              stage = "manifest";
              record("본문 전달받기");
              const manifest = await this._externalAuthJson(endpoint, "/v1/jobs/" + id + "/manifest", {}, false, seconds(15));
              stage = "validate";
              record("현재 회차와 본문 확인");
              if (!manifest || this._text(manifest.id) !== id || this._text(manifest.chapterUrl) !== target) {
                throw new Error("외부인증 결과가 현재 회차와 일치하지 않습니다.");
              }
              const text = this._text(manifest.text).trim();
              if (manifest.kind !== "novel" || text.length < 1) throw new Error("유효한 소설 본문이 반환되지 않았습니다.");
              record("본문 확인 완료");
              return this._novelHtml(this._text(manifest.title).trim() || name, text, heading);
            }
            if (!["queued", "authenticating"].includes(lastState)) throw new Error("알 수 없는 서버 작업 상태입니다.");
            await this._pause(Math.min(Date.now() - started < 5000 ? 250 : 750, Math.max(0, deadline - Date.now())));
          }
          if (!retryCode) throw new Error("전체 인증 요청 대기시간 초과");
        } finally {
          try {
            const closed = await this._externalAuthJson(endpoint, "/v1/jobs/" + id + "/close", {}, true, 2);
            record(closed?.state === "closed" ? "작업 정리 완료" : "작업 정리 응답 확인 불가");
          } catch (_) { record("작업 정리 응답 확인 불가"); }
        }
        stage = "retry";
        record("일시적 시간 초과 · 자동 재시도 " + attempt + "/2");
        await this._pause(attempt * 500);
      }
      throw new Error("자동 재시도 횟수를 초과했습니다.");
    } catch (error) {
      let detail = this._text(error && (error.message || error)).slice(0, 500);
      const key = this._text(this._preference("toki_novel_external_auth_access_key", "")).trim();
      if (key) detail = detail.split(key).join("[접속 키 숨김]");
      const diagnostic = new Error("외부인증 진단 v0.2.25 | 경로=" + target + " | stage=" + stage
        + " | state=" + (lastState || "unknown") + " | job=" + (jobId || "not_created")
        + " | attempt=" + attempt + "/3 | elapsedMs=" + (Date.now() - started)
        + " | " + detail + "\n진행 기록:\n" + history.join("\n")
        + "\n재시도하거나 웹뷰에서 인증 상태를 확인하세요.");
      diagnostic.externalAuthCode = error?.externalAuthCode;
      diagnostic.externalAuthDiagnostic = true;
      throw diagnostic;
    }
  }

  async _localWebViewNovel(name, target, base, timeoutSeconds, heading) {
    const webTimeout = Math.max(1, timeoutSeconds || 45);
    const bridgeScript = `(function () {
      if (window.__mangayomiTokiNovelBridgeInstalled) return;
      window.__mangayomiTokiNovelBridgeInstalled = true;
      var startedAt = Date.now();
      var delivered = false;
      function send(value) {
        if (delivered) return;
        delivered = true;
        window.flutter_inappwebview.callHandler("setResponse", String(value || ""));
      }
      function makeHtml(text) {
        var title = document.querySelector(".ne-h1, h3.theme-novel-title")?.textContent?.trim() || document.title.split(" | ")[0] || "Chapter";
        var known = ${JSON.stringify(heading || {})};
        return (${dcNovelReadableHtml.toString()})(title, text, known);
      }
      function check() {
        var text = String(window.__novelTTSText || "").trim();
        if (text.length > 0 && document.querySelector(".ne-h1")) { send("__TOKI31_OK__" + makeHtml(text)); return; }
        var challenge = document.querySelector("#challenge-form, #cf-challenge-running") || /just a moment|verify you are human|verifying you are human|checking your browser/i.test(String(document.title) + " " + String(document.body?.innerText || ""));
        if (challenge) {
          if (Date.now() - startedAt < ${Math.max(500, webTimeout * 1000 - 3000)}) { window.setTimeout(check, 250); return; }
          send("__TOKI31_ERR__AUTH_REQUIRED"); return;
        }
        var heading = String(document.title || "") + " " + String(document.querySelector("h1")?.textContent || "");
        var status = heading.match(/\\b(403|404|410|502|503|504)\\b/);
        if (status && /gateway|time.?out|unavailable|forbidden|not found|gone/i.test(heading)) { send("__TOKI31_ERR__HTTP_" + status[1]); return; }
        if (/chrome-error:\\/\\/|chromewebdata/i.test(String(location.href)) || /ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|ERR_TIMED_OUT/.test(String(document.body?.innerText || ""))) { send("__TOKI31_ERR__NETWORK"); return; }
        if (Date.now() - startedAt < ${Math.max(500, webTimeout * 1000 - 3000)}) { window.setTimeout(check, 250); return; }
        var pageText = String((document.body && document.body.innerText) || "").replace(/\\s+/g, " ").slice(0, 240);
        send("__TOKI31_ERR__INCOMPLETE|state=" + document.readyState + "|title=" + document.title.slice(0, 100) + "|body=" + pageText);
      }
      window.addEventListener("novel-content-ready", check, { once: false });
      check();
    })();`;
    try {
      const raw = await sendMessage("evaluateJavascriptViaWebview", JSON.stringify([target, this._webViewHeaders(`${base}/novel`), [bridgeScript], webTimeout]));
      if (typeof raw === "string" && raw.startsWith("__TOKI31_OK__")) return raw.slice(13);
      if (typeof raw === "string" && raw.trim().startsWith("<")) throw this._invalidNovelResponse();
      if (typeof raw === "string" && raw.startsWith("__TOKI31_ERR__INCOMPLETE")) {
        const incomplete = this._invalidNovelResponse();
        incomplete.message = raw.slice(0, 600);
        throw incomplete;
      }
      throw new Error(typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 600) : `EMPTY_OR_INVALID_RESULT:${typeof raw}`);
    } catch (error) {
      const detail = this._text(error && (error.message || error));
      if (/String[^\n]{0,80}bool|subtype of type[^\n]{0,80}bool|as bool/i.test(detail)) {
        throw new Error("현재 Mangayomi 버전의 WebView 문자열 반환 오류로 콘텐츠를 받을 수 없습니다. 외부인증 서버를 사용하거나 Mangayomi 업데이트를 확인하세요.");
      }
      if (/timeout|timed out/i.test(detail) && !/__TOKI31_ERR__HTTP_|__TOKI31_ERR__NETWORK/.test(detail)) {
        throw new Error("본문 WebView 응답을 확인하지 못했습니다. 해당 주소에서 인증 상태를 확인한 뒤 다시 시도하세요.");
      }
      throw error;
    }
  }

  async getHtmlContent(name, url) {
    const base = await this._resolveBaseUrl();
    const target = this.siteUrl(base, url);
    const heading = this._readerHeading(name, target);
    if (this._externalAuthEnabled()) {
      const deadline = Date.now() + this.domainRequestBudgetMs;
      const result = await this._withDomainFallback(target, `${base}/novel`,
        async current => await this._externalAuthNovel(name, current, deadline, heading),
        {allowAuthenticatedServer:true, reuseVerifiedDomain:true});
      return result.value;
    }
    const result = await this._withDomainFallback(target, `${base}/novel`,
      async (current, currentReferer, context) => await this._localWebViewNovel(name, current, this._origin(current),
        Math.min(context.candidate ? 20 : 35, context.remainingSeconds), heading), {reuseVerifiedDomain:true});
    return result.value;
  }

  async cleanHtmlContent(html) {
    return html;
  }

  async getPageList() {
    return [];
  }

  async getVideoList() {
    return [];
  }

  _select(type, name, pairs) {
    return { type, name, type_name: "SelectFilter",
      values: pairs.map(([name, value]) => ({ type_name: "SelectOption", name, value })) };
  }

  getFilterList() {
    const header = (type, name) => ({ type, name, type_name: "HeaderFilter" });
    const separator = (type) => ({ type, name: "", type_name: "SeparatorFilter" });
    const popular = this._tabRule(this.popularRulePreference, this._defaultPopularRule());
    const latest = this._tabRule(this.latestRulePreference, this._defaultLatestRule());
    return [
      header("novelFilterHelp", "제목 검색과 아래 조건을 함께 사용할 수 있습니다."),
      this._select("novelStatus", "목록 구분", dcNovelFilterOptions.status),
      this._select("novelGenre", "장르", dcNovelFilterOptions.genre),
      this._select("novelPlatform", "플랫폼", dcNovelFilterOptions.platform),
      separator("novelSortSeparator"),
      this._select("novelSort", "정렬", dcNovelFilterOptions.sort),
      separator("novelSaveSeparator"),
      header("novelSaveHelp", "조건을 고른 뒤 Filter 버튼을 누르면 결과를 보고 Popular/Latest 탭 규칙으로 저장할 수 있습니다."),
      header("novelPopularSummary", "현재 Popular: " + this._ruleSummary(popular)),
      header("novelLatestSummary", "현재 Latest: " + this._ruleSummary(latest)),
      this._select("tabRuleAction", "Popular/Latest 규칙", [
        ["저장하지 않음 (필터 결과만 보기)", "0"],
        ["현재 조건을 Popular 탭에 저장", "1"],
        ["현재 조건을 Latest 탭에 저장", "2"],
        ["Popular 탭을 기본값으로 복원", "3"],
        ["Latest 탭을 기본값으로 복원", "4"],
        ["두 탭 모두 기본값으로 복원", "5"]
      ]),
      header("novelCardHelp", "독서 카드는 Popular/Latest 첫 페이지에만 표시되며 검색·필터 결과에는 나오지 않습니다.")
    ];
  }

  getSourcePreferences() {
    return [
      {
        key: this.domainPreference,
        editTextPreference: {
          title: "토끼 주소 직접 지정 (선택)",
          summary: "빈 값이면 토끼 중앙신호등의 최신 주소를 자동으로 사용합니다.",
          value: "",
          dialogTitle: "토끼 소설 주소",
          dialogMessage: "https://로 시작하는 사이트 주소를 입력하세요. 자동 주소를 쓰려면 비워 두세요."
        }
      },
      {
        key: this.customCardPreference,
        editTextPreference: {
          title: "커스텀 독서 카드 (선택)",
          summary: "개인 JSON 주소로 여러 장의 카드를 설정합니다. 7장 제한은 없으며, 설정하면 공용 이벤트 카드는 표시되지 않습니다.",
          value: "",
          dialogTitle: "커스텀 독서 카드 JSON 주소",
          dialogMessage: "cards 배열 또는 기존 요일별 cards 객체를 지원합니다. Google Drive 공개 공유 링크나 직접 JSON 주소를 넣으세요."
        }
      },
      {
        key: "toki_novel_card_rotation_minutes",
        editTextPreference: {
          title: "공용 카드 교체 주기(분)",
          summary: "빈칸: 배포소 설정 따름 / 0: 새로고침마다 / 60: 1시간마다",
          value: "",
          dialogTitle: "공용 카드 교체 주기",
          dialogMessage: "0 또는 분 단위 숫자를 입력하세요. 빈칸은 배포소 JSON 설정을 사용합니다."
        }
      },
      {
        key: "toki_novel_external_auth_enabled",
        switchPreferenceCompat: {
          title: "외부인증 서버 사용",
          summary: "켜면 Windows/도커 외부인증 서버만 사용합니다. 끄면 이 기기의 숨은 WebView를 사용합니다.",
          value: false
        }
      },
      {
        key: "toki_novel_external_auth_endpoint",
        editTextPreference: {
          title: "외부인증 서버 주소",
          summary: "Windows: localhost 가능 / 모바일: LAN, 역방향 프록시 또는 VPN 주소",
          value: "",
          dialogTitle: "예: http://192.168.0.10:9870",
          dialogMessage: ""
        }
      },
      {
        key: "toki_novel_external_auth_access_key",
        editTextPreference: {
          title: "외부인증 서버 접속 키 (선택)",
          summary: "서버에 키를 설정한 경우만 입력",
          value: "",
          dialogTitle: "접속 키",
          dialogMessage: ""
        }
      }
    ];
  }
}
