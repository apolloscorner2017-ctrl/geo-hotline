# geo-hotline

Show each visitor the phone line that belongs to their country, on a static site, with no dependencies and no way to make the page worse than it was. A Cloudflare Pages Function reports the visitor's country, a 30-line client caches it, and a small renderer swaps the server-rendered default for the right `tel:` links. If anything fails, the default stays.

> **IMPORTANT: the numbers in this repo are fictional.** `public/hotlines.json` uses placeholder numbers (`+1 555 01xx`, all-zero ranges) and names like "Example Poison Line". **Never ship them. Verify every real emergency number yourself from the line operator's own official site** before putting it in your data file. A wrong emergency number is worse than none, and this project makes no claim that any number is correct.

Built for [plantdoctor.apolloscorner.com](https://plantdoctor.apolloscorner.com), a free pet plant-safety checker. Every species page told visitors to call a US-only poison hotline, including the ones in France, Spain and Brazil, where that number is useless at the exact moment someone's dog has eaten a lily. This is the pattern that fixed it.

## How it works

```
browser ──GET /api/geo──▶ functions/api/geo.js  ──▶ {"country":"FR"}   (request.cf.country, no-store)
   │
   ├─ geo.js       one fetch, sessionStorage cache, window.GEO.ready (always resolves; null on failure)
   └─ hotline.js   waits on GEO.ready, loads hotlines.json only if a country is known, swaps [data-hotline] nodes
```

| Visitor | What renders |
|---|---|
| Country has an entry with valid lines | Heading + each line as a `tel:` link, with localized cost and hours |
| Known country, no entry (or no valid line) | Heading + generic text ("call your local emergency number or nearest vet"), no number |
| Unknown country, Tor, lookup failed, bad data, JS off | The server-rendered default, untouched |

## Design choices

**The server-rendered default is the product for crawlers and no-JS visitors.** Search engines and AI crawlers see the HTML, not the swap. So the default has to be correct and useful on its own, and the enhancement only improves it for people it can help.

**Fail safe to the default, never to a blank.** `GEO.ready` always resolves (country string or `null`), `hotline.js` only acts on a valid two-letter code, and every error path leaves the original markup alone. A flaky edge function or blocked request can never leave someone with an empty box in an emergency.

**Domestic dialing for non-geographic numbers.** E.164 (`+61...`) looks like the obviously right format for `tel:` links, but it breaks numbers like Australia's `1300` and Brazil's `0800`: they are not geographic and only work when dialed domestically. So `tel` accepts either E.164 (`+` and 6-15 digits) or plain domestic digits (3-12), and the displayed `phone` is separate from the dialed `tel`. The check is a regex, so a `javascript:` URL in your data can never become a link.

**DOM nodes only, never `innerHTML`.** Names and numbers go in through `createTextNode`, so markup in the data file stays text. The tests use a fake DOM whose `innerHTML` setter throws.

**The data must come from the operator's own site.** Hotline numbers change, get retired, and start charging. Copying them from an aggregator or a model's memory is how a wrong number reaches a panicking person. Each entry has an enum `cost` field (`free`, `fee`, `fee_may`) so the page can say whether a call costs money, and it is localized from the `strings` block instead of free text, so a stray value is dropped rather than displayed.

**One lookup per session.** No second geo request, no cookies, no storage of the country on the server. The function is `no-store` so a CDN never serves one visitor's country to another.

## Use it

1. Copy `functions/` into your Cloudflare Pages project (it deploys as `/api/geo`) and `public/geo.js`, `public/hotline.js`, `public/hotlines.json` into your static output.
2. Mark up the default:
   ```html
   <li data-hotline data-lang="en">Poison help line: <a href="tel:...">your default</a></li>
   <script src="/geo.js"></script>
   <script src="/hotline.js" data-hotline-src="/hotlines.json"></script>
   ```
3. Replace the sample data with numbers you verified. Format:
   ```json
   { "strings":   { "en": { "heading": "...", "fallback": "...", "cost_free": "...", "cost_fee": "...", "cost_fee_may": "...", "hours_247": "..." } },
     "countries": { "XX": { "lines": [ { "name": "...", "phone": "display text", "tel": "+E164 or domestic digits", "cost": "free|fee|fee_may", "hours": "24/7" } ] } } }
   ```
   `hours` of exactly `24/7` is localized; any other string is shown as written, so write it in that line's language. Country codes are ISO 3166-1 alpha-2; add a language by adding a `strings` block and `data-lang` on the node.

Try it locally with `npx wrangler pages dev public` (country will be unknown locally, so you will see the default; use the tests or stub `/api/geo` to see the swap).

## Tests

```bash
npm test      # node's built-in runner, Node 20+, no installs
```

24 tests cover country picking, tel validation, rendering (cost, hours, languages, domestic digits), markup safety, every failure path of the client, and the function itself. A last test fails if the sample data stops being fictional.

## Layout

```
functions/api/geo.js   Pages Function, returns {country}
public/geo.js          client lookup + cache, window.GEO
public/hotline.js      pick + render
public/hotlines.json   sample data (FICTIONAL numbers)
public/index.html      demo page
test/                  fake DOM + tests
```

## License

MIT
