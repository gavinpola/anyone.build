// Demo page for ask.js: takes the site key (and where notes go) from the URL,
// the way the "Try it" link on /sites hands them over.
(() => {
  const q = new URLSearchParams(location.search);
  const site = (q.get("site") || "").replace(/[^a-z0-9_]/g, "");
  const api = q.get("api") || "";
  const banner = document.getElementById("banner");
  if (!/^site_[a-f0-9]{20}$/.test(site)) {
    banner.innerHTML = 'This is a demo page for the widget. Open it from the <a href="/sites">Try it</a> link next to one of your sites.';
    return;
  }
  const coarse = matchMedia("(pointer: coarse)").matches;
  banner.textContent = coarse
    ? "Demo page. Tap Ask, then tap anything on this page and say what should change."
    : "Demo page. Hold ⇧⌘ (or ⇧Ctrl), click anything on this page, and say what should change.";
  const s = document.createElement("script");
  s.src = "/ask.js";
  s.setAttribute("data-site", site);
  if (/^https:\/\/[a-z0-9.-]+\.convex\.site\/ask\/note$/.test(api)) s.setAttribute("data-api", api);
  document.body.appendChild(s);
})();
