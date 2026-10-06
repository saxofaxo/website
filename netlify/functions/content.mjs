import { getStore } from "@netlify/blobs";

/* Saxofaxo Content-API
 * GET  /api/content -> aktueller Inhalt (öffentlich, für die Website)
 * POST /api/content -> Inhalt speichern (nur mit ADMIN_PASSWORD)
 */

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
    const pw = req.headers.get("x-admin-password") || "";
    const expected = process.env.ADMIN_PASSWORD || "";
    if (!expected || pw !== expected) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
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
