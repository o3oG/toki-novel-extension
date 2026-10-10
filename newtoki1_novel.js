const mangayomiSources = [{
  name: "토끼 소설 1",
  lang: "ko",
  baseUrl: "https://newtoki1.org",
  apiUrl: "",
  iconUrl: "https://dc-toki-mangayomi-novel.pages.dev/icon/ko.toki-novel.png",
  typeSource: "single",
  itemType: 2,
  version: "0.2.25",
  dateFormat: "",
  dateFormatLocale: "ko_KR",
  pkgPath: "novel/src/ko/newtoki1_novel.js",
  isNsfw: true,
  hasCloudflare: false,
  appMinVerReq: "0.9.2",
  notes: "newtoki1.org 전용 · 목록 20초 · 작가·장르 구조 보완 · 실제 업로드 날짜 · 문단 한 칸 들여쓰기"
}];

let tokiNovelDomainRequestActive = false;

function dcNovelReadableHtml(title, text) {
  const escape = value => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  // Source line breaks are paragraph boundaries. Do not rewrite sentences or
  // split text at punctuation. Native p spacing/font/page settings still apply.
  const paragraphs = String(text || "").replace(/\r\n?/g, "\n").split(/\n+/)
    .map(line => line.trim()).filter(Boolean).map(line => "<p>&#160;" + escape(line) + "</p>").join("");
  return "<h2>" + escape(title || "Chapter") + "</h2><hr><div class=\"toki-novel-paragraphs\">" + paragraphs + "</div>";
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
    this.fallbackBaseUrl = "https://newtoki1.org";
    this.signalUrl = "https://wankyo83.github.io/tokki-traffic-light/domains.json";
    this.assetBaseUrl = "https://dc-toki-mangayomi-novel.pages.dev";
    this.eventManifestUrl = this.assetBaseUrl + "/assets/official-event-card.json";
    this.cardManifestUrl = this.assetBaseUrl + "/assets/official-random-cards.json";
    this.popularRulePreference = "newtoki1_novel_popular_rule_v1";
    this.latestRulePreference = "newtoki1_novel_latest_rule_v1";
    this.domainPreference = "newtoki1_novel_domain_url_v2";
    this.customCardPreference = "newtoki1_novel_custom_card_json_url_v2";
    this.autoDomainBase = "";
    this.maxDomainAdvances = 20;
    this.domainRequestBudgetMs = 120000;
    this.listRequestBudgetMs = 20000;
    this.domainScanCooldownMs = 60000;
    this.domainCacheMs = 10 * 60 * 1000;
    this.pageSize = 49;
    this.requestSequence = 0;
    this.novelMetadata = new Map();
    this.diagnosticReports = new Map();
    this.fallbackCover = this.assetBaseUrl + "/cover/auto-novel-1.png";
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
    if (previous && previous !== base) this._setPreferenceString("newtoki1_novel_previous_base", previous);
    this._setPreferenceString("newtoki1_novel_pending_auth_base", "");
    this.autoDomainBase = base;
    this._setPreferenceString("newtoki1_novel_auto_domain_base", base);
    this._setPreferenceString("newtoki1_novel_resolved_base", base);
    this._setPreferenceString("newtoki1_novel_resolved_base_time", String(Date.now()));
    this._setPreferenceString("newtoki1_novel_scan_after", "0");
  }

  _authenticationRequired(error, url) {
    const detail = this._text(error && (error.message || error));
    if (!error?.authenticationRequired && !/AUTH_REQUIRED|Failed to bypass Cloudflare|Cloudflare.*(?:challenge|verification)|인증이 필요/i.test(detail)) return null;
    const base = this._numberedTokiOrigin(url)?.origin;
    if (base) this._setPreferenceString("newtoki1_novel_pending_auth_base", base);
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
      candidate: [403, 404, 410, 502, 503, 504].indexOf(status) >= 0 || network || error?.invalidNovelResponse === true
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

  async _webViewText(target, referer, timeoutSeconds) {
    const base = this._origin(target);
    const path = this._text(target).slice(base.length);
    const isApi = /^\/api\//.test(path);
    const landing = isApi ? base + "/novel" : target;
    const seconds = Math.max(1, Math.floor(timeoutSeconds || 35));
    const script = `(function () {
      if (window.__tokiReadInstalled) return;
      window.__tokiReadInstalled = true;
      var started = Date.now(), delivered = false, fetching = false;
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
        if (/chrome-error:|chromewebdata/i.test(String(location.href)) || /ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|ERR_TIMED_OUT/.test(String(document.body?.innerText || ""))) { send("__TOKI_READ_ERR__NETWORK"); return; }
        // Resolve the rendered URL: some WebViews report a missing/opaque origin.
        var href = String(location.href || "");
        var match = href.match(/^https:\\/\\/([^/?#]+)/i);
        var currentOrigin = match ? "https://" + match[1].toLowerCase() : "";
        function canonical(value) { return String(value).toLowerCase().replace("https://www.", "https://"); }
        if (!currentOrigin && /^(?:about:blank|about:srcdoc)?$/.test(href)) {
          if (Date.now() - started < ${Math.max(500, seconds * 1000 - 3000)}) { window.setTimeout(check, 250); return; }
          send("__TOKI_READ_ERR__NOT_LOADED"); return;
        }
        if (canonical(currentOrigin) !== canonical(origin)) {
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
        var heading = String(document.title || "") + " " + String(document.querySelector("h1")?.textContent || "");
        if (!challenge()) {
          var status = heading.match(/\\b(403|404|410|502|503|504)\\b/);
          if (status && /gateway|time.?out|unavailable|forbidden|not found|gone/i.test(heading)) { send("__TOKI_READ_ERR__HTTP_" + status[1]); return; }
          if (/chrome-error:|chromewebdata/i.test(String(location.href)) || /ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|ERR_TIMED_OUT/.test(String(document.body?.innerText || ""))) { send("__TOKI_READ_ERR__NETWORK"); return; }
        }
        if (Date.now() - started >= ${Math.max(500, seconds * 1000 - 3000)}) {
          send(challenge() ? "__TOKI_READ_ERR__AUTH_REQUIRED" : "__TOKI_READ_ERR__INCOMPLETE"); return;
        }
        window.setTimeout(check, 250);
      }
      check();
    })();`;
    const raw = await sendMessage("evaluateJavascriptViaWebview", JSON.stringify([landing, this._webViewHeaders(referer), [script], seconds]));
    if (typeof raw === "string" && raw.startsWith("__TOKI_READ_OK__")) return raw.slice("__TOKI_READ_OK__".length);
    const detail = this._text(raw);
    if (/AUTH_REQUIRED/.test(detail)) {
      const error = new Error("AUTH_REQUIRED"); error.authenticationRequired = true; throw error;
    }
    const status = detail.match(/^__TOKI_READ_ERR__HTTP_(\d{3})$/);
    if (status) { const error = new Error("HTTP " + status[1]); error.statusCode = Number(status[1]); throw error; }
    if (detail === "__TOKI_READ_ERR__NETWORK") throw new Error("__TOKI31_ERR__NETWORK");
    if (detail === "__TOKI_READ_ERR__INCOMPLETE") throw this._invalidNovelResponse();
    const redirected = detail.match(/^__TOKI_READ_ERR__REDIRECT\|expected=[^|]+\|actual=(https:\/\/toki\d+\.com)$/i);
    if (redirected && this._numberedTokiOrigin(redirected[1])) {
      const error = new Error(detail);
      error.redirectBase = redirected[1].toLowerCase();
      throw error;
    }
    // A transport timeout or fetch error is not proof of a changed domain.
    throw new Error("WebView 응답을 가져오지 못했습니다. 앱 WebView에서 해당 주소를 확인한 뒤 다시 시도하세요. " + detail.slice(0, 150));
  }

  async _boundedGet(client, url, headers, seconds) {
    // The Dart client does not honor Rhttp's timeout option. Bound the await
    // here too, so a timed-out list cannot keep the extension's request lock.
    if (typeof setTimeout !== "function" || typeof clearTimeout !== "function") return await client.get(url, headers);
    let timer;
    try {
      return await Promise.race([client.get(url, headers), new Promise((_, reject) => {
        timer = setTimeout(() => reject(this._listContext ? this._listTimeoutError() : new Error("HTTP 응답 대기시간 초과")), Math.max(1, seconds * 1000));
      })]);
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }

  async _rawText(url, referer, timeout) {
    if (this._numberedTokiOrigin(url)) return await this._webViewText(url, referer, timeout);
    const deadline = Date.now() + Math.max(1, timeout || 30) * 1000;
    let response;
    try {
      response = await this._boundedGet(new Client({
        persistentConnection: false, noProxy: true, verifyCertificates: true,
        timeout, connectTimeout: Math.min(8, timeout)
      }), url, this.getHeaders(url, referer), timeout || 30);
    } catch (error) {
      // Try the app's other transport once for Rhttp connection failures.
      // Certificate/authentication failures must retain their original error.
      const reason = this._text(error?.message || error);
      const eligible = /InvalidContentType/.test(reason) ||
        (/RhttpConnectionException/.test(reason) && /(?:Connection error|\bConnect\b)/i.test(reason)
          && !/certificate|certificat|unknownissuer|invalidpeer|handshake|\bSSL\b|\bTLS\b|AUTH_REQUIRED/i.test(reason));
      if (!eligible) throw error;
      this._checkListBudget();
      const remaining = Math.floor((Math.min(deadline, this._listContext?.deadline || deadline) - Date.now()) / 1000);
      if (remaining < 1) throw this._listTimeoutError();
      const report = "v0.2.25 · Rhttp 연결 실패 → Dart HTTP 1회\n경로: " + this._safeReportUrl(url)
        + "\n최초 오류: " + this._safeError(reason);
      this._saveReport("transport", report);
      try {
        response = await this._boundedGet(new Client({
          useDartHttpClient: true, persistentConnection: false, verifyCertificates: true,
          timeout: remaining, connectTimeout: Math.min(8, remaining)
        }), url, this.getHeaders(url, referer), remaining);
        this._saveReport("transport", report + "\n전송 결과: HTTP " + response.statusCode);
      } catch (fallbackError) {
        this._saveReport("transport", report + "\n대체 전송 실패: " + this._safeError(fallbackError));
        throw fallbackError;
      }
      this._checkListBudget();
    }
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

  async _verifyCandidate(base, deadline) {
    const seconds = Math.min(20, Math.floor((deadline - Date.now()) / 1000));
    if (seconds < 1) throw new Error("DOMAIN_SCAN_BUDGET_EXCEEDED");
    const body = await this._rawText(base + "/novel", base + "/novel", seconds);
    this._validateNovelResponse(base + "/novel", body);
  }

  async _followDomainRedirect(error, url, referer, operation, deadline) {
    const initial = this._origin(url);
    const path = this._text(url).slice(initial.length);
    const refererPath = this._numberedTokiOrigin(referer)
      ? this._text(referer).slice(this._origin(referer).length) : "/novel";
    const visited = [initial];
    let currentError = error;
    for (let count = 0; count < 3; count++) {
      const base = currentError.redirectBase;
      if (!this._numberedTokiOrigin(base) || !this._isHttpsOrigin(base) || visited.indexOf(base) >= 0) {
        throw new Error("소설 주소 이동이 반복되거나 유효하지 않습니다. 기존 주소를 유지합니다.");
      }
      visited.push(base);
      const target = base + path;
      const seconds = Math.floor((deadline - Date.now()) / 1000);
      if (seconds < 1) throw new Error("DOMAIN_SCAN_BUDGET_EXCEEDED");
      try {
        // Re-open the requested path at the site's explicit HTTPS destination.
        const value = await operation(target, base + refererPath,
          { candidate: true, remainingSeconds: seconds });
        await this._verifyCandidate(base, deadline);
        this._rememberDomain(base, initial);
        return { value, url: target };
      } catch (nextError) {
        const authentication = this._authenticationRequired(nextError, target);
        if (authentication) throw authentication;
        if (!nextError?.redirectBase) throw nextError;
        currentError = nextError;
      }
    }
    throw new Error("소설 주소 이동 횟수를 초과했습니다. 기존 주소를 유지합니다.");
  }

  async _withDomainFallback(url, referer, operation) {
    if (tokiNovelDomainRequestActive) throw new Error("소설 요청이 진행 중입니다. 인증 또는 현재 요청이 끝난 뒤 다시 시도하세요.");
    tokiNovelDomainRequestActive = true;
    try { return await this._runDomainFallback(url, referer, operation); }
    finally { tokiNovelDomainRequestActive = false; }
  }

  async _runDomainFallback(url, referer, operation) {
    const requested = this._numberedTokiOrigin(url);
    const pending = this._preferenceString("newtoki1_novel_pending_auth_base", "");
    const resumeAuth = requested && this._numberedTokiOrigin(pending) && this._isHttpsOrigin(pending);
    if (resumeAuth) {
      url = pending + this._text(url).slice(requested.origin.length);
      if (this._numberedTokiOrigin(referer)) referer = pending + this._text(referer).slice(this._origin(referer).length);
    }
    const original = this._numberedTokiOrigin(url);
    const deadline = Math.min(Date.now() + this.domainRequestBudgetMs, this._listContext?.deadline || Infinity);
    const remaining = () => Math.floor((deadline - Date.now()) / 1000);
    let lastError;
    // Non-Toki requests (manifests, signal, external hosts) are never scanned.
    if (!original) return { value: await operation(url, referer, { candidate: false, remainingSeconds: remaining() }), url };
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const value = await operation(url, referer, { candidate: false, remainingSeconds: remaining() });
        if (resumeAuth) {
          await this._verifyCandidate(original.origin, deadline);
          this._rememberDomain(original.origin, requested.origin);
        }
        return { value, url };
      } catch (error) {
        if (error?.redirectBase) return await this._followDomainRedirect(error, url, referer, operation, deadline);
        const authentication = this._authenticationRequired(error, url);
        if (authentication) throw authentication;
        const afterAuthFailure = resumeAuth && (error?.invalidNovelResponse === true || [403, 404, 410].indexOf(Number(error?.statusCode)) >= 0);
        if (!this._domainFailure(error).retry && !afterAuthFailure) throw error;
        lastError = error;
        if (attempt === 0 && remaining() > 1) await this._pause(750);
      }
    }
    const fail = () => {
      this._setPreferenceString("newtoki1_novel_scan_after", String(Date.now() + this.domainScanCooldownMs));
      return new Error("서버 장애 또는 주소 변경을 확인하지 못했습니다. 기존 주소를 유지합니다: " + original.origin + " / " + this._text(lastError && (lastError.message || lastError)));
    };
    if (Date.now() < Number(this._preferenceString("newtoki1_novel_scan_after", "0"))) {
      throw new Error("서버 접속 실패. 기존 주소를 유지하며, 도메인 재탐색은 잠시 후 가능합니다. / " + this._text(lastError && lastError.message));
    }
    if (resumeAuth) this._setPreferenceString("newtoki1_novel_pending_auth_base", "");
    const candidates = [];
    const previous = this._trimSlash(this._preferenceString("newtoki1_novel_previous_base", ""));
    if (this._numberedTokiOrigin(previous) && this._isHttpsOrigin(previous) && previous !== original.origin) candidates.push(previous);
    for (let index = 1; index <= this.maxDomainAdvances; index++) {
      const base = "https://toki" + (original.number + index) + ".com";
      if (candidates.indexOf(base) < 0) candidates.push(base);
    }
    for (const base of candidates) {
      if (remaining() < 1) break;
      const target = base + this._text(url).slice(original.origin.length);
      const currentReferer = referer && this._numberedTokiOrigin(referer)
        ? base + this._text(referer).slice(this._origin(referer).length) : referer;
      try {
        await this._verifyCandidate(base, deadline);
        if (remaining() < 1) break;
        const value = await operation(target, currentReferer, { candidate: true, remainingSeconds: remaining() });
        // Both the site structure and the actual requested result must succeed.
        this._rememberDomain(base, original.origin);
        return { value, url: target };
      } catch (error) {
        if (error?.redirectBase) return await this._followDomainRedirect(error, target, currentReferer, operation, deadline);
        const authentication = this._authenticationRequired(error, target);
        if (authentication) throw authentication;
        lastError = error;
        if (!this._domainFailure(error).candidate && error.message !== "DOMAIN_SCAN_BUDGET_EXCEEDED") throw error;
      }
    }
    throw fail();
  }

  async _requestResult(url, referer, timeout) {
    this._checkListBudget();
    timeout = Math.min(timeout || 30, this._listContext ? Math.floor((this._listContext.deadline - Date.now()) / 1000) : Infinity);
    const result = await this._withDomainFallback(url, referer, async (target, currentReferer, context) => {
      const seconds = Math.min(timeout || 30, this._numberedTokiOrigin(target) ? (context.candidate ? 20 : 35) : (timeout || 30), context.remainingSeconds);
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
    // This independent source never consumes the toki.com domain signal.
    const manual = this._trimSlash(this._preferenceString(this.domainPreference, ""));
    return this._isHttpsOrigin(manual) ? manual : this.fallbackBaseUrl;
  }

  absoluteUrl(base, url) {
    const value = this._text(url).trim();
    if (!value) return this._trimSlash(base || this.fallbackBaseUrl);
    if (/^https?:\/\//i.test(value)) return value;
    return `${this._trimSlash(base || this.fallbackBaseUrl)}${value.startsWith("/") ? "" : "/"}${value}`;
  }

  siteUrl(base, url) {
    const value = this._text(url).trim();
    if (!value) return this._trimSlash(base);
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
    const list = [];
    const seen = new Set();

    for (const element of doc.select("a.novel-card")) {
      const link = this.siteUrl(base, element.getHref || element.attr("href"));
      if (!link || seen.has(link)) continue;
      const name = this.firstText(element, ".nv-title");
      if (!name) continue;
      seen.add(link);
      list.push({
        name,
        link,
        imageUrl: this.firstImage(element, ".nv-thumb img", name)
      });
    }

    for (const element of doc.select(".search-results-grid > a.card")) {
      const rawLink = element.getHref || element.attr("href");
      if (!/^\/?novel\/\d+/.test(rawLink || "")) continue;
      const link = this.siteUrl(base, rawLink);
      if (seen.has(link)) continue;
      const name = this.firstText(element, ".subject");
      if (!name) continue;
      seen.add(link);
      list.push({
        name,
        link,
        imageUrl: this.firstImage(element, ".thumb img", name)
      });
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
        const name = this._cleanNovelLabel(this.firstText(element, group[1]));
        if (!name) continue;
        seen.add(link);
        list.push({
          name,
          link,
          imageUrl: this.firstImage(element, ".rank-v2-cover img", name)
        });
      }
    }
    return list.slice(0, 50);
  }

  novelFromApi(base, item) {
    const id = this._text(item?.id);
    const name = this._cleanNovelLabel(item?.title || ("\uC18C\uC124 " + id));
    return {
      name,
      link: `${this._trimSlash(base)}/novel/${encodeURIComponent(id)}`,
      imageUrl: item?.thumbnailUrl ? this.absoluteUrl(base, this._text(item.thumbnailUrl).replace(/^\/\//, "https://")) : this.generatedCover(id || name)
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
    let result;
    try { result = await this._requestResult(apiUrl, `${base}/novel`, 30); }
    catch (error) {
      const detail = this._text(error?.message || error);
      const cause = /InvalidContentType/.test(detail) ? "InvalidContentType" : error?.authenticationRequired ? "AUTH_REQUIRED" : error?.statusCode ? "HTTP " + error.statusCode : error?.listDeadline ? "20초 초과" : "연결 오류";
      this._saveReport("api", "v0.2.25 · 목록/검색 API 요청 실패\n경로: /api/novel-list\n원인: " + cause);
      throw error;
    }
    base = this._origin(result.url);
    const body = result.value;
    let data;
    try { data = JSON.parse(body); }
    catch (_) {
      this._saveReport("api", "v0.2.25 · /api/novel-list JSON 파싱 실패 · 응답길이=" + this._text(body).length);
      throw new Error("토끼 소설 1 v0.2.25 · 목록 API가 JSON을 반환하지 않았습니다. 웹뷰에서 인증·사이트 상태를 확인하세요.");
    }
    if (!Array.isArray(data?.novels)) {
      this._saveReport("api", "v0.2.25 · /api/novel-list novels 배열 없음 · 응답 키=" + Object.keys(data || {}).slice(0, 15).join(","));
      throw new Error("토끼 소설 1 구조 진단 v0.2.25 | 단계=목록 API | 경로=/api/novel-list | novels 배열 없음 | 응답 키=" + Object.keys(data || {}).slice(0, 15).join(","));
    }
    const novels = data.novels;
    this._saveReport("api", "v0.2.25 · 목록/검색 API 정상 · 반환 작품 수=" + novels.length);
    const list = novels.map((item) => this.novelFromApi(base, item));
    await this._hydrateCovers(list, base);
    this._rememberNovels(list);
    return {
      list,
      hasNextPage: novels.length >= this.pageSize
    };
  }

  _driveDirect(url, image) {
    const value = this._text(url).trim();
    const match = value.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
    return match ? "https://drive.google.com/uc?export=" + (image ? "view" : "download") + "&id=" + match[1] : value;
  }

  _customCardSource() {
    return this._migratedPreferenceString(this.customCardPreference, "newtoki1_novel_custom_card_json_url").trim();
  }

  async _customCards(source) {
    if (!source) return [];
    const cacheKey = "newtoki1_novel_custom_card_cache";
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
      return { name: this.cleanText(data.name || data.title || "\uD2B9\uBCC4 \uC774\uBCA4\uD2B8"), imageUrl };
    } catch (_) {
      return null;
    }
  }

  _nextCardIndex(total, scope, holdMinutes, revision) {
    const count = Math.max(1, Number(total) || 1);
    const suffix = this._text(scope || "default").replace(/[^a-z0-9_-]/gi, "_");
    const key = "newtoki1_novel_last_card_index_" + suffix;
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
    const override = this._preferenceString("newtoki1_novel_card_rotation_minutes", "").trim();
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
        return { name: "\uC624\uB298\uC758 \uB3C5\uC11C", link: `/__newtoki1_novel_card__/custom-${index}`, imageUrl: cards[index - 1] };
      }
    }
    const event = await this._activeEventCard();
    if (event) return { name: event.name, link: "/__newtoki1_novel_card__/event", imageUrl: event.imageUrl };
    const official = await this._officialCardSet(tab);
    const index = this._nextCardIndex(official.cards.length, "official-" + String(tab || "all"), official.holdMinutes, official.revision);
    const card = official.cards[index - 1];
    return {
      name: card.name,
      link: `/__newtoki1_novel_card__/official-${index}`,
      imageUrl: card.imageUrl
    };
  }

  async _prependCard(result, page, tab) {
    if (Number(page) !== 1) return result;
    return { list: [await this._tabCard(tab)].concat(result.list || []), hasNextPage: result.hasNextPage === true };
  }

  _defaultPopularRule() {
    return { mode: "rank", status: "ongoing", genre: "", platform: "", sort: "hot" };
  }

  _defaultLatestRule() {
    return { mode: "filter", status: "ongoing", genre: "", platform: "", sort: "new" };
  }

  _allowedRuleValue(value, allowed, fallback) {
    const text = this._text(value);
    return allowed.includes(text) ? text : fallback;
  }

  _normalizeRule(rule, fallback) {
    const source = rule || fallback || this._defaultLatestRule();
    return {
      mode: source.mode === "rank" ? "rank" : "filter",
      status: this._allowedRuleValue(source.status, ["ongoing", "completed"], "ongoing"),
      genre: this._allowedRuleValue(source.genre, ["", "fantasy", "wuxia", "adult19", "modern", "romance", "romance_fantasy", "bl", "light_novel", "etc"], ""),
      platform: this._allowedRuleValue(source.platform, ["", "user", "novelpia", "booktoki", "munpia", "joara", "kakaopage", "series", "ridi", "etc"], ""),
      sort: this._allowedRuleValue(source.sort, ["new", "fresh", "hot", "views", "rating", "episodes"], "new")
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
    if (value.mode === "rank") return "6\uC2DC\uAC04 \uC18C\uC124 TOP 50";
    return [
      this._ruleName(value.status, [["\uC18C\uC124 (\uC5F0\uC7AC\uC911)", "ongoing"], ["\uC644\uACB0 \uC18C\uC124", "completed"]], "\uC18C\uC124 (\uC5F0\uC7AC\uC911)"),
      this._ruleName(value.genre, [["\uC804\uCCB4", ""], ["\uD310\uD0C0\uC9C0", "fantasy"], ["\uBB34\uD611", "wuxia"], ["19\uAE08", "adult19"], ["\uD604\uB300", "modern"], ["\uB85C\uB9E8\uC2A4", "romance"], ["\uB85C\uB9E8\uC2A4 \uD310\uD0C0\uC9C0", "romance_fantasy"], ["BL", "bl"], ["\uB77C\uB178\uBCA8", "light_novel"], ["\uAE30\uD0C0", "etc"]], "\uC804\uCCB4"),
      this._ruleName(value.platform, [["\uC804\uCCB4", ""], ["\uC9C1\uC811 \uC5C5\uB85C\uB4DC", "user"], ["\uB178\uBCA8\uD53C\uC544", "novelpia"], ["\uBD81\uD1A0\uB07C", "booktoki"], ["\uBB38\uD53C\uC544", "munpia"], ["\uC870\uC544\uB77C", "joara"], ["\uCE74\uCE74\uC624\uD398\uC774\uC9C0", "kakaopage"], ["\uB124\uC774\uBC84 \uC2DC\uB9AC\uC988", "series"], ["\uB9AC\uB514\uBD81\uC2A4", "ridi"], ["\uAE30\uD0C0", "etc"]], "\uC804\uCCB4"),
      this._ruleName(value.sort, [["\uCD5C\uC2E0\uC21C", "new"], ["\uC2E0\uC791\uC21C", "fresh"], ["\uBD81\uB9C8\uD06C\uC21C", "hot"], ["\uC870\uD68C\uC21C", "views"], ["\uD3C9\uC810\uC21C", "rating"], ["\uD654\uC218\uC21C", "episodes"]], "\uCD5C\uC2E0\uC21C")
    ].join(" + ");
  }

  async _rankList(page) {
    if (Number(page) > 1) return { list: [], hasNextPage: false };
    const base = await this._resolveBaseUrl();
    const target = `${base}/rank?kind=novel`;
    const result = await this._requestResult(target, `${base}/rank`, 30);
    const doc = new Document(result.value), origin = this._origin(result.url);
    this._captureStructure("rank", result.url, result.value, doc);
    let list = this.listFromRankDocument(doc, origin);
    if (!list.length) list = this._listFromNovelLinks(doc, origin).slice(0, 50);
    if (!list.length) throw this._siteStructureError("인기 목록", result.url, result.value);
    await this._hydrateCovers(list, origin);
    this._rememberNovels(list);
    return { list, hasNextPage: false };
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
        timer = setTimeout(() => {
          context.closed = true;
          reject(scoped._listTimeoutError());
        }, this.listRequestBudgetMs);
      })]);
    } finally {
      context.closed = true;
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  async _listWithOptionalCard(result, page, tab) {
    if (Number(page) !== 1) return result;
    result = { ...result, list: [this._diagnosticCard()].concat(result.list || []) };
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
    if (this.cleanText(query) === "::진단") return { list: Number(page) === 1 ? [this._diagnosticCard()] : [], hasNextPage: false };
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
      if (action === 1) preferences.setString(this.popularRulePreference, this._encodeRule(rule));
      else if (action === 2) preferences.setString(this.latestRulePreference, this._encodeRule(rule));
      else if (action === 3) preferences.setString(this.popularRulePreference, "");
      else if (action === 4) preferences.setString(this.latestRulePreference, "");
      else if (action === 5) {
        preferences.setString(this.popularRulePreference, "");
        preferences.setString(this.latestRulePreference, "");
      }
    }
    return this.loadApiList(page, rule, this.cleanText(query));
  }

  parseDate(value) {
    const match = String(value || "").match(/(?:^|\D)(\d{2}|\d{4})[.\/-]\s*(\d{1,2})[.\/-]\s*(\d{1,2})(?!\d)/);
    if (!match) return null;
    let year = Number(match[1]);
    if (year < 100) year += 2000;
    const month = Number(match[2]), day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    // The source's calendar dates are Korean dates, independent of runtime TZ.
    return String(date.valueOf() - 9 * 60 * 60 * 1000);
  }

  _novelLinkPath(base, raw) {
    const href = this._text(raw).trim();
    if (!href || /^(?:javascript:|data:|mailto:|#)/i.test(href)) return "";
    const absolute = this.absoluteUrl(base, href);
    if (this._origin(absolute).toLowerCase() !== this._origin(base).toLowerCase()) return "";
    return absolute.slice(this._origin(absolute).length).split(/[?#]/)[0];
  }

  _cleanNovelLabel(value) {
    let text = this.cleanText(value);
    // Only remove the observed leading count/time/rank cluster. A title's
    // own numbers (e.g. 1998 or 1레벨) are otherwise preserved.
    const count = /^\+\d+(?:\.\d+)?(?:만|억)?(?=\s|$)\s*/.exec(text);
    if (count) {
      text = text.slice(count[0].length);
      const time = /^(?:방금\s*전|\d+\s*(?:초|분|시간|일)\s*전)\s*/.exec(text);
      if (time) {
        text = text.slice(time[0].length);
        const rank = /^(\d+)\s+(?=\S)/.exec(text);
        if (rank && Number(rank[1]) >= 1 && Number(rank[1]) <= 50) text = text.slice(rank[0].length);
      }
    }
    return this.cleanText(text);
  }

  _imageFromNode(node, base) {
    if (!node) return "";
    const candidates = [node.attr("data-src"), node.attr("data-original"), node.attr("data-lazy-src"),
      this._text(node.attr("data-srcset") || node.attr("srcset")).split(",")[0].trim().split(/\s+/)[0], node.attr("src"), node.getSrc];
    for (let raw of candidates) {
      raw = this._text(raw).trim();
      if (!raw || /^(?:data|blob|javascript):/i.test(raw)) continue;
      if (/^\/\//.test(raw)) raw = "https:" + raw;
      const absolute = this.absoluteUrl(base, raw);
      if (/^https?:\/\//i.test(absolute) && !/\/cover\/auto-novel-\d+\.png/.test(absolute)) return absolute;
    }
    return "";
  }

  _realCover(url) {
    return /^https?:\/\//i.test(this._text(url)) && !/\/cover\/auto-novel-\d+\.png/.test(url);
  }

  _detailCover(doc, base) {
    for (const selector of [".nd-thumb img", ".view-title .view-content img", ".view-title img.theme-thumb-img"]) {
      const cover = this._imageFromNode(doc.selectFirst(selector), base);
      if (cover) return cover;
    }
    // A site's generic og:image is not the book's cover.
    if (this.firstText(doc, "article h2, .view-title h2") || doc.selectFirst(".novel-detail")) {
      const raw = doc.selectFirst('meta[property="og:image"]')?.attr("content");
      const cover = raw ? this.absoluteUrl(base, raw) : "";
      if (this._realCover(cover)) return cover;
    }
    return "";
  }

  async _hydrateCovers(list, base) {
    const deadline = Math.min(Date.now() + 12000, this._listContext?.deadline || Infinity);
    for (const item of list) {
      item.name = this._cleanNovelLabel(item.name);
      if (this._realCover(item.imageUrl)) continue;
      const cached = this._rememberedNovel(item.link);
      if (this._realCover(cached.imageUrl)) { item.imageUrl = cached.imageUrl; continue; }
      const seconds = Math.floor((deadline - Date.now() - 250) / 1000);
      if (seconds < 1) continue;
      try {
        const result = await this._requestResult(item.link, base + "/novel", Math.min(3, seconds));
        if (this._novelLinkPath(base, result.url) !== this._novelLinkPath(base, item.link)) continue;
        const cover = this._detailCover(new Document(result.value), base);
        if (cover) item.imageUrl = cover;
      } catch (error) {
        if (error?.authenticationRequired || error?.listDeadline) break;
      }
    }
    this._saveReport("covers", "v0.2.25 · 표지 확인 · 실제 표지=" + list.filter(item => this._realCover(item.imageUrl)).length
      + "/" + list.length + "\n표지 미확인 작품:\n" + list.filter(item => !this._realCover(item.imageUrl))
        .map(item => item.name + " · " + this._safeReportUrl(item.link)).join("\n"));
    return list;
  }

  _rememberNovels(list) {
    // Write each record once without first reading an absent preference.
    // The app creates defaults and queues its writes asynchronously.
    for (const item of list) {
      if (!item.name || !/^https:\/\/[^/]+\/novel\/\d+$/.test(item.link)) continue;
      const old = this.novelMetadata.get(item.link) || {};
      const imageUrl = !item.imageUrl || /\/cover\/auto-novel-\d+\.png/.test(item.imageUrl) ? (old.imageUrl || "") : item.imageUrl;
      item.name = this._cleanNovelLabel(item.name);
      const record = {name: item.name, link: item.link, imageUrl};
      this.novelMetadata.set(item.link, record);
      this._setPreferenceString("newtoki1_novel_metadata_v21_" + encodeURIComponent(item.link), JSON.stringify(record));
    }
    while (this.novelMetadata.size > 200) this.novelMetadata.delete(this.novelMetadata.keys().next().value);
  }

  _rememberedNovel(target) {
    try {
      const key = target.split(/[?#]/)[0].replace(/\/$/, "");
      const record = this.novelMetadata.get(key) || JSON.parse(this._preferenceString("newtoki1_novel_metadata_v21_" + encodeURIComponent(key), "{}"));
      return {...record, name: this._cleanNovelLabel(record.name)};
    } catch (_) { return {}; }
  }

  _listFromNovelLinks(doc, base) {
    const byPath = new Map();
    for (const anchor of doc.select("a[href]")) {
      const path = this._novelLinkPath(base, anchor.getHref || anchor.attr("href"));
      if (!/^\/novel\/\d+\/?$/.test(path)) continue;
      const key = path.replace(/\/$/, "");
      const explicitLabel = anchor.attr("title") || this.firstText(anchor, ".nv-title, .subject, h2, h3, h4") || anchor.attr("aria-label");
      const textLabel = this._titleWithoutRankMetadata(anchor);
      const label = this._cleanNovelLabel(explicitLabel || textLabel || anchor.selectFirst("img")?.attr("alt"));
      const quality = explicitLabel ? 3 : textLabel ? 2 : 1;
      if (label.length > 180) continue;
      const img = anchor.selectFirst("img");
      const imageUrl = this._imageFromNode(img, base);
      const previous = byPath.get(key);
      if (!previous) byPath.set(key, { name: label, link: base + key, imageUrl, quality });
      else {
        if (label && (!previous.name || quality > previous.quality || (quality === previous.quality && previous.name.length > label.length))) { previous.name = label; previous.quality = quality; }
        if (!previous.imageUrl && imageUrl) previous.imageUrl = imageUrl;
      }
    }
    const list = Array.from(byPath.values()).filter(item => item.name && item.quality > 1).map(item => ({ name: item.name, link: item.link, imageUrl: item.imageUrl || this.generatedCover(item.link) }));
    return list;
  }

  _titleWithoutRankMetadata(anchor) {
    let label = this.cleanText(anchor.text);
    for (const child of Array.from(anchor.children || [])) {
      if (!/(?:^|\s)(?:pull-right|rank-icon)(?:\s|$)/.test(this._text(child.attr("class")))) continue;
      const value = this.cleanText(child.text);
      if (!value) continue;
      if (label.startsWith(value)) label = label.slice(value.length).trim();
      else if (label.endsWith(value)) label = label.slice(0, -value.length).trim();
    }
    return label;
  }

  _episodeNumber(label, element, allowTrailing = true) {
    const attrs = ["data-ep", "data-episode-number", "data-chapter-number"];
    for (const attr of attrs) {
      const raw = this._text(element?.attr(attr)).trim();
      if (/^\d+(?:\.\d+)?$/.test(raw)) return raw;
    }
    const child = element?.selectFirst("[data-ep], [data-episode-number], [data-chapter-number]");
    for (const attr of attrs) {
      const raw = this._text(child?.attr(attr)).trim();
      if (/^\d+(?:\.\d+)?$/.test(raw)) return raw;
    }
    const text = this.cleanText(label);
    const explicit = text.match(/\b(?:episode|ep\.?|ch\.?)\s*(\d+(?:\.\d+)?)(?:\s|$|[·:.-])/i)
      || text.match(/(?:^|\s)(?:제\s*)?(\d+(?:\.\d+)?)\s*(?:화|회)(?:\s|$)/);
    if (explicit) return explicit[1];
    const leading = text.match(/^(\d+)\.\s+(?!\d)/);
    if (leading) return leading[1];
    // A separate trailing number is used by the observed episode links.
    const trailing = text.match(/\s+(\d+)$/);
    return allowTrailing && trailing ? trailing[1] : "";
  }

  _chapterName(label, number) {
    if (number) {
      const clean = this.cleanText(label).replace(/^\[목차 순번\]\s*/, "");
      const remainder = clean.replace(new RegExp("^(?:제\\s*)?" + String(number).replace(/\./g, "\\.") + "(?:\\s*(?:화|회)(?=\\s|$)|\\.\\s+|\\s*[·:]\\s*)\\s*"), "");
      return number + "화" + (remainder ? " · " + remainder : "");
    }
    // The native recognizer treats the year in a title as an episode number.
    // Preserve its appearance with full-width digits when the number is unknown.
    return "[회차 번호 확인 필요] " + label.replace(/[0-9]/g, digit => String.fromCharCode(digit.charCodeAt(0) + 0xfee0));
  }

  _chaptersFromNovelLinks(doc, base, novelId) {
    const chapters = [], seen = new Set();
    if (!/^\d+$/.test(novelId)) return chapters;
    for (const anchor of doc.select("a[href]")) {
      const path = this._novelLinkPath(base, anchor.getHref || anchor.attr("href"));
      const match = path.match(/^\/novel\/(\d+)\/(\d+)\/?$/);
      if (!match || match[1] !== novelId || seen.has(match[2])) continue;
      const label = this.cleanText(anchor.attr("title") || anchor.text);
      if (!label) continue;
      seen.add(match[2]);
      const number = this._episodeNumber(label, anchor, false);
      chapters.push({ name: this._chapterName(label, number), url: base + path, dateUpload: null, scanlator: null });
    }
    return chapters;
  }

  _episodePager(doc, base, novelId, currentUrl) {
    const path = "/novel/" + novelId, pages = new Map(), unresolved = [];
    let pagerNodes = doc.select(".theme-episode-pager");
    if (!pagerNodes.length) pagerNodes = doc.select(".pg_wrap").filter(node => node.select("a[href]").some(anchor => {
      const href = this._text(anchor.attr("href"));
      return /[?&](?:epage|ep_page|episode_page)=\d+/.test(href) &&
        (href.startsWith("?") || this._novelLinkPath(base, href) === path);
    }));
    const requested = this._pageNumber(currentUrl) || 1;
    const currentText = this.cleanText(pagerNodes[0]?.selectFirst(".pg_current")?.text);
    const current = /^\d+$/.test(currentText) ? Number(currentText) : requested;
    const anchors = pagerNodes.flatMap(pager => pager.select("a[href]"));
    const entries = [];
    let template = null;
    for (const anchor of anchors) {
      const raw = this._text(anchor.attr("href") || anchor.getHref).replace(/&amp;/g, "&").trim();
      if (!raw || /^(?:#|javascript:|data:)/i.test(raw)) continue;
      let url = raw.startsWith("?") ? base + path + raw : raw.startsWith("//") ? "https:" + raw
        : /^https?:\/\//i.test(raw) || raw.startsWith("/") ? this.absoluteUrl(base, raw) : base + "/novel/" + raw;
      url = url.split("#")[0];
      if (this._origin(url) !== base || this._novelLinkPath(base, url).replace(/\/$/, "") !== path) continue;
      const label = this.cleanText(anchor.text), cls = this._text(anchor.attr("class"));
      const numbered = Number((label.match(/^(\d+)(?:\s*페이지)?$/) || [])[1]);
      const attrPage = Number(anchor.attr("data-page") || anchor.attr("data-ep-page") || 0);
      let number = this._pageNumber(url) || attrPage || numbered;
      const query = url.split("?")[1] || "";
      if (numbered && query) {
        for (const match of query.matchAll(/(?:^|&)([a-zA-Z][a-zA-Z0-9_]*)=(\d+)(?=&|$)/g)) {
          if (Number(match[2]) === numbered) {template = {url, key: match[1]}; number = numbered; break;}
        }
      }
      entries.push({url, number, numbered, query, label, forward: /pg_next/.test(cls) || /다음/.test(label), last: /pg_end|pg_last/.test(cls) || /맨끝|마지막/.test(label)});
    }
    const text = pagerNodes.map(node => this._text(node.text)).join(" ");
    // DOM text concatenates adjacent spans (current 1 + link 2 -> "12페이지").
    // Read labels per anchor instead of inventing page 12 from joined text.
    const labels = anchors.length ? entries.map(entry => entry.numbered).filter(Number.isSafeInteger)
      : Array.from(text.matchAll(/(?:^|\D)(\d+)\s*페이지/g)).map(match => Number(match[1]));
    const groupEnd = Math.max(current, ...labels, ...entries.filter(item => !item.last && !item.forward).map(item => item.number || 0));
    for (const entry of entries) {
      let {number, url} = entry;
      // Use the page parameter observed on numbered links, including controls
      // whose href omits it. Never execute onclick or assume an API endpoint.
      if (!number && entry.forward && template) number = groupEnd + 1;
      if (number && !entry.query && template) {
        url = template.url.replace(new RegExp("([?&]" + template.key + "=)\\d+(?=&|$)"), "$1" + number);
      }
      if (Number.isSafeInteger(number) && number >= 1 && number <= 150 && url.includes("?")) pages.set(number, url);
      else if (entry.forward || entry.last) unresolved.push(entry.label || "다음/맨끝");
    }
    return {pages, current, requested, expected: Math.max(current, ...pages.keys(), ...labels), present: pagerNodes.length > 0, unresolved};
  }

  _pageNumber(url) {
    const query = this._text(url).split("?")[1]?.split("#")[0] || "";
    const match = query.match(/(?:^|&)(?:page|ep_page|episode_page|epage|p|pg|page_no|pageNo)=(\d+)(?:&|$)/i);
    return match ? Number(match[1]) : 0;
  }

  _serialChapters(doc, base, novelId) {
    // Some older books use plain links inside the serial list. Do not use
    // global chapter links: latest widgets and prev/next controls are partial.
    const chapters = [], seen = new Set();
    const roots = doc.select(".serial-list, #serial-move");
    const anchors = roots.length ? roots.flatMap(root => root.select("a[href]")) : doc.select("a.item-subject[href]");
    const rowNumbers = new Map(), rowDates = new Map();
    for (const root of roots) {
      let rows = root.select("li, tr, .list-item, .serial-row, .list-row");
      if (!rows.length) rows = Array.from(root.children || []);
      for (const row of rows) {
        const links = row.select("a[href]").map(anchor => this._novelLinkPath(base, anchor.attr("href") || anchor.getHref))
          .filter(path => new RegExp("^/novel/" + novelId + "/\\d+/?$").test(path));
        if (new Set(links).size !== 1) continue;
        const numberNode = row.selectFirst(".item-num, .wr-num, .list-num, .episode-num, .ne-num, td:first-child");
        const raw = this.cleanText(numberNode?.text || Array.from(row.children || [])[0]?.text);
        const number = this._episodeNumber("", row, false) || (raw.match(/^(?:제\s*)?(\d+)(?:\s*(?:화|회))?$/) || [])[1];
        if (number) rowNumbers.set(links[0].replace(/\/$/, ""), number);
        const date = this.parseDate(this.firstText(row, ".wr-date"))
          || this.parseDate(this.firstText(row, ".item-details"));
        if (date) rowDates.set(links[0].replace(/\/$/, ""), date);
      }
    }
    for (const anchor of anchors) {
      const path = this._novelLinkPath(base, anchor.getHref || anchor.attr("href"));
      const match = path.match(/^\/novel\/(\d+)\/(\d+)\/?$/);
      if (!match || match[1] !== novelId || seen.has(match[2])) continue;
      if (/\b(?:btn|pg_page|pg_next|pg_end)\b/.test(this._text(anchor.attr("class")))) continue;
      const label = this.cleanText(this.firstText(anchor, ".wr-subject, .item-subject, .subject, .ne-title") || anchor.attr("title") || anchor.text);
      if (!label) continue;
      seen.add(match[2]);
      // The site's '(2)' in a title is a sub-part, not a whole-book number.
      chapters.push({label, number: rowNumbers.get(path.replace(/\/$/, "")) || this._episodeNumber(label, anchor, false), url: base + path,
        dateUpload: rowDates.get(path.replace(/\/$/, "")) || null, scanlator: null});
    }
    return chapters;
  }

  _detailMetadata(doc, root) {
    const values = {};
    const labels = ["작가", "저자", "장르", "발행구분", "연재상태"];
    for (const row of doc.select(".view-title tr, .novel-detail tr")) {
      const cells = row.select("th, td");
      const label = this.cleanText(cells[0]?.text).replace(/[\s:：]/g, "");
      if (!labels.includes(label)) continue;
      const value = cells.slice(1).map(cell => this.cleanText(cell.text)).filter(Boolean).join(" ");
      if (value) values[label] = value;
    }
    // The legacy theme also uses div/dl fields rather than table rows.
    // The native bridge has sibling access, but no Element.parent.
    for (const container of doc.select(".view-title, .novel-detail")) {
      for (const node of container.select("dt, th, td, span, strong, div")) {
        const label = this.cleanText(node.text).replace(/[\s:：]/g, "");
        if (!labels.includes(label) || values[label]) continue;
        const sibling = node.nextElementSibling;
        const value = this.cleanText(sibling?.text);
        if (value && value.length <= (label === "장르" ? 300 : 120)
            && !labels.includes(value.replace(/[\s:：]/g, ""))) values[label] = value;
      }
      // Scoped label chain fallback for labels/values nested in different
      // wrappers. Never search comments, page headings or whole-page text.
      const text = this.cleanText(container.text);
      const pair = text.match(/(?:작가|저자)\s*[:：]?\s*(.{1,120}?)\s*장르\s*[:：]?\s*(.{1,300}?)\s*(?:발행구분|연재상태)\s*[:：]?\s*(연재중|연재 중|완결|완료|휴재)/);
      if (pair) {
        if (!values.작가 && !values.저자) values.작가 = this.cleanText(pair[1]);
        if (!values.장르) values.장르 = this.cleanText(pair[2]);
        if (!values.발행구분 && !values.연재상태) values.발행구분 = pair[3];
      }
    }
    const author = values.작가 || values.저자 || this.firstText(root, ".nd-meta span a");
    const rawGenres = values.장르 ? values.장르.split(/[,，/|·]+/) : (root?.select(".hero-v2-tag") || []).map(node => node.text);
    const genre = Array.from(new Set(rawGenres.map(value => this.cleanText(value)).filter(Boolean)));
    const statusText = values.발행구분 || values.연재상태 || "";
    return {author, genre, status: /완결|완료/.test(statusText) || this.hasElement(root, ".nv-badge--done") ? 1 : 0};
  }

  async _collectSerialChapters(doc, base, novelId, target, deadline) {
    const first = this._serialChapters(doc, base, novelId);
    const pager = this._episodePager(doc, base, novelId, target);
    const pages = new Map([[pager.current, first]]), pending = new Map(pager.pages);
    const failed = new Map(), visited = new Set([pager.current]);
    let expected = pager.expected, stopped = "수집하지 못함";
    const previousSignature = first.map(ch => ch.url).join("|");
    // A bounded metadata checkpoint lets a long TOC continue after refresh.
    // Reuse only the same book with the same first-page chapter signature.
    const checkpointKey = "newtoki1_toc_v25_" + encodeURIComponent(base + "/novel/" + novelId);
    try {
      const saved = JSON.parse(this._preferenceString(checkpointKey, "{}"));
      if (pager.current === 1 && saved.signature === previousSignature && Date.now() - saved.at < 300000) {
        for (const [number, list] of saved.pages || []) {
          if (!Number.isInteger(number) || number < 1 || number > 150 || !Array.isArray(list)
              || !list.every(ch => this._novelLinkPath(base, ch.url).startsWith("/novel/" + novelId + "/"))) continue;
          pages.set(number, list);visited.add(number);
        }
        for (const [number, url] of saved.pending || []) if (Number.isInteger(number) && number >= 1 && number <= 150
          && this._origin(url) === base && this._novelLinkPath(base, url) === "/novel/" + novelId) pending.set(number, url);
        expected = Math.max(expected, Math.min(150, Number(saved.expected) || 1));
      }
    } catch (_) {}
    const signatures = new Set(Array.from(pages.values()).map(list => list.map(ch => ch.url).join("|")).filter(Boolean));
    const record = () => this._saveReport("toc", "v0.2.25 · 목차 페이지 수집\n작품: " + this._safeReportUrl(target)
      + "\n완료 페이지: " + Array.from(pages.keys()).sort((a,b) => a-b).join(", ")
      + "\n예상 페이지: " + expected + "\n수집 회차: " + Array.from(pages.values()).reduce((sum, list) => sum + list.length, 0)
      + "\n실패 페이지:\n" + Array.from(failed.entries()).map(([page, reason]) => (page === 0 ? "전체 범위" : page + "페이지") + " · " + reason).join("\n"));
    while (true) {
      const next = Array.from(pending.keys()).filter(page => !visited.has(page)).sort((a,b) => a-b)[0];
      if (!next) break;
      visited.add(next);
      const url = pending.get(next);
      const remaining = Math.floor((deadline - Date.now()) / 1000);
      if (remaining < 1) { stopped = "목차 전체 대기시간 초과"; failed.set(next, stopped); break; }
      try {
        const result = await this._requestResult(url, target, Math.min(15, remaining));
        if (this._origin(result.url) !== base || this._novelLinkPath(base, result.url).replace(/\/$/, "") !== "/novel/" + novelId) throw new Error("다른 작품 또는 초기 화면으로 이동함");
        const pageDoc = new Document(result.value);
        const list = this._serialChapters(pageDoc, base, novelId);
        const signature = list.map(ch => ch.url).join("|");
        if (!list.length) throw new Error("회차 링크 없음");
        if (signatures.has(signature)) throw new Error("다른 페이지와 같은 목차가 반환됨");
        signatures.add(signature);
        pages.set(next, list);
        const discovered = this._episodePager(pageDoc, base, novelId, result.url);
        if (discovered.current !== next) { pages.delete(next); throw new Error("요청 페이지와 표시된 페이지가 다름"); }
        expected = Math.max(expected, discovered.expected);
        for (const [page, pageUrl] of discovered.pages) if (!pending.has(page)) pending.set(page, pageUrl);
      } catch (error) {
        failed.set(next, this._text(error?.message || error).split(/[\r\n]/)[0].slice(0, 160).replace(/https?:\/\/\S+/g, "[주소 생략]"));
        if (error?.authenticationRequired) { stopped = "사람 인증이 필요하여 수집 중단"; break; }
      }
      record();
    }
    for (let page = 1; page <= expected; page++) if (!pages.has(page) && !failed.has(page)) failed.set(page, pending.has(page) ? stopped : "이동 링크를 확인하지 못함");
    const seen = new Set(), chapters = [];
    for (const page of Array.from(pages.keys()).sort((a,b) => a-b)) {
      for (const chapter of pages.get(page)) if (!seen.has(chapter.url)) {seen.add(chapter.url); chapters.push(chapter);}
    }
    const numbers = chapters.map(ch => Number(ch.number || 0)).filter(n => n > 0);
    const oldest = numbers.length ? Math.min(...numbers) : 0;
    if (oldest > 1) failed.set(0, "1화까지 수집하지 못함 · 가장 오래된 확인 회차=" + oldest + "화");
    if (pager.unresolved.length && !numbers.length) failed.set(0, "페이지 이동 확인 필요: " + pager.unresolved.join(", "));
    if (numbers.length === chapters.length && numbers.every(Number.isInteger)) {
      const distinct = new Set(numbers), maximum = Math.max(...numbers);
      const missing = [];
      for (let n = 1; n <= maximum && missing.length < 20; n++) if (!distinct.has(n)) missing.push(n);
      if (missing.length) failed.set(0, "미수집 회차: " + missing.join(", ") + "화" + (missing.length === 20 ? " 외 추가 확인 필요" : ""));
    }
    const complete = failed.size === 0 && first.length > 0;
    record();
    if (pager.current === 1) this._setPreferenceString(checkpointKey, JSON.stringify({signature: previousSignature, at: Date.now(), expected,
      pages: Array.from(pages), pending: Array.from(pending)}));
    const ordered = chapters.map((chapter, index) => ({
      name: this._chapterName(chapter.label, chapter.number || (complete ? String(chapters.length - index) : "")),
      url: chapter.url, dateUpload: chapter.dateUpload, scanlator: chapter.scanlator,
      order: chapter.number ? Number(chapter.number) : chapters.length - index
    })).sort((a, b) => a.order - b.order).map(({order, ...chapter}) => chapter);
    return { complete, failed, pageCount: pages.size, chapters: ordered };
  }

  _safeReportUrl(value) {
    return this._text(value).split(/[?#]/)[0].replace(/^(https?:\/\/)[^/]*@/i, "$1[숨김]@").slice(0, 180);
  }

  _safeError(error) {
    let text = this._text(error?.message || error).replace(/https?:\/\/[^\s)"'<>]+/gi, value => this._safeReportUrl(value));
    const key = this._preferenceString("newtoki1_novel_external_auth_access_key", "");
    if (key) text = text.split(key).join("[숨김]");
    return text.replace(/Bearer\s+[^\s,;]+/gi, "Bearer [숨김]")
      .replace(/((?:authorization|cookie|password|token|access_key)\s*[:=]\s*)[^\s,;]+/gi, "$1[숨김]").slice(0, 2000);
  }

  _saveReport(stage, text) {
    const report = this._text(text).slice(0, 12000);
    this.diagnosticReports.set(stage, report);
    this._setPreferenceString("newtoki1_novel_report_" + stage, report);
  }

  _report(stage) {
    return this.diagnosticReports.get(stage) || this._preferenceString("newtoki1_novel_report_" + stage, "");
  }

  _rememberTocReport(target) {
    const report = this._report("toc"), book = this._safeReportUrl(target);
    if (!report.includes("작품: " + book + "\n")) return;
    try {
      const previous = this.tocReportHistory || JSON.parse(this._preferenceString("newtoki1_toc_reports_v24", "[]"));
      const recent = [{book, report}, ...previous.filter(item => item.book !== book)].slice(0, 5);
      this.tocReportHistory = recent;
      this._setPreferenceString("newtoki1_toc_reports_v24", JSON.stringify(recent));
      this._saveReport("tocHistory", "최근 작품별 목차 기록 (최대 5개)\n\n" + recent.map(item => item.report).join("\n\n"));
    } catch (_) {}
  }

  _captureStructure(stage, url, html, parsedDoc) {
    const doc = parsedDoc || new Document(this._text(html));
    const brief = (node, depth) => {
      const attrs = ["id", "class", "title", "alt", "data-page", "data-ep-page", "data-ep", "data-episode-number", "data-chapter-number", "data-episode-id"];
      const parts = attrs.map(key => { const value = this._text(node?.attr(key)).replace(/\s+/g, " ").slice(0, 100); return value ? key + "=" + value : ""; }).filter(Boolean);
      for (const key of ["href", "src", "data-src", "data-original", "data-srcset", "srcset"]) {
        const value = node?.attr(key);
        if (value) parts.push(key + "=" + this._safeReportUrl(value));
      }
      const children = depth > 0 ? Array.from(node?.children || []).filter(child => !/^(script|style|input|textarea|iframe)$/i.test(this._text(child.localName))).slice(0, 6).map(child => brief(child, depth - 1)) : [];
      const textAllowed = /^(?:a|span|h1|h2|h3|h4|strong|small|time|td)$/i.test(this._text(node?.localName)) || /(?:subject|title|num|rank|caption)/i.test(this._text(node?.attr("class")));
      const label = textAllowed ? this.cleanText(node?.text).slice(0, 100) : "";
      return "{" + this._text(node?.localName || "element") + " " + parts.join(" ") + (label ? " text=" + label : "") + (children.length ? " children=" + children.join(" ") : "") + "}";
    };
    const anchors = doc.select("a[href]").filter(node => /\/novel\/\d+/.test(this._text(node.getHref || node.attr("href")))).slice(0, 12);
    const parent = node => {
      try {
        const contexts = [];
        let current = node.parent;
        for (let depth = 0; current?.localName && depth < 3; depth++, current = current.parent) {
          if (/^(?:body|html|form)$/i.test(current.localName) || /(?:^|\s)serial-list(?:\s|$)/.test(this._text(current.attr("class")))) break;
          contexts.push("parentClass=" + this._text(current.attr("class")).slice(0, 100)
            + " siblings=" + Array.from(current.children || []).slice(0, 6).map(child => brief(child, 0)).join(" "));
        }
        return " " + contexts.join(" / ");
      } catch (_) { return ""; }
    };
    const headings = doc.select("h1, h2, h3, h4").slice(0, 8).map(node => brief(node, 1));
    const articles = doc.select("article").slice(0, 1).map(node => brief(node, 2));
    const classes = [].concat(doc.select("div"), doc.select("span"), doc.select("section")).map(node => this._text(node.attr("class")))
      .filter(value => /content|view|read|novel|episode|chapter|subject|item-num|text/i.test(value));
    const pager = doc.select(".theme-episode-pager").map(node => brief(node, 1) + "\n" + node.select("a[href]").map(anchor => {
      const href = this._text(anchor.attr("href") || anchor.getHref);
      const pageFields = (href.split("?")[1] || "").split("&").map(part => part.replace(/^amp;/, "")).filter(part => /^[a-zA-Z][a-zA-Z0-9_]*=\d{1,3}$/.test(part));
      return brief(anchor, 0) + (pageFields.length ? " numericQuery=" + pageFields.join("&") : "");
    }).join("\n"));
    const serial = doc.select(".serial-list, #serial-move").slice(0, 1).map(node => Array.from(node.children || []).slice(0, 3).map(row => brief(row, 3)).join("\n"));
    const report = this._siteStructureError(stage, url, html, doc).message + (pager.length ? "\n목차 페이지 이동 구조:\n" + pager.join("\n") : "") + (serial.length ? "\n연재 목록 행 구조:\n" + serial.join("\n") : "") + "\n제목 구조:\n" + headings.join("\n") + "\n링크 구조:\n" + anchors.map((node, index) => brief(node, 3) + (index < 3 ? parent(node) : "")).join("\n")
      + "\n내용 영역 class: " + Array.from(new Set(classes)).slice(0, 30).join("; ") + "\narticle 구조:\n" + articles.join("\n");
    const forms = doc.select("form").slice(0, 3).map(form => "action=" + this._safeReportUrl(form.attr("action")) + " method=" + this._text(form.attr("method")).slice(0, 10)
      + " fields=" + form.select("input[name], select[name]").map(field => this._text(field.attr("name")).replace(/[^a-zA-Z0-9_\[\]-]/g, "").slice(0, 40)).slice(0, 12).join(","));
    this._saveReport(stage, report + (forms.length ? "\n검색 폼 구조:\n" + forms.join("\n") : ""));
  }

  _diagnosticCard() {
    return { name: "[진단] 최근 오류·페이지 구조", link: "/__newtoki1_diagnostics__", imageUrl: this.generatedCover("diagnostics") };
  }

  async _diagnosticDetail(url) {
    // This explicit diagnostic action reads only DOM structure, never returns
    // a chapter's text or sends it to a third party.
    const bodyReport = this._report("body");
    const lastUrl = this._preferenceString("newtoki1_novel_last_body_url", "") || (bodyReport.match(/\n경로:\s*(https:\/\/[^\s]+)/) || [])[1] || "";
    const base = await this._resolveBaseUrl();
    if (this._origin(lastUrl) === base && /^\/novel\/\d+\/\d+$/.test(this._novelLinkPath(base, lastUrl))) {
      try {
        const result = await this._requestResult(lastUrl, base + "/novel", 8);
        this._captureStructure("bodyStructure", result.url, result.value);
      } catch (_) { this._saveReport("bodyStructure", "실패 회차의 HTTP 구조를 읽지 못했습니다. WebView 인증 상태와 서버의 본문 추출 구조를 확인해야 합니다."); }
    }
    const text = ["body", "bodyStructure", "detailRequest", "toc", "tocHistory", "metadata", "covers", "api", "transport", "detail", "rank"].map(stage => this._report(stage)).filter(Boolean).join("\n\n");
    return { name: "토끼 소설 1 진단 v0.2.25", link: url, imageUrl: this.generatedCover("diagnostics"), description: text ? "현재 확장 v0.2.25 · 각 기록의 버전은 오류 당시 실행 버전입니다. 본문 기록을 갱신하려면 해당 회차를 다시 열어 주세요.\n\n" + text : "아직 진단 기록이 없습니다. 목록·상세·본문을 다시 불러온 뒤 이 항목을 다시 열어 주세요.", genre: [], author: "", artist: "", status: 0, chapters: [] };
  }

  _siteStructureError(stage, url, html, parsedDoc) {
    const doc = parsedDoc || new Document(this._text(html));
    const safePath = value => this._text(value).split(/[?#]/)[0].slice(0, 100);
    const short = value => this._text(value).replace(/[^a-zA-Z0-9_ .:-]/g, "").slice(0, 100);
    const counts = [".novel-detail", ".novel-ep-row", "a.novel-card", ".search-results-grid > a.card", "a.rank-v2-row", ".novel-viewer", "article", "p", "h1", "a"].map(selector => selector + "=" + doc.select(selector).length);
    const headings = doc.select("h1, h2").slice(0, 6).map(node => short(node.attr("class"))).filter(Boolean);
    const links = doc.select("a[href]").filter(node => /\/novel(?:\/|$)/.test(this._text(node.getHref || node.attr("href")))).slice(0, 6).map(node => safePath(node.getHref || node.attr("href")) + " class=" + short(node.attr("class")));
    const containers = doc.select("[class]").map(node => short(node.attr("class"))).filter(value => /novel|episode|chapter|rank|detail|book|list/i.test(value));
    const unique = Array.from(new Set(containers)).slice(0, 12);
    return new Error("토끼 소설 1 구조 진단 v0.2.25 | 단계=" + stage + " | 경로=" + safePath(url) + " | 응답길이=" + this._text(html).length + " | 소설 링크: " + links.join("; ") + " | 영역 class: " + unique.join("; ") + " | 제목요소 class: " + headings.join("; ") + " | 요소: " + counts.join(", "));
  }

  async getDetail(url) {
    if (/\/__newtoki1_diagnostics__(?:[?#]|$)/.test(this._text(url))) return this._diagnosticDetail(url);
    const cardMatch = this._text(url).match(/\/__newtoki1_novel_card__\/([\w-]+)/);
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
        item = { name: "\uC624\uB298\uC758 \uB3C5\uC11C", imageUrl: `${this.assetBaseUrl}/card/novel-reading-${String(index).padStart(2, "0")}.gif` };
      } else if (custom) {
        const cards = await this._customCards(this._customCardSource());
        const index = Math.max(1, Number(custom[1]) || 1);
        if (cards[index - 1]) item = { name: "\uC624\uB298\uC758 \uB3C5\uC11C", imageUrl: cards[index - 1] };
      } else if (key === "event") {
        item = await this._activeEventCard();
      }
      if (!item) item = { name: "\uC624\uB298\uC758 \uB3C5\uC11C", imageUrl: `${this.assetBaseUrl}/card/novel-reading-01.gif` };
      return {
        name: item.name,
        link: this._text(url),
        imageUrl: item.imageUrl,
        description: "\uBAA9\uB85D\uC744 \uAD6C\uBD84\uD558\uB294 \uACF5\uC6A9 \uB3C5\uC11C \uC548\uB0B4 \uCE74\uB4DC\uC785\uB2C8\uB2E4. \uB4A4\uB85C \uB3CC\uC544\uAC00 \uC791\uD488\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.",
        genre: [cardMatch[1] === "event" ? "\uC774\uBCA4\uD2B8 \uC548\uB0B4" : "\uB3C5\uC11C \uCE74\uB4DC"],
        author: "\uD1A0\uB07C \uC18C\uC124",
        artist: "",
        status: 0,
        chapters: []
      };
    }

    const detailDeadline = Date.now() + 75000;
    let base = await this._resolveBaseUrl();
    let target = this.siteUrl(base, url);
    let result;
    try {
      result = await this._requestResult(target, `${base}/novel`, 45);
      this._saveReport("detailRequest", "v0.2.25 · 작품 상세 연결 성공\n작품: " + this._safeReportUrl(result.url));
    } catch (error) {
      const report = "v0.2.25 · 작품 상세 연결 실패\n작품: " + this._safeReportUrl(target) + "\n오류: " + this._safeError(error);
      this._saveReport("detailRequest", report);
      throw new Error(report + "\n::진단 검색에서 전체 기록을 확인하세요.");
    }
    target = result.url;
    base = this._origin(target);
    const doc = new Document(result.value);
    this._captureStructure("detail", target, result.value, doc);
    const root = doc.selectFirst(".novel-detail");
    const cached = this._rememberedNovel(target);
    const pageTitle = this.firstText(root, ".nd-info h1") || this.firstText(doc, "article h2, .view-title h2") || this.firstText(doc, "main h1, h1") || doc.selectFirst('meta[property="og:title"]')?.attr("content") || "";
    const commonTitle = /^(?:뉴토끼|토끼|newtoki)(?:\s*[-|·:].*)?$/i.test(this.cleanText(pageTitle));
    const name = this._cleanNovelLabel(commonTitle ? (cached.name || "[작품명 확인 필요]") : (pageTitle || cached.name || "[작품명 확인 필요]"));
    let description = this.firstText(root, ".nd-desc") || doc.selectFirst('meta[name="description"]')?.attr("content") || "";
    const {author, genre, status} = this._detailMetadata(doc, root);
    const ogCover = doc.selectFirst('meta[property="og:image"]')?.attr("content");
    const imageUrl = this._detailCover(doc, base) || cached.imageUrl || this.generatedCover(target);
    this._rememberNovels([{name, link: target.split(/[?#]/)[0], imageUrl}]);
    const chapters = [];
    let serialResult = null;
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
      const title = this.cleanText(this.firstText(row, ".ne-title"));
      const rowText = this.cleanText(row.text);
      const rowClass = this._text(row.attr("class"));
      const isNotReady = this.hasElement(row, ".ep-badge-not-ready") || /novel-ep--not-ready/.test(rowClass);
      const gateMode = this._text(anchor?.attr("data-novel-episode-gate"));
      const isPaid = this.hasElement(row, ".ep-badge-paid, .ne-unlock-cost") || /novel-ep--paid/.test(rowClass) || this.isPaidGate(gateMode) || /(?:\uD83D\uDC8E|\uD83D\uDD12|\uC720\uB8CC|\uD3EC\uC778\uD2B8|\uACB0\uC81C|\d+P)/.test(rowText);
      const markers = [isNotReady ? "\u23F3 \uC900\uBE44\uC911" : "", isPaid ? "\uD83D\uDD12 \uC720\uB8CC" : ""].filter(Boolean).join(" ");
      const episodeNumber = this._episodeNumber(number, row) || (number.match(/^\s*(\d+(?:\.\d+)?)(?:화|회)?\s*$/) || [])[1] || "";
      chapters.push({
        name: this._chapterName(`${markers ? markers + " · " : ""}${title || number}`, episodeNumber),
        url: chapterUrl,
        dateUpload: this.parseDate(this.firstText(row, ".ne-date")),
        scanlator: null
      });
    }

    if (!chapters.length) {
      if (this._serialChapters(doc, base, novelId).length) {
        serialResult = await this._collectSerialChapters(doc, base, novelId, target, detailDeadline);
        chapters.push(...serialResult.chapters);
      } else {
        for (const chapter of this._chaptersFromNovelLinks(doc, base, novelId)) chapters.push(chapter);
        if (chapters.length) {
          description = "[목차 범위 확인 필요] 연재 목록 영역을 확인하지 못해 일부 회차만 표시될 수 있습니다. 진단 기록의 작품 주소와 연재 목록 구조를 확인하세요.\n\n" + description;
          this._saveReport("toc", "v0.2.25 · 연재 목록 영역 미확인\n작품: " + this._safeReportUrl(target) + "\n수집 회차: " + chapters.length + "\n완료 여부: 확인 필요");
        }
      }
      for (const chapter of chapters) chapterIds.add(chapter.url.split("/").pop());
    }

    // The new site server-renders only the newest 100 episodes. Older
    // episodes are exposed through a cursor API, so follow the same windows
    // the website's "이전 회차 더 보기" button uses.
    let olderIncomplete = false;
    if (!serialResult && novelId && chapters.length > 0) {
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
        } catch (_) { olderIncomplete = true; break; }
        base = this._origin(windowResult.url);
        target = this.siteUrl(base, target);

        let data;
        try {
          data = JSON.parse(windowResult.value);
        } catch (_) {
          olderIncomplete = true;
          break;
        }
        if (!data?.ok || !Array.isArray(data.items)) { olderIncomplete = true; break; }

        for (const item of data.items) {
          const episodeId = String(item?.id || "");
          if (!episodeId || chapterIds.has(episodeId)) continue;
          chapterIds.add(episodeId);
          const number = this.cleanText(item.episodeLabel || (item.number ? `${item.number}\uD654` : "\uD68C\uCC28"));
          const title = this.cleanText(item.title || "");
          const markers = [
            this.isTrueFlag(item.isNotReady) ? "\u23F3 \uC900\uBE44\uC911" : "",
            this.isTrueFlag(item.isPaid) || this.isPaidGate(item.gateMode) ? "\uD83D\uDD12 \uC720\uB8CC" : ""
          ].filter(Boolean).join(" ");
          chapters.push({
            name: this._chapterName(`${markers ? markers + " · " : ""}${title || number}`, /^\d+(?:\.\d+)?$/.test(this._text(item.number)) ? this._text(item.number) : this._episodeNumber(number)),
            url: `${base}/novel/${novelId}/${episodeId}`,
            dateUpload: this.parseDate(item.publishedAtLabel),
            scanlator: null
          });
        }

        hasOlder = this.isTrueFlag(data.hasOlder);
        cursor = typeof data.olderCursor === "string" ? data.olderCursor : null;
        windows += 1;
      }
      if (hasOlder) olderIncomplete = true;
    }

    if (!chapters.length) {
      // The native detail page clips error toasts. Put diagnostics in its
      // expandable description so the user can read the complete report.
      description = "[목차 추출 실패 — 아래 진단 정보를 공유해 주세요]\n" + this._siteStructureError("작품 상세·목차", target, result.value).message + (description ? "\n\n" + description : "");
      this._saveReport("toc", "v0.2.25 · 목차 추출 실패\n작품: " + this._safeReportUrl(target) + "\n수집 회차: 0\n완료 여부: 확인 필요");
    }
    if (serialResult) {
      if (serialResult.complete) description = "[목차 수집 완료] " + serialResult.pageCount + "페이지 · " + chapters.length + "개 항목\n[목차 순번]은 사이트 회차 번호를 우선 사용합니다. 번호가 없는 항목만 전체 목록의 읽기 순서로 표시하며 외전·후기도 포함합니다.\n\n" + description;
      else description = "[목차 수집 미완료] " + chapters.length + "개 항목만 수집했습니다. 누락된 페이지: " + Array.from(serialResult.failed.keys()).sort((a,b) => a-b).join(", ")
        + "\n" + Array.from(serialResult.failed.entries()).map(([page, reason]) => (page === 0 ? "전체 범위" : page + "페이지") + " · " + reason).join("\n")
        + "\n미완료 상태에서는 전체 목차 순번을 부여하지 않습니다. 상세 새로고침 후 다시 시도하세요.\n\n" + description;
    }
    const unknown = chapters.filter(chapter => chapter.name.startsWith("[회차 번호 확인 필요]"));
    if (unknown.length) description = "[회차 번호 확인 필요 — 다운로드 실패를 뜻하지 않습니다]\n" + unknown.map(chapter => chapter.name + "\n" + this._safeReportUrl(chapter.url)).join("\n") + "\n\n" + description;
    if (olderIncomplete) description = "[이전 회차 목록 불러오기 미완료] 일부 회차가 표시되지 않을 수 있습니다. 재시도 후 진단 항목을 확인하세요.\n\n" + description;
    this._rememberTocReport(target);
    description = "작가: " + (author || "확인 필요") + "\n장르: " + (genre.length ? genre.join(", ") : "확인 필요") + "\n\n" + description;
    const dated = chapters.filter(chapter => chapter.dateUpload);
    const fields = doc.select(".view-title dt, .view-title th, .view-title td, .view-title span, .view-title strong, .view-title div")
      .filter(node => ["작가", "저자", "장르", "발행구분", "연재상태"].includes(this.cleanText(node.text).replace(/[\s:：]/g, "")))
      .slice(0, 8).map(node => this.cleanText(node.text) + " → " + this.cleanText(node.nextElementSibling?.text).slice(0, 300));
    this._saveReport("metadata", "v0.2.25 · 작품 정보\n작품: " + this._safeReportUrl(target) + "\n작가: " + (author || "확인 필요") + "\n장르: " + (genre.join(", ") || "확인 필요")
      + "\n메타데이터 항목: " + (fields.join("; ") || "인접 항목 확인 필요")
      + "\n업로드 날짜 확인: " + dated.length + "/" + chapters.length
      + "\n날짜 표본 (한국 날짜): " + dated.slice(0, 3).map(chapter => chapter.name + "=" + new Date(Number(chapter.dateUpload) + 9 * 3600000).toISOString().slice(0, 10)).join("; "));

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
    const value = this._preference("newtoki1_novel_external_auth_enabled", false);
    return value === true || this._text(value).toLowerCase() === "true" || this._text(value) === "1";
  }

  _externalAuthEndpoint() {
    const raw = this._trimSlash(this._preference("newtoki1_novel_external_auth_endpoint", ""));
    if (!raw) throw new Error("\uC678\uBD80\uC778\uC99D \uC11C\uBC84 \uC8FC\uC18C\uAC00 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.");
    if (!/^https?:\/\/(?:\[[0-9a-f:]+\]|[a-z0-9.-]+)(?::\d{1,5})?$/i.test(raw)) {
      throw new Error("\uC678\uBD80\uC778\uC99D \uC11C\uBC84 \uC8FC\uC18C \uD615\uC2DD\uC774 \uC798\uBABB\uB410\uC2B5\uB2C8\uB2E4.");
    }
    return raw;
  }

  _externalAuthHeaders(jsonBody) {
    const headers = { Accept: "application/json", "X-Lab-Request": "1" };
    if (jsonBody) headers["Content-Type"] = "application/json";
    const key = this._text(this._preference("newtoki1_novel_external_auth_access_key", "")).trim();
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
        throw new Error("\uC811\uC18D \uD0A4\uAC00 \uD2C0\uB838\uAC70\uB098 \uC11C\uBC84 \uC124\uC815\uACFC \uB2E4\uB985\uB2C8\uB2E4.");
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        if (ignoreFailure) return {};
        throw new Error("\uC678\uBD80\uC778\uC99D \uC11C\uBC84 \uC694\uCCAD \uC2E4\uD328 (HTTP " + response.statusCode + ").");
      }
      return JSON.parse(this._text(response.body));
    } catch (error) {
      if (ignoreFailure) return {};
      const detail = this._text(error && (error.message || error));
      if (/\uC811\uC18D \uD0A4|\uC678\uBD80\uC778\uC99D \uC11C\uBC84 \uC694\uCCAD/.test(detail)) throw error;
      throw new Error("\uC678\uBD80\uC778\uC99D \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC8FC\uC18C, \uD3EC\uD2B8, \uBC29\uD654\uBCBD\uC744 \uD655\uC778\uD558\uC138\uC694.");
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

  _novelHtml(title, text) {
    return dcNovelReadableHtml(title, text);
  }

  async _externalAuthNovel(name, target) {
    const started = Date.now(), deadline = started + 115000;
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
              const reason = code === "manual_viewer_confirmation_required"
                ? "서버가 이 회차의 본문 확인을 완료하지 못했습니다. 수동 확인 또는 뷰어 구조 확인이 필요합니다."
                : code === "novel_viewer_structure_unrecognized" ? "인증 후 본문 영역을 확정하지 못했습니다. 구조 진단: " + this._text(state.message).slice(0, 1800) : "서버 작업 실패";
              throw new Error(reason + " | code=" + code);
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
              return this._novelHtml(this._text(manifest.title).trim() || name, text);
            }
            if (!["queued", "authenticating"].includes(lastState)) throw new Error("알 수 없는 서버 작업 상태입니다.");
            await this._pause(Math.min(750, Math.max(0, deadline - Date.now())));
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
      const key = this._text(this._preference("newtoki1_novel_external_auth_access_key", "")).trim();
      if (key) detail = detail.split(key).join("[접속 키 숨김]");
      throw new Error("외부인증 진단 v0.2.25 | stage=" + stage
        + " | state=" + (lastState || "unknown") + " | job=" + (jobId || "not_created")
        + " | attempt=" + attempt + "/3 | elapsedMs=" + (Date.now() - started)
        + " | " + detail + "\n진행 기록:\n" + history.join("\n")
        + "\n재시도하거나 웹뷰에서 인증 상태를 확인하세요.");
    }
  }

  _novelDomReader() {
    return "(function (expectedUrl) {\n  const href = String(location.href || '').split(/[?#]/)[0].replace(/\\/$/, '');\n  const wanted = String(expectedUrl || '').split(/[?#]/)[0].replace(/\\/$/, '');\n  const base = {href, allImages: document.images.length, viewport: innerHeight,\n    documentHeight: document.documentElement.scrollHeight};\n  const finish = value => JSON.stringify(Object.assign(base, value));\n  if (href !== wanted) return finish({error:'novel_page_mismatch'});\n  if (document.querySelector('#challenge-form, #cf-challenge-running') ||\n      /just a moment|verify you are human|verifying you are human/i.test(document.title))\n    return finish({text:'', structure:'challenge'});\n  const gate = document.querySelector('[data-novel-unlock-status], .novel-gate, .novel-error, .novel-viewer [role=alert]');\n  if (gate && /로그인|구매|결제|포인트|잠긴|이용할 수 없는|sign in|payment|unlock/i.test(gate.textContent || ''))\n    return finish({error:'manual_login_or_paid_content'});\n  const heading = document.querySelector('h3.theme-novel-title, .ne-h1, .novel-viewer h1');\n  const viewer = document.querySelector('.novel-viewer, [data-novel-content], .theme-novel-content');\n  const title = (heading && heading.textContent || document.title || '').trim();\n  const forbidden = 'script, style, nav, form, footer, header, aside, button, iframe, .comment-media, .view-comment, .serial-list, .theme-episode-pager, .theme-comment-pager, [role=alert]';\n  function visibleText(root) {\n    if (!root) return '';\n    if (root.innerText && !root.querySelector(\"h1, h2, h3, h4, \" + forbidden)) return root.innerText.replace(/\\r\\n?/g, '\\n').trim();\n    const lines = [];\n    function visit(node) {\n      if (node.nodeType === 3) {lines.push(node.textContent || ''); return;}\n      if (node.nodeType !== 1 && node.nodeType !== 11) return;\n      if (node.nodeType === 1 && node.matches(forbidden + \", h1, h2, h3, h4\") || node.hidden) return;\n      if (node.nodeType === 1 && node.tagName === 'BR') {lines.push('\\n'); return;}\n      for (const child of node.childNodes || []) visit(child);\n      if (node.nodeType === 1 && /^(P|DIV|SECTION)$/.test(node.tagName)) lines.push('\\n');\n    }\n    visit(root);return lines.join('').replace(/\\n{3,}/g, '\\n\\n').trim();\n  }\n  function shadowRoot(node) {\n    if (!node) return null;\n    if (node.shadowRoot || node.__novelShadow) return node.shadowRoot || node.__novelShadow;\n    for (const child of Array.from(node.querySelectorAll('*')).slice(0, 100))\n      if (child.shadowRoot || child.__novelShadow) return child.shadowRoot || child.__novelShadow;\n    return node;\n  }\n  const inspected = [], results = [];\n  function inspect(node, trusted) {\n    if (!node || /^(BODY|HTML|MAIN|ARTICLE)$/.test(node.tagName || '') || node.matches(forbidden) ||\n        (!trusted && node.querySelector(forbidden + ', h1, h2, h3, h4, a[href]'))) return;\n    const root = shadowRoot(node), text = visibleText(root);\n    const lines = text.split('\\n').filter(line => line.trim());\n    inspected.push((node.tagName || '') + '#' + (node.id || '').replace(/[^\\w-]/g,'').slice(0,60)\n      + '.' + String(node.className || '').replace(/[^\\w .-]/g,'').slice(0,100)\n      + ':chars=' + text.length + ':lines=' + lines.length + ':shadow=' + (root !== node));\n    const minimum = trusted ? 31 : 300;\n    if (text.length >= minimum && (trusted || lines.length >= 6)) results.push({text, node});\n  }\n  if (viewer) inspect(viewer, true);\n  // Older layouts use a title followed by an unlabelled text/BR container.\n  // Inspect only adjacent containers; never use document.body as novel text.\n  if (!results.length && heading) {\n    let parent = heading;\n    for (let level=0; parent && level<3; level++,parent=parent.parentElement) {\n      if (/^(BODY|HTML|MAIN|ARTICLE)$/.test(parent.tagName || '')) break;\n      let node=parent.nextElementSibling;\n      for (let n=0; node && n<4; n++,node=node.nextElementSibling) {\n        if (/^(NAV|FORM|FOOTER|ASIDE)$/.test(node.tagName || '')) break;\n        inspect(node, false);\n      }\n    }\n  }\n  // Conflicting candidates require manual diagnosis, not a guessed chapter.\n  const distinct = Array.from(new Set(results.map(result => result.text)));\n  if (distinct.length === 1) return finish({text:distinct[0], title, structure:'scoped_reader'});\n  return finish({text:'', title, structure:(distinct.length > 1 ? 'ambiguous:' : 'unrecognized:')\n    + 'heading=' + !!heading + ';viewer=' + !!viewer + ';' + inspected.slice(0,8).join(';')});\n})";
  }

  async _localWebViewNovel(name, target, base, timeoutSeconds) {
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
      function escapeHtml(value) {
        return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
      }
      function makeHtml(text) {
        var title = document.querySelector("h3.theme-novel-title, .ne-h1")?.textContent?.trim() || ${JSON.stringify(name || "Chapter")};
        return (${dcNovelReadableHtml.toString()})(title, text);
      }
      function check() {
        var actualOrigin = String(location.href || "").match(/^https:\\/\\/[^/?#]+/i)?.[0] || "";
        if (actualOrigin.toLowerCase() !== ${JSON.stringify(base.toLowerCase())}) { send("__TOKI31_ERR__ORIGIN_MISMATCH"); return; }
        if (String(location.href || "").split(/[?#]/)[0].replace(/\\/$/, "") !== ${JSON.stringify(target.split(/[?#]/)[0].replace(/\/$/, ""))}) { send("__TOKI31_ERR__PAGE_MISMATCH"); return; }
        var challenge = document.querySelector("#challenge-form, #cf-challenge-running") || /just a moment|verify you are human|verifying you are human|checking your browser/i.test(String(document.title) + " " + String(document.body?.innerText || ""));
        if (challenge) {
          if (Date.now() - startedAt < ${Math.max(500, webTimeout * 1000 - 3000)}) { window.setTimeout(check, 250); return; }
          send("__TOKI31_ERR__AUTH_REQUIRED"); return;
        }
        var gate = document.querySelector("[data-novel-unlock-status], .novel-gate, .novel-error, .novel-viewer [role=alert]");
        if (gate && /로그인|결제|포인트|유료|sign in|payment|unlock/i.test(String(gate.textContent || ""))) { send("__TOKI31_ERR__MANUAL_GATE"); return; }
        var viewer = document.querySelector(".novel-viewer");
        var root = viewer && (viewer.shadowRoot || viewer.__novelShadow || viewer);
        var text = String(window.__novelTTSText || "").trim();
        if (!text && root) text = Array.from(root.querySelectorAll("p")).map(function (p) { return String(p.textContent || "").trim(); }).filter(Boolean).join("\\n\\n");
        if (!text && document.querySelector("h3.theme-novel-title")) {
          var scoped = JSON.parse((${this._novelDomReader()})(${JSON.stringify(target)}));
          if (scoped.error === "manual_login_or_paid_content") { send("__TOKI31_ERR__MANUAL_GATE"); return; }
          if (scoped.text) text = scoped.text;
        }
        if (text.length > 30) { send("__TOKI31_OK__" + makeHtml(text)); return; }
        var heading = String(document.title || "") + " " + String(document.querySelector("h1")?.textContent || "");
        var status = heading.match(/\\b(403|404|410|502|503|504)\\b/);
        if (status && /gateway|time.?out|unavailable|forbidden|not found|gone/i.test(heading)) { send("__TOKI31_ERR__HTTP_" + status[1]); return; }
        if (/chrome-error:\\/\\/|chromewebdata/i.test(String(location.href)) || /ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|ERR_TIMED_OUT/.test(String(document.body?.innerText || ""))) { send("__TOKI31_ERR__NETWORK"); return; }
        if (Date.now() - startedAt < ${Math.max(500, webTimeout * 1000 - 3000)}) { window.setTimeout(check, 250); return; }
        send("__TOKI31_ERR__INCOMPLETE|state=" + document.readyState + "|viewer=" + !!viewer + "|paragraphs=" + (root ? root.querySelectorAll("p").length : 0) + "|tts=" + !!window.__novelTTSText);
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
        throw new Error("\uD604\uC7AC Mangayomi \uBC84\uC804\uC758 WebView \uBB38\uC790\uC5F4 \uBC18\uD658 \uC624\uB958\uB85C \uCF58\uD150\uCE20\uB97C \uBC1B\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC678\uBD80\uC778\uC99D \uC11C\uBC84\uB97C \uC0AC\uC6A9\uD558\uAC70\uB098 Mangayomi \uC5C5\uB370\uC774\uD2B8\uB97C \uD655\uC778\uD558\uC138\uC694.");
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
    name = this._cleanNovelLabel(name);
    try {
      const book = target.match(/^(https:\/\/[^/]+\/novel\/\d+)\/\d+/)?.[1];
      if (book) {
        const checkpoint = JSON.parse(this._preferenceString("newtoki1_toc_v25_" + encodeURIComponent(book), "{}"));
        const chapter = (checkpoint.pages || []).flatMap(entry => entry[1] || []).find(item => item.url === target);
        if (chapter) name = this._chapterName(chapter.label, chapter.number);
      }
    } catch (_) {}
    try {
      let html;
      if (this._externalAuthEnabled()) html = await this._externalAuthNovel(name, target);
      else {
        const result = await this._withDomainFallback(target, `${base}/novel`,
          async (current, currentReferer, context) => await this._localWebViewNovel(name, current, this._origin(current),
            Math.min(context.candidate ? 20 : 35, context.remainingSeconds)));
        html = result.value;
      }
      this._saveReport("body", "v0.2.25 · 본문 전달 성공\n회차: " + this.cleanText(name) + "\n경로: " + this._safeReportUrl(target));
      this._setPreferenceString("newtoki1_novel_last_body_url", "");
      return html;
    } catch (error) {
      let detail = this._text(error?.message || error);
      const key = this._text(this._preference("newtoki1_novel_external_auth_access_key", "")).trim();
      if (key) detail = detail.split(key).join("[접속 키 숨김]");
      detail = detail.replace(/https?:\/\/[^\s|]+/g, value => this._safeReportUrl(value));
      this._saveReport("body", "v0.2.25 · 본문 실패\n회차: " + this.cleanText(name) + "\n경로: " + this._safeReportUrl(target) + "\n" + detail);
      this._setPreferenceString("newtoki1_novel_last_body_url", target.split(/[?#]/)[0]);
      throw new Error("회차: " + this.cleanText(name) + " | 경로=" + this._safeReportUrl(target) + "\n" + detail + "\n인기 목록의 [진단] 항목 또는 ::진단 검색에서 전체 기록을 확인하세요.");
    }
  }

  escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  _option(name, value) {
    return { type_name: "SelectOption", name, value };
  }

  _select(type, name, pairs) {
    return {
      type,
      name,
      type_name: "SelectFilter",
      values: pairs.map((pair) => this._option(pair[0], pair[1]))
    };
  }

  getFilterList() {
    const header = (type, name) => ({ type, name, type_name: "HeaderFilter" });
    const separator = (type) => ({ type, name: "", type_name: "SeparatorFilter" });
    const popular = this._tabRule(this.popularRulePreference, this._defaultPopularRule());
    const latest = this._tabRule(this.latestRulePreference, this._defaultLatestRule());
    return [
      header("novelFilterHelp", "\uC81C\uBAA9 \uAC80\uC0C9\uACFC \uC544\uB798 \uC870\uAC74\uC744 \uD568\uAED8 \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."),
      this._select("novelStatus", "\uBAA9\uB85D \uAD6C\uBD84", [
        ["\uC18C\uC124 (\uC5F0\uC7AC\uC911)", "ongoing"],
        ["\uC644\uACB0 \uC18C\uC124", "completed"]
      ]),
      this._select("novelGenre", "\uC7A5\uB974", [
        ["\uC804\uCCB4", ""],
        ["\uD310\uD0C0\uC9C0", "fantasy"],
        ["\uBB34\uD611", "wuxia"],
        ["19\uAE08", "adult19"],
        ["\uD604\uB300", "modern"],
        ["\uB85C\uB9E8\uC2A4", "romance"],
        ["\uB85C\uB9E8\uC2A4 \uD310\uD0C0\uC9C0", "romance_fantasy"],
        ["BL", "bl"],
        ["\uB77C\uB178\uBCA8", "light_novel"],
        ["\uAE30\uD0C0", "etc"]
      ]),
      this._select("novelPlatform", "\uD50C\uB7AB\uD3FC", [
        ["\uC804\uCCB4", ""],
        ["\uC9C1\uC811 \uC5C5\uB85C\uB4DC", "user"],
        ["\uB178\uBCA8\uD53C\uC544", "novelpia"],
        ["\uBD81\uD1A0\uB07C", "booktoki"],
        ["\uBB38\uD53C\uC544", "munpia"],
        ["\uC870\uC544\uB77C", "joara"],
        ["\uCE74\uCE74\uC624\uD398\uC774\uC9C0", "kakaopage"],
        ["\uB124\uC774\uBC84 \uC2DC\uB9AC\uC988", "series"],
        ["\uB9AC\uB514\uBD81\uC2A4", "ridi"],
        ["\uAE30\uD0C0", "etc"]
      ]),
      separator("novelSortSeparator"),
      this._select("novelSort", "\uC815\uB82C", [
        ["\uCD5C\uC2E0\uC21C", "new"],
        ["\uC2E0\uC791\uC21C", "fresh"],
        ["\uBD81\uB9C8\uD06C\uC21C", "hot"],
        ["\uC870\uD68C\uC21C", "views"],
        ["\uD3C9\uC810\uC21C", "rating"],
        ["\uD654\uC218\uC21C", "episodes"]
      ]),
      separator("novelSaveSeparator"),
      header("novelSaveHelp", "\uC870\uAC74\uC744 \uACE0\uB978 \uB4A4 Filter \uBC84\uD2BC\uC744 \uB204\uB974\uBA74 \uACB0\uACFC\uB97C \uBCF4\uACE0 Popular/Latest \uD0ED \uADDC\uCE59\uC73C\uB85C \uC800\uC7A5\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."),
      header("novelPopularSummary", "\uD604\uC7AC Popular: " + this._ruleSummary(popular)),
      header("novelLatestSummary", "\uD604\uC7AC Latest: " + this._ruleSummary(latest)),
      this._select("tabRuleAction", "Popular/Latest \uADDC\uCE59", [
        ["\uC800\uC7A5\uD558\uC9C0 \uC54A\uC74C (\uD544\uD130 \uACB0\uACFC\uB9CC \uBCF4\uAE30)", "0"],
        ["\uD604\uC7AC \uC870\uAC74\uC744 Popular \uD0ED\uC5D0 \uC800\uC7A5", "1"],
        ["\uD604\uC7AC \uC870\uAC74\uC744 Latest \uD0ED\uC5D0 \uC800\uC7A5", "2"],
        ["Popular \uD0ED\uC744 \uAE30\uBCF8\uAC12\uC73C\uB85C \uBCF5\uC6D0", "3"],
        ["Latest \uD0ED\uC744 \uAE30\uBCF8\uAC12\uC73C\uB85C \uBCF5\uC6D0", "4"],
        ["\uB450 \uD0ED \uBAA8\uB450 \uAE30\uBCF8\uAC12\uC73C\uB85C \uBCF5\uC6D0", "5"]
      ]),
      header("novelCardHelp", "\uB3C5\uC11C \uCE74\uB4DC\uB294 Popular/Latest \uCCAB \uD398\uC774\uC9C0\uC5D0\uB9CC \uD45C\uC2DC\uB418\uBA70 \uAC80\uC0C9\u00B7\uD544\uD130 \uACB0\uACFC\uC5D0\uB294 \uB098\uC624\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.")
    ];
  }

  getSourcePreferences() {
    return [
      {
        key: this.domainPreference,
        editTextPreference: {
          title: "\uD1A0\uB07C \uC8FC\uC18C \uC9C1\uC811 \uC9C0\uC815 (\uC120\uD0DD)",
          summary: "빈 값이면 https://newtoki1.org를 사용합니다.",
          value: "",
          dialogTitle: "\uD1A0\uB07C \uC18C\uC124 \uC8FC\uC18C",
          dialogMessage: "https://\uB85C \uC2DC\uC791\uD558\uB294 \uC0AC\uC774\uD2B8 \uC8FC\uC18C\uB97C \uC785\uB825\uD558\uC138\uC694. \uC790\uB3D9 \uC8FC\uC18C\uB97C \uC4F0\uB824\uBA74 \uBE44\uC6CC \uB450\uC138\uC694."
        }
      },
      {
        key: this.customCardPreference,
        editTextPreference: {
          title: "\uCEE4\uC2A4\uD140 \uB3C5\uC11C \uCE74\uB4DC (\uC120\uD0DD)",
          summary: "\uAC1C\uC778 JSON \uC8FC\uC18C\uB85C \uC5EC\uB7EC \uC7A5\uC758 \uCE74\uB4DC\uB97C \uC124\uC815\uD569\uB2C8\uB2E4. 7\uC7A5 \uC81C\uD55C\uC740 \uC5C6\uC73C\uBA70, \uC124\uC815\uD558\uBA74 \uACF5\uC6A9 \uC774\uBCA4\uD2B8 \uCE74\uB4DC\uB294 \uD45C\uC2DC\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
          value: "",
          dialogTitle: "\uCEE4\uC2A4\uD140 \uB3C5\uC11C \uCE74\uB4DC JSON \uC8FC\uC18C",
          dialogMessage: "cards \uBC30\uC5F4 \uB610\uB294 \uAE30\uC874 \uC694\uC77C\uBCC4 cards \uAC1D\uCCB4\uB97C \uC9C0\uC6D0\uD569\uB2C8\uB2E4. Google Drive \uACF5\uAC1C \uACF5\uC720 \uB9C1\uD06C\uB098 \uC9C1\uC811 JSON \uC8FC\uC18C\uB97C \uB123\uC73C\uC138\uC694."
        }
      },
      {
        key: "newtoki1_novel_card_rotation_minutes",
        editTextPreference: {
          title: "\uACF5\uC6A9 \uCE74\uB4DC \uAD50\uCCB4 \uC8FC\uAE30(\uBD84)",
          summary: "\uBE48\uCE78: \uBC30\uD3EC\uC18C \uC124\uC815 \uB530\uB984 / 0: \uC0C8\uB85C\uACE0\uCE68\uB9C8\uB2E4 / 60: 1\uC2DC\uAC04\uB9C8\uB2E4",
          value: "",
          dialogTitle: "\uACF5\uC6A9 \uCE74\uB4DC \uAD50\uCCB4 \uC8FC\uAE30",
          dialogMessage: "0 \uB610\uB294 \uBD84 \uB2E8\uC704 \uC22B\uC790\uB97C \uC785\uB825\uD558\uC138\uC694. \uBE48\uCE78\uC740 \uBC30\uD3EC\uC18C JSON \uC124\uC815\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4."
        }
      },
      {
        key: "newtoki1_novel_external_auth_enabled",
        switchPreferenceCompat: {
          title: "\uC678\uBD80\uC778\uC99D \uC11C\uBC84 \uC0AC\uC6A9",
          summary: "\uCF1C\uBA74 Windows/\uB3C4\uCEE4 \uC678\uBD80\uC778\uC99D \uC11C\uBC84\uB9CC \uC0AC\uC6A9\uD569\uB2C8\uB2E4. \uB044\uBA74 \uC774 \uAE30\uAE30\uC758 \uC228\uC740 WebView\uB97C \uC0AC\uC6A9\uD569\uB2C8\uB2E4.",
          value: false
        }
      },
      {
        key: "newtoki1_novel_external_auth_endpoint",
        editTextPreference: {
          title: "\uC678\uBD80\uC778\uC99D \uC11C\uBC84 \uC8FC\uC18C",
          summary: "Windows: localhost \uAC00\uB2A5 / \uBAA8\uBC14\uC77C: LAN, \uC5ED\uBC29\uD5A5 \uD504\uB85D\uC2DC \uB610\uB294 VPN \uC8FC\uC18C",
          value: "",
          dialogTitle: "\uC608: http://192.168.0.10:9870",
          dialogMessage: ""
        }
      },
      {
        key: "newtoki1_novel_external_auth_access_key",
        editTextPreference: {
          title: "\uC678\uBD80\uC778\uC99D \uC11C\uBC84 \uC811\uC18D \uD0A4 (\uC120\uD0DD)",
          summary: "\uC11C\uBC84\uC5D0 \uD0A4\uB97C \uC124\uC815\uD55C \uACBD\uC6B0\uB9CC \uC785\uB825",
          value: "",
          dialogTitle: "\uC811\uC18D \uD0A4",
          dialogMessage: ""
        }
      }
    ];
  }
}
