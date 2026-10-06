/* SAXOFAXO — main.js
   1) i18n: Browser-Sprache erkennen, Auswahl in localStorage merken
   2) Mobile-Navigation
   3) DSGVO-konforme Video-Einbettung (2-Klick)
   4) Kontakt-Funnel (3 Schritte, Validierung, Zusammenfassung)
*/

/* ---------- Anonyme Reichweitenmessung (eigene Zähler, First-Party) ----------
 * Sendet nur aggregierbare Werte an /api/stats: Pfad, Referrer-Domain,
 * Sprache, Ereignisname. Keine Cookies, keine IP-Speicherung, keine IDs.
 */
(function () {
  function send(payload) {
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/stats", body);
      } else if (window.fetch) {
        fetch("/api/stats", { method: "POST", body: body, keepalive: true }).catch(function () {});
      }
    } catch (e) {}
  }
  window.SAXO_TRACK = function (eventName) { send({ e: eventName }); };

  var firstOfSession = false;
  try {
    if (!sessionStorage.getItem("saxo-vis")) {
      firstOfSession = true;
      sessionStorage.setItem("saxo-vis", "1");
    }
  } catch (e) {}
  var ref = "";
  try {
    if (document.referrer) {
      var h = new URL(document.referrer).hostname;
      if (h && h !== location.hostname) ref = h;
    }
  } catch (e) {}
  var lang = "de";
  try { lang = localStorage.getItem("saxofaxo-lang") || (navigator.language || "de"); } catch (e) {}
  send({
    p: location.pathname,
    r: ref,
    l: lang.indexOf("de") === 0 ? "de" : "en",
    v: firstOfSession ? 1 : 0
  });
})();

(function () {
  "use strict";

  /* ---------- 1) i18n ---------- */
  var STORAGE_KEY = "saxofaxo-lang";
  var dict = window.SAXO_I18N || { de: {}, en: {} };

  function detectLang() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "de" || stored === "en") return stored;
    } catch (e) { /* private mode */ }
    var nav = (navigator.language || "de").toLowerCase();
    return nav.indexOf("de") === 0 ? "de" : "en";
  }

  function t(lang, key) {
    return (dict[lang] && dict[lang][key]) || (dict.de && dict.de[key]) || null;
  }

  function applyLang(lang) {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var val = t(lang, el.getAttribute("data-i18n"));
      if (val !== null) el.innerHTML = val;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var val = t(lang, el.getAttribute("data-i18n-placeholder"));
      if (val !== null) el.setAttribute("placeholder", val);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var val = t(lang, el.getAttribute("data-i18n-aria"));
      if (val !== null) el.setAttribute("aria-label", val);
    });
    // Meta / Title (nur wenn Seite Keys definiert)
    var titleKey = document.body.getAttribute("data-title-key");
    if (titleKey) {
      var titleVal = t(lang, titleKey);
      if (titleVal) document.title = titleVal;
    }
    var descKey = document.body.getAttribute("data-desc-key");
    if (descKey) {
      var meta = document.querySelector('meta[name="description"]');
      var descVal = t(lang, descKey);
      if (meta && descVal) meta.setAttribute("content", descVal);
    }
    // Switcher-Status
    document.querySelectorAll(".lang-switch button").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-lang") === lang ? "true" : "false");
    });
    document.body.setAttribute("data-lang", lang);
  }

  var currentLang = detectLang();
  applyLang(currentLang);
  // Hook für nachträglich eingefügte Elemente (z. B. Hinweisbanner)
  window.SAXO_APPLY_LANG = function () { applyLang(currentLang); };

  document.querySelectorAll(".lang-switch button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      currentLang = btn.getAttribute("data-lang");
      try { localStorage.setItem(STORAGE_KEY, currentLang); } catch (e) {}
      applyLang(currentLang);
    });
  });

  /* ---------- 2) Mobile-Navigation ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      document.body.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        links.classList.remove("open");
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- 3) Video 2-Klick-Einbettung ---------- */
  document.querySelectorAll(".video-cover").forEach(function (cover) {
    cover.addEventListener("click", function () {
      var wrap = cover.closest(".video-embed");
      var src = wrap.getAttribute("data-src");
      if (!src) return;
      var iframe = document.createElement("iframe");
      iframe.src = src;
      iframe.allow = "autoplay; fullscreen; picture-in-picture";
      iframe.setAttribute("allowfullscreen", "");
      iframe.setAttribute("loading", "lazy");
      iframe.title = wrap.getAttribute("data-title") || "Video";
      wrap.innerHTML = "";
      wrap.appendChild(iframe);
    });
  });

  /* ---------- 4) Kontakt-Funnel ---------- */
  var funnel = document.querySelector(".funnel form");
  if (!funnel) return;

  var steps = Array.prototype.slice.call(funnel.querySelectorAll("[data-step]"));
  var keys = Array.prototype.slice.call(document.querySelectorAll(".funnel-progress .key"));
  var rods = Array.prototype.slice.call(document.querySelectorAll(".funnel-progress .rod"));
  var current = 0;

  function showStep(i) {
    current = i;
    if (i > 0 && window.SAXO_TRACK && !steps[i].dataset.tracked) {
      steps[i].dataset.tracked = "1";
      window.SAXO_TRACK("funnel_step_" + (i + 1));
    }
    steps.forEach(function (s, idx) { s.classList.toggle("active", idx === i); });
    keys.forEach(function (k, idx) {
      k.classList.toggle("active", idx === i);
      k.classList.toggle("done", idx < i);
    });
    rods.forEach(function (r, idx) { r.classList.toggle("done", idx < i); });
    var box = document.querySelector(".funnel");
    if (box && i > 0) box.scrollIntoView({ behavior: "smooth", block: "start" });
    if (i === steps.length - 1) buildSummary();
  }

  function markInvalid(fieldEl, invalid) {
    if (!fieldEl) return;
    fieldEl.classList.toggle("invalid", invalid);
  }

  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }

  function validateStep(i) {
    var ok = true;
    var stepEl = steps[i];
    var stepErr = stepEl.querySelector(".step-err");

    if (i === 0) {
      var chosen = funnel.querySelector('input[name="anlass"]:checked');
      ok = !!chosen;
      if (stepErr) stepErr.classList.toggle("show", !ok);
    }
    if (i === 1) {
      var loc = funnel.querySelector('[name="ort"]');
      var guests = funnel.querySelector('[name="gaeste"]');
      var dat = funnel.querySelector('[name="datum"]');
      var fmts = funnel.querySelectorAll("input.js-format:checked");
      var locOk = loc.value.trim().length >= 2;
      var gOk = guests.value !== "";
      var dOk = dat.value !== "";
      var fOk = fmts.length > 0;
      markInvalid(loc.closest(".field"), !locOk);
      markInvalid(guests.closest(".field"), !gOk);
      markInvalid(dat.closest(".field"), !dOk);
      var fErr = funnel.querySelector('input[name="format"]').parentNode.querySelector(".err");
      if (fErr) fErr.classList.toggle("show", !fOk);
      ok = locOk && gOk && dOk && fOk;
    }
    if (i === 2) {
      var name = funnel.querySelector('[name="name"]');
      var mail = funnel.querySelector('[name="email"]');
      var phone = funnel.querySelector('[name="telefon"]');
      var consent = funnel.querySelector('[name="datenschutz"]');
      var nOk = name.value.trim().length >= 2;
      var mOk = validEmail(mail.value.trim());
      var pOk = phone.value.replace(/[^0-9]/g, "").length >= 6;
      var cOk = consent.checked;
      markInvalid(name.closest(".field"), !nOk);
      markInvalid(mail.closest(".field"), !mOk);
      markInvalid(phone.closest(".field"), !pOk);
      if (stepErr) stepErr.classList.toggle("show", !cOk);
      ok = nOk && mOk && pOk && cOk;
    }
    return ok;
  }

  function labelFor(inputName) {
    var el = funnel.querySelector('input[name="' + inputName + '"]:checked');
    if (!el) return "";
    var lbl = funnel.querySelector('label[for="' + el.id + '"] strong');
    return lbl ? lbl.textContent : el.value;
  }

  function buildSummary() {
    var parts = [];
    var anlass = labelFor("anlass");
    var fmtChecked = Array.prototype.slice.call(funnel.querySelectorAll("input.js-format:checked"));
    var format = fmtChecked.map(function (b) {
      var lbl = funnel.querySelector('label[for="' + b.id + '"] strong');
      return lbl ? lbl.textContent : b.value;
    }).join(" + ");
    var fmtHidden = funnel.querySelector('input[name="format"]');
    if (fmtHidden) fmtHidden.value = fmtChecked.map(function (b) { return b.value; }).join(" + ");
    var datum = funnel.querySelector('[name="datum"]').value;
    var ort = funnel.querySelector('[name="ort"]').value.trim();
    var gaeste = funnel.querySelector('[name="gaeste"]');
    var gaesteTxt = gaeste.selectedIndex > 0 ? gaeste.options[gaeste.selectedIndex].text : "";

    if (anlass) parts.push(anlass);
    if (format) parts.push(format);
    if (datum) {
      var d = new Date(datum + "T00:00:00");
      if (!isNaN(d)) {
        parts.push(d.toLocaleDateString(currentLang === "de" ? "de-DE" : "en-GB",
          { day: "2-digit", month: "2-digit", year: "numeric" }));
      }
    }
    if (ort) parts.push(ort);
    var venue = funnel.querySelector('[name="location"]');
    if (venue && venue.value.trim()) parts.push(venue.value.trim());
    if (gaesteTxt) parts.push(gaesteTxt + (currentLang === "de" ? " Gäste" : " guests"));

    var summary = parts.join(" · ");
    var box = document.getElementById("summary-text");
    if (box) box.textContent = summary;
    var hidden = funnel.querySelector('[name="zusammenfassung"]');
    if (hidden) hidden.value = summary;
    var subject = funnel.querySelector('[name="subject"]');
    if (subject) subject.value = "Neue Anfrage: " + summary;
    // Sprache für die Bestätigungsmail (submission-created-Function)
    var spr = funnel.querySelector('[name="sprache"]');
    if (spr) spr.value = currentLang;
  }

  funnel.addEventListener("click", function (e) {
    var next = e.target.closest("[data-next]");
    var back = e.target.closest("[data-back]");
    if (next) {
      e.preventDefault();
      if (validateStep(current)) {
        showStep(Math.min(current + 1, steps.length - 1));
      } else {
        var bad = steps[current].querySelector(".invalid input, .invalid select, .invalid textarea");
        if (bad) bad.focus({ preventScroll: false });
      }
    }
    if (back) {
      e.preventDefault();
      showStep(Math.max(current - 1, 0));
    }
  });

  // Format-Auswahl: Mehrfach möglich; "Noch offen" exklusiv; Empfang & Jazz-Ensemble je max. 1
  var fmtBoxes = Array.prototype.slice.call(funnel.querySelectorAll("input.js-format"));
  fmtBoxes.forEach(function (box) {
    box.addEventListener("change", function () {
      if (!box.checked) return;
      if (box.dataset.group === "open") {
        fmtBoxes.forEach(function (b) { if (b !== box) b.checked = false; });
      } else {
        fmtBoxes.forEach(function (b) {
          if (b === box) return;
          if (b.dataset.group === "open") b.checked = false;
          if ((box.dataset.group === "emp" || box.dataset.group === "jazz") && b.dataset.group === box.dataset.group) {
            b.checked = false;
          }
          if (box.dataset.group === "party" && b.dataset.group === "party") {
            var boxSolo = box.dataset.solo === "1";
            var bSolo = b.dataset.solo === "1";
            if (boxSolo !== bSolo) b.checked = false;
          }
        });
      }
      var err = funnel.querySelector('input[name="format"]');
      if (err) {
        var p = err.parentNode.querySelector(".err");
        if (p) p.classList.remove("show");
      }
    });
  });

  // Anlass-Auswahl springt automatisch weiter (weniger Klicks = besserer Funnel)
  funnel.querySelectorAll('input[name="anlass"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
      var err = steps[0].querySelector(".step-err");
      if (err) err.classList.remove("show");
      setTimeout(function () { showStep(1); }, 250);
    });
  });

  funnel.addEventListener("submit", function (e) {
    if (!validateStep(2)) {
      e.preventDefault();
      return;
    }
    buildSummary();
    if (window.SAXO_TRACK) window.SAXO_TRACK("funnel_submit");
    var submitBtn = funnel.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add("is-sending");
      var lang = (localStorage.getItem("saxofaxo-lang") || "de");
      submitBtn.textContent = lang === "en" ? "Sending\u2026" : "Wird gesendet\u2026";
    }
  });

  funnel.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    var tag = e.target.tagName;
    if (tag === "TEXTAREA" || tag === "BUTTON") return;
    if (current < steps.length - 1) {
      e.preventDefault();
      var nextBtn = steps[current].querySelector("[data-next]");
      if (nextBtn) nextBtn.click();
    }
  });

  var dateInput = funnel.querySelector('input[type="date"]');
  if (dateInput) dateInput.min = new Date().toISOString().split("T")[0];

  /* Autosave: Eingaben überleben ein versehentliches Neuladen (nur diese Sitzung) */
  var AS_KEY = "saxofaxo-funnel";
  function saveDraft() {
    try {
      var data = {};
      funnel.querySelectorAll("input[name], select[name], textarea[name]").forEach(function (el) {
        if (el.type === "hidden" || el.name === "bot-field") return;
        if (el.type === "checkbox" || el.type === "radio") {
          if (el.checked) data[el.name + "::" + el.value] = 1;
        } else if (el.value) {
          data[el.name] = el.value;
        }
      });
      data.__step = current;
      sessionStorage.setItem(AS_KEY, JSON.stringify(data));
    } catch (e) {}
  }
  function restoreDraft() {
    try {
      var raw = sessionStorage.getItem(AS_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      funnel.querySelectorAll("input[name], select[name], textarea[name]").forEach(function (el) {
        if (el.type === "hidden" || el.name === "bot-field") return;
        if (el.type === "checkbox" || el.type === "radio") {
          if (data[el.name + "::" + el.value]) {
            el.checked = true;
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } else if (data[el.name]) {
          el.value = data[el.name];
        }
      });
      if (typeof data.__step === "number" && data.__step > 0 && data.__step < steps.length) {
        showStep(data.__step);
      }
    } catch (e) {}
  }
  funnel.addEventListener("input", saveDraft);
  funnel.addEventListener("change", saveDraft);
  funnel.addEventListener("submit", function () {
    if (validateStep(2)) { try { sessionStorage.removeItem(AS_KEY); } catch (e) {} }
  });
  restoreDraft();

  /* Live-Validierung: sanft beim Verlassen des Felds, Fehler löschen beim Tippen */
  funnel.querySelectorAll(".field input, .field textarea").forEach(function (el) {
    el.addEventListener("blur", function () {
      var field = el.closest(".field");
      if (!field) return;
      var bad = false;
      if (el.required && !el.value.trim()) bad = true;
      if (el.type === "email" && el.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value)) bad = true;
      field.classList.toggle("invalid", bad);
    });
    el.addEventListener("input", function () {
      var field = el.closest(".field");
      if (field && field.classList.contains("invalid") && el.value.trim()) field.classList.remove("invalid");
    });
  });

  showStep(0);
})();

/* ---------- Hero-Hintergrundvideo ----------
 * Selbst gehostete MP4 (/assets/video/hero.mp4). Blendet sanft ein, sobald
 * abspielbar; existiert die Datei (noch) nicht oder ist Datensparen aktiv,
 * bleibt einfach der Gradient-Hintergrund stehen. Kein Drittanbieter, kein Consent.
 */
(function () {
  var video = document.getElementById("hero-video");
  if (!video) return;

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  if (reduced || saveData) {
    video.removeAttribute("autoplay");
    video.remove();
    return;
  }

  video.addEventListener("canplay", function () {
    video.classList.add("is-playing");
  });
  video.addEventListener("error", function () {
    video.remove();
  }, true);
  // Nur ein Fehler der LETZTEN <source> bedeutet "keine abspielbare Quelle" –
  // scheitert nur die WebM-Variante, fällt der Browser selbst auf MP4 zurück.
  var srcs = video.querySelectorAll("source");
  var lastSrc = srcs[srcs.length - 1];
  if (lastSrc) lastSrc.addEventListener("error", function () { video.remove(); });
})();

/* ---------- Datenschutz-Hinweisbanner ----------
 * Diese Seite setzt keine Tracking-Cookies; der Banner informiert einmalig
 * (Sprachwahl-localStorage, 2-Klick-Videos) und merkt sich die Bestätigung.
 */
(function () {
  var KEY = "saxofaxo-consent-info";
  try {
    if (localStorage.getItem(KEY)) return;
  } catch (e) { return; }

  var depth = (location.pathname.match(/\/[^\/]+\//g) || []).length;
  var base = new Array(depth + 1).join("../");

  var banner = document.createElement("div");
  banner.className = "consent-banner";
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-label", "Datenschutz-Hinweis");
  banner.innerHTML =
    '<p><span data-i18n="banner.text">Diese Website verwendet keine Tracking-Cookies. Externe Videos (Vimeo/YouTube) laden erst nach Ihrem Klick, Ihre Sprachwahl wird lokal gespeichert. Das Anfrageformular ist durch Google reCAPTCHA vor Spam geschützt.</span> ' +
    '<a href="' + base + 'datenschutz/" data-i18n="banner.more">Details in der Datenschutzerklärung</a></p>' +
    '<button type="button" class="btn btn-primary" data-i18n="banner.ok">Verstanden</button>';
  document.body.appendChild(banner);

  // Übersetzung auf den nachträglich eingefügten Banner anwenden
  if (window.SAXO_APPLY_LANG) window.SAXO_APPLY_LANG();

  banner.querySelector("button").addEventListener("click", function () {
    try { localStorage.setItem(KEY, "1"); } catch (e) {}
    banner.remove();
  });
})();


/* ---------- Referenzleiste: CSS-Animation + WCAG-Pause ----------
 * Die Bewegung läuft als reine CSS-Keyframe-Animation (GPU, robust in allen
 * Browsern). JS liefert nur noch die explizite Pause-Steuerung (WCAG 2.2.2).
 */
(function () {
  var track = document.querySelector(".marquee-track");
  if (!track) return;
  var marquee = track.closest(".marquee");
  if (!marquee) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var dict = window.SAXO_I18N || { de: {}, en: {} };
  var lang = localStorage.getItem("saxofaxo-lang") || "de";
  function t(key, fb) { return (dict[lang] && dict[lang][key]) || fb; }

  var stopped = false;
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "marquee-toggle";
  btn.setAttribute("aria-pressed", "false");
  btn.setAttribute("aria-label", t("marquee.pause", "Laufband anhalten"));
  var iconPause = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="7" y="6" width="3.2" height="12" rx="0.8"/><rect x="13.8" y="6" width="3.2" height="12" rx="0.8"/></svg>';
  var iconPlay = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M8 5.5v13l10-6.5z"/></svg>';
  btn.innerHTML = iconPause;
  marquee.appendChild(btn);
  btn.addEventListener("click", function () {
    stopped = !stopped;
    track.classList.toggle("is-stopped", stopped);
    btn.setAttribute("aria-pressed", String(stopped));
    btn.setAttribute("aria-label", stopped ? t("marquee.play", "Laufband fortsetzen") : t("marquee.pause", "Laufband anhalten"));
    btn.innerHTML = stopped ? iconPlay : iconPause;
  });
})();

/* ---------- UX: aktive Seite in der Navigation markieren ---------- */
(function () {
  var path = location.pathname.replace(/index\.html$/, "");
  document.querySelectorAll(".nav-links a").forEach(function (a) {
    var href = a.getAttribute("href");
    if (!href || a.classList.contains("btn")) return;
    var target = new URL(href, location.href).pathname.replace(/index\.html$/, "");
    if (target === path) a.setAttribute("aria-current", "page");
  });
})();

/* ---------- UX: Header verdichtet sich beim Scrollen ---------- */
(function () {
  var header = document.querySelector(".site-header");
  if (!header) return;
  var ticking = false;
  function update() {
    header.classList.toggle("scrolled", window.scrollY > 24);
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
})();

/* ---------- UX: sanftes Einblenden beim Scrollen (progressiv, barrierefrei) ---------- */
(function () {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var targets = document.querySelectorAll(".section-head, .card, .testimonial, .index-row, .photo-band figure, .fmt, .quote, .fmt-photo, .dj-card, .release-cover, .release-body, .facts > div, .name-story");
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        en.target.classList.add("in");
        io.unobserve(en.target);
      }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  targets.forEach(function (t, idx) {
    t.classList.add("js-reveal");
    if (t.matches(".photo-band figure, .fmt-photo, .dj-photo, .release-cover")) t.classList.add("rv-clip");
    t.style.transitionDelay = Math.min(idx % 4, 3) * 60 + "ms";
    io.observe(t);
  });
})();

/* ---------- Galerie: "Mehr anzeigen" (progressiv, ohne JS bleiben alle sichtbar) ---------- */
(function () {
  var grid = document.querySelector(".photo-grid");
  if (!grid) return;
  var photos = Array.prototype.slice.call(grid.querySelectorAll(".photo"));
  var INITIAL = 6;
  if (photos.length <= INITIAL + 1) return;

  var hidden = photos.slice(INITIAL);
  hidden.forEach(function (p) { p.classList.add("is-hidden"); });

  var dict = window.SAXO_I18N || { de: {}, en: {} };
  var lang = localStorage.getItem("saxofaxo-lang") || "de";
  var moreBtn = document.createElement("button");
  moreBtn.type = "button";
  moreBtn.className = "btn btn-ghost gallery-more";
  moreBtn.setAttribute("data-i18n", "media.photos.more");
  moreBtn.textContent = (dict[lang] && dict[lang]["media.photos.more"]) || "Mehr Fotos anzeigen";
  moreBtn.setAttribute("aria-expanded", "false");

  var slot = document.createElement("p");
  slot.className = "gallery-more-slot";
  grid.parentNode.insertBefore(slot, grid.nextSibling);
  slot.appendChild(moreBtn);

  moreBtn.addEventListener("click", function () {
    hidden.forEach(function (p, i) {
      p.classList.remove("is-hidden");
      p.classList.add("js-reveal");
      p.style.transitionDelay = Math.min(i, 5) * 50 + "ms";
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { p.classList.add("in"); });
      });
    });
    moreBtn.setAttribute("aria-expanded", "true");
    slot.remove();
  });
})();

/* ---------- UX: nur ein Video spielt gleichzeitig ---------- */
(function () {
  var videos = document.querySelectorAll("video:not(#hero-video)");
  if (videos.length < 2) return;
  videos.forEach(function (v) {
    v.addEventListener("play", function () {
      videos.forEach(function (other) {
        if (other !== v && !other.paused) other.pause();
      });
    });
  });
})();

/* ---------- Performance: Hero-Video pausiert außerhalb des Sichtfelds ---------- */
(function () {
  var video = document.getElementById("hero-video");
  if (!video || !("IntersectionObserver" in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!document.body.contains(video)) return;
      if (en.isIntersecting) {
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        video.pause();
      }
    });
  }, { threshold: 0.05 });
  io.observe(video);
})();

/* ---------- UX: Zurück-nach-oben nach längerem Scrollen ---------- */
(function () {
  var dict = window.SAXO_I18N || { de: {}, en: {} };
  var lang = localStorage.getItem("saxofaxo-lang") || "de";
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "to-top";
  btn.setAttribute("aria-label", (dict[lang] && dict[lang]["a11y.top"]) || "Nach oben");
  btn.setAttribute("data-i18n-aria", "a11y.top");
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 19V5m0 0l-6 6m6-6l6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  document.body.appendChild(btn);
  btn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
  var ticking = false;
  function update() {
    btn.classList.toggle("show", window.scrollY > window.innerHeight * 1.5);
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
})();

/* ---------- Galerie-Lightbox: natives <dialog>, Pfeiltasten, ESC ---------- */
(function () {
  var grid = document.querySelector(".photo-grid");
  if (!grid) return;
  var dlg = document.createElement("dialog");
  if (typeof dlg.showModal !== "function") return; // sehr alte Browser: Galerie bleibt einfach klickfrei

  var dict = window.SAXO_I18N || { de: {}, en: {} };
  var lang = localStorage.getItem("saxofaxo-lang") || "de";
  function t(key, fallback) { return (dict[lang] && dict[lang][key]) || fallback; }

  var photos = Array.prototype.slice.call(grid.querySelectorAll(".photo"));
  if (!photos.length) return;
  var current = 0;

  dlg.className = "lightbox";
  dlg.setAttribute("aria-label", t("lb.label", "Bildansicht"));
  dlg.innerHTML =
    '<button class="lb-close" type="button" aria-label="' + t("lb.close", "Schließen") + '">&times;</button>' +
    '<button class="lb-prev" type="button" aria-label="' + t("lb.prev", "Vorheriges Bild") + '">&larr;</button>' +
    '<figure class="lb-figure"><img alt=""><figcaption></figcaption></figure>' +
    '<button class="lb-next" type="button" aria-label="' + t("lb.next", "Nächstes Bild") + '">&rarr;</button>' +
    '<p class="lb-count" aria-hidden="true"></p>';
  document.body.appendChild(dlg);

  var img = dlg.querySelector("img");
  var cap = dlg.querySelector("figcaption");
  var count = dlg.querySelector(".lb-count");

  function show(i) {
    current = (i + photos.length) % photos.length;
    var src = photos[current].querySelector("img");
    img.src = src.currentSrc || src.src;
    img.alt = src.alt || "";
    var credit = photos[current].querySelector("figcaption");
    cap.textContent = credit ? credit.textContent : "";
    cap.style.display = credit ? "" : "none";
    count.textContent = (current + 1) + " / " + photos.length;
  }
  photos.forEach(function (p, i) {
    p.classList.add("lb-enabled");
    p.addEventListener("click", function () {
      show(i);
      dlg.showModal();
    });
  });
  dlg.querySelector(".lb-close").addEventListener("click", function () { dlg.close(); });
  dlg.querySelector(".lb-prev").addEventListener("click", function () { show(current - 1); });
  dlg.querySelector(".lb-next").addEventListener("click", function () { show(current + 1); });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });
})();

/* ---------- Deep-Links: #faq-N öffnet das Akkordeon automatisch ---------- */
(function () {
  function openFromHash() {
    if (!location.hash) return;
    var el = document.querySelector(location.hash.replace(/[^#\w-]/g, ""));
    if (el && el.tagName === "DETAILS") {
      el.open = true;
      el.scrollIntoView({ block: "start" });
    }
  }
  window.addEventListener("hashchange", openFromHash);
  openFromHash();
})();

/* ---------- Dynamische Inhalte aus dem Admin-Panel (/api/content) ---------- */
(function () {
  if (!window.fetch) return;
  fetch("/api/content", { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d) return;

      /* Ankündigungs-Balken */
      if (d.banner && d.banner.on && d.banner.text) {
        var note = document.createElement("div");
        note.className = "site-note";
        var span = document.createElement("span");
        span.textContent = d.banner.text;
        note.appendChild(span);
        if (d.banner.link && /^https?:\/\//.test(d.banner.link)) {
          var a = document.createElement("a");
          a.href = d.banner.link;
          a.target = "_blank";
          a.rel = "noopener";
          a.textContent = d.banner.linkLabel || "Mehr erfahren";
          note.appendChild(a);
        }
        var header = document.querySelector(".site-header");
        if (header && header.parentNode) header.parentNode.insertBefore(note, header.nextSibling);
      }

      /* Musik-Block (Über mich) */
      if (d.release) {
        var t = document.querySelector(".release-body h2");
        if (t && d.release.title) t.textContent = d.release.title;
        var ar = document.querySelector(".release-artists");
        if (ar && d.release.artists) ar.textContent = d.release.artists;
        var le = document.querySelector('[data-i18n="release.lede"]');
        if (le && d.release.lede) { le.textContent = d.release.lede; le.removeAttribute("data-i18n"); }
        if (d.release.link && /^https?:\/\//.test(d.release.link)) {
          var btn = document.querySelector('[data-i18n="release.btn"]');
          if (btn) btn.setAttribute("href", d.release.link);
          var cov = document.querySelector(".cover-frame a");
          if (cov) cov.setAttribute("href", d.release.link);
        }
      }

      /* Referenz-Laufband */
      if (d.refs && d.refs.length) {
        document.querySelectorAll(".marquee-track ul").forEach(function (ul) {
          ul.textContent = "";
          d.refs.forEach(function (r) {
            var li = document.createElement("li");
            li.textContent = r;
            ul.appendChild(li);
          });
        });
      }
    })
    .catch(function () {});
})();

/* ---------- Fakten: Zahlen zählen beim Erscheinen hoch ---------- */
(function () {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var facts = document.querySelectorAll(".facts strong");
  if (!facts.length) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      var el = en.target;
      var finalText = el.textContent;
      var match = finalText.match(/(\d+[,.]?\d*)/);
      if (!match) return;
      var raw = match[1];
      var decimal = raw.indexOf(",") > -1;
      var target = parseFloat(raw.replace(",", "."));
      var start = null;
      var DUR = 900;
      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / DUR, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        var val = target * eased;
        var shown = decimal ? val.toFixed(1).replace(".", ",") : String(Math.round(val));
        el.textContent = finalText.replace(raw, shown);
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = finalText;
      }
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  facts.forEach(function (f) { io.observe(f); });
})();
