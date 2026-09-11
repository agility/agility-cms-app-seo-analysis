# Licensing

**Read this before moving the analysis into the browser.**

## The constraint

Every Yoast package is **GPL-3.0**, including `yoastseo`, the analysis engine
this app is built on (`packages/yoastseo/package.json`: `"license": "GPL-3.0"`).

GPL-3.0 has no network-use clause — running the software on a server to provide
a service is not, by itself, distribution. But **a browser downloading a
JavaScript bundle is**. If `yoastseo` were bundled into this app's client
JavaScript, we would be conveying a combined work, and the GPL's terms would
apply to the whole of it.

## What this app does about it

`yoastseo` is imported in exactly one place: `src/analysis/`, which is reachable
only from `src/app/api/analyze/route.ts`. The browser receives JSON — scores and
feedback strings — and never a line of GPL code.

Two mechanical consequences worth knowing:

- `next.config.js` marks `yoastseo` as a server external package, so it is
  resolved by Node at runtime and never enters a bundle at all.
- `src/analysis/*` must never be imported from a client component. There is no
  lint rule enforcing this yet; adding one would be worthwhile.

You can verify the boundary holds after any build:

```bash
npm run build
grep -rl "yoastseo\|scoreToRating\|keyphraseDensity" .next/static/chunks/   # must print nothing
grep -rl "yoastseo" .next/server/                                           # should print the analyze route
```

## What has NOT been decided

**This is an engineering mitigation, not legal advice, and it has not been
reviewed by anyone qualified to sign off on it.** Do that before the app ships
to customers. The specific questions worth putting to counsel:

1. Is the server-side split sufficient, given that the app is distributed as a
   hosted service rather than as software?
2. Does shipping this app's *source* (a public repo) alongside GPL-3.0
   dependencies create any obligation, even with no combined distribution?
3. **Trademark.** "Yoast" is a trademark. This app is named "SEO Analysis" and
   credits "YoastSEO.js" as the engine, which is a factual statement about a
   dependency. If it is ever marketed as a "Yoast app" or uses Yoast branding,
   that needs permission.

## If the decision changes

Moving the analysis client-side (a Web Worker, as Yoast does in WordPress) would
make the UI instant and remove a network round trip. It is a real improvement and
the code is structured so the swap is contained: `analyze()` is a pure function
of its request, and `src/analysis/contract.ts` is already the serialization
boundary. The only thing stopping it is the question above.
