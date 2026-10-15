// One geo lookup per session. Exposes window.GEO:
//   GEO.country -> upper-case ISO 3166-1 alpha-2 code once known, else null
//   GEO.ready   -> Promise that ALWAYS resolves: the country string, or null on any failure
// Other scripts wait on GEO.ready instead of fetching again. Never rejects, never throws.
(function (root) {
  var KEY = "geo_country_v1";
  var geo = { country: null, ready: null };
  var settle = function () {};
  geo.ready = new Promise(function (res) { settle = res; });

  function done(c) {
    geo.country = typeof c === "string" && /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : null;
    settle(geo.country);
  }

  function start() {
    var cached = null;
    try { cached = root.sessionStorage.getItem(KEY); } catch (e) {}
    if (cached) { done(cached); return; }
    try {
      root.fetch("/api/geo", { cache: "no-store", credentials: "omit" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d || typeof d.country !== "string") { done(null); return; }
          done(d.country);
          if (geo.country) { try { root.sessionStorage.setItem(KEY, geo.country); } catch (e) {} }
        })
        .catch(function () { done(null); });
    } catch (e) { done(null); }
  }

  start();
  root.GEO = geo;
  if (typeof module !== "undefined" && module.exports) module.exports = geo;
})(typeof window !== "undefined" ? window : globalThis);
