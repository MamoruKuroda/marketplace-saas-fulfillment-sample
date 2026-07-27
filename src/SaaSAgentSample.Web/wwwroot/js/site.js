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

  document.addEventListener("click", function (e) {
    var link = e.target.closest(".site-header .lang a");
    if (!link) return;
    // Respect new-tab / modified clicks and let them navigate normally.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var href = link.getAttribute("href");
    if (!href) return;

    e.preventDefault();

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
        swapInner(doc, ".stepper-bar");
        swapInner(doc, ".site-footer");

        var lang = doc.documentElement.getAttribute("lang");
        if (lang) document.documentElement.setAttribute("lang", lang);

        var title = doc.querySelector("title");
        if (title) document.title = title.textContent;
      })
      .catch(function () {
        // Any failure falls back to a normal navigation.
        window.location.assign(href);
      });
  });
})();
