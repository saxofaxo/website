# Saxofaxo → Cloudflare: Go-Live-Fahrplan

Die Code-Seite ist fertig und lokal komplett getestet (Formular + Turnstile +
Mails + Admin + Statistik). Dieser Fahrplan führt vom getesteten Stand zum
Livegang. Netlify bleibt bis Schritt 8 unangetastet online – kein Risiko.

Lokal testen: `npx wrangler dev --port 8643` in diesem Ordner
(nutzt .dev.vars mit Turnstile-TEST-Keys und lokaler KV).

## 1. Einmalig: Anmelden
```bash
cd /Users/pasqualesgro/Downloads/saxofaxo-website/cloudflare
npx wrangler login
```
(Browser öffnet sich, bei Cloudflare freigeben.)

## 2. KV-Namespaces anlegen
```bash
npx wrangler kv namespace create CONTENT
npx wrangler kv namespace create STATS
```
Die beiden ausgegebenen IDs in `wrangler.jsonc` bei
`WIRD_BEIM_SETUP_ERSETZT` eintragen.

## 3. Turnstile-Widget anlegen (Dashboard)
Cloudflare-Dashboard → Turnstile → Add widget → Domain `saxofaxo.com`,
Modus „Managed".
- **Site Key** → in `public/kontakt/index.html` den TEST-Key
  `1x00000000000000000000AA` ersetzen (TODO-Kommentar markiert die Stelle).
  ⚠️ Der Test-Key lässt ALLES durch – niemals live lassen!
- **Secret Key** → `npx wrangler secret put TURNSTILE_SECRET_KEY`

## 4. Admin-Passwort setzen
```bash
npx wrangler secret put ADMIN_PASSWORD
```
(Dasselbe Passwort wie bisher bei Netlify – Felix' Login bleibt gleich.)

## 5. E-Mail-Versand aktivieren
```bash
npx wrangler email sending enable saxofaxo.com
```
Erzeugt DNS-Einträge (DKIM/SPF) – dafür muss die Domain in Cloudflare-DNS
liegen (Schritt 7 ggf. vorziehen).
⚠️ **WICHTIG:** Das Postfach info@saxofaxo.com sendet weiter über den
bisherigen Mail-Anbieter. Der bestehende SPF-Eintrag darf nur ERWEITERT,
nie ersetzt werden – sonst landen Felix' normale Mails im Spam.

## 6. Admin-Inhalte übernehmen
```bash
curl -s https://saxofaxo.com/api/content > content-backup.json
npx wrangler kv key put site --path content-backup.json --binding CONTENT --remote
```
(Statistik-Historie: 30-Tage-Fenster, Neuanfang ist verschmerzbar.)

## 7. Deploy + Test auf workers.dev
```bash
npx wrangler deploy
```
Auf der ausgegebenen *.workers.dev-URL einmal komplett testen:
Startseite, Admin-Login, **eine echte Testanfrage** (kommen beide Mails an?).

## 8. Domain umschalten
Dashboard → Worker `saxofaxo` → Settings → Domains & Routes →
Custom Domain `saxofaxo.com` + `www.saxofaxo.com`.
Dafür muss saxofaxo.com als Zone in Cloudflare liegen (Nameserver beim
Registrar auf Cloudflare umstellen, Cloudflare importiert die DNS-Einträge –
**MX-/Mail-Einträge kontrollieren**, damit das Postfach weiterläuft).
⚠️ Dashboard-Einstellung prüfen: **„Block AI bots" DEAKTIVIEREN**
(AI-Crawler sind bewusst zugelassen, llms.txt liegt bereit).

## 9. Netlify aufräumen (erst wenn alles live verifiziert ist)
- Bezahltes Abo? → Downgrade/Kündigung unter Billing. Free-Plan: nichts zu kündigen.
- Site löschen (oder behalten als Fallback für 2–4 Wochen).
- Die Env-Vars (SMTP_*) werden nicht mehr gebraucht.

## Was sich geändert hat (gegenüber Netlify)
- Formular: eigene Worker-Route `/api/anfrage` statt Netlify Forms;
  Spam-Schutz **Cloudflare Turnstile** statt Google reCAPTCHA (Google ist
  komplett von der Seite verschwunden, CSP entsprechend verschärft).
- Jede Anfrage wird VOR dem Mailversand in KV gesichert
  (Schlüssel `anfrage-<zeitstempel>`, 1 Jahr TTL) – kein Lead geht verloren,
  selbst wenn eine Mail scheitert.
- Mails (an Felix + Bestätigung) über Cloudflare Email Service statt SMTP.
- Admin-Inhalte + Statistik in Workers KV statt Netlify Blobs
  (Statistik ist eventual consistent – bei gleichzeitigen Zugriffen können
  einzelne Zählungen verloren gehen, für diese Größenordnung egal).
- Header/CSP in `public/_headers` statt netlify.toml.
- Datenschutzerklärung aktualisiert (Hosting Cloudflare, Turnstile statt
  reCAPTCHA, Stand Oktober 2026).
- `site/` im Nachbarordner ist ab Cutover LEGACY (Netlify-Stand) –
  Änderungen nur noch hier in `cloudflare/public/`.
