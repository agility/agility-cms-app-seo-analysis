# SEO Analysis for Agility CMS

An Agility CMS app that scores pages for SEO and readability against a focus
keyphrase, using the open-source [YoastSEO.js](https://github.com/Yoast/wordpress-seo)
library. It works on both kinds of page Agility renders:

- **Dynamic-page content items** — blog posts, articles, products — in the
  **content item sidebar**.
- **Regular pages** from the page tree, in the **page sidebar**.

Either way it reads the real rendered page and writes meta descriptions back to
Agility's own SEO fields, so an existing site picks them up through the Fetch
API with no changes.

---

## How it works

```
useAgilityAppSDK()  ──►  content item sidebar: referenceName, contentID
                         page sidebar:         pageItem.ItemContainerID (the page ID)
        │
        ├─ getManagementAPIToken() ──► [/api/page-content]
        │     content item: getContainerByReferenceName() ► isDynamicPageList?
        │                   GET /content/previewUrl?containerId&contentItemID
        │     page:         GET /page/{id} ► folder, link or dynamic template? stop
        │                   GET /page/previewUrl/{id}
        │        └─► server fetches the URL, follows the preview-cookie redirect,
        │            extracts <main>
        │
        └─ meta description, and an optional keyphrase, debounced 700ms
                 │
                 ▼
          POST /api/analyze  ──►  Paper + SEOAssessor + ContentAssessor
                 │                (server only — see docs/LICENSING.md)
                 ▼
          scores + grouped results  ──►  "Fix" jumps to the field the engine names
```

**Two surfaces, one panel.** `src/components/AnalysisPanel.tsx` is everything
the editor sees; the two sidebars only differ in how they find their page and
where they write the meta description.

- The **content item sidebar** can write through the App SDK: `setFieldValue`
  puts the description on the item as the editor types, and the CMS's own save
  flow persists it.
- The **page sidebar** is read-only in the App SDK (`getPageItem` and nothing
  else), so the description is saved on blur through the Management API
  (`PUT /api/page-seo`): the route re-reads the page, changes `seo.metaDescription`
  and re-posts the whole page with `linkExistingComponents=true` so its
  components stay attached to their existing content. It then calls the SDK's
  `refresh()` so the manager reloads the page it is showing.

**Why the rendered page and not the item's fields.** An Agility page is assembled
from components across zones, so no single content item contains the whole page.
Scoring the item's own fields would make internal links, image counts, H1
uniqueness and word count meaningless. The rendered page is what Google sees.

## Surfaces

| Route | What it is |
|---|---|
| `/content-item-sidebar` | The analysis panel for a dynamic-page content item |
| `/page-sidebar` | The same panel for a regular page |
| `/install` | Install screen |
| `/api/analyze` | Runs the engine (server only) |
| `/api/page-content` | Resolves a content item or a page to its rendered HTML and main content |
| `/api/keyphrase` | Saves the focus keyphrase for an item or a page |
| `/api/page-seo` | Saves a regular page's meta description through the Management API |

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

### Where the keyphrase is stored

In the app's own key-value store, not on the content item. Agility's SEO
fields hold the meta description because an existing site reads them through
the Fetch API. Nothing reads a keyphrase, so putting it on the item would mean
either a model change on every customer's schema or borrowing the meta
keywords field, which means something else.

| | |
|---|---|
| Store | Upstash Redis via the **Vercel Marketplace** (`@upstash/redis`). Vercel provisions it, bills it and injects the credentials; the data lives outside the app, so it survives cold starts and deploys. Development falls back to an in-memory map when the env vars are absent. **Production does not fall back**: saves fail with a visible message rather than silently losing data. |
| Key | `{guid}-{locale}-content-{contentID}` for a content item, `{guid}-{locale}-page-{pageID}` for a page — see `src/store/keyphraseStore.ts`. IDs are shared across an item's locales and a keyphrase is language-specific, so the locale is part of the key. |
| Value | `{ keyphrase, updatedAt }` |
| Read | Returned by `/api/page-content` alongside the rendered page, so it costs no extra round trip and no extra authorization. |
| Write | `PUT /api/keyphrase`, on **blur or Enter**, never per keystroke. An empty value deletes the key. |
| Authorization | The caller's Management API token must be able to read the item or page it names. The route re-fetches it with that token before writing. |
| Region | One database, one region, chosen when it is created. Agility has instances in Canada, Europe and Australia as well as the US, and keyphrases from all of them land in this one region. A keyphrase is low-sensitivity, but say so in any data-processing description of the app. |

The `isCornerstone` flag the engine already supports can be stored the same
way when it is exposed.

Rejected: a *field on the model* (schema change, a developer task at most
customers), the *meta keywords system field* (works, but it is a different
concept - a rendered list search engines ignore, not a ranking target - and
the CMS's SEO tab shows it to editors), an *app-owned content list* via the
Management API (creates schema in the customer's instance), *`persistData` in
the App SDK* (no handler in the manager; per-user), and *SQLite on the app*
(Vercel's filesystem is ephemeral).

## Where meta data is stored

| Data | Home |
|---|---|
| Meta description, content item | `DynamicPageMetaDescription` on the item |
| Meta keywords, header code | `DynamicPageMetaKeywords`, `DynamicPageAdditionalHeaderCode` |
| Meta description, regular page | `seo.metaDescription` on the page record, via the Management API |

The item fields are Agility system fields present on every dynamic-page item —
no model change needed — and the CMS's own SEO tab reads and writes the same
keys. The page field is the one the page's SEO tab edits.

**One thing to verify on a real instance:** the page save posts to
`POST /page?parentPageID={own parent}&placeBeforePageItemID=-1&linkExistingComponents=true`,
which is how the Management SDK itself updates an existing page. It should leave
the page's position in its parent untouched; if a saved page ever moves to the
bottom of its siblings, pass the next sibling's ID as `placeBeforePageItemID`
(the sitemap endpoint has the order).

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

Then register the tunnel URL as a private app on a dev instance. Keyphrases
are held in memory until `UPSTASH_REDIS_REST_URL` / `_TOKEN` are set - see
`.env.local.example`.

> **Register the URL without a trailing slash.** Every surface URL is built with
> trailing-slash normalization except the install screen
> (`AppConfigurationPanel.tsx:913` builds `` `${url}/install` `` raw), so a
> trailing slash yields `//install`.

Then, in the CMS:

Open any content item whose container is a dynamic page list, or any regular
page in the page tree — the panel scores it immediately. No field to add.
Folders, links and dynamic page templates show an explanatory state instead.

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
  template's title formula, not a field on the content item. On a regular page
  the site usually decorates the page's Title (a suffix, the site name), so the
  panel shows what the rendered page actually has rather than offering to edit
  a field it can't preview honestly.
- **`yoastseo@3.6.0` does not ship the `yoastseo/contract` or
  `yoastseo/researcher` entry points its README documents** — `files` is
  `["build","!*.map","vendor","images"]`, so they exist only on the project's
  trunk. `src/analysis/contract.ts` is our own equivalent boundary, and
  `src/analysis/researcher.ts` reaches the language researchers under `build/`.
  Both are written to be deleted when a release exposes the real ones.

## Licensing

This app is licensed under the **GNU General Public License v3.0** — see
[LICENSE](LICENSE). It is built on `yoastseo`, which is GPL-3.0, and the
coupling is close enough that the app is treated as a derivative work and
licensed the same way.

`yoastseo` runs **server-side only**, so the browser receives scores and
feedback text rather than the library itself. Read
[docs/LICENSING.md](docs/LICENSING.md) before changing where the analysis runs.

"Yoast" is a trademark of Yoast BV. This app is not affiliated with or endorsed
by Yoast; the name YoastSEO.js is used only to identify the library it depends
on. See [docs/LICENSING.md](docs/LICENSING.md#trademark).
