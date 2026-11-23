// Funnel-Check für saxofaxo.com
//
// Klickt das Anfrageformular auf Desktop und Handy, auf Deutsch und Englisch
// bis zum letzten Schritt durch – ohne abzusenden. Prüft dabei, ob jede
// Auswahlkarte lesbar ist (nichts Deckendes über dem Text, genug Kontrast),
// ob die Schritte weiterschalten und ob Spamschutz und Absende-Knopf da sind.
//
//   node funnel-check.mjs                      prüft https://saxofaxo.com
//   node funnel-check.mjs --base http://localhost:8643
//   node funnel-check.mjs --wait-deploy-only   wartet, bis der Repo-Stand live ist
//   node funnel-check.mjs --inject-bug         Selbsttest: muss rot werden
//
// Exit-Code 1 = Alarm. Screenshots landen in ./out/.

import { chromium, devices } from "playwright";
import { createHash } from "node:crypto";
import { readFile, mkdir, appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : fallback; };
const BASE = (arg("--base", "https://saxofaxo.com")).replace(/\/$/, "");
const WAIT_ONLY = args.includes("--wait-deploy-only");
const INJECT_BUG = args.includes("--inject-bug");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, "..", "cloudflare", "public");
const OUT = path.join(HERE, "out");

const problems = [];
const passed = [];
const fail = (where, msg) => { problems.push(`${where}: ${msg}`); console.log(`  ✗ ${where}: ${msg}`); };
const ok = (where, msg) => { passed.push(`${where}: ${msg}`); console.log(`  ✓ ${where}: ${msg}`); };

/* ---------- 1) Warten, bis Cloudflare den Repo-Stand ausliefert ---------- */
async function waitForDeploy() {
  const files = ["assets/css/style.css", "assets/js/main.js", "assets/js/ux.js", "assets/js/i18n.js"];
  const sha = (buf) => createHash("sha256").update(buf).digest("hex");
  const want = {};
  for (const f of files) want[f] = sha(await readFile(path.join(PUBLIC, f)));
  const kontakt = await readFile(path.join(PUBLIC, "kontakt/index.html"), "utf8");
  const versions = [...kontakt.matchAll(/(?:style\.css|main\.js|ux\.js|i18n\.js)\?v=[\w]+/g)].map((m) => m[0]);

  const started = Date.now();
  const limit = 12 * 60 * 1000;
  await new Promise((r) => setTimeout(r, 45000)); /* Build braucht mindestens eine halbe Minute */
  while (Date.now() - started < limit) {
    let match = true;
    try {
      for (const f of files) {
        const res = await fetch(`${BASE}/${f}?ci=${Date.now()}`, { cache: "no-store" });
        if (!res.ok || sha(Buffer.from(await res.arrayBuffer())) !== want[f]) { match = false; break; }
      }
      if (match) {
        const html = await (await fetch(`${BASE}/kontakt/?ci=${Date.now()}`, { cache: "no-store" })).text();
        match = versions.every((v) => html.includes(v));
      }
    } catch { match = false; }
    if (match) { console.log(`Neuer Stand ist live (nach ${Math.round((Date.now() - started) / 1000)} s).`); return; }
    await new Promise((r) => setTimeout(r, 15000));
  }
  fail("Deploy", "Der gepushte Stand ist nach 12 Minuten nicht live. Cloudflare-Build prüfen (Root-Verzeichnis muss „cloudflare“ sein).");
}

/* ---------- 2) Lesbarkeit einer Auswahlkarte (läuft im Browser) ---------- */
function checkCards(selector) {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(",").map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const bgOf = (el) => { for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0.5) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const out = [];
  const cards = [...document.querySelectorAll(selector)].filter((c) => c.offsetParent !== null);
  for (const card of cards) {
    const label = card.querySelector("label");
    const name = (label && label.innerText.trim().split("\n")[0]) || "(Karte ohne Text)";
    if (!label || !label.innerText.trim()) { out.push(`${name}: Karte hat keinen Text`); continue; }
    card.scrollIntoView({ block: "center" });
    const textEl = label.querySelector("strong") || label;
    const range = document.createRange(); range.selectNodeContents(textEl);
    const tr = range.getBoundingClientRect();
    if (tr.width < 4 || tr.height < 4) { out.push(`${name}: Text hat keine Fläche`); continue; }
    const x = tr.left + Math.min(12, tr.width / 2), y = tr.top + tr.height / 2;
    for (const el of document.elementsFromPoint(x, y)) {
      if (el === label || label.contains(el)) break;
      const cs = getComputedStyle(el);
      const c = parse(cs.backgroundColor);
      const opaque = (c && c.a > 0.05) || cs.backgroundImage !== "none";
      if (opaque && parseFloat(cs.opacity) > 0.05 && cs.visibility !== "hidden") {
        out.push(`${name}: Text verdeckt von <${el.tagName.toLowerCase()} class="${el.className}"> (${cs.backgroundColor})`);
        break;
      }
    }
    const fg = parse(getComputedStyle(textEl).color), bg = bgOf(label);
    if (fg && fg.a > 0.2) {
      const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      if (ratio < 3) out.push(`${name}: Kontrast nur ${ratio.toFixed(2)}:1`);
    } else out.push(`${name}: Text unsichtbar (Farbe ${getComputedStyle(textEl).color})`);
  }
  return { count: cards.length, problems: out };
}

/* ---------- 3) Ein Durchgang: ein Gerät, eine Sprache ---------- */
async function run(browser, device, lang) {
  const where = `${device.name} ${lang.toUpperCase()}`;
  console.log(`\n${where}`);
  const ctx = await browser.newContext({ ...device.opts, locale: lang === "en" ? "en-US" : "de-DE" });
  await ctx.addInitScript(() => { try { localStorage.setItem("saxofaxo-consent-info", "1"); } catch (e) {} });
  /* Felix' Statistik sauber halten: keine Zählung durch den Test */
  await ctx.route("**/api/stats", (r) => r.fulfill({ status: 204, body: "" }));
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && (m.location().url || "").startsWith(BASE)) jsErrors.push(m.text()); });
  const shot = (step) => page.screenshot({ path: path.join(OUT, `${device.key}-${lang}-${step}.png`), fullPage: false });

  try {
    const res = await page.goto(`${BASE}/kontakt/`, { waitUntil: "load" });
    if (!res || !res.ok()) { fail(where, `Anfrageseite antwortet mit ${res ? res.status() : "nichts"}`); return; }
    if (INJECT_BUG) await page.addStyleTag({ content: ".funnel .choice input[type]{background:#fff !important}" });
    await page.waitForTimeout(600);

    /* Schritt 1: Anlass */
    const s1 = await page.evaluate(checkCards, 'fieldset[data-step="1"] .choice');
    await shot("1-anlass");
    if (s1.count < 4) fail(where, `Schritt 1 zeigt nur ${s1.count} Anlass-Karten`);
    else if (s1.problems.length) s1.problems.forEach((p) => fail(where, "Schritt 1 · " + p));
    else ok(where, `Schritt 1: ${s1.count} Anlass-Karten lesbar`);

    await page.locator('fieldset[data-step="1"] .choice input').first().click();
    await page.waitForSelector('fieldset[data-step="2"].active', { timeout: 4000 }).catch(() => {});
    if (!(await page.$('fieldset[data-step="2"].active'))) {
      await page.locator('fieldset[data-step="1"] [data-next]').click().catch(() => {});
      await page.waitForSelector('fieldset[data-step="2"].active', { timeout: 4000 }).catch(() => {});
    }
    if (!(await page.$('fieldset[data-step="2"].active'))) { fail(where, "Nach Auswahl des Anlasses kommt Schritt 2 nicht"); await shot("2-fehlt"); return; }

    /* Schritt 2: Format und Eckdaten */
    await page.waitForTimeout(400);
    const s2 = await page.evaluate(checkCards, 'fieldset[data-step="2"] .choice');
    await shot("2-details");
    if (s2.count < 8) fail(where, `Schritt 2 zeigt nur ${s2.count} Format-Karten`);
    else if (s2.problems.length) s2.problems.forEach((p) => fail(where, "Schritt 2 · " + p));
    else ok(where, `Schritt 2: ${s2.count} Format-Karten lesbar`);

    await page.locator("#fmt-dj").click();
    if (!(await page.locator("#fmt-dj").isChecked())) fail(where, "Format „DJ + Sax“ lässt sich nicht auswählen");
    const future = new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10);
    await page.locator("#f-datum").fill(future);
    await page.locator("#f-ort").fill("49074 Osnabrück");
    await page.locator("#f-gaeste").selectOption({ index: 2 });
    await page.locator('fieldset[data-step="2"] [data-next]').click();
    await page.waitForSelector('fieldset[data-step="3"].active', { timeout: 4000 }).catch(() => {});
    if (!(await page.$('fieldset[data-step="3"].active'))) { fail(where, "Schritt 2 schaltet trotz vollständiger Angaben nicht weiter"); await shot("3-fehlt"); return; }

    /* Schritt 3: Kontakt (nicht absenden) */
    await page.waitForTimeout(400);
    await shot("3-kontakt");
    const s3 = await page.evaluate(() => {
      const vis = (el) => !!el && el.offsetParent !== null && el.getBoundingClientRect().height > 10;
      const miss = [];
      for (const n of ["name", "email", "telefon", "nachricht"]) if (!vis(document.querySelector(`[name="${n}"]`))) miss.push(`Feld „${n}“`);
      if (!vis(document.querySelector('[name="datenschutz"]'))) miss.push("Datenschutz-Häkchen");
      const btn = document.querySelector('fieldset[data-step="3"] [type="submit"]');
      if (!vis(btn) || btn.disabled) miss.push("Absende-Knopf");
      return miss;
    });
    if (s3.length) s3.forEach((m) => fail(where, `Schritt 3: ${m} fehlt oder ist unsichtbar`));
    else ok(where, "Schritt 3: Felder, Häkchen und Absende-Knopf da");

    const turnstile = await page.waitForSelector(".cf-turnstile iframe, .cf-turnstile input[name='cf-turnstile-response']", { timeout: 20000, state: "attached" }).catch(() => null);
    if (!turnstile) fail(where, "Spamschutz (Turnstile) lädt nicht – ohne ihn kann niemand absenden");
    else ok(where, "Spamschutz (Turnstile) geladen");
    await shot("3-spamschutz");
  } catch (e) {
    fail(where, "Abbruch: " + e.message.split("\n")[0]);
    await shot("abbruch").catch(() => {});
  } finally {
    if (jsErrors.length) jsErrors.slice(0, 3).forEach((m) => fail(where, "JavaScript-Fehler: " + m.slice(0, 160)));
    await ctx.close();
  }
}

/* ---------- Ablauf ---------- */
await mkdir(OUT, { recursive: true });
if (WAIT_ONLY) {
  await waitForDeploy();
} else {
  const browser = await chromium.launch();
  const DEVICES = [
    { key: "desktop", name: "Desktop", opts: { viewport: { width: 1440, height: 900 } } },
    { key: "handy", name: "Handy", opts: { ...devices["iPhone 13"] } },
  ];
  for (const d of DEVICES) for (const l of ["de", "en"]) await run(browser, d, l);
  await browser.close();
}

const summary = [
  `## Funnel-Check ${problems.length ? "❌ Alarm" : "✅ in Ordnung"}`,
  `Geprüft: ${BASE}${INJECT_BUG ? " (Selbsttest mit absichtlichem Fehler)" : ""}`,
  "",
  ...(problems.length ? ["**Probleme:**", ...problems.map((p) => `- ${p}`), ""] : []),
  ...passed.map((p) => `- ✓ ${p}`),
].join("\n");
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
console.log("\n" + (problems.length ? `ALARM: ${problems.length} Problem(e)` : "Alles in Ordnung."));
process.exit(problems.length ? 1 : 0);
