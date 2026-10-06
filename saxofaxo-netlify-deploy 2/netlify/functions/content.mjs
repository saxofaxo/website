import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

/* Saxofaxo Content-API
 * GET  /api/content -> aktueller Inhalt (öffentlich, für die Website)
 * POST /api/content -> Inhalt speichern (nur mit ADMIN_PASSWORD)
 */

/* Brute-Force-Bremse: max. 10 Fehlversuche pro IP in 15 Minuten.
 * In-Memory, d. h. pro Function-Instanz – als erste Hürde ausreichend,
 * das eigentliche Geheimnis bleibt das Passwort in der Env-Variable. */
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

function passwordOk(given, expected) {
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const url = (v) => {
  const s = str(v, 300);
  return /^https?:\/\//i.test(s) ? s : "";
};

function sanitize(body) {
  const b = body || {};
  const banner = b.banner || {};
  const release = b.release || {};
  const refs = Array.isArray(b.refs) ? b.refs : [];
  return {
    banner: {
      on: banner.on === true,
      text: str(banner.text, 180),
      link: url(banner.link),
      linkLabel: str(banner.linkLabel, 60),
    },
    release: {
      title: str(release.title, 90),
      artists: str(release.artists, 90),
      lede: str(release.lede, 300),
      link: url(release.link),
    },
    refs: refs.slice(0, 40).map((r) => str(r, 60)).filter(Boolean),
    updated: new Date().toISOString(),
  };
}

export default async (req) => {
  const store = getStore("saxofaxo-content");

  if (req.method === "GET") {
    const data = await store.get("site", { type: "json" });
    return Response.json(data || {}, {
      headers: { "cache-control": "no-store" },
    });
  }

  if (req.method === "POST") {
    const ip = req.headers.get("x-nf-client-connection-ip") || "unknown";
    if (tooManyFails(ip)) {
      return new Response(JSON.stringify({ error: "too many attempts" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "900" },
      });
    }
    const pw = req.headers.get("x-admin-password") || "";
    const expected = process.env.ADMIN_PASSWORD || "";
    if (!passwordOk(pw, expected)) {
      recordFail(ip);
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    fails.delete(ip);
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "bad json" }), { status: 400 });
    }
    if (body && body.op === "verify") return Response.json({ ok: true });
    await store.setJSON("site", sanitize(body));
    return Response.json({ ok: true });
  }

  return new Response("Method Not Allowed", { status: 405 });
};

export const config = { path: "/api/content" };
