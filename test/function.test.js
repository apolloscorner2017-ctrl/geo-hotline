const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const load = () => import(pathToFileURL(path.join(__dirname, "../functions/api/geo.js")).href);
const call = async (ctx) => { const { onRequestGet } = await load(); const r = onRequestGet(ctx); return { r, body: await r.json() }; };

test("returns upper-cased cf.country with no-store", async () => {
  const { r, body } = await call({ request: { cf: { country: "fr" } } });
  assert.deepStrictEqual(body, { country: "FR" });
  assert.strictEqual(r.headers.get("cache-control"), "no-store");
  assert.match(r.headers.get("content-type"), /application\/json/);
});
test("missing cf or bad value gives country null", async () => {
  for (const ctx of [{ request: {} }, { request: { cf: {} } }, { request: { cf: { country: "USA" } } }, { request: { cf: { country: 7 } } }, {}, undefined]) {
    assert.deepStrictEqual((await call(ctx)).body, { country: null });
  }
});
