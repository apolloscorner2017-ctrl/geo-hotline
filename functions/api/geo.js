// Cloudflare Pages Function: GET /api/geo -> {"country":"FR"} (or {"country":null}).
// Cloudflare sets request.cf.country on every request; nothing is stored or logged here.
// "no-store" matters: a cached response would show the next visitor the previous visitor's country.
export function onRequestGet(context) {
  const raw = context && context.request && context.request.cf && context.request.cf.country;
  const country = typeof raw === "string" && /^[A-Za-z]{2}$/.test(raw) ? raw.toUpperCase() : null;
  return new Response(JSON.stringify({ country }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
