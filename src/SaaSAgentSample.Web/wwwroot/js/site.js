// Progressive enhancement for the header EN / 日本語 toggle.
//
// The links point at /set-culture (which sets the culture cookie and redirects),
// so without JavaScript the toggle still works via a normal full-page navigation.
// When fetch + DOMParser are available we intercept the click, request the same
// page in the chosen culture, and swap the localized regions in place — so the
// language changes without a visible refresh. Strings remain server-rendered from
// the .resx catalog (single source of truth); this only removes the reload.
(function () {
  "use strict";
  if (!window.fetch || !window.DOMParser) return;

  function swapInner(sourceDoc, selector) {
    var next = sourceDoc.querySelector(selector);
    var current = document.querySelector(selector);
    if (next && current) current.innerHTML = next.innerHTML;
  }

  // Legacy #how links now point at the repository guide, without forwarding page query data.
  function openSection() {
    if (!["#how", "#boundary", "#behind-scenes", "#history", "#implementation-details"].includes(window.location.hash)) return;
    var anchor = window.location.hash === "#implementation-details" ? "how" : window.location.hash.substring(1);
    var how = document.getElementById(anchor);
    if (!how) return;
    if (how.tagName === "DETAILS") how.open = true;
    for (var ancestor = how.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName === "DETAILS") ancestor.open = true;
    }
    // Scroll by hand rather than with scrollIntoView: the header is sticky, so aligning the
    // element with the top of the viewport would park it underneath the header.
    var header = document.querySelector(".site-header");
    var offset = (header ? header.getBoundingClientRect().height : 0) + 8;
    var top = how.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo(0, top > 0 ? top : 0);
  }

  document.addEventListener("click", function (e) {
    var link = e.target.closest(".site-header .lang a");
    if (!link) return;
    // Respect new-tab / modified clicks and let them navigate normally.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var href = link.getAttribute("href");
    if (!href) return;

    e.preventDefault();
    var openPanels = Array.from(document.querySelectorAll("details[open][id]")).map(function (panel) { return panel.id; });

    fetch(href, { headers: { "X-Requested-With": "fetch" }, credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error("culture switch failed: " + res.status);
        return res.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        // Re-render the localized regions. The click listener is delegated on
        // document, so replacing the header (and its toggle links) is safe.
        swapInner(doc, "main");
        swapInner(doc, ".site-header");
        swapInner(doc, ".orient-bar");
        swapInner(doc, ".partner-sidebar");
        swapInner(doc, ".site-footer");

        var lang = doc.documentElement.getAttribute("lang");
        if (lang) document.documentElement.setAttribute("lang", lang);
        // Keep subsequent form posts in the selected language, even when arrival included ?culture=.
        if (lang === "ja" || lang === "en") {
          var currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set("culture", lang);
          currentUrl.searchParams.delete("ui-culture");
          window.history.replaceState(window.history.state, "", currentUrl.href);
        }

        var title = doc.querySelector("title");
        if (title) document.title = title.textContent;

        openPanels.forEach(function (id) {
          var panel = document.getElementById(id);
          if (panel && panel.tagName === "DETAILS") panel.open = true;
        });
        openSection();
      })
      .catch(function () {
        // Any failure falls back to a normal navigation.
        window.location.assign(href);
      });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", openSection);
  } else {
    openSection();
  }
  window.addEventListener("hashchange", openSection);
})();
