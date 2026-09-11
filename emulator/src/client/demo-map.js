// Teaching navigation only. Roles do not grant access, and the guide never creates
// a purchase or a tokenless "activated landing" link.
(function () {
  "use strict";

  var TOOLS = [
    { href: "/start.html", key: "nav.marketplace" },
    { href: "/subscriptions.html", key: "nav.subscriptions" },
    { href: "/", key: "boundary.tokenTool" },
    { href: "/landing.html", key: "nav.landingPage" },
    { href: "/offers.html", key: "nav.offers" },
    { href: "/config.html", key: "nav.config" },
    { href: "https://github.com/microsoft/Commercial-Marketplace-SaaS-API-Emulator/issues", key: "boundary.issues" }
  ];
  var STEPS = [
    { n: "1", key: "map.step1", href: "/start.html" },
    { n: "2", key: "map.step2", external: true },
    { n: "3", key: "map.step3", external: true, path: "/admin" },
    { n: "4", key: "map.step4", href: "/subscriptions.html" }
  ];

  function el(tag, className, key) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (key) {
      node.setAttribute("data-i18n", key);
      node.textContent = t(key);
    }
    return node;
  }

  function teachingLink(node, href, external) {
    node.href = window.PurchaseJourney.withContext(href).href;
    if (external) {
      node.target = "_blank";
      node.rel = "noopener";
      node.setAttribute("title", t("boundary.newTab"));
    }
  }

  function roleLinks() {
    var list = document.querySelector(".role-switch nav ul");
    if (!list) return;
    list.replaceChildren();
    TOOLS.forEach(function (tool) {
      var item = el("li");
      var link = el("a", "", tool.key);
      var external = tool.href.indexOf("https:") === 0;
      if (external) {
        link.href = tool.href;
        link.target = "_blank";
        link.rel = "noopener";
      } else {
        teachingLink(link, tool.href, false);
        if (new URL(link.href).pathname === window.location.pathname ||
            (tool.href === "/" && window.location.pathname === "/index.html")) {
          link.setAttribute("aria-current", "page");
        }
      }
      item.appendChild(link);
      list.appendChild(item);
    });
  }

  function start() {
    var guideFile = window.i18nLang() === "ja" ? "walkthrough.ja.md" : "walkthrough.md";
    document.querySelectorAll("[data-implementation-guide]").forEach(function (link) {
      // Never carry a purchase token, contract ID or simulation context to GitHub.
      link.href = "https://github.com/MamoruKuroda/marketplace-saas-fulfillment-sample/blob/main/docs/" + guideFile;
    });
    roleLinks();
    if (document.querySelector(".demo-map")) return;
    var anchor = document.querySelector("body > header");
    if (!anchor || !anchor.parentNode) return;
    var current = document.body.getAttribute("data-demo-step") || "";
    var wrap = el("aside", "demo-map");
    wrap.setAttribute("aria-label", t("journey.mapLabel"));
    var nav = el("div", "stepper");
    nav.setAttribute("role", "list");
    var partnerLinks = [];
    STEPS.forEach(function (step) {
      var item = el("div", "step" + (step.external ? " external" : "") + (step.n === current ? " current" : ""));
      item.setAttribute("role", "listitem");
      if (step.n === current) item.setAttribute("aria-current", "step");
      var head = el(step.href || step.path ? "a" : "span", "step-head");
      if (step.href) teachingLink(head, step.href, false);
      if (step.path) partnerLinks.push({ node: head, path: step.path });
      var number = el("span", "n");
      number.textContent = step.n;
      head.appendChild(number);
      head.appendChild(el("span", "lbl", step.key));
      item.appendChild(head);
      nav.appendChild(item);
    });
    wrap.appendChild(nav);
    var guide = el("div", "guide-caption");
    guide.appendChild(el("strong", "", "boundary.teachingGuide"));
    var overview = el("a", "boundary-overview", "boundary.overview");
    partnerLinks.push({ node: overview, path: "/", hash: "#boundary" });
    guide.appendChild(overview);
    var status = el("span", "guide-status", "boundary.configLoading");
    status.setAttribute("role", "status");
    guide.appendChild(status);
    var roles = document.querySelector(".role-switch");
    if (roles) {
      var menu = el("div", "role-menu");
      Array.from(roles.children).forEach(function (child) {
        if (child.tagName !== "SUMMARY") menu.appendChild(child);
      });
      roles.appendChild(menu);
      guide.appendChild(roles);
    }
    wrap.appendChild(guide);
    var header = document.querySelector("body > header");
    (header || anchor).parentNode.insertBefore(wrap, header || anchor);
    if (window.applyI18n) window.applyI18n(wrap);

    var settled = false;
    function unavailable() {
      status.textContent = t("boundary.configUnavailable");
      status.setAttribute("data-i18n", "boundary.configUnavailable");
    }
    // The guide and role labels are visible even while configuration is unavailable.
    window.setTimeout(function () { if (!settled) unavailable(); }, 1500);
    fetch("/api/util/config")
      .then(function (res) {
        if (!res.ok) throw new Error("Configuration unavailable");
        return res.json();
      })
      .then(function (config) {
        var base = new URL(config.landingPageUrl);
        if (!/^https?:$/.test(base.protocol) || base.username || base.password) throw new Error("Invalid partner URL");
        partnerLinks.forEach(function (link) {
          // Root paths intentionally discard configured token/query values.
          var url = new URL(link.path, base);
          if (link.hash) url.hash = link.hash;
          teachingLink(link.node, url, true);
        });
        status.hidden = true;
        settled = true;
      })
      .catch(function () { settled = true; unavailable(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
