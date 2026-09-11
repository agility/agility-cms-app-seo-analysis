# SEO Analysis for Agility CMS

An Agility CMS app that scores dynamic-page content items — blog posts,
articles, products — for SEO and readability against a focus keyphrase, using
the open-source [YoastSEO.js](https://github.com/Yoast/wordpress-seo) engine.

It renders in the **content item sidebar**, reads the item's real rendered page,
and writes meta descriptions back to Agility's own SEO fields so an existing site
picks them up through the Fetch API with no changes.

---

## How it works

```
useAgilityAppSDK()  ──►  referenceName, contentID, locale, instance.guid
        │
        ├─ getManagementAPIToken() ──► getContainerByReferenceName()
        │                                   └─► contentViewID, isDynamicPageList
        │                                        └─ not a dynamic page? empty state, stop
        │
        ├─ GET /content/previewUrl?containerId&contentItemID
        │        └─► server fetches it, follows the preview-cookie redirect,
        │            extracts <main>                          [/api/page-content]
        │
        └─ meta description, and an optional keyphrase, debounced 700ms
                 │
                 ▼
          POST /api/analyze  ──►  Paper + SEOAssessor + ContentAssessor
                 │                (server only — see docs/LICENSING.md)
                 ▼
          scores + grouped results  ──►  "Fix" jumps to the field the engine names
```

**Why the content item sidebar and not the page sidebar.** Dynamic pages are
where SEO volume lives, and this surface can *write*: it has `setFieldValue` and
`saveContentItem`, which the page sidebar does not. A page-sidebar version would
have to round-trip every edit through the Management API.

**Why the rendered page and not the item's fields.** An Agility page is assembled
from components across zones, so no single content item contains the whole page.
Scoring the item's own fields would make internal links, image counts, H1
uniqueness and word count meaningless. The rendered page is what Google sees.

## Surfaces

| Route | What it is |
|---|---|
| `/content-item-sidebar` | The analysis panel |
| `/install` | Install screen |
| `/api/analyze` | Runs the engine (server only) |
| `/api/page-content` | Resolves and fetches the item's rendered page |

Route names are **not** configurable — Agility builds these URLs by string
concatenation in `useAppConfig.ts`.

## The focus keyphrase

**It is optional, and not persisted.** Thirteen of the twenty-two checks need no
keyphrase at all:

| | checks | needs a keyphrase? |
|---|---|---|
| Readability | 6 | no |
| Structural SEO | 7 | no |
| Keyphrase-relative SEO | 9 | **yes** |

So the panel scores an item the moment it opens — on a customer's existing
content models, with no field to add and nothing to configure. Typing a
keyphrase unlocks the other nine for that session.

Without a keyphrase the app deliberately shows **no overall SEO score**: that
measure is keyphrase-relative, and scoring the structural subset alone would
give a number that isn't comparable to the one shown once a keyphrase is set.
The keyphrase-relative checks are withheld rather than reported as failures,
because "your keyphrase does not appear in the title" is not something an editor
can act on when they haven't set one. The split lives in
`src/analysis/keyphraseChecks.ts`.

**Where a keyphrase should be stored is still open.** The options, and why none
is obviously right yet:

- *A custom field on the model* — versioned with the item and visible inline,
  but it is a schema change, which in most organisations is a developer task.
- *An app-owned content list*, provisioned through the Management API — works on
  existing models, but the app creates schema in the customer's instance.
- *`persistData` in the App SDK* — **not viable.** It appears in the operation
  type union but has no handler in the manager, so it resolves as "operation not
  supported on this surface". It is also per-user, so two editors would see
  different keyphrases for the same post.

## Where meta data is stored

| Data | Home |
|---|---|
| Meta description | `DynamicPageMetaDescription` on the item |
| Meta keywords, header code | `DynamicPageMetaKeywords`, `DynamicPageAdditionalHeaderCode` |

These are Agility system fields present on every dynamic-page item — no model
change needed — and the CMS's own SEO tab reads and writes the same keys.

## Development

```bash
npm install
npm run dev      # http://localhost:3060
```

**Agility fetches the manifest server-side**, so `localhost` is invisible to it.
Local development needs a public tunnel:

```bash
cloudflared tunnel --url http://localhost:3060
```

Then register the tunnel URL as a private app on a dev instance.

> **Register the URL without a trailing slash.** Every surface URL is built with
> trailing-slash normalization except the install screen
> (`AppConfigurationPanel.tsx:913` builds `` `${url}/install` `` raw), so a
> trailing slash yields `//install`.

Then, in the CMS:

Open any content item whose container is a dynamic page list — the panel scores
it immediately. No field to add.

```bash
npm run typecheck
npm run build
```

## Matching the CMS visually

The panel is an iframe, so it inherits **nothing** from the manager shell - not
fonts, not tokens. Both have to be reproduced deliberately:

- **Type.** TT Interphases Pro is loaded by `@font-face` in
  `src/app/globals.css`, pointing at the same `cdn.aglty.io` files the manager
  uses, so the two can't drift. Naming the family in Tailwind alone is not
  enough and fails quietly - it falls through to `system-ui`, which resolves via
  fontconfig on Linux and is not reliably proportional. Only the three weights
  the UI uses (400/500/600) are declared, of the 18 the family ships.
- **Colors, spacing, control sizing.** Lifted from
  `agility-cms-manager-app-react/tailwind.config.cjs` and the `@agility/plenum-ui`
  component source, not eyeballed: inputs are `rounded` (4px) `border px-3 py-2`
  `text-sm/20` on `#D1D5DB`, focusing to violet-700 `#6D28D9`; primary buttons
  are violet-800 `#5B21B6`.
- **Width.** The panel is 320px by default (min 320, max 640) and the host adds
  `px-6`, so the usable column is **272px**. The app adds no outer padding of
  its own.

## Known constraints

- **22 languages** have dedicated analysis. Others fall back to a
  language-agnostic researcher — most assessments still run, morphology-dependent
  ones do not. The panel says so when it happens.
- **Title pixel width is measured in the browser** (`src/lib/pixelWidth.ts`) and
  passed into the request. The server has no font metrics.
- **The SEO title is read-only here.** On a dynamic page it comes from the page
  template's title formula, not a field on the content item.
- **`yoastseo@3.6.0` does not ship the `yoastseo/contract` or
  `yoastseo/researcher` entry points its README documents** — `files` is
  `["build","!*.map","vendor","images"]`, so they exist only on the project's
  trunk. `src/analysis/contract.ts` is our own equivalent boundary, and
  `src/analysis/researcher.ts` reaches the language researchers under `build/`.
  Both are written to be deleted when a release exposes the real ones.

## Licensing

`yoastseo` is GPL-3.0 and runs **server-side only** so it is never conveyed to a
browser. This is an engineering mitigation that still needs legal sign-off —
read [docs/LICENSING.md](docs/LICENSING.md) before changing where the analysis
runs, and before shipping.
