# Agility SEO App (Yoast-powered) — Architecture Plan

A Next.js app that embeds the Yoast analysis engine into Agility CMS sidebar surfaces.

---

## 1. How Agility apps actually work (verified against `agility-cms-manager-app-react`)

An Agility app is **just a website**. The CMS registers its base URL, reads a manifest, and
mounts specific routes of it in iframes. There is no plugin runtime.

### 1.1 The manifest

`public/.well-known/agility-app.json` — the manager fetches this server-side via its own API
(`marketplace/app-capabilities?appUrl=...`, see `src/lib/marketplace/get-app-capabilities.ts`).

```jsonc
{
  "name": "SEO Analysis",
  "description": "...",
  "version": "1.0.0",
  "__sdkVersion": "2.0.0",
  "configValues": [ { "name": "...", "label": "...", "type": "string" } ],
  "capabilities": {
    "pageSidebar":       { "description": "SEO analysis for this page." },
    "contentItemSidebar":{ "description": "SEO analysis for this content item." },
    "contentListSidebar":{ "description": "Bulk SEO overview." },
    "contentDashboard":  { "description": "Site-wide SEO health." },
    "fields":  [ { "name": "SEOKeyphrase", "label": "SEO Keyphrase", "description": "..." } ],
    "installScreen": true
  }
}
```

`capabilities` keys are read by `useAppsForSurface.ts`; a surface only appears if its key is
truthy. `fields` entries become selectable custom field types on content models
(`useFieldTypes.ts`).

### 1.2 Routes the CMS will request

From `src/hooks/iframes/useAppConfig.ts`, the CMS builds iframe URLs by string concatenation.
**These paths are not configurable** — our route names must match exactly:

| Surface | URL the CMS loads |
|---|---|
| `pageSidebar` | `{base}/page-sidebar?appID={n}` |
| `contentItemSidebar` | `{base}/content-item-sidebar?appID={n}` |
| `contentListSidebar` | `{base}/content-list-sidebar?appID={n}` |
| `homeDashboard` | `{base}/home-dashboard?appID={n}` |
| `contentDashboard` | `{base}/content-dashboard?appID={n}` |
| `pagesDashboard` | `{base}/pages-dashboard?appID={n}` |
| custom field | `{base}/fields/{fieldType}?appID={n}` |
| modal | `{base}/modals/{name}?appID={n}&closeModalID={id}` |
| install screen | `{base}/install?appID={n}` |

> **Gotcha:** `useAppConfig` normalises a trailing slash onto the base URL, but
> `AppConfigurationPanel.tsx:913` builds the install URL as `` `${url}/install` `` with no
> normalisation. Register the app URL **without** a trailing slash or you get `//install`.

### 1.3 The postMessage bridge

`@agility/app-sdk` v2 (`/home/kevin/Documents/agility-dev/agility-cms-app-sdk`) wraps an RPC
protocol over `postMessage`. One hook gives us everything:

```ts
const { initializing, appInstallContext, instance, locale,
        field, contentItem, contentModel, pageItem, modalProps, fieldValue } = useAgilityAppSDK()
```

Operations available to us (CMS side: `src/hooks/iframes/useAppSurfaceMessages.ts`):

- **Every surface (core handlers):** `getManagementAPIToken`, `getAPIKey({apiType:"preview"|"fetch", fullKey})`, `openModal`, `openAlertModal`, `selectAssets`
- **Content item sidebar:** `getContentItem`, `setFieldValue`, `addFieldListener` / `removeFieldListener`, `saveContentItem`
- **Page sidebar:** `getPageItem`, `refresh`
- **Content list sidebar:** `getSelectedItems`, `addSelectedItemListener`
- **Universal:** `setHeight`, `setVisibility`, `setFocus`, `persistData`, `getAppInstall`, `closeModal`

### 1.4 What each surface hands us

- **Content item sidebar** → `contentItem` is `{ contentID, referenceName, values }` only
  (`normalizeContentItem.ts`); attachments are flattened into `values`. Plus `contentModel`
  with the full `FieldSettings[]` (field name, type, label, order) — that's how we know which
  fields are rich text vs. plain.
- **Page sidebar** → the full `PageItemType`, including `PreviewUrl`, `URL`, `Title`,
  `PageName`, `MetaTags` (= meta description), `MetaKeyWords`, `MetaTagsRaw`, and the whole
  `DynamicPage*` set. **`PreviewUrl` is the key to render-based analysis.**
- `addFieldListener` gives live field-change events → live re-analysis as the editor types.

---

## 2. What we take from Yoast (verified against `wordpress-seo`)

### 2.1 Use the engine, not the UI

`packages/yoastseo` (npm: `yoastseo`, v3.6.0) is a standalone, WordPress-free analysis library.
It exposes three entry points, and one of them was built for exactly our use case:

| Import | What it gives us |
|---|---|
| `yoastseo` | `Paper`, `SEOAssessor`, `ContentAssessor`, `InclusiveLanguageAssessor`, `AnalysisWebWorker` |
| `yoastseo/researcher` | `getResearcher(locale)` → language-specific Researcher class (22 languages + default) |
| `yoastseo/contract` | **`toPaper` / `paperDtoSchema`, `toResultDto` / `resultDtoSchema`** |

`docs/CONTRACT.md` states the contract exists for "non-WordPress consumers (a hosted web API,
the Shopify app, the Google Docs extension…)". **This is our boundary.** We send a `PaperDto`,
we get back `ResultDto[]`:

```ts
{ identifier, score, rating: "error"|"feedback"|"bad"|"ok"|"good",
  text, marks, editFieldName, editFieldAriaLabel, isOptimizable, isBeta }
```

`rating` is computed inside the boundary, so we never re-implement score interpretation.

`PaperDto` fields we can populate: `text` (HTML or plain), `keyphrase`, `synonyms`, `locale`,
`description`, `title`, `slug`, `permalink`, `titleWidth`, `textTitle`, `date`,
`writingDirection`, `customData`. The `wpBlocks` / `shortcodes` / `isFrontPage` fields are
WP-transitional and we simply omit them.

### 2.2 Do NOT use the Yoast React packages

`@yoast/analysis-report`, `@yoast/components`, `@yoast/ui-library` etc. pull in
`styled-components`, `@wordpress/i18n`, and WP data stores. Rebuild the presentation with
`@agility/plenum-ui` + Tailwind so it looks native inside the CMS. We're reimplementing maybe
400 lines of list/traffic-light UI — worth it.

Possible exception to evaluate later: `@yoast/search-metadata-previews` for the Google snippet
preview. Same WP coupling, so assume reimplementation.

### 2.3 Assessors we get for free

`SEOAssessor` (17 assessments: keyphrase in title/intro/subheadings/slug/meta, keyphrase
density & length, text length, internal + outbound links, image count & alt keyphrase, title
pixel width, single H1, function words), `ContentAssessor` (readability: Flesch, sentence
length, paragraph length, passive voice, transition words, consecutive sentences),
`InclusiveLanguageAssessor`, plus cornerstone and taxonomy variants.

---

## 3. Two decisions to make before writing code

### 3.1 ⚠️ Licensing — GPL-3.0

**Every Yoast package is GPL-3.0** (`packages/yoastseo/package.json`: `"license": "GPL-3.0"`).

GPL-3 has no network clause, but a browser downloading our JS bundle **is** conveying. So:

- **Option A — server-side analysis (recommended).** `yoastseo` is imported only in a Next.js
  Route Handler. The browser receives JSON. The GPL work is never conveyed, so our app source
  stays ours. Costs one debounced round-trip (~700ms debounce; analysis itself is ~50-150ms).
  It also happens to be the right place for render-based analysis and keeps the 2.4 MB of
  language data off the client.
- **Option B — client-side web worker (what WordPress does).** Instant, no network. But the
  bundle conveys GPL-3 code, which very likely makes the whole app GPL-3.

**Recommendation: Option A for v1.** This is a legal call, not mine — flag it before launch.

Related: **"Yoast" is a trademark.** Ship it as "SEO Analysis for Agility" with an
"analysis powered by the open-source YoastSEO.js library" credit, unless Agility has an
agreement with Yoast.

### 3.2 Where does the text to analyse come from?

Yoast assumes one blob of post HTML. Agility pages are composed of components in zones, each
pointing at separate content items. Two complementary strategies:

- **Model mode** (content item sidebar): assemble `text` by concatenating the item's own
  fields, ordered by `contentModel.FieldSettings[].ItemOrder`, using a per-model mapping stored
  in app config (which field is the body / title / description / slug / image). Rich-text
  fields are already HTML, so headings, links and images survive — which is what the
  subheading, link and image assessments need. Instant and live via `addFieldListener`.
- **Render mode** (page sidebar): a server route fetches `pageItem.PreviewUrl`, extracts the
  main content region (configurable CSS selector, default `main`), and analyses the real
  rendered HTML. This is the only way to score internal links, image count, H1 uniqueness and
  total word count across all the page's components — i.e. what Google actually sees.
  Auth for preview: `getAPIKey({ apiType: "preview", fullKey: true })`.

**Recommendation: model mode for live feedback, render mode behind an
"Analyse full page" button** (and the default on the page sidebar).

---

## 4. Where SEO data is stored

`persistData` is **per-user** (see the SDK's JSDoc) — so it's only good for UI preferences
(collapsed sections, active tab). Real data needs a home:

| Data | Home | Mechanism |
|---|---|---|
| Focus keyphrase, synonyms, cornerstone flag | A **custom field** (`capabilities.fields` → `SEOKeyphrase`) the editor adds to a content model; value is JSON | `setFieldValue` — versioned with the item, no extra API |
| Meta description / keywords / title (pages) | Native `MetaTags`, `MetaKeyWords`, `Title` on `PageItemType` | Management API via `getManagementAPIToken()`, then `refresh()` |
| Meta description (dynamic-page content items) | Native `DynamicPageMetaDescription`, `DynamicPageMetaKeywords`, `DynamicPageAdditionalHeaderCode` | `setFieldValue` — the CMS's own `ContentItemSEO.tsx` uses these exact names |
| Social (OG / Twitter) overrides | New fields on the keyphrase JSON, or a dedicated custom field | `setFieldValue` |
| Score history for dashboards | A hidden Agility content model `SEOAnalysis` (contentID, pageID, locale, keyphrase, seoScore, readabilityScore, analyzedOn) | Management API |
| UI prefs | — | `persistData` |

Writing meta into Agility's **native** fields (rather than app-private storage) is the important
call: it means existing Agility sites and the Fetch API pick the values up with zero changes.

---

## 5. Repo layout

```
agility-yoast/
  public/.well-known/agility-app.json
  app/
    layout.tsx                       # Tailwind + plenum-ui css, no chrome
    install/page.tsx                 # config: preview selector, default locale, field mappings
    page-sidebar/page.tsx
    content-item-sidebar/page.tsx
    content-list-sidebar/page.tsx    # phase 3
    content-dashboard/page.tsx       # phase 3
    fields/
      SEOKeyphrase/page.tsx          # focus keyphrase custom field
    modals/
      field-mapping/page.tsx         # pick which model fields feed the analysis
      snippet-editor/page.tsx        # full-size snippet editor
    api/
      analyze/route.ts               # POST PaperDto -> ResultDto[]   (server-side yoastseo)
      render/route.ts                # POST { previewUrl } -> extracted main HTML
      page-meta/route.ts             # PATCH page meta via Management API
  src/
    analysis/
      analyze.ts                     # toPaper -> SEO+Content+InclusiveLanguage -> toResultDto
      researcher.ts                  # locale -> getResearcher(), cached
      extract.ts                     # HTML -> main content (cheerio/linkedom)
      buildPaper.ts                  # Agility contentItem+model -> PaperDto
    agility/
      useSeoData.ts                  # read/write the SEOKeyphrase field
      useLiveFields.ts               # addFieldListener plumbing + debounce
      managementApi.ts
    components/
      ScoreBullet.tsx  AnalysisList.tsx  SnippetPreview.tsx
      SnippetEditor.tsx  KeyphraseInput.tsx  ScoreSummary.tsx
```

**Stack:** Next.js 15 (App Router), React 18 (SDK peer dep), TypeScript, Tailwind,
`@agility/plenum-ui`, `@agility/app-sdk` ^2.2, `@agility/management-sdk`, `yoastseo` ^3.6,
`linkedom` or `cheerio` for extraction.

`next.config.js` needs the React alias workaround from the SDK README, and must **not** set
`X-Frame-Options`/restrictive `frame-ancestors` — the whole app lives in an iframe.

---

## 6. Data flow, end to end (content item sidebar)

```
useAgilityAppSDK()  ──► contentItem.values + contentModel.FieldSettings
        │
        ├─ read SEOKeyphrase field ──► keyphrase, synonyms, cornerstone
        │
        ├─ addFieldListener(body/title/slug) ──► debounce 700ms
        │
        ▼
buildPaper()  ──► PaperDto { text, keyphrase, title, description, slug, locale, titleWidth }
        │                               ▲
        │        titleWidth measured client-side (canvas) — server can't do it
        ▼
POST /api/analyze ──► toPaper() ──► SEOAssessor + ContentAssessor ──► toResultDto()
        │
        ▼
ResultDto[]  ──► group by rating ──► <AnalysisList> traffic lights + <ScoreSummary>
        │
        └─ editFieldName non-empty ──► "fix this" jumps the editor via setFocus()
```

`marks` come back from the contract too, so a phase-2 "highlight in editor" feature is possible
where the marked field is one we control.

---

## 7. Phasing

**Phase 1 — MVP**
- Install screen (default locale, preview content selector, per-model field mapping)
- `SEOKeyphrase` custom field
- Content item sidebar: SEO + readability analysis, score summary, result list
- Page sidebar: same, plus meta title/description editing written to native page fields
- Google snippet preview with pixel-width title/description warnings

**Phase 2**
- Render-mode analysis off `PreviewUrl` (unlocks link/image/H1 assessments properly)
- Inclusive-language analysis; cornerstone content mode
- Social previews (OG / Twitter) + overrides
- Multi-locale: re-analyse per Agility locale, map Agility locale → Yoast researcher

**Phase 3**
- Content/pages dashboards: site-wide score rollup from the `SEOAnalysis` model
- Content list sidebar: bulk SEO state for selected items
- Related keyphrase suggestions (Yoast's uses SEMrush — we'd need our own provider + key)

---

## 8. Open questions / risks

1. **GPL-3.0** — server-side-only is the mitigation. Needs a legal sign-off. *(blocking for launch, not for a prototype)*
2. **Yoast trademark** — naming and attribution.
3. **Local dev**: the CMS fetches the manifest **server-side**, so `localhost` is unreachable. Dev needs a public tunnel (ngrok/cloudflared) registered as a private app on a dev instance.
4. **Preview auth & CORS** — `PreviewUrl` may need the preview key appended; fetching must happen server-side anyway.
5. **Title pixel width** — Yoast measures rendered width in the browser. We must measure client-side and pass `titleWidth` into the DTO; the server cannot compute it.
6. **Model-mode incompleteness** — a content item never contains the whole page, so link/image/word-count scores in model mode are advisory. Render mode is the honest answer; make the mode visible in the UI.
7. **Locale mapping** — Agility locales (`en-us`) → Yoast (`en_US`) → researcher (`en`). 22 languages supported; everything else falls back to the default researcher with reduced analysis.
8. **Rich text storage** — confirm Agility rich-text fields store HTML (they appear to). If any model uses markdown via Power Fields, we need a markdown→HTML step before analysis.
