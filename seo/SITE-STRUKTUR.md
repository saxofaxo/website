# Site-Struktur & Architektur-Plan

## Ist-Zustand (11 indexierbare Seiten – gesund)

```
/                    Startseite (MusicGroup-Schema, Hero, Funnel-Einstieg)
/hochzeit/           Anlass-Landingpage (Service + Breadcrumb-Schema)
/firmenevent/        Anlass-Landingpage
/club/               Anlass-Landingpage
/leistungen/         Formate + Konditionen + FAQ (FAQPage-Schema)
/media/              Videos, Fotos
/ueber-mich/         Person-Schema, Repertoire, DJs, Bewertungs-Links
/kontakt/            Anfrage-Funnel (noindex nicht nötig, konvertiert)
/agb/ /impressum/ /datenschutz/
/danke/              noindex ✓
```

## Ausbau Stufe 1: Stadt-/Regionsseiten (Kern des Plans)

**Qualitäts-Gates (hart):** Eine Stadt-Seite entsteht NUR, wenn alle drei
erfüllt sind – sonst wird sie zur Doorway-Page und schadet:
1. echte Auftritte dort (nennbare Locations/Referenzen),
2. eigenes Material (mind. 2 Fotos oder 1 Video von dort),
3. ≥ 50 % einzigartiger Text (keine umgeschriebene Schwester-Seite).

Obergrenze: **8 Stadt-Seiten insgesamt.** (Template-Warnung liegt bei 30 –
wir bleiben bewusst weit darunter.)

| URL | Stadt/Region | Beleg vorhanden | Priorität |
|---|---|---|---|
| /saxophonist-osnabrueck/ | Osnabrück + Osnabrücker Land | Heimatstandort, Terrassenfest | **1 – sofort** |
| /saxophonist-muensterland/ | Münster/Münsterland | Auftritte + direkter Wettbewerber dort | **1** |
| /saxophonist-hamburg/ | Hamburg | NOHO, Fischauktionshalle | 2 |
| /saxophonist-sylt/ | Sylt | PONY Kampen (Premium-Signal!) | 2 |
| /saxophonist-berlin/ | Berlin | Indian Club | 3 |
| weitere (Bremen, Hannover, Köln …) | nur nach neuen Auftritten | – | später |

**Aufbau jeder Stadt-Seite:** H1 „Saxophonist in X buchen", Intro mit
lokalem Bezug (Locations, Anlässe dort), 2–3 passende Formate mit Links auf
/leistungen/ und die Anlass-Seiten, lokale Fotos, 1 Testimonial,
Anfahrt-Hinweis („von Osnabrück ohne Übernachtungskosten bis …"), FAQ-Block
(2–3 lokale Fragen), CTA. Schema: Service mit areaServed auf die Stadt.

## Ausbau Stufe 2: Ratgeber-Inhalte (kein klassischer „Blog")

Keine Blog-Chronik, sondern 4–6 stehende Ratgeber-Seiten unter /ratgeber/…
(evergreen, jährlich aktualisiert statt ständig neu):

| URL | Ziel-Query | Hinweis |
|---|---|---|
| /ratgeber/saxophonist-kosten/ | was kostet ein saxophonist hochzeit/event | **wichtigste Seite**; ehrliche Spannen + Preistreiber; verlinkt Konditionen |
| /ratgeber/musik-trauung/ | musik standesamt/freie trauung, einzug lieder saxophon | Hochzeits-Longtail, Repertoire-Links |
| /ratgeber/dj-oder-band/ | dj oder band hochzeit | positioniert „DJ + Sax" als dritte Option |
| /ratgeber/sektempfang-musik/ | musik sektempfang ideen | Deep-House-/Jazz-Formate verkaufen |

## Interne Verlinkung

- Startseiten-Anlasskacheln → Anlass-Seiten ✓ (besteht)
- Anlass-Seiten ←→ passende Stadt-Seiten (neu, je 2–3 Links)
- Stadt-Seiten → /kontakt/ + /leistungen/
- Ratgeber → Anlass-Seiten + Konditionen (Money-Pages)
- Footer bleibt schlank (keine Stadt-Linkliste im Footer – Spam-Muster)

## Schema-Plan (Ergänzungen)

| Seite | Ist | Ergänzen |
|---|---|---|
| Startseite | MusicGroup + AggregateRating ✓ | – |
| Stadt-Seiten | – | Service (areaServed: Stadt) + BreadcrumbList |
| /ratgeber/saxophonist-kosten/ | – | FAQPage für Kosten-Fragen |
| /leistungen/ | FAQPage ✓ | Offer-Angaben, sobald ab-Preise live |

## EN-Version (Stufe 3, bewusst hinten)

Aktuell übersetzt JS clientseitig → Google sieht nur Deutsch. Für
internationale Corporate-Anfragen später `/en/`-Variante der wichtigsten
4 Seiten (Start, Leistungen, Firmenevent, Kontakt) als statisch gerenderte
Kopien + hreflang. Erst sinnvoll, wenn DE-Basis Ergebnisse zeigt.
