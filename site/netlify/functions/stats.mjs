import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

/* Saxofaxo – eigene, anonyme Reichweitenmessung
 *
 * POST /api/stats  <- Beacon der Website (Seitenaufruf oder Ereignis).
 *                     Gespeichert werden ausschließlich aggregierte Tageszähler:
 *                     Seitenpfad, Referrer-DOMAIN (nie volle URL), Sprache,
 *                     Ereignisname. KEINE IP-Adressen, keine User-Agents,
 *                     keine Kennungen einzelner Besucher.
 * GET  /api/stats  <- Auswertung der letzten 30 Tage (nur mit ADMIN_PASSWORD).
 */

const DAY_MS = 86400000;

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

const clean = (v, max, re) => String(v || "").slice(0, max).replace(re, "");

export default async (req) => {
  const store = getStore("saxofaxo-stats");

  if (req.method === "POST") {
    let b;
    try { b = await req.json(); } catch { return new Response(null, { status: 400 }); }
    const day = new Date().toISOString().slice(0, 10);
    const key = "d-" + day;
    const data = (await store.get(key, { type: "json" })) || { total: 0, visits: 0, pv: {}, ref: {}, lang: {}, ev: {} };

    const bump = (obj, k) => { if (k) obj[k] = (obj[k] || 0) + 1; };
    if (b.e) {
      // Ereignis (z. B. funnel_step_2, funnel_submit)
      if (Object.keys(data.ev).length < 50) bump(data.ev, clean(b.e, 40, /[^\w-]/g));
    } else {
      data.total++;
      if (b.v) data.visits++;
      if (Object.keys(data.pv).length < 100) bump(data.pv, clean(b.p, 80, /[^\w\-/]/g) || "/");
      if (Object.keys(data.ref).length < 100) bump(data.ref, clean(b.r, 80, /[^\w.\-]/g));
      bump(data.lang, b.l === "en" ? "en" : "de");
    }
    await store.setJSON(key, data);
    return new Response(null, { status: 204 });
  }

  if (req.method === "GET") {
    const pw = req.headers.get("x-admin-password") || "";
    if (!passwordOk(pw, process.env.ADMIN_PASSWORD || "")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    const out = {};
    const now = Date.now();
    const reads = [];
    for (let i = 0; i < 30; i++) {
      const day = new Date(now - i * DAY_MS).toISOString().slice(0, 10);
      reads.push(store.get("d-" + day, { type: "json" }).then((d) => { if (d) out[day] = d; }));
    }
    await Promise.all(reads);
    return Response.json(out, { headers: { "cache-control": "no-store" } });
  }

  return new Response("Method Not Allowed", { status: 405 });
};

export const config = { path: "/api/stats" };
