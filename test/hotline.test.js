const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const H = require("../public/hotline.js");
const { element, textNode, makeDoc, find } = require("./fakedom.js");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "../public/hotlines.json"), "utf8"));
const DEFAULT = "server default";
function node(lang) {
  const n = element("div", { "data-hotline": "", "data-lang": lang });
  n.appendChild(textNode(DEFAULT));
  return n;
}

test("pick: country with entry returns its lines, case-insensitive", () => {
  assert.strictEqual(H.pick(data.countries, "us").length, 2);
  assert.strictEqual(H.pick(data.countries, "FR").length, 1);
});
test("pick: known country with empty entry or no entry returns []", () => {
  assert.deepStrictEqual(H.pick(data.countries, "ES"), []);
  assert.deepStrictEqual(H.pick(data.countries, "JP"), []);
});
test("pick: unknown or malformed country returns null", () => {
  for (const c of [null, undefined, "", "XX", "T1", "USA", "1", 5, {}, "U S"]) assert.strictEqual(H.pick(data.countries, c), null, String(c));
});
test("pick: bad data returns null", () => {
  for (const d of [null, undefined, "x", 3]) assert.strictEqual(H.pick(d, "US"), null);
});
test("pick: prototype keys are not countries", () => {
  assert.deepStrictEqual(H.pick({}, "US"), []);
  assert.deepStrictEqual(H.pick(Object.create({ US: { lines: [{}] } }), "US"), []);
});
test("tel validation accepts E.164 and domestic digits, rejects junk", () => {
  for (const ok of ["+15550100", "+33100000000", "1300000000", "08000000000", "112"]) assert.ok(H.TEL_RE.test(ok), ok);
  for (const bad of ["", "+1 555 0100", "javascript:alert(1)", "12", "+12", "555-0100", "1300000000000", "+", "tel:+1555", "1;DROP"]) assert.ok(!H.TEL_RE.test(bad), bad);
});
test("pick drops lines with invalid tel or missing fields", () => {
  const c = { US: { lines: [
    { name: "ok", phone: "1", tel: "+15550100" },
    { name: "bad tel", phone: "1", tel: "javascript:x" },
    { name: "", phone: "1", tel: "+15550100" },
    { name: "no phone", tel: "+15550100" },
    null,
  ] } };
  assert.strictEqual(H.pick(c, "US").length, 1);
});
test("render: lines become tel: links with localized cost and hours", () => {
  const n = node("en");
  assert.ok(H.render(makeDoc([n]), n, H.pick(data.countries, "US"), data.strings));
  const links = find(n, "a");
  assert.strictEqual(links.length, 2);
  assert.strictEqual(links[0].getAttribute("href"), "tel:+15550100");
  assert.match(n.textContent, /Poison help line:/);
  assert.match(n.textContent, /Example Poison Line: \+1 555 0100 \(fee applies, 24\/7\)/);
});
test("render: French strings, verbatim non-24/7 hours", () => {
  const n = node("fr");
  H.render(makeDoc([n]), n, H.pick(data.countries, "FR"), data.strings);
  assert.match(n.textContent, /Ligne d'aide antipoison:/);
  assert.match(n.textContent, /\(payant, 24h\/24\)/);
});
test("render: domestic digits for AU 1300 and BR 0800", () => {
  const a = node("en"), b = node("en");
  H.render(makeDoc([a]), a, H.pick(data.countries, "AU"), data.strings);
  H.render(makeDoc([b]), b, H.pick(data.countries, "BR"), data.strings);
  assert.strictEqual(find(a, "a")[0].getAttribute("href"), "tel:1300000000");
  assert.strictEqual(find(b, "a")[0].getAttribute("href"), "tel:08000000000");
  assert.match(b.textContent, /\(free, 24\/7\)/);
});
test("render: unknown language falls back to en", () => {
  const n = node("zz");
  H.render(makeDoc([n]), n, H.pick(data.countries, "US"), data.strings);
  assert.match(n.textContent, /Poison help line:/);
});
test("render: bad cost enum is dropped, never shown raw", () => {
  const n = node("en");
  H.render(makeDoc([n]), n, [{ name: "L", phone: "1", tel: "+15550100", cost: "<b>free</b>" }], data.strings);
  assert.strictEqual(n.textContent, "Poison help line: L: 1");
});
test("render: markup in data stays text, never becomes nodes", () => {
  const n = node("en");
  H.render(makeDoc([n]), n, [{ name: "<img src=x onerror=1>", phone: "<b>1</b>", tel: "+15550100" }], data.strings);
  assert.strictEqual(find(n, "img").length, 0);
  assert.strictEqual(find(n, "b").length, 0);
  assert.match(n.textContent, /<img src=x onerror=1>/);
});
test("render: known country with no lines shows fallback text and no number", () => {
  const n = node("en");
  H.render(makeDoc([n]), n, [], data.strings);
  assert.strictEqual(find(n, "a").length, 0);
  assert.match(n.textContent, /local emergency number/);
});
test("render: no strings or no fallback leaves the default untouched", () => {
  const n = node("en");
  assert.strictEqual(H.render(makeDoc([n]), n, [], null), false);
  assert.strictEqual(H.render(makeDoc([n]), n, [], { en: { heading: "H" } }), false);
  assert.strictEqual(n.textContent, DEFAULT);
});
test("swapAll: unknown country, null, or broken data leave every node untouched", () => {
  for (const [d, c] of [[data, null], [data, "XX"], [data, "T1"], [null, "US"], [{}, "US"], [{ countries: 5 }, "US"]]) {
    const n = node("en");
    assert.strictEqual(H.swapAll(makeDoc([n]), d, c), 0);
    assert.strictEqual(n.textContent, DEFAULT);
  }
});
test("swapAll: swaps every marked node and reports the count", () => {
  const ns = [node("en"), node("fr"), node("en")];
  assert.strictEqual(H.swapAll(makeDoc(ns), data, "FR"), 3);
  assert.ok(ns.every((n) => n.textContent !== DEFAULT));
});
test("sample data hygiene: only fictional numbers, valid cost enums", () => {
  for (const [code, entry] of Object.entries(data.countries)) {
    assert.match(code, /^[A-Z]{2}$/);
    for (const l of entry.lines) {
      assert.ok(H.TEL_RE.test(l.tel), l.tel);
      assert.ok(["free", "fee", "fee_may"].includes(l.cost), l.cost);
      assert.match(l.tel, /^(\+1555010\d|\+33100000000|1300000000|08000000000)$/, "sample numbers must stay fictional");
    }
  }
});
