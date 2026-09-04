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

  // The emulator links here with #how so a reader looking for a term lands on the
  // explanation already open, instead of on a closed summary they have to spot.
  function openHow() {
    if (window.location.hash !== "#how") return;
    var how = document.getElementById("how");
    if (!how) return;
    how.open = true;
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
        swapInner(doc, ".site-footer");

        var lang = doc.documentElement.getAttribute("lang");
        if (lang) document.documentElement.setAttribute("lang", lang);

        var title = doc.querySelector("title");
        if (title) document.title = title.textContent;

        // The swap rebuilds <main>, so a details opened via #how closes again.
        openHow();
      })
      .catch(function () {
        // Any failure falls back to a normal navigation.
        window.location.assign(href);
      });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", openHow);
  } else {
    openHow();
  }
  window.addEventListener("hashchange", openHow);
})();
