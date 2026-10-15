// Show the visitor the right phone line for their country.
//
// Markup: <div data-hotline data-lang="en">...server-rendered default...</div>
//   country has an entry with valid lines -> heading + each line as a tel: link
//   known country, no entry / no valid line -> heading + generic fallback text (no number)
//   unknown country, bad data, any error    -> the server-rendered default is left untouched
// DOM nodes only (createElement / createTextNode), never innerHTML.
(function (root) {
  // E.164 (+ then 6-15 digits) OR plain domestic digits. Non-geographic numbers (AU 1300, BR 0800)
  // are only dialable domestically, so forcing E.164 would silently break them.
  var TEL_RE = /^(\+\d{6,15}|\d{3,12})$/;
  var COSTS = { free: 1, fee: 1, fee_may: 1 };
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

  function validLine(l) {
    return !!l && typeof l.name === "string" && l.name !== "" &&
      typeof l.phone === "string" && l.phone !== "" &&
      typeof l.tel === "string" && TEL_RE.test(l.tel);
  }

  // -> array of valid lines (empty = known country, show fallback), or null = leave the default alone.
  function pick(countries, country) {
    if (typeof country !== "string" || !/^[A-Za-z]{2}$/.test(country)) return null;
    var c = country.toUpperCase();
    if (c === "XX" || c === "T1") return null; // Cloudflare: unknown / Tor
    if (!countries || typeof countries !== "object") return null;
    var entry = has(countries, c) ? countries[c] : null;
    var lines = entry && Array.isArray(entry.lines) ? entry.lines : [];
    return lines.filter(validLine);
  }

  function strFor(strings, lang) {
    if (!strings || typeof strings !== "object") return null;
    if (lang && has(strings, lang) && strings[lang]) return strings[lang];
    return has(strings, "en") && strings.en ? strings.en : null;
  }

  function text(S, key) { return S && typeof S[key] === "string" ? S[key] : ""; }

  function el(doc, tag, txt) {
    var n = doc.createElement(tag);
    if (txt) n.appendChild(doc.createTextNode(txt));
    return n;
  }

  // cost is an enum; anything else is dropped, never shown raw. Only exactly "24/7" is localized;
  // other hours strings are assumed to be written in the line's own language and kept verbatim.
  function extras(line, S) {
    var out = [];
    if (typeof line.cost === "string" && has(COSTS, line.cost) && text(S, "cost_" + line.cost)) out.push(text(S, "cost_" + line.cost));
    if (typeof line.hours === "string" && line.hours) out.push(line.hours === "24/7" && text(S, "hours_247") ? text(S, "hours_247") : line.hours);
    return out;
  }

  // Returns true if the node was changed.
  function render(doc, node, lines, strings) {
    var S = strFor(strings, node.getAttribute("data-lang"));
    if (!S) return false;
    var heading = text(S, "heading");
    var kids = [];
    if (heading) kids.push(el(doc, "strong", heading + ":"), doc.createTextNode(" "));
    if (lines.length) {
      lines.forEach(function (l) {
        var row = el(doc, "span");
        row.setAttribute("class", "hotline-line");
        var a = el(doc, "a", l.name + ": " + l.phone);
        a.setAttribute("href", "tel:" + l.tel);
        row.appendChild(a);
        var x = extras(l, S);
        if (x.length) row.appendChild(doc.createTextNode(" (" + x.join(", ") + ")"));
        kids.push(row);
      });
    } else {
      if (!text(S, "fallback")) return false; // nothing useful to say: keep the default
      kids.push(el(doc, "span", text(S, "fallback")));
    }
    while (node.firstChild) node.removeChild(node.firstChild);
    kids.forEach(function (k) { node.appendChild(k); });
    return true;
  }

  // data = {strings, countries}. Returns the number of nodes swapped.
  function swapAll(doc, data, country) {
    if (!data || typeof data !== "object") return 0;
    var lines = pick(data.countries, country);
    if (lines === null) return 0;
    var nodes = doc.querySelectorAll("[data-hotline]");
    var n = 0;
    for (var i = 0; i < nodes.length; i++) { if (render(doc, nodes[i], lines, data.strings)) n++; }
    return n;
  }

  var api = { pick: pick, render: render, swapAll: swapAll, TEL_RE: TEL_RE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (!root) return;
  root.Hotline = api;

  // Browser auto-run: wait for the geo lookup, fetch the data only if a country is known.
  if (root.GEO && root.GEO.ready && root.document && root.fetch) {
    root.GEO.ready.then(function (country) {
      if (!country) return;
      var s = root.document.querySelector("script[data-hotline-src]");
      var src = (s && s.getAttribute("data-hotline-src")) || "/hotlines.json";
      return root.fetch(src, { credentials: "omit" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) { swapAll(root.document, data, country); });
    }).catch(function () {});
  }
})(typeof window !== "undefined" ? window : null);
