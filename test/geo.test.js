const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const GEO_PATH = path.join(__dirname, "../public/geo.js");

// geo.js reads globalThis.sessionStorage / fetch when loaded, so set them, then re-require fresh.
function load({ fetchImpl, store }) {
  delete require.cache[GEO_PATH];
  globalThis.fetch = fetchImpl;
  globalThis.sessionStorage = store;
  return require(GEO_PATH);
}
function memStore(init) {
  const m = new Map(Object.entries(init || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), m };
}
const ok = (body) => async () => ({ ok: true, json: async () => body });

test("fetches once, normalizes case, caches in sessionStorage", async () => {
  const store = memStore();
  let calls = 0;
  const g = load({ store, fetchImpl: async (...a) => { calls++; return ok({ country: "fr" })(...a); } });
  assert.strictEqual(await g.ready, "FR");
  assert.strictEqual(g.country, "FR");
  assert.strictEqual(calls, 1);
  assert.strictEqual(store.getItem("geo_country_v1"), "FR");
});
test("cached country skips the network", async () => {
  let calls = 0;
  const g = load({ store: memStore({ geo_country_v1: "BR" }), fetchImpl: async () => { calls++; } });
  assert.strictEqual(await g.ready, "BR");
  assert.strictEqual(calls, 0);
});
test("ready resolves null on network error, HTTP error, bad JSON, bad payload", async () => {
  const cases = [
    async () => { throw new Error("offline"); },
    async () => ({ ok: false, json: async () => ({}) }),
    async () => ({ ok: true, json: async () => { throw new Error("bad json"); } }),
    ok({ country: null }), ok({ country: 42 }), ok({ country: "USA" }), ok(null),
  ];
  for (const f of cases) {
    const g = load({ store: memStore(), fetchImpl: f });
    assert.strictEqual(await g.ready, null);
    assert.strictEqual(g.country, null);
  }
});
test("failure is not cached; sync fetch throw and broken storage still resolve", async () => {
  const store = memStore();
  const g = load({ store, fetchImpl: ok({ country: "XXX" }) });
  assert.strictEqual(await g.ready, null);
  assert.strictEqual(store.m.size, 0);
  const g2 = load({ store: { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } },
    fetchImpl: () => { throw new Error("sync"); } });
  assert.strictEqual(await g2.ready, null);
  const g3 = load({ store: { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } },
    fetchImpl: ok({ country: "es" }) });
  assert.strictEqual(await g3.ready, "ES");
});
