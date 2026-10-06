# SAXOFAXO – Website Felix Tönnies

Statische Website (HTML/CSS/JS, keine Build-Tools nötig) für Netlify.

## 1. Deployment auf Netlify (5 Minuten)

**Variante A – Drag & Drop (schnellster Weg):**
1. Bei https://app.netlify.com anmelden.
2. „Add new site" → „Deploy manually" → den **gesamten Inhalt dieses Ordners** (nicht den Ordner selbst) in das Feld ziehen.

**Variante B – Git (empfohlen für Pflege):**
1. Ordner in ein GitHub-Repo pushen.
2. Netlify: „Add new site" → „Import an existing project" → Repo wählen.
3. Build command: leer lassen · Publish directory: `.` (die `netlify.toml` regelt das).

## 2. Kontaktformular aktivieren (Netlify Forms)

Das Formular heißt `event-anfrage` und wird beim ersten Deploy automatisch erkannt.
1. Netlify-Dashboard → **Forms** → prüfen, dass „event-anfrage" gelistet ist.
2. **Forms → Settings → Form notifications → Add notification → Email notification** → Empfänger: `info@saxofaxo.com`.
3. Optional: Den Betreff der Benachrichtigung dort anpassen. Das Feld `zusammenfassung` enthält den Kurz-Überblick der Anfrage (z. B. „Hochzeit · DJ + Sax · 24.08.2026 · Osnabrück · 100–200 Gäste"), damit du auf einen Blick siehst, worum es geht.
4. **Wichtig:** Netlify Forms ist im Free-Plan auf 100 Einsendungen/Monat begrenzt – für den Start ausreichend.
5. Einmal selbst testen (echte Anfrage schicken) – erst dann live bewerben.

## 3. Domain saxofaxo.com (IONOS → Netlify)

1. Netlify: **Domain management → Add a domain** → `saxofaxo.com` eintragen.
2. Bei IONOS (Domain & SSL → saxofaxo.com → DNS):
   - **A-Record** für `@` auf `75.2.60.5` (Netlify Load Balancer) setzen, **oder** – sauberer – bei IONOS die Nameserver auf die von Netlify angezeigten „Netlify DNS"-Nameserver umstellen.
   - **CNAME** für `www` auf `<dein-site-name>.netlify.app`.
3. In Netlify unter „Domain management" HTTPS aktivieren (Let's-Encrypt-Zertifikat, automatisch).
4. Hinweis: Die genauen IPs/Nameserver zeigt dir Netlify im Dashboard an – bitte die dort angezeigten Werte verwenden, falls sie abweichen.

**E-Mail info@saxofaxo.com:** bleibt bei IONOS! Wenn du auf Netlify DNS umstellst, müssen die **MX-Records von IONOS in Netlify DNS nachgetragen** werden, sonst kommt keine Mail mehr an. (Bei Variante „nur A-Record ändern" bleibt alles wie es ist – das ist der sicherere Weg.)

## 4. Sprache (i18n)

- Standard: **Deutsch**. Beim ersten Besuch wird die Browsersprache erkannt (EN-Browser → Englisch).
- Die Auswahl wird in `localStorage` gespeichert (kein Cookie, kein Tracking).
- Alle Texte liegen in `assets/js/i18n.js` – dort DE/EN pflegen.

## 5. Inhalte pflegen

- **Fotos:** Platzhalter (`.photo-ph`) in `media/index.html` und `ueber-mich/index.html` durch `<img>`-Tags ersetzen. Empfehlung: WebP, max. 1600 px Breite, `loading="lazy"` und aussagekräftiges `alt`.
- **Videos:** In `media/index.html` – `data-src` austauschen/ergänzen (Vimeo mit `&dnt=1`, YouTube über `youtube-nocookie.com`).
- **Impressum:** ⚠️ Offene TODOs in `impressum/index.html` (Telefonnummer, USt-Variante A/B, ggf. USt-IdNr.) – vor Livegang ausfüllen!
- **Datenschutz:** Vorlage vor Livegang fachlich prüfen lassen (z. B. eRecht24-Generator gegenlesen).

## 6. Technik-Notizen

- Fonts (Fraunces, Instrument Sans) sind **selbst gehostet** → kein Google-Fonts-Abmahnrisiko.
- Videos laden per **2-Klick-Lösung** erst nach Nutzer-Klick → DSGVO-konform ohne Cookie-Banner.
- Es gibt **keine Cookies und kein Tracking** → aktuell ist kein Consent-Banner nötig. Sobald Analytics o. Ä. dazukommt, ändert sich das.

## Hero-Video (Startseite)
Die Startseite ist für ein selbst gehostetes Hintergrundvideo vorbereitet
(DSGVO-sauber, kein Drittanbieter). Siehe `assets/video/README-VIDEO.md`.
Fehlt die Datei, wird automatisch der Gradient-Hero angezeigt.

## Social Media
Instagram- und Spotify-Links sind im Footer aller Seiten sowie auf der
Media-Seite verlinkt und im Schema.org-Markup (`sameAs`) hinterlegt.

## Redesign v2 – „Das Programmheft“
Redaktionelles, helles Design (Porzellan/Espresso/Messing) mit dunklen
Bühnenmomenten (Header, Hero, CTA, Footer). Deutsche Ansprache durchgängig
in Sie-Form (B2B). Referenz-Marquee unter dem Hero, Anlässe als Index-Liste,
Formate als asymmetrischer Bogen.

## Medien (Stand: Redesign v2.1)
- Fotos liegen optimiert als WebP unter assets/img/ (Hero-Hintergrund,
  Bühnen-, Detail- und Hochzeitsfoto). Quelle in Originalqualität behalten!
- Live-Videos (saxofaxo1/2) sind als H.264-MP4 selbst gehostet unter
  assets/video/ – saxofaxo1 ist das Hauptvideo auf der Media-Seite.
  Credits (Alexander Cooijmans) stehen an den Videos und im Impressum.
- Hero-Video ist live: 28-Sekunden-Loop aus "Felix Ralf.mov" (stumm,
  1280px, 5,5 MB) unter assets/video/hero.mp4; Poster/Fallback-Bild stammen
  aus demselben Video. Zusätzlich: Cityfest-Mitschnitt (16:9, mit Ton) auf
  der Media-Seite unter assets/video/cityfest.mp4.

## Logo & Favicon
- Farb-Logo (assets/img/logo-color.svg) läuft im dunklen Header und Footer;
  Weiß-/Schwarz-Varianten liegen daneben für spätere Zwecke.
- Favicon: nur das goldene Saxophon, extrahiert aus dem Farb-Logo
  (assets/img/favicon.svg, quadratische ViewBox).
- Kontakt-Mail ist seitenweit info@saxofaxo.com.

## Fix: Relative Pfade + Hinweisbanner (v2.2)
- Alle Pfade sind jetzt relativ – die Seite funktioniert damit auch beim
  lokalen Öffnen per Doppelklick (vorher lud lokal kein CSS, wodurch das
  Footer-Logo riesig als "Saxophon" die Seite blockierte).
- CSS/JS werden auf Netlify nur noch 1 h gecacht (Design-Updates kommen an).
- Datenschutz-Hinweisbanner: informiert einmalig (keine Tracking-Cookies,
  2-Klick-Videos, lokale Sprachwahl), Bestätigung wird im localStorage
  gemerkt. Rechtlich ist für dieses Setup kein Consent-Banner nötig –
  der Banner ist ein transparenter Hinweis, kein Cookie-Zwang.

## Funnel-Update (v2.3)
- Anlass- und Format-Auswahl sind jetzt echte klickbare Karten (weiße Fläche,
  Rahmen, Hover, Haken bei Auswahl) – die gesamte Karte ist Hitbox.
- Neue Formate: Jazz Duo, Jazz Trio, Jazz Quartett, Jazz Quintett.
- Neues optionales Feld "Location / Veranstaltungsort" (fließt in die
  Anfrage-Zusammenfassung ein, wenn ausgefüllt).
- Telefon ist Pflichtfeld (mit Validierung und Fehlermeldung).

## v2.4: Font, neue Formate, FAQ, SEO/LLM
- Display-Font: Cormorant Garamond (selbst gehostet). Wunschfont "Realistic
  Nature": Lizenz klären, Fontdatei bereitstellen, dann austauschbar.
- Formate: Deep House-Empfang & Jazz-Pop-Empfang ersetzen den Solo-Act
  (Leistungen, Startseite, Funnel). Jazzquartett mit Besetzung, Spielzeit
  und Rabattstaffel (15 %/3 Std., 20 %/4 Std.).
- FAQ auf /leistungen/ inkl. FAQPage-Schema; TODOs im Quellcode markiert
  (Technik-Details, Anzahlung/Storno).
- SEO/KI: llms.txt, sitemap.xml, robots.txt, og:image, MusicGroup-Schema
  mit aggregateRating (4,9/36).

## v2.5: reCAPTCHA + SEO/LLM-Finale
- Netlify reCAPTCHA am Formular (data-netlify-recaptcha; Widget erscheint
  erst auf dem Netlify-Deploy, nicht in der lokalen Vorschau).
- Datenschutz: neuer Abschnitt 5 (Google reCAPTCHA, Art. 6 Abs. 1 lit. f);
  Hinweisbanner-Text entsprechend angepasst.
- SEO: keyword-optimierte Titel/Descriptions auf allen Seiten, zweisprachig
  per meta.*-Keys; Person-Schema auf /ueber-mich/; llms.txt mit Bewertungen.
