// The same demo map the publisher app shows, rendered here so the four steps have a
// "you are here" everywhere. Steps 1 and 4 happen in this emulator, so without this the
// map could never highlight them and the app had to explain the gap in prose instead.
//
// The convention is the same on both sides: a solid card is the system you are in now,
// a dashed card is the other system and opens in a new tab. Only the current step is
// expanded, so a page shows one actor and (where relevant) one part.
//
// Presentation only — no emulator behaviour or API is touched. Strings go through the
// existing i18n catalogue, and injected markup is translated with applyI18n(), the same
// way injectLanguageToggle() does it.
(function () {
  "use strict";

  // Steps 1 and 4 are this emulator; 2 and 3 are the publisher app, which is a separate
  // origin, so those links are resolved at render time from the emulator's config.
  var STEPS = [
    { n: "1", key: "map.step1", where: "map.hereEmulator", who: "map.whoBuyer", part: null, href: "/", path: null, external: false },
    { n: "2", key: "map.step2", where: "map.herePublisher", who: "map.whoBuyer", part: "map.partLanding", href: null, path: "/", external: true },
    { n: "3", key: "map.step3", where: "map.herePublisher", who: "map.whoPublisher", part: "map.partStore", href: null, path: "/admin", external: true },
    { n: "4", key: "map.step4", where: "map.hereEmulator", who: "map.whoMicrosoft", part: null, href: "/subscriptions.html", path: null, external: false },
  ];

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function i18nSpan(tag, key, className) {
    var node = el(tag, className);
    node.setAttribute("data-i18n", key);
    return node;
  }

  function buildStep(step, current, publisherUrl) {
    var card = el("div", "step" + (step.external ? " external" : "") + (current ? " current" : ""));
    card.setAttribute("role", "listitem");
    if (current) card.setAttribute("aria-current", "step");

    var href = step.external ? (publisherUrl ? publisherUrl + step.path : null) : step.href;
    var head = el(href ? "a" : "span", "step-head");
    if (href) {
      head.href = href;
      if (step.external) {
        head.target = "_blank";
        head.rel = "noopener";
      }
    }

    var num = el("span", "n");
    num.textContent = step.n;
    head.appendChild(num);

    var lbl = el("span", "lbl");
    lbl.appendChild(i18nSpan("span", step.key));
    var where = i18nSpan("small", step.where);
    lbl.appendChild(where);
    head.appendChild(lbl);
    card.appendChild(head);

    if (current) {
      card.appendChild(i18nSpan("p", step.key + "Desc", "desc"));
      var meta = el("dl", "step-meta");
      meta.appendChild(i18nSpan("dt", "map.operatedBy"));
      meta.appendChild(i18nSpan("dd", step.who));
      if (step.part) {
        meta.appendChild(i18nSpan("dt", "map.youBuild"));
        meta.appendChild(i18nSpan("dd", step.part, "is-part"));
      }
      card.appendChild(meta);
    }

    return card;
  }

  function render(current, publisherUrl) {
    var wrap = el("div", "demo-map");

    // A div, not a <nav>: the emulator styles every <nav> as its dark navigation bar, and the
    // map is not navigation chrome. role/aria keep the semantics.
    var nav = el("div", "stepper");
    nav.setAttribute("role", "list");
    nav.setAttribute("aria-label", "Demo steps");
    STEPS.forEach(function (step) {
      nav.appendChild(buildStep(step, step.n === current, publisherUrl));
    });
    wrap.appendChild(nav);

    var rp = el("p", "return-path");
    var rpn = el("span", "rp-n");
    rpn.textContent = "4\u21923";
    rp.appendChild(rpn);
    rp.appendChild(i18nSpan("span", "map.youBuild", "rp-cap"));
    rp.appendChild(i18nSpan("strong", "map.partWebhook", "is-part"));
    rp.appendChild(i18nSpan("span", "map.webhookDesc"));
    wrap.appendChild(rp);

    return wrap;
  }

  function mount(publisherUrl) {
    if (document.querySelector(".demo-map")) return;

    var current = document.body.getAttribute("data-demo-step") || "";
    var anchor = document.querySelector("p.page-hint") || document.querySelector("nav");
    if (!anchor || !anchor.parentNode) return;

    var map = render(current, publisherUrl);
    anchor.parentNode.insertBefore(map, anchor.nextSibling);
    if (window.applyI18n) window.applyI18n(map);
  }

  function start() {
    // The publisher app's URL is the landing page the emulator is configured to call, so the
    // map can link to steps 2 and 3 without hard-coding anything.
    var done = false;
    function once(url) {
      if (done) return;
      done = true;
      mount(url);
    }

    fetch("/api/util/config")
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (config) {
        var landing = config && config.landingPageUrl;
        once(landing ? landing.replace(/\/+$/, "") : null);
      })
      .catch(function () { once(null); });

    // Never let a slow or failed config call hide the map.
    window.setTimeout(function () { once(null); }, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
