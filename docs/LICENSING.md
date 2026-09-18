# Licensing

**Read this before moving the analysis into the browser, and before changing
how the app describes its dependency on Yoast.**

## This app is GPL-3.0

The app is licensed under the GNU General Public License v3.0 — see the
[LICENSE](../LICENSE) file at the repo root and the `license` field in
`package.json`.

Why GPL rather than something permissive: every Yoast package is GPL-3.0,
including `yoastseo`, the analysis library this app is built on
(`packages/yoastseo/package.json`: `"license": "GPL-3.0"`). The coupling is
close. `src/analysis/researcher.ts` requires internal paths under the package's
`build/` directory, `src/analysis/types.ts` and `contract.ts` are modelled on
upstream's contract and result objects, and `keyphraseChecks.ts` was derived by
running upstream's `SEOAssessor`. A program written to require a GPL library
this tightly is, on the FSF's reading, a derivative work when its source is
distributed. This repo is public, so its source *is* distributed. Licensing it
GPL-3.0 removes the question rather than arguing it.

Practical consequences for contributors:

- Code added to this repo is GPL-3.0. Don't paste in code under an incompatible
  licence.
- Dependencies conveyed with the app must be GPL-3.0-compatible. Everything in
  `package.json` today is MIT or Agility's own.
- If the app is ever offered for self-hosting (a deploy button, a Docker image),
  that is a conveyance of the combined work and the full GPL terms apply: the
  recipient gets this source and the licence text. The public repo already
  satisfies that; keep it that way.

## Server-side only, and why it still matters

GPL-3.0 has no network-use clause. Running the software on a server to provide
a service is not distribution. **A browser downloading a JavaScript bundle is.**
Keeping `yoastseo` server-side means the hosted app never conveys the library
to end users, which keeps the obligations to "the repo is GPL" and nothing
more, and keeps ~2.4 MB out of the client bundle.

`yoastseo` is imported in exactly one place, `src/analysis/`, which is
reachable only from `src/app/api/analyze/route.ts`.

Two mechanical details:

- `next.config.js` marks `yoastseo` as a server external package, so it is
  resolved by Node at runtime and never enters a bundle at all.
- `src/analysis/*` must never be imported from a client component. There is no
  lint rule enforcing this yet; adding one would be worthwhile.

Verify the boundary after any build:

```bash
npm run build
grep -rl "yoastseo\|scoreToRating\|keyphraseDensity" .next/static/chunks/   # must print nothing
grep -rl "yoastseo" .next/server/                                           # should print the analyze route
```

**What the browser does receive.** The JSON from `/api/analyze` includes the
assessment feedback strings. Those are Yoast-authored text that ships inside
the GPL package, not merely program output, so it is not accurate to say
"nothing from the package reaches the browser". Displaying that text is the
library's purpose and the exposure is small, but be precise about it in any
user-facing or legal description. `contract.ts` also strips the `yoast.com`
links from that text, for an iframe-navigation reason documented there. That is
permitted, but it removes Yoast's own attribution; if Yoast is ever approached
for consent (below), expect to be asked to restore it.

## Trademark

"Yoast" is a registered trademark of Yoast BV (US and EU). It is separate from
the GPL: the licence grants rights to the code, not the name. Yoast's published
policy (yoast.com/reserved-rights) says third parties may not brand a product
"Yoast", may not use the mark in a domain name, may not use plays on the word,
and may not state that a product "contains Yoast" without express written
consent from support@yoast.com.

Rules this repo follows:

- **The product is "SEO Analysis".** Not "Yoast for Agility", not
  "Agility Yoast". The repo is `agility-cms-app-seo-analysis` for the same
  reason.
- **Referential use only.** Where the dependency is named it is described as
  "uses the open-source YoastSEO.js library", which is a truthful statement
  identifying a component, the kind of use trademark law permits. Do not write
  "powered by", "Yoast-based", "Yoast-compatible" or anything that reads as
  endorsement or partnership.
- **No Yoast branding.** No logo, no Yoast colour scheme, no reproduction of
  the WordPress plugin's traffic-light UI.
- **Disclaimer.** The install screen, the home page and the README carry "not
  affiliated with or endorsed by Yoast BV".

Yoast's policy is broader than what trademark law would actually let them
enforce against truthful referential use, but Agility is a commercial vendor
and the cheapest path is to ask. If the app will be marketed anywhere, email
support@yoast.com describing it and requesting written consent to reference
YoastSEO.js.

## Not legal advice

This document records the engineering position and the reasoning behind it. It
has not been reviewed by counsel. Have that review done before the app is
listed for customers, and revisit this file if the answer differs.

## If the analysis moves client-side

Moving the analysis into a Web Worker, as Yoast does in WordPress, would make
the UI instant and remove a network round trip. The code is structured so the
swap is contained: `analyze()` is a pure function of its request, and
`src/analysis/contract.ts` is already the serialization boundary. Because the
app is already GPL-3.0, conveying `yoastseo` to the browser would be
licence-compliant. The remaining cost is practical: the bundle grows by
~2.4 MB, and the GPL's source-offer obligation must be met for what is served,
which the public repo does as long as the deployed build matches a tagged
commit.
