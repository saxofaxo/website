/* SAXOFAXO — ux.js
 * UI-Details, die sich wie eine native App anfühlen sollen:
 *  - Federn (Dämpfung/Response wie bei Apple), unterbrechbar, mit Velocity-Übergabe
 *  - Wischbare Sheets (Schnellzugriff mobil, Lightbox, Menü) mit Rubber-Banding
 *  - Zurück-Geste schließt Overlays statt die Seite zu verlassen
 *  - ⌘K-Schnellzugriff mit Tastatur-Hinweisen, Toasts mit Rückgängig
 *  - Anlässe-Menü mit „Safe Triangle", Skeletons, Prerendering
 * Alles progressiv: ohne JS funktioniert die Seite wie vorher.
 */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement, body = doc.body;
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isAdmin = !!doc.getElementById("login");
  var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  function en() { return root.lang === "en"; }
  function T(de, e) { return en() ? e : de; }

  /* ================= Feder ================= */
  /* response = Zeit bis zum Ziel in s, damping 1 = ohne Überschwingen (Apple-Parameter) */
  function spring(from, to, velocity, opt, onUpdate, onDone) {
    var response = (opt && opt.response) || 0.35, damping = (opt && opt.damping) || 1;
    var k = Math.pow(2 * Math.PI / response, 2), c = 4 * Math.PI * damping / response;
    var x = from, v = velocity || 0, last = performance.now(), id = 0, done = false;
    if (reduced) { onUpdate(to); if (onDone) onDone(); return { stop: function () {}, value: function () { return to; } }; }
    function step(now) {
      var dt = Math.min(0.064, (now - last) / 1000); last = now;
      for (var i = 0, h = dt / 6; i < 6; i++) { var a = -k * (x - to) - c * v; v += a * h; x += v * h; }
      if (Math.abs(v) < 4 && Math.abs(x - to) < 0.4) { x = to; onUpdate(x); done = true; if (onDone) onDone(); return; }
      onUpdate(x); id = requestAnimationFrame(step);
    }
    id = requestAnimationFrame(step);
    return { stop: function () { if (!done) cancelAnimationFrame(id); done = true; }, value: function () { return x; } };
  }
  /* Apples Projektion: wo würde ein Wurf mit dieser Geschwindigkeit zur Ruhe kommen? */
  function project(v, d) { d = d || 0.998; return (v / 1000) * d / (1 - d); }
  function rubber(over, dim) { var c = 0.55; return (over * dim * c) / (dim + c * Math.abs(over)); }

  /* ================= Wischbares Sheet =================
   * el bewegt sich auf einer Achse 1:1 mit dem Finger (Griffpunkt bleibt erhalten),
   * zur Schließrichtung frei, dagegen mit Gummiband. Loslassen: Schwung wird
   * projiziert, Feder übernimmt die Fingergeschwindigkeit. */
  function sheetDrag(el, o) {
    var axis = o.axis || "y", dir = o.dir || 1, pos = 0, anim = null, track = null;
    function set(p) {
      pos = p;
      el.style.transform = axis === "y" ? "translate3d(0," + p + "px,0)" : "translate3d(" + p + "px,0,0)";
      if (o.onMove) o.onMove(p);
    }
    function size() { var r = el.getBoundingClientRect(); return axis === "y" ? r.height : r.width; }
    function down(e) {
      if (e.button > 0 || (o.can && !o.can(e))) return;
      if (anim) { anim.stop(); anim = null; } /* Unterbrechen: ab der aktuellen Position weiter */
      track = { id: e.pointerId, start: axis === "y" ? e.clientY : e.clientX, startPos: pos, cross: axis === "y" ? e.clientX : e.clientY, hist: [], live: false };
    }
    function move(e) {
      if (!track || e.pointerId !== track.id) return;
      var p = axis === "y" ? e.clientY : e.clientX, q = axis === "y" ? e.clientX : e.clientY;
      var d = p - track.start;
      if (!track.live) {
        if (Math.abs(q - track.cross) > 12 && Math.abs(q - track.cross) > Math.abs(d)) { track = null; return; } /* andere Achse gewinnt */
        if (Math.abs(d) < 8) return; /* Hysterese */
        track.live = true; track.start = p; d = 0;
        el.style.transition = "none";
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
        el.classList.add("is-dragging");
      }
      var raw = track.startPos + d, dim = size();
      set(raw * dir >= 0 ? raw : -rubber(-raw * dir, dim) * dir);
      track.hist.push([performance.now(), p]); if (track.hist.length > 6) track.hist.shift();
      e.preventDefault();
    }
    function up(e) {
      if (!track || e.pointerId !== track.id) return;
      var t = track; track = null;
      if (!t.live) return;
      el.classList.remove("is-dragging");
      var h = t.hist, v = 0;
      if (h.length > 1) { var a = h[0], b = h[h.length - 1]; v = (b[1] - a[1]) / Math.max(1, b[0] - a[0]) * 1000; }
      var dim = size(), end = pos + project(v);
      if (end * dir > dim * (o.threshold || 0.45) && v * dir > -200) {
        anim = spring(pos, dim * dir * 1.05, v, { response: 0.3, damping: 1 }, set, function () { anim = null; o.onDismiss(); });
      } else {
        anim = spring(pos, 0, v, { response: 0.35, damping: 0.85 }, set, function () { anim = null; el.style.transform = ""; el.style.transition = ""; });
      }
    }
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move, { passive: false });
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return { reset: function () { if (anim) anim.stop(); anim = null; pos = 0; el.style.transform = ""; el.style.transition = ""; } };
  }

  /* ================= Zurück-Geste schließt Overlays =================
   * Jedes Overlay legt einen History-Eintrag an. Zurück (Taste, Wischgeste,
   * Android Predictive Back) schließt das oberste Overlay, die Seite bleibt. */
  var stack = [], skipPop = 0, pendingHref = null, afterPop = null;
  function overlayOpen(name, close) {
    stack.push({ name: name, close: close });
    try { history.pushState({ saxoOverlay: name }, ""); } catch (e) {}
  }
  function overlayClosed(name) {
    var i = stack.length - 1;
    if (i < 0 || stack[i].name !== name) return;
    stack.pop();
    if (history.state && history.state.saxoOverlay === name) { skipPop++; history.back(); }
  }
  /* Link aus einem Overlay: erst History aufräumen, dann navigieren */
  function navigateFromOverlay(href) {
    if (stack.length && history.state && history.state.saxoOverlay) {
      pendingHref = href; stack.length = 0; history.go(-1);
      setTimeout(function () { if (pendingHref) { var h = pendingHref; pendingHref = null; location.href = h; } }, 350);
    } else { location.href = href; }
  }
  window.addEventListener("popstate", function () {
    if (pendingHref) { var h = pendingHref; pendingHref = null; location.href = h; return; }
    if (skipPop) { skipPop--; if (afterPop) { var f = afterPop; afterPop = null; setTimeout(f, 0); } return; }
    var top = stack.pop();
    if (top) top.close(true);
  });
  if (history.state && history.state.saxoOverlay) { try { history.replaceState(null, ""); } catch (e) {} }

  /* ================= Toasts mit Rückgängig ================= */
  var region = doc.createElement("div");
  region.className = "toasts";
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  body.appendChild(region);
  function toast(opt) {
    var t = doc.createElement("div");
    t.className = "toast";
    var msg = doc.createElement("span"); msg.textContent = opt.text; t.appendChild(msg);
    var timer = null, left = opt.timeout || 6000, startedAt = 0;
    function dismiss() {
      clearTimeout(timer);
      if (!t.isConnected) return;
      t.classList.add("is-leaving");
      setTimeout(function () { t.remove(); }, reduced ? 0 : 260);
    }
    if (opt.action) {
      var b = doc.createElement("button");
      b.type = "button"; b.className = "toast-action"; b.textContent = opt.action.label;
      b.addEventListener("click", function () { dismiss(); opt.action.onClick(); });
      t.appendChild(b);
    }
    var x = doc.createElement("button");
    x.type = "button"; x.className = "toast-close"; x.setAttribute("aria-label", T("Hinweis schließen", "Dismiss"));
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    x.addEventListener("click", dismiss);
    t.appendChild(x);
    function run() { startedAt = Date.now(); timer = setTimeout(dismiss, left); }
    function pause() { clearTimeout(timer); left = Math.max(1500, left - (Date.now() - startedAt)); }
    t.addEventListener("pointerenter", pause); t.addEventListener("pointerleave", run);
    t.addEventListener("focusin", pause); t.addEventListener("focusout", run);
    region.appendChild(t);
    while (region.children.length > 3) region.firstChild.remove();
    sheetDrag(t, { axis: "x", dir: 1, threshold: 0.35, onDismiss: function () { t.remove(); } });
    run();
    return dismiss;
  }
  window.SAXO_TOAST = toast;

  if (isAdmin) return; /* Admin braucht nur die Toasts */

  /* ================= Prerendering (Speculation Rules) =================
   * Beim Zeigen auf einen Link wird die Zielseite vorab gerendert –
   * der Klick öffnet sie ohne Wartezeit. */
  if (HTMLScriptElement.supports && HTMLScriptElement.supports("speculationrules")) {
    var sr = doc.createElement("script");
    sr.type = "speculationrules";
    sr.textContent = JSON.stringify({
      prerender: [{
        where: { and: [{ href_matches: "/*" }, { not: { href_matches: "/admin/*" } }, { not: { href_matches: "/api/*" } }, { not: { selector_matches: "[target=_blank], [download]" } }] },
        eagerness: "moderate"
      }]
    });
    doc.head.appendChild(sr);
  }

  /* ================= Skeleton, solange ein Video-Player lädt ================= */
  doc.querySelectorAll(".video-embed").forEach(function (wrap) {
    new MutationObserver(function () {
      var f = wrap.querySelector("iframe");
      if (!f || f.dataset.skel) return;
      f.dataset.skel = "1";
      wrap.classList.add("is-loading");
      f.addEventListener("load", function () { wrap.classList.remove("is-loading"); });
    }).observe(wrap, { childList: true });
  });

  /* ================= Seiten & Aktionen (für Menü und Schnellzugriff) ================= */
  var PAGES = [
    { href: "/", de: "Startseite", en: "Home", kw: "start home saxofaxo" },
    { href: "/leistungen/", de: "Leistungen", en: "Services", kw: "formate preise kosten konditionen besetzung dj jazz duo trio quartett quintett sextett rabatt prices services", key: "l" },
    { href: "/hochzeit/", de: "Hochzeit", en: "Wedding", kw: "trauung sektempfang braut wedding ceremony", key: "h" },
    { href: "/firmenevent/", de: "Firmenevent", en: "Corporate event", kw: "gala firma weihnachtsfeier sommerfest corporate", key: "f" },
    { href: "/club/", de: "Club & Gastro", en: "Club & hospitality", kw: "bar festival party club" },
    { href: "/saxophonist-osnabrueck/", de: "Saxophonist in Osnabrück", en: "Saxophonist in Osnabrück", kw: "osnabrück region niedersachsen nrw" },
    { href: "/media/", de: "Media: Videos & Hörproben", en: "Media: videos & recordings", kw: "video hörprobe fotos audio listen", key: "m" },
    { href: "/ueber-mich/", de: "Über mich", en: "About", kw: "felix tönnies vita dj setlist repertoire about", key: "u" },
    { href: "/kontakt/", de: "Anfrage stellen", en: "Send an enquiry", kw: "kontakt buchen anfrage termin verfügbar booking contact", key: "k" }
  ];

  /* ================= Anlässe-Menü mit Safe Triangle =================
   * Links die Anlässe, rechts eine Vorschau. Wer schräg von „Hochzeit“ zur
   * Vorschau fährt, streift „Firmenevent“ – das Dreieck verhindert den Wechsel. */
  var OCC = [
    { href: "/hochzeit/", img: "/assets/img/media-wald-staendchen-700.webp", de: ["Hochzeit", "Trauung, Sektempfang, Dinner und Party."], en: ["Wedding", "Ceremony, drinks reception, dinner and party."] },
    { href: "/firmenevent/", img: "/assets/img/media-empfang-outdoor-700.webp", de: ["Firmenevent", "Empfang, Gala, Sommerfest, Weihnachtsfeier."], en: ["Corporate event", "Reception, gala, summer party, Christmas party."] },
    { href: "/club/", img: "/assets/img/media-festival-buehne-700.webp", de: ["Club & Gastro", "Live-Sax über DJ-Sets für Club, Bar und Festival."], en: ["Club & hospitality", "Live sax over DJ sets for club, bar and festival."] },
    { href: "/saxophonist-osnabrueck/", img: "/assets/img/media-park-sommer-700.webp", de: ["In Osnabrück", "Kurze Wege, persönliches Kennenlernen."], en: ["In Osnabrück", "Short distances, a personal first meeting."] }
  ];
  var navLinks = doc.querySelector(".site-header .nav-links");
  var svcLink = navLinks && navLinks.querySelector('a[href$="leistungen/"]');
  if (svcLink) {
    var li = svcLink.parentElement;
    li.classList.add("has-mega");
    /* Pfeil zeigt: hier klappt etwas auf. Der Text wandert in ein eigenes span,
       weil der Sprachwechsel den Inhalt von [data-i18n] komplett ersetzt. */
    var svcText = doc.createElement("span");
    svcText.setAttribute("data-i18n", svcLink.getAttribute("data-i18n") || "nav.services");
    svcText.textContent = svcLink.textContent;
    svcLink.removeAttribute("data-i18n");
    svcLink.textContent = "";
    svcLink.appendChild(svcText);
    svcLink.insertAdjacentHTML("beforeend", '<svg class="nav-chev" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    svcLink.setAttribute("aria-haspopup", "true");
    var mega = doc.createElement("div");
    mega.className = "mega";
    mega.innerHTML =
      '<div class="mega-list"></div>' +
      '<a class="mega-preview" href="/hochzeit/"><img alt="" width="700" height="520" decoding="async" loading="lazy"><span class="mega-title"></span><span class="mega-text"></span><span class="mega-go" aria-hidden="true">→</span></a>';
    li.appendChild(mega);
    var list = mega.querySelector(".mega-list"), prev = mega.querySelector(".mega-preview");
    var pImg = prev.querySelector("img"), pTitle = prev.querySelector(".mega-title"), pText = prev.querySelector(".mega-text");
    var items = OCC.map(function (o, i) {
      var a = doc.createElement("a");
      a.href = o.href; a.className = "mega-item"; a.dataset.i = i;
      list.appendChild(a);
      return a;
    });
    var all = doc.createElement("a"); all.href = "/leistungen/"; all.className = "mega-all"; list.appendChild(all);
    var active = 0;
    function label() {
      items.forEach(function (a, i) { a.textContent = OCC[i][en() ? "en" : "de"][0]; });
      all.textContent = T("Alle Leistungen →", "All services →");
      activate(active, true);
    }
    function activate(i, force) {
      if (i === active && !force) return;
      active = i;
      var o = OCC[i], l = o[en() ? "en" : "de"];
      items.forEach(function (a, j) { a.classList.toggle("is-active", j === i); });
      prev.href = o.href; pImg.src = o.img; pTitle.textContent = l[0]; pText.textContent = l[1];
    }
    label();
    new MutationObserver(label).observe(root, { attributes: true, attributeFilter: ["lang"] });

    /* Safe Triangle: Zeigerverlauf merken; bewegt er sich in das Dreieck
       Richtung Vorschau, wird der Wechsel kurz zurückgehalten. */
    var lastPts = [], pendingTimer = null;
    function inTri(p, a, b, c) {
      function s(p1, p2, p3) { return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y); }
      var d1 = s(p, a, b), d2 = s(p, b, c), d3 = s(p, c, a);
      return !(((d1 < 0) || (d2 < 0) || (d3 < 0)) && ((d1 > 0) || (d2 > 0) || (d3 > 0)));
    }
    list.addEventListener("pointermove", function (e) {
      lastPts.push({ x: e.clientX, y: e.clientY }); if (lastPts.length > 4) lastPts.shift();
    });
    items.forEach(function (a, i) {
      a.addEventListener("pointerenter", function (e) {
        if (e.pointerType !== "mouse") { activate(i); return; }
        clearTimeout(pendingTimer);
        var r = prev.getBoundingClientRect(), from = lastPts[0];
        var cur = { x: e.clientX, y: e.clientY };
        var heading = from && inTri(cur, from, { x: r.left, y: r.top - 30 }, { x: r.left, y: r.bottom + 30 });
        if (heading && from && cur.x > from.x) {
          pendingTimer = setTimeout(function () { if (a.matches(":hover")) activate(i); }, 280);
        } else { activate(i); }
      });
      a.addEventListener("focus", function () { activate(i); });
    });

    /* Öffnen mit Absicht (kurze Verzögerung), Schließen mit Gnadenfrist */
    var openT = null, closeT = null;
    function setOpen(v) { li.classList.toggle("is-open", v); svcLink.setAttribute("aria-expanded", v ? "true" : "false"); }
    svcLink.setAttribute("aria-expanded", "false");
    li.addEventListener("pointerenter", function (e) {
      if (e.pointerType !== "mouse" || !matchMedia("(min-width: 901px)").matches) return;
      clearTimeout(closeT); openT = setTimeout(function () { setOpen(true); }, 90);
    });
    li.addEventListener("pointerleave", function (e) {
      if (e.pointerType !== "mouse") return;
      clearTimeout(openT); closeT = setTimeout(function () { setOpen(false); }, 260);
    });
    li.addEventListener("focusin", function () { if (matchMedia("(min-width: 901px)").matches) setOpen(true); });
    li.addEventListener("focusout", function (e) { if (!li.contains(e.relatedTarget)) setOpen(false); });
    li.addEventListener("keydown", function (e) { if (e.key === "Escape" && li.classList.contains("is-open")) { setOpen(false); svcLink.focus(); } });

    /* Mobil: die Anlässe stehen im Menü direkt unter „Leistungen“ */
    var sub = doc.createElement("li");
    sub.className = "nav-sub";
    OCC.forEach(function (o) { var a = doc.createElement("a"); a.href = o.href; a.dataset.occ = "1"; sub.appendChild(a); });
    li.after(sub);
    function subLabel() { sub.querySelectorAll("a").forEach(function (a, i) { a.textContent = OCC[i][en() ? "en" : "de"][0]; }); }
    subLabel();
    new MutationObserver(subLabel).observe(root, { attributes: true, attributeFilter: ["lang"] });
  }

  /* ================= Mobiles Menü: Wischen nach oben schließt, Zurück schließt ================= */
  var toggle = doc.querySelector(".nav-toggle");
  if (navLinks && toggle) {
    function closeNav() {
      navLinks.classList.remove("open");
      body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    }
    var navOpen = false;
    new MutationObserver(function () {
      var now = body.classList.contains("nav-open");
      if (now === navOpen) return;
      navOpen = now;
      if (now) overlayOpen("nav", function () { closeNav(); });
      else { navDrag.reset(); overlayClosed("nav"); }
    }).observe(body, { attributes: true, attributeFilter: ["class"] });
    var navDrag = sheetDrag(navLinks, {
      axis: "y", dir: -1, threshold: 0.3,
      can: function () { return matchMedia("(max-width: 900px)").matches && body.classList.contains("nav-open"); },
      onDismiss: function () { closeNav(); }
    });
    navLinks.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a || !navOpen || a.target === "_blank" || /^(mailto|tel):/.test(a.getAttribute("href"))) return;
      e.preventDefault(); e.stopPropagation();
      closeNav(); navigateFromOverlay(a.href);
    }, true);
  }

  /* ================= Lightbox: wischen, ziehen, Zurück ================= */
  var lb = doc.querySelector("dialog.lightbox");
  if (lb) {
    var fig = lb.querySelector(".lb-figure");
    fig.addEventListener("dragstart", function (e) { e.preventDefault(); }); /* natives Bild-Ziehen bricht sonst die Geste ab */
    var lbOpen = false;
    new MutationObserver(function () {
      var now = lb.hasAttribute("open");
      if (now === lbOpen) return;
      lbOpen = now;
      if (now) { lbDrag.reset(); overlayOpen("lightbox", function () { lb.close(); }); }
    }).observe(lb, { attributes: true, attributeFilter: ["open"] });
    lb.addEventListener("close", function () { lbOpen = false; overlayClosed("lightbox"); });
    var lbDrag = sheetDrag(fig, {
      axis: "y", dir: 1, threshold: 0.25,
      onMove: function (p) { lb.style.setProperty("--lb-fade", String(Math.max(0.25, 1 - Math.abs(p) / 500))); },
      onDismiss: function () { lb.close(); setTimeout(function () { lbDrag.reset(); lb.style.removeProperty("--lb-fade"); }, 50); }
    });
    /* Waagerecht wischen = vor/zurück */
    var sx = null;
    fig.addEventListener("pointerdown", function (e) { sx = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    fig.addEventListener("pointerup", function (e) {
      if (!sx) return;
      var dx = e.clientX - sx.x, dy = e.clientY - sx.y, v = Math.abs(dx) / Math.max(1, performance.now() - sx.t);
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 || (v > 0.6 && Math.abs(dx) > 30 && Math.abs(dy) < 30)) {
        var btn = lb.querySelector(dx < 0 ? ".lb-next" : ".lb-prev");
        if (btn) btn.click();
      }
      sx = null;
    });
  }

  /* ================= ⌘K-Schnellzugriff ================= */
  var nav = doc.querySelector(".site-header .nav");
  if (nav) {
    var kbd = mac ? "⌘K" : "Strg K";
    var trig = doc.createElement("button");
    trig.type = "button"; trig.className = "cmdk-trigger";
    trig.setAttribute("aria-haspopup", "dialog");
    trig.setAttribute("aria-keyshortcuts", mac ? "Meta+K" : "Control+K");
    trig.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><kbd>' + kbd + "</kbd>";
    nav.insertBefore(trig, toggle || null);

    var dlg = doc.createElement("dialog");
    dlg.className = "cmdk";
    dlg.innerHTML =
      '<div class="cmdk-sheet">' +
        '<span class="cmdk-grabber" aria-hidden="true"></span>' +
        '<div class="cmdk-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' +
        '<input type="text" role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-autocomplete="list" autocomplete="off" spellcheck="false" enterkeyhint="go"></div>' +
        '<ul class="cmdk-list" id="cmdk-list" role="listbox"></ul>' +
        '<p class="cmdk-foot" aria-hidden="true"></p>' +
      "</div>";
    body.appendChild(dlg);
    var sheet = dlg.querySelector(".cmdk-sheet"), input = dlg.querySelector("input"), ul = dlg.querySelector("ul"), foot = dlg.querySelector(".cmdk-foot");
    var results = [], sel = 0;

    function actions() {
      var a = [];
      a.push({ group: T("Aktionen", "Actions"), label: T("Anfrage starten", "Start an enquiry"), kw: "buchen anfrage book quote", run: function () { go("/kontakt/"); } });
      a.push({ group: T("Aktionen", "Actions"), label: T("Anrufen: +49 173 926 5526", "Call: +49 173 926 5526"), kw: "telefon anrufen call phone", run: function () { closeThen(function () { location.href = "tel:+491739265526"; }); } });
      a.push({ group: T("Aktionen", "Actions"), label: T("E-Mail schreiben", "Write an email"), kw: "mail email info", run: function () { closeThen(function () { location.href = "mailto:info@saxofaxo.com"; }); } });
      a.push({ group: T("Aktionen", "Actions"), label: en() ? "Auf Deutsch anzeigen" : "Switch to English", kw: "sprache language english deutsch", run: function () { var b = doc.querySelector('.lang-switch button[data-lang="' + (en() ? "de" : "en") + '"]'); closeThen(function () { if (b) b.click(); }); } });
      PAGES.forEach(function (p) {
        a.push({ group: T("Seiten", "Pages"), label: en() ? p.en : p.de, kw: p.kw, hint: p.key ? "G " + p.key.toUpperCase() : "", current: location.pathname === p.href, run: function () { go(p.href); } });
      });
      doc.querySelectorAll("main h2").forEach(function (h) {
        var txt = h.textContent.trim();
        if (!txt || h.closest("dialog")) return;
        a.push({ group: T("Auf dieser Seite", "On this page"), label: txt, kw: "", run: function () { closeThen(function () { h.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" }); }); } });
      });
      return a;
    }
    function norm(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
    function filter() {
      var q = norm(input.value.trim());
      var all = actions();
      results = !q ? all.filter(function (x) { return x.group !== T("Auf dieser Seite", "On this page"); }).concat(all.filter(function (x) { return x.group === T("Auf dieser Seite", "On this page"); }).slice(0, 4))
        : all.filter(function (x) { var hay = norm(x.label + " " + x.kw); return q.split(/\s+/).every(function (w) { return hay.indexOf(w) > -1; }); });
      sel = 0; render();
    }
    function render() {
      ul.textContent = "";
      var lastGroup = "";
      if (!results.length) {
        var none = doc.createElement("li"); none.className = "cmdk-empty"; none.textContent = T("Nichts gefunden – vielleicht „Preise“ oder „Hochzeit“?", "Nothing found – try “prices” or “wedding”?");
        ul.appendChild(none); input.removeAttribute("aria-activedescendant"); return;
      }
      results.forEach(function (r, i) {
        if (r.group !== lastGroup) {
          lastGroup = r.group;
          var g = doc.createElement("li"); g.className = "cmdk-group"; g.setAttribute("role", "presentation"); g.textContent = r.group; ul.appendChild(g);
        }
        var li = doc.createElement("li");
        li.id = "cmdk-o" + i; li.setAttribute("role", "option"); li.className = "cmdk-item";
        li.setAttribute("aria-selected", i === sel ? "true" : "false");
        var s = doc.createElement("span"); s.textContent = r.label; li.appendChild(s);
        if (r.current) { var c = doc.createElement("small"); c.textContent = T("Hier", "Here"); li.appendChild(c); }
        if (r.hint) { var k = doc.createElement("kbd"); k.textContent = r.hint; li.appendChild(k); }
        li.addEventListener("pointermove", function () { if (sel !== i) { sel = i; mark(); } });
        li.addEventListener("click", function () { r.run(); });
        ul.appendChild(li);
      });
      mark();
    }
    function mark() {
      ul.querySelectorAll(".cmdk-item").forEach(function (li, i) { li.setAttribute("aria-selected", i === sel ? "true" : "false"); });
      var cur = doc.getElementById("cmdk-o" + sel);
      if (cur) { input.setAttribute("aria-activedescendant", cur.id); cur.scrollIntoView({ block: "nearest" }); }
    }
    function go(href) { navigateFromOverlay(href); closeNow(); }
    function closeThen(fn) {
      if (history.state && history.state.saxoOverlay === "cmdk") { afterPop = fn; close(); }
      else { close(); fn(); }
    }
    var cmdDrag = sheetDrag(sheet, {
      axis: "y", dir: 1, threshold: 0.3,
      can: function (e) { return matchMedia("(max-width: 720px)").matches && (e.target.closest(".cmdk-grabber, .cmdk-search") || ul.scrollTop <= 0); },
      onDismiss: function () { close(); }
    });
    function open() {
      if (dlg.open) return;
      input.value = ""; input.placeholder = T("Seite, Anlass oder Aktion suchen …", "Search a page, occasion or action …");
      dlg.setAttribute("aria-label", T("Schnellzugriff", "Quick access"));
      foot.innerHTML = "<kbd>↑</kbd><kbd>↓</kbd> " + T("auswählen", "select") + " · <kbd>↵</kbd> " + T("öffnen", "open") + " · <kbd>esc</kbd> " + T("schließen", "close");
      filter(); cmdDrag.reset();
      dlg.showModal();
      if (matchMedia("(min-width: 721px)").matches) input.focus();
      overlayOpen("cmdk", function () { closeNow(); });
    }
    function closeNow() { if (dlg.open) dlg.close(); }
    function close() { closeNow(); }
    dlg.addEventListener("close", function () { if (stack.length && stack[stack.length - 1].name === "cmdk") overlayClosed("cmdk"); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) close(); });
    input.addEventListener("input", filter);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); mark(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
      else if (e.key === "Enter") { e.preventDefault(); if (results[sel]) results[sel].run(); }
    });
    trig.addEventListener("click", open);
    function typing(t) { return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }
    var gPending = 0;
    doc.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); dlg.open ? close() : open(); return; }
      if (dlg.open || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); open(); return; }
      /* Tastenfolgen: G dann Buchstabe (wie in Mail-Apps) */
      if (e.key === "g" || e.key === "G") { gPending = Date.now(); return; }
      if (gPending && Date.now() - gPending < 900) {
        var p = PAGES.filter(function (x) { return x.key === e.key.toLowerCase(); })[0];
        gPending = 0;
        if (p) { e.preventDefault(); location.href = p.href; }
      }
    });
    /* Tastatur-Hinweis im Footer (nur mit echter Tastatur sinnvoll) */
    var footP = doc.querySelector(".site-footer .copyright");
    if (footP && matchMedia("(hover: hover) and (pointer: fine)").matches) {
      var hint = doc.createElement("button");
      hint.type = "button"; hint.className = "kbd-hint";
      function hintText() { hint.innerHTML = T("Schnellzugriff", "Quick access") + " <kbd>" + kbd + "</kbd> · " + T("Seiten", "Pages") + " <kbd>G</kbd> + <kbd>L</kbd> <kbd>M</kbd> <kbd>U</kbd> <kbd>K</kbd>"; }
      hintText();
      new MutationObserver(hintText).observe(root, { attributes: true, attributeFilter: ["lang"] });
      hint.addEventListener("click", open);
      footP.appendChild(hint);
    }
  }

  /* ================= Sprachwechsel mit Rückgängig ================= */
  var prevLang = null, undoing = false;
  doc.querySelectorAll(".lang-switch button").forEach(function (b) {
    b.addEventListener("click", function () { prevLang = root.lang; }, true);
    b.addEventListener("click", function () {
      var back = prevLang;
      if (!back || back === root.lang) return;
      if (undoing) { undoing = false; return; }
      toast({
        text: root.lang === "en" ? "Showing the English version" : "Deutsche Version",
        action: { label: root.lang === "en" ? "Undo" : "Rückgängig", onClick: function () { var o = doc.querySelector('.lang-switch button[data-lang="' + back + '"]'); if (o) { undoing = true; o.click(); } } },
        timeout: 5000
      });
    });
  });

  /* ================= Funnel: Entwurf wiederhergestellt → neu beginnen, mit Rückgängig ================= */
  var F = window.SAXO_FUNNEL;
  if (F && F.restored) {
    toast({
      text: T("Ihre Eingaben von vorhin sind wieder da.", "Your previous entries are back."),
      action: { label: T("Neu beginnen", "Start over"), onClick: function () {
        var snap = F.snapshot();
        F.clear();
        toast({
          text: T("Formular geleert.", "Form cleared."),
          action: { label: T("Rückgängig", "Undo"), onClick: function () { F.restoreFrom(snap); } },
          timeout: 7000
        });
      } },
      timeout: 8000
    });
  }
})();
