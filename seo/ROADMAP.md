# Umsetzungs-Roadmap

Vier Phasen, dosiert für einen Ein-Personen-Betrieb (2–4 h/Woche).
Technisches Fundament ist bereits gelegt – Phase 1 ist deshalb
Messbarkeit + schnelle Hebel statt Infrastruktur.

## Phase 1 – Fundament & Quick Wins (Nov–Dez 2026)

| # | Aufgabe | Wer | Aufwand |
|---|---|---|---|
| 1 | **Google Search Console** öffnen/verifizieren (TXT-Record existiert bereits!) + Sitemap einreichen | Pasquale/Felix | 20 min |
| 2 | **Bing Webmaster Tools** anlegen (GSC-Import) | Pasquale | 10 min |
| 3 | **Google Business Profile** ausbauen: Kategorie „Musiker", Leistungen, Fotos, Posts; Website-Link prüfen | Felix | 1 h |
| 4 | **Bridebook-Profil** anlegen (Fotos, Videos, Preisspanne, Link) | Felix | 1 h |
| 5 | **ab-Preise freigeben** → vorbereitete Sektion auf /leistungen/ aktivieren | Felix → Claude | 30 min |
| 6 | **/saxophonist-osnabrueck/** bauen | Claude | – |
| 7 | **/ratgeber/saxophonist-kosten/** bauen (nach Preis-Freigabe) | Claude | – |
| 8 | Review-Routine starten: Google-Link nach jedem Gig | Felix | laufend |

**Erfolgskriterium:** GSC liefert Daten; Osnabrück-Seite indexiert;
Preis-Seite live vor der Januar-Verlobungswelle.

## Phase 2 – Regionale Expansion (Jan–Apr 2027)

- Stadt-Seiten Münsterland, Hamburg (je mit Gates aus SITE-STRUKTUR.md)
- Ratgeber Trauungsmusik + Sektempfang
- Interne Verlinkung Anlass ↔ Stadt ↔ Ratgeber durchziehen
- Erste GSC-Auswertung (Februar): Rankings Osnabrück/Kosten-Seite prüfen,
  Titles/Descriptions nach echten Suchanfragen nachschärfen

**Erfolgskriterium:** „saxophonist osnabrück" Top 20 → Top 10;
Kosten-Ratgeber erhält Impressionen; +6 Google-Reviews.

## Phase 3 – Saison nutzen & Autorität (Mai–Sep 2027)

- Saisonmaterial systematisch einsammeln (Fotos/Videos/Reviews je Gig)
- Sylt-Seite mit Premium-Material
- Backlink-Basics: Locations um Verlinkung bitten („bewährte Künstler"-
  Seiten von NOHO, Beach Clubs, Hochzeitslocations), Hochzeitsblogs
  regional anschreiben (1–2 Platzierungen reichen)
- Weihnachtsfeier-Abschnitt auf /firmenevent/ (September!)

**Erfolgskriterium:** 50 Google-Reviews; 2–3 echte Backlinks von
Locations/Blogs; Corporate-Anfragen fürs Q4 messbar.

## Phase 4 – Skalieren nach Daten (Okt 2027–)

- Jahresauswertung: GSC + Funnel-Statistik + Pipeline-Absagegründe
- Entscheidung datenbasiert: weitere Stadt-Seiten? EN-Version (/en/ für
  Corporate)? Berlin-Seite?
- Ratgeber aktualisieren (2028-Stand), llms.txt pflegen

## Abhängigkeiten & Risiken

- **Preis-Freigabe von Felix** blockiert die zwei stärksten Phase-1-Hebel
  (ab-Preise + Kosten-Ratgeber) → früh klären.
- Stadt-Seiten ohne echtes Material **nicht** bauen – lieber schieben.
- Jede neue Seite läuft über das bestehende Deploy (Push auf main);
  Sitemap + lastmod nicht vergessen.
- Messbarkeit zuerst: ohne GSC (Aufgabe 1!) ist jede spätere
  Erfolgsdiskussion Spekulation.
