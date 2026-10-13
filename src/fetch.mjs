// Pobieranie stron. Dwa tryby: zwykly fetch (tani, szybki) i Chromium przez
// Playwright (drogi, ale radzi sobie z renderowaniem po stronie klienta).
// Chromium wstaje LENIWIE i jest wspoldzielony miedzy wszystkie zrodla w runie -
// osobna instancja na kazdy URL kosztowala 40 s przy piecu produktach.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const HEADERS = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Upgrade-Insecure-Requests": "1",
};

const WALL = /just a moment|cierpliwo[sś]ci|przejd[zź] do ceneo|kontynuowa[cć] zakup/i;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function plainFetch(url, { timeoutMs = 25000, retries = 1 } = {}) {
  let last = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: HEADERS, redirect: "follow", signal: ac.signal });
      clearTimeout(t);
      const body = await res.text();
      if (res.ok) return { ok: true, status: res.status, html: body, finalUrl: res.url || url, via: "fetch" };
      last = { ok: false, status: res.status, html: body, finalUrl: res.url || url, via: "fetch" };
      // 4xx sie nie naprawi przez powtorzenie; 5xx i 429 bywa chwilowe.
      if (res.status < 500 && res.status !== 429) return last;
    } catch (e) {
      clearTimeout(t);
      last = { ok: false, status: 0, html: "", finalUrl: url, via: "fetch", error: String(e && e.message || e) };
    }
    if (attempt < retries) await sleep(1500 * (attempt + 1));
  }
  return last;
}

let _browser = null;
let _playwright = null;

async function getBrowser() {
  if (_browser) return _browser;
  if (!_playwright) {
    try {
      _playwright = await import("playwright");
    } catch (e) {
      throw new Error("Playwright niedostepny: " + (e && e.message));
    }
  }
  // Na Actions przegladarka chodzi z oknem na wirtualnym ekranie (xvfb-run) i
  // jako zainstalowany Chrome, nie dolaczony Chromium. Wzor z car-watch: bid.cars
  // za Cloudflare dawal headless 403, a ten sam Chrome z oknem przechodzil
  // nieinteraktywne sprawdzenie. Captchy nie rozwiazujemy - taka strona konczy
  // sie jako "blocked".
  const headless = process.env.UPS_WATCH_HEADFUL !== "1";
  const channel = process.env.UPS_WATCH_CHROME_CHANNEL || undefined;
  const opts = { headless, args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"] };
  try {
    _browser = await _playwright.chromium.launch({ ...opts, channel });
  } catch (e) {
    if (!channel) throw e;
    console.log(`  [fetch] Chrome (${channel}) nie wstal, zostaje dolaczony Chromium: ${String(e && e.message).split("\n")[0]}`);
    _browser = await _playwright.chromium.launch(opts);
  }
  return _browser;
}

export async function closeBrowser() {
  if (_browser) {
    try { await _browser.close(); } catch { /* i tak konczymy proces */ }
    _browser = null;
  }
}

export async function browserFetch(url, { timeoutMs = 40000, waitFor = null } = {}) {
  let ctx = null;
  try {
    const browser = await getBrowser();
    ctx = await browser.newContext({
      userAgent: UA,
      locale: "pl-PL",
      timezoneId: "Europe/Warsaw",
      viewport: { width: 1366, height: 900 },
      extraHTTPHeaders: { "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8" },
    });
    const page = await ctx.newPage();
    // Obrazy i fonty to polowa transferu i zero wartosci przy czytaniu ceny.
    await page.route("**/*", (route) => {
      const t = route.request().resourceType();
      if (t === "image" || t === "font" || t === "media") return route.abort();
      return route.continue();
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    if (waitFor) {
      try { await page.waitForSelector(waitFor, { timeout: 8000 }); } catch { /* i tak czytamy co jest */ }
    } else {
      try { await page.waitForLoadState("networkidle", { timeout: 8000 }); } catch { /* jw. */ }
    }
    const html = await page.content();
    const finalUrl = page.url();
    return { ok: true, status: 200, html, finalUrl, via: "browser" };
  } catch (e) {
    return { ok: false, status: 0, html: "", finalUrl: url, via: "browser", error: String(e && e.message || e) };
  } finally {
    if (ctx) { try { await ctx.close(); } catch { /* jw. */ } }
  }
}

// Zwykly fetch, a gdy odbije sie od ochrony albo odda pusty szkielet - Chromium.
export async function smartFetch(url, { needsBrowser = false, waitFor = null } = {}) {
  // Skan lokalny leci bez Chromium - na maszynie uzytkownika pakiet playwright
  // jest, ale binarka przegladarki juz nie, a instalowanie jej tylko po to,
  // zeby zapytac o cene, byloby absurdem. Bez tej flagi kazde zrodlo
  // needsBrowser konczylo sie krzykliwym "Playwright niedostepny".
  const noBrowser = process.env.UPS_WATCH_NO_BROWSER === "1";
  if (needsBrowser) {
    if (noBrowser) return { ok: false, status: 0, html: "", finalUrl: url, via: "fetch",
      error: "zrodlo wymaga przegladarki, a skan lokalny jej nie uzywa" };
    return browserFetch(url, { waitFor });
  }

  const r = await plainFetch(url);
  if (noBrowser) return r;
  const blocked = !r.ok && [401, 403, 406, 429, 503].includes(r.status);
  const thin = r.ok && r.html && r.html.length < 2000;
  // Strona posrednia z kodem 200 (Ceneo "Przejdz do Ceneo", Amazon "Kontynuuj
  // zakupy") tez zasluguje na druga probe przez przegladarke.
  const wall = r.ok && r.html && r.html.length < 30000 && WALL.test(r.html);
  if (blocked || thin || wall || (!r.ok && r.status === 0)) {
    const b = await browserFetch(url, { waitFor });
    if (b.ok) return { ...b, escalatedFrom: r.status };
    return r.ok ? r : b;
  }
  return r;
}
