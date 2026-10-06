# Saxofaxo auf Cloudflare – Betriebshandbuch

**Stand: 06.10.2026 – LIVE auf saxofaxo.com.** Migration abgeschlossen.

## Architektur
- **Worker mit Static Assets** (`src/worker.js` + `public/`), Custom Domains
  `saxofaxo.com` + `www` (301 → Apex), workers.dev → 301 Apex.
- **Formular**: `/api/anfrage` mit Cloudflare Turnstile (Widget
  `0x4AAAAAAFPa16hr6B151VSQ`, Action `anfrage`, Hostname-Allowlist via
  `TURNSTILE_HOSTNAMES`). Jede Anfrage wird VOR dem Mailversand in KV
  gesichert (`anfrage-<zeitstempel>`).
- **Mails**: Brevo-API (Free-Tier) – Anfrage an Felix + Bestätigung an
  Kund*innen. KEIN Cloudflare Email Routing aktivieren (würde die
  IONOS-MX-Einträge kapern)!
- **Admin** (`/admin/`): Inhalte, anonyme Statistik und die
  **Anfragen-Pipeline** (Status, Absagegründe, Notizen, Löschen mit
  doppelter Nachfrage) – alles hinter `ADMIN_PASSWORD`.
- **KV**: CONTENT (Admin-Inhalte + Anfragen-Backups, 2 J. ab letzter
  Bearbeitung), STATS (aggregierte Tageszähler, 60 Tage).

## Deploys
- **Automatisch**: Push auf `main` → Workers-Builds-Integration
  (Root directory **`cloudflare`**, Deploy command `npx wrangler deploy`).
  ⚠️ Root directory niemals auf `/` stellen – dann wird der alte
  `site/`-Ordner als Assets-only-Worker deployed und überschreibt alles
  (inkl. Verlust der Secrets!).
- **Manuell**: `npx wrangler deploy` in diesem Ordner.
- Lokal testen: `npx wrangler dev --port 8643` (.dev.vars enthält
  Turnstile-TEST-Keys; Hostname-Prüfung lokal deaktiviert).

## Secrets (Worker `saxofaxo`)
`ADMIN_PASSWORD` · `TURNSTILE_SECRET_KEY` · `BREVO_API_KEY` –
setzen per `npx wrangler secret put <NAME>`. Nach Verlust (z. B. durch
einen Fehl-Build): Turnstile-Secret lässt sich per
`wrangler turnstile widget get <sitekey> --json` wiederholen, die anderen
beiden neu setzen.

## DNS (Zone in Felix' Cloudflare-Account)
- MX → IONOS (Postfach), SPF `include:_spf-eu.ionos.com` – **nie anfassen**.
- Brevo: CNAMEs `brevo1/brevo2._domainkey`, `mail.*`, TXT `brevo-code`, DMARC.
- Worker-Records für Apex + www verwaltet Cloudflare selbst.

## Historie / Legacy
- `site/` = letzter Netlify-Stand (Netlify-Site ist gelöscht); der
  Juli-Originalzustand liegt im ersten Git-Commit (`e3ee4a2`).
- Vollständige Projekthistorie: github.com/saxofaxo/website
