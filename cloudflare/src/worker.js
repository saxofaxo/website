/* SAXOFAXO – Cloudflare Worker (Static Assets + API)
 *
 * Statische Seite kommt aus /public (Assets-first-Routing); der Worker
 * beantwortet nur, was kein Asset ist:
 *
 *   GET  /api/content  -> aktueller Admin-Inhalt (öffentlich)
 *   POST /api/content  -> Inhalt speichern (ADMIN_PASSWORD)
 *   POST /api/stats    -> anonymer Zähl-Beacon (aggregierte Tageszähler)
 *   GET  /api/stats    -> Auswertung 30 Tage (ADMIN_PASSWORD)
 *   POST /api/anfrage  -> Kontaktformular: Turnstile-Prüfung, KV-Backup,
 *                         Mail an Felix + Bestätigung an Anfragende
 *
 * Bindings (wrangler.jsonc): CONTENT (KV), STATS (KV), EMAIL (send_email)
 * Secrets: ADMIN_PASSWORD, TURNSTILE_SECRET_KEY
 */

const MAIL_FROM = { email: "info@saxofaxo.com", name: "Saxofaxo · Felix Tönnies" };
const MAIL_TO_FELIX = "info@saxofaxo.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ---------- Auth: timing-sicherer Passwortvergleich ---------- */
async function passwordOk(given, expected) {
  if (!given || !expected) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(given)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

/* ---------- Brute-Force-Bremse (pro Isolate, best effort) ---------- */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;
const fails = new Map();
function tooManyFails(ip) {
  const e = fails.get(ip);
  return !!e && Date.now() - e.t < WINDOW_MS && e.n >= MAX_FAILS;
}
function recordFail(ip) {
  const now = Date.now();
  const e = fails.get(ip);
  if (e && now - e.t < WINDOW_MS) e.n++;
  else fails.set(ip, { n: 1, t: now });
  if (fails.size > 1000) fails.clear();
}

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...extra },
  });

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const urlStr = (v) => {
  const s = str(v, 300);
  return /^https?:\/\//i.test(s) ? s : "";
};

/* ================= /api/content ================= */
function sanitizeContent(body) {
  const b = body || {};
  const banner = b.banner || {};
  const release = b.release || {};
  const refs = Array.isArray(b.refs) ? b.refs : [];
  return {
    banner: {
      on: banner.on === true,
      text: str(banner.text, 180),
      link: urlStr(banner.link),
      linkLabel: str(banner.linkLabel, 60),
    },
    release: {
      title: str(release.title, 90),
      artists: str(release.artists, 90),
      lede: str(release.lede, 300),
      link: urlStr(release.link),
    },
    refs: refs.slice(0, 40).map((r) => str(r, 60)).filter(Boolean),
    updated: new Date().toISOString(),
  };
}

async function handleContent(req, env, ip) {
  if (req.method === "GET") {
    const data = await env.CONTENT.get("site", { type: "json" });
    return json(data || {});
  }
  if (req.method === "POST") {
    if (tooManyFails(ip)) return json({ error: "too many attempts" }, 429, { "retry-after": "900" });
    const pw = req.headers.get("x-admin-password") || "";
    if (!(await passwordOk(pw, env.ADMIN_PASSWORD || ""))) {
      recordFail(ip);
      return json({ error: "unauthorized" }, 401);
    }
    fails.delete(ip);
    let body;
    try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
    if (body && body.op === "verify") return json({ ok: true });
    await env.CONTENT.put("site", JSON.stringify(sanitizeContent(body)));
    return json({ ok: true });
  }
  return new Response("Method Not Allowed", { status: 405 });
}

/* ================= /api/stats ================= */
const clean = (v, max, re) => String(v || "").slice(0, max).replace(re, "");

async function handleStats(req, env, ip) {
  if (req.method === "POST") {
    let b;
    try { b = await req.json(); } catch { return new Response(null, { status: 400 }); }
    const day = new Date().toISOString().slice(0, 10);
    const key = "d-" + day;
    const data = (await env.STATS.get(key, { type: "json" })) || { total: 0, visits: 0, pv: {}, ref: {}, lang: {}, ev: {} };
    const bump = (obj, k) => { if (k) obj[k] = (obj[k] || 0) + 1; };
    if (b.e) {
      if (Object.keys(data.ev).length < 50) bump(data.ev, clean(b.e, 40, /[^\w-]/g));
    } else {
      data.total++;
      if (b.v) data.visits++;
      if (Object.keys(data.pv).length < 100) bump(data.pv, clean(b.p, 80, /[^\w\-/]/g) || "/");
      if (Object.keys(data.ref).length < 100) bump(data.ref, clean(b.r, 80, /[^\w.\-]/g));
      bump(data.lang, b.l === "en" ? "en" : "de");
    }
    // KV ist eventual consistent – bei gleichzeitigen Schreibzugriffen können
    // einzelne Zählungen verloren gehen. Für diese Größenordnung in Ordnung.
    await env.STATS.put(key, JSON.stringify(data), { expirationTtl: 60 * 60 * 24 * 60 });
    return new Response(null, { status: 204 });
  }
  if (req.method === "GET") {
    if (tooManyFails(ip)) return json({ error: "too many attempts" }, 429, { "retry-after": "900" });
    const pw = req.headers.get("x-admin-password") || "";
    if (!(await passwordOk(pw, env.ADMIN_PASSWORD || ""))) {
      recordFail(ip);
      return json({ error: "unauthorized" }, 401);
    }
    fails.delete(ip);
    const out = {};
    const now = Date.now();
    await Promise.all(
      Array.from({ length: 30 }, (_, i) => {
        const day = new Date(now - i * 86400000).toISOString().slice(0, 10);
        return env.STATS.get("d-" + day, { type: "json" }).then((d) => { if (d) out[day] = d; });
      })
    );
    return json(out);
  }
  return new Response("Method Not Allowed", { status: 405 });
}

/* ================= /api/anfrage ================= */

/* Transaktionsmails über Brevo (Free-Tier). Ohne BREVO_API_KEY wird der
 * Versand nur geloggt und übersprungen – die Anfrage liegt dann trotzdem
 * im KV-Backup. Absenderdomain muss bei Brevo authentifiziert sein. */
async function sendMail(env, msg, label) {
  if (!env.BREVO_API_KEY) {
    console.log("mail:", label, "übersprungen – BREVO_API_KEY nicht gesetzt");
    return false;
  }
  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json",
        "accept": "application/json",
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        sender: { email: MAIL_FROM.email, name: MAIL_FROM.name },
        ...msg,
      }),
    });
    if (!r.ok) {
      console.log("mail:", label, "fehlgeschlagen – Brevo", r.status, (await r.text()).slice(0, 200));
      return false;
    }
    return true;
  } catch (e) {
    console.log("mail:", label, "fehlgeschlagen –", e && e.message);
    return false;
  }
}
function mailTexts(lang, name, summary) {
  const anrede = name ? (lang === "en" ? `Hello ${name},` : `Hallo ${name},`) : (lang === "en" ? "Hello," : "Hallo,");
  if (lang === "en") {
    return {
      subject: "Your enquiry has been received | Saxofaxo",
      text: `${anrede}\n\nthank you for your enquiry – it has arrived safely.\n${summary ? `\nYour request: ${summary}\n` : ""}\nYou will usually receive a personal offer within 24 hours. If anything is urgent, you can reach me directly:\n\ninfo@saxofaxo.com · +49 173 9265526\n\nBest regards\nFelix Tönnies · Saxofaxo\nhttps://saxofaxo.com`,
    };
  }
  return {
    subject: "Ihre Anfrage ist eingegangen | Saxofaxo",
    text: `${anrede}\n\nvielen Dank für Ihre Anfrage – sie ist sicher bei mir angekommen.\n${summary ? `\nIhre Anfrage: ${summary}\n` : ""}\nIn der Regel erhalten Sie innerhalb von 24 Stunden ein persönliches Angebot. Wenn es eilig ist, erreichen Sie mich auch direkt:\n\ninfo@saxofaxo.com · +49 173 9265526\n\nHerzliche Grüße\nFelix Tönnies · Saxofaxo\nhttps://saxofaxo.com`,
  };
}

/* Kanonische Siteverify-Prüfung (nach developers.cloudflare.com/turnstile/spin):
 * success === true  UND  erwartete Action  UND  erlaubter Frontend-Hostname.
 * Action-/Hostname-Prüfung greift, sobald TURNSTILE_HOSTNAMES gesetzt ist
 * (Produktion via wrangler.jsonc); lokal mit Test-Keys bleibt sie aus. */
const TURNSTILE_ACTION = "anfrage";

async function verifyTurnstile(token, env, ip) {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, reason: "no-secret" };
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return { ok: false, reason: "bad-token" };
  }
  let d;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    if (!r.ok) return { ok: false, reason: "siteverify-" + r.status };
    d = await r.json();
  } catch (e) {
    return { ok: false, reason: "siteverify-unreachable" };
  }
  if (d.success !== true) return { ok: false, reason: (d["error-codes"] || []).join(",") };
  const hostnames = String(env.TURNSTILE_HOSTNAMES || "").split(",").map((h) => h.trim()).filter(Boolean);
  if (hostnames.length) {
    if (!hostnames.includes(d.hostname)) return { ok: false, reason: "hostname:" + d.hostname };
    if (d.action !== TURNSTILE_ACTION) return { ok: false, reason: "action:" + (d.action || "leer") };
  }
  return { ok: true, reason: "" };
}

async function handleAnfrage(req, env, ip) {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const back = (q) => new Response(null, { status: 303, headers: { location: "/kontakt/?" + q } });

  let form;
  try { form = await req.formData(); } catch { return back("fehler=1"); }
  const f = (n, max = 300) => str(form.get(n), max);

  // Honeypot: still verwerfen, aber wie Erfolg behandeln
  if (f("bot-field", 50)) return new Response(null, { status: 303, headers: { location: "/danke/" } });

  const turnstile = await verifyTurnstile(form.get("cf-turnstile-response"), env, ip);
  if (!turnstile.ok) {
    console.log("anfrage: turnstile abgelehnt:", turnstile.reason);
    return back("fehler=captcha");
  }

  const email = f("email", 200);
  const name = f("name", 120);
  if (!EMAIL_RE.test(email) || name.length < 2) return back("fehler=1");

  const data = {
    anlass: f("anlass", 60),
    format: f("format", 200),
    datum: f("datum", 20),
    ort: f("ort", 160),
    location: f("location", 200),
    gaeste: f("gaeste", 30),
    name,
    email,
    telefon: f("telefon", 60),
    nachricht: f("nachricht", 4000),
    zusammenfassung: f("zusammenfassung", 300),
    sprache: f("sprache", 5) === "en" ? "en" : "de",
    eingegangen: new Date().toISOString(),
    status: "neu",
    grund: "",
    notiz: "",
  };

  // 1) Backup in KV – die Anfrage ist gesichert, bevor irgendeine Mail rausgeht
  const backupKey = "anfrage-" + data.eingegangen + "-" + crypto.randomUUID().slice(0, 8);
  await env.CONTENT.put(backupKey, JSON.stringify(data), { expirationTtl: 60 * 60 * 24 * 365 });

  // 2) Mail an Felix
  const felixText =
    `Neue Anfrage über saxofaxo.com\n\n` +
    Object.entries({
      Anlass: data.anlass, Format: data.format, Datum: data.datum, "Ort/PLZ": data.ort,
      Location: data.location, "Gäste": data.gaeste, Name: data.name, "E-Mail": data.email,
      Telefon: data.telefon, Sprache: data.sprache,
    }).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n") +
    (data.nachricht ? `\n\nNachricht:\n${data.nachricht}` : "") +
    `\n\n– Backup gespeichert unter ${backupKey}`;

  await sendMail(env, {
    to: [{ email: MAIL_TO_FELIX }],
    replyTo: { email: data.email, name: data.name },
    subject: f("subject", 200) || ("Neue Anfrage: " + (data.zusammenfassung || data.name)),
    textContent: felixText,
  }, "Mail an Felix");

  // 3) Bestätigung an Anfragende
  const m = mailTexts(data.sprache, data.name, data.zusammenfassung);
  await sendMail(env, {
    to: [{ email: data.email, name: data.name }],
    replyTo: { email: MAIL_TO_FELIX },
    subject: m.subject,
    textContent: m.text,
  }, "Bestätigungsmail");

  return new Response(null, { status: 303, headers: { location: "/danke/" } });
}

/* ================= /api/anfragen (Admin: Pipeline-Bearbeitung) ================= */
const ANFRAGE_STATI = ["neu", "angebot", "gebucht", "gespielt", "abgesagt"];
const ABSAGE_GRUENDE = ["zu-teuer", "termin-vergeben", "keine-rueckmeldung", "anderweitig-vergeben", "sonstiges"];
const ANFRAGE_TTL = 60 * 60 * 24 * 730; // 2 Jahre ab letzter Bearbeitung

async function handleAnfragen(req, env, ip) {
  if (tooManyFails(ip)) return json({ error: "too many attempts" }, 429, { "retry-after": "900" });
  const pw = req.headers.get("x-admin-password") || "";
  if (!(await passwordOk(pw, env.ADMIN_PASSWORD || ""))) {
    recordFail(ip);
    return json({ error: "unauthorized" }, 401);
  }
  fails.delete(ip);

  if (req.method === "GET") {
    const list = await env.CONTENT.list({ prefix: "anfrage-" });
    const items = await Promise.all(
      list.keys.map((k) => env.CONTENT.get(k.name, { type: "json" }).then((v) => v && { key: k.name, ...v }))
    );
    items.sort((a, b) => String(b && b.eingegangen).localeCompare(String(a && a.eingegangen)));
    return json(items.filter(Boolean));
  }

  if (req.method === "DELETE") {
    let b;
    try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
    const key = String(b.key || "");
    if (!key.startsWith("anfrage-")) return json({ error: "bad key" }, 400);
    await env.CONTENT.delete(key);
    return json({ ok: true });
  }

  if (req.method === "POST") {
    let b;
    try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
    const key = String(b.key || "");
    if (!key.startsWith("anfrage-")) return json({ error: "bad key" }, 400);
    const cur = await env.CONTENT.get(key, { type: "json" });
    if (!cur) return json({ error: "not found" }, 404);
    const status = ANFRAGE_STATI.includes(b.status) ? b.status : cur.status || "neu";
    cur.status = status;
    cur.grund = status === "abgesagt" && ABSAGE_GRUENDE.includes(b.grund) ? b.grund : "";
    cur.notiz = str(b.notiz, 1000);
    cur.bearbeitet = new Date().toISOString();
    await env.CONTENT.put(key, JSON.stringify(cur), { expirationTtl: ANFRAGE_TTL });
    return json({ ok: true });
  }

  return new Response("Method Not Allowed", { status: 405 });
}

/* ================= Router ================= */
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    // www -> Apex (301), damit es genau eine kanonische Adresse gibt
    if (url.hostname === "www.saxofaxo.com" || url.hostname === "saxofaxo.toennies-felix.workers.dev") {
      url.hostname = "saxofaxo.com";
      return Response.redirect(url.toString(), 301);
    }
    const ip = req.headers.get("cf-connecting-ip") || "unknown";
    if (url.pathname === "/api/content") return handleContent(req, env, ip);
    if (url.pathname === "/api/stats") return handleStats(req, env, ip);
    if (url.pathname === "/api/anfrage") return handleAnfrage(req, env, ip);
    if (url.pathname === "/api/anfragen") return handleAnfragen(req, env, ip);
    // Alles andere: statische Assets (inkl. 404-Seite und _headers)
    return env.ASSETS.fetch(req);
  },
};
