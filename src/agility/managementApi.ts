/**
 * Thin client for the Agility Management API calls this app needs.
 *
 * The App SDK does not hand us everything directly: the container behind a
 * content item's reference name, the preview/live URL of the dynamic page that
 * container renders, and - for the page sidebar - the page itself, its URLs and
 * a way to save its SEO fields. The SDK's `getManagementAPIToken()` supplies the
 * bearer token, so the app never stores a credential of its own.
 */

export interface AgilityContainer {
	contentViewID: number
	referenceName: string
	contentViewName: string
	isDynamicPageList: boolean
	/** e.g. "~/blog/post-details" - the dynamic page node items render through. */
	defaultDetailsPage: string | null
	/** e.g. "~/blog" - the listing page the details node sits under. */
	defaultListingPage: string | null
}

export interface AgilityItemDetails {
	/** The container's TRUE reference name, which the App SDK does not give us. */
	referenceName: string
	/** The item's slug field, used to build its friendly URL. */
	slug: string | null
	title: string | null
}

interface CallOptions {
	/** Regional Management API base, e.g. https://mgmt-eu.aglty.io - NOT the manager URL. */
	mgmtApiUrl: string
	token: string
	path: string
	method?: "GET" | "POST"
	body?: unknown
}

async function call<T>({ mgmtApiUrl, token, path, method = "GET", body }: CallOptions): Promise<T | null> {
	const base = mgmtApiUrl.replace(/\/+$/, "")

	const response = await fetch(`${base}/api/v1${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/json",
			...(body !== undefined ? { "Content-Type": "application/json" } : {})
		},
		body: body !== undefined ? JSON.stringify(body) : undefined,
		cache: "no-store"
	})

	if (response.status === 404) return null

	if (!response.ok) {
		throw new Error(`Management API ${response.status} on ${method} ${path}`)
	}

	const text = await response.text()
	if (!text) return null

	try {
		return JSON.parse(text) as T
	} catch {
		// Several of these endpoints return a bare quoted string (a URL), which is
		// valid JSON, but a plain unquoted URL shows up too. Hand it back as-is.
		return text as unknown as T
	}
}

/**
 * The container reference name a content item actually belongs to.
 *
 * This call exists because the App SDK lies about it. `contentItem.referenceName`
 * looks authoritative and is not: normalizeContentItem.ts sets it from
 * `contentView.ContentViewName` - the container's editable DISPLAY name -
 * despite the field name and its "get the contentview reference name" comment.
 * On a real instance 4095 of 4907 containers had the two differing (a container
 * displayed as "Posts" has the reference name "BlogPosts"), so looking a
 * container up by the SDK's value 404s far more often than it succeeds.
 *
 * The item's own properties carry the true reference name, so we ask it.
 */
export async function getItemDetails(
	mgmtApiUrl: string,
	token: string,
	guid: string,
	locale: string,
	contentID: number
): Promise<AgilityItemDetails | null> {
	const item = await call<any>({
		mgmtApiUrl,
		token,
		path: `/instance/${guid}/${locale}/item/${contentID}`
	})

	const referenceName = item?.properties?.referenceName
	if (!referenceName) return null

	return {
		referenceName,
		slug: findSlugField(item?.fields),
		title: firstString(item?.fields, ["title", "Title", "name", "Name"])
	}
}

/**
 * The item's slug.
 *
 * Agility has no fixed name for it - the field is whatever the model calls it -
 * and the Management API lower-cases the first letter of every field name
 * ("URL" comes back as "uRL"), so matching is case-insensitive over the names
 * that are conventional in practice.
 */
function findSlugField(fields: Record<string, any> | undefined): string | null {
	return firstString(fields, ["url", "slug", "pageslug", "friendlyurl", "urlslug"])
}

function firstString(fields: Record<string, any> | undefined, candidates: string[]): string | null {
	if (!fields) return null

	const byLowerKey = new Map(
		Object.entries(fields).map(([key, value]) => [key.toLowerCase(), value])
	)

	for (const candidate of candidates) {
		const value = byLowerKey.get(candidate.toLowerCase())
		if (typeof value === "string" && value.trim()) return value.trim()
	}

	return null
}

/**
 * Resolves a container by its TRUE reference name.
 *
 * We need its numeric contentViewID, which no SDK context carries but the
 * preview-URL endpoint requires as `containerId`, plus isDynamicPageList to know
 * whether this item has a rendered page at all.
 */
export async function getContainerByReferenceName(
	mgmtApiUrl: string,
	token: string,
	guid: string,
	referenceName: string
): Promise<AgilityContainer | null> {
	const raw = await call<any>({
		mgmtApiUrl,
		token,
		path: `/instance/${guid}/container/${encodeURIComponent(referenceName)}`
	})

	if (!raw) return null

	return {
		contentViewID: raw.contentViewID ?? raw.ContentViewID ?? -1,
		referenceName: raw.referenceName ?? raw.ReferenceName ?? referenceName,
		contentViewName: raw.contentViewName ?? raw.ContentViewName ?? "",
		isDynamicPageList: Boolean(raw.isDynamicPageList ?? raw.IsDynamicPageList),
		defaultDetailsPage: raw.defaultDetailsPage ?? raw.DefaultDetailsPage ?? null,
		defaultListingPage: raw.defaultListingPage ?? raw.DefaultListingPage ?? null
	}
}

/**
 * The rendered URL for ONE content item's dynamic page.
 *
 * This is the content-level endpoint the manager itself uses (see
 * useContentPreviewUrl.ts) - not the page-level one. It is what makes analysis
 * of an individual blog post or product possible at all: the page tree only
 * knows about the dynamic page template, this resolves the real per-item URL.
 */
export async function getContentPreviewUrl(
	mgmtApiUrl: string,
	token: string,
	guid: string,
	locale: string,
	containerId: number,
	contentItemID: number
): Promise<string | null> {
	const url = await call<string>({
		mgmtApiUrl,
		token,
		path: `/instance/${guid}/${locale}/content/previewUrl/?containerId=${containerId}&contentItemID=${contentItemID}`
	})

	return cleanUrl(url)
}

export async function getContentLiveUrl(
	mgmtApiUrl: string,
	token: string,
	guid: string,
	locale: string,
	containerId: number,
	contentItemID: number
): Promise<string | null> {
	const url = await call<string>({
		mgmtApiUrl,
		token,
		path: `/instance/${guid}/${locale}/content/liveUrl/?containerId=${containerId}&contentItemID=${contentItemID}`
	})

	return cleanUrl(url)
}

/** These endpoints return the URL as a JSON string, so it arrives quoted. */
function cleanUrl(url: string | null): string | null {
	if (!url) return null

	const trimmed = url.trim().replace(/^"|"$/g, "")
	return trimmed || null
}

// ---------------------------------------------------------------------------
// Pages (the page sidebar)
// ---------------------------------------------------------------------------

export type AgilityPageType = "static" | "dynamic" | "folder" | "link"

export interface AgilityPage {
	pageID: number
	pageType: AgilityPageType
	title: string | null
	name: string | null
	parentPageID: number
	metaDescription: string
	/** The page exactly as the API returned it. Saved back verbatim, plus our edit. */
	raw: Record<string, any>
}

/**
 * One page, by ID.
 *
 * The page sidebar's `pageItem` carries the ID as `ItemContainerID` (pages are
 * items internally), but its SEO fields are the manager's legacy shape. This is
 * the Management API's view of the same page, which is the shape it saves.
 */
export async function getPage(
	mgmtApiUrl: string,
	token: string,
	guid: string,
	locale: string,
	pageID: number
): Promise<AgilityPage | null> {
	const raw = await call<any>({
		mgmtApiUrl,
		token,
		path: `/instance/${guid}/${locale}/page/${pageID}`
	})

	if (!raw || typeof raw !== "object") return null

	return {
		pageID: raw.pageID ?? pageID,
		pageType: normalizePageType(raw),
		title: raw.title ?? null,
		name: raw.name ?? null,
		parentPageID: typeof raw.parentPageID === "number" ? raw.parentPageID : -1,
		metaDescription: raw.seo?.metaDescription ?? "",
		raw
	}
}

/**
 * The API describes the type as a string; the manager as a number (0 page, 1
 * link, 2 folder). Accept either, and fall back on the shape: a page with a
 * dynamic configuration is dynamic, anything else with zones is static.
 */
function normalizePageType(raw: any): AgilityPageType {
	const value = String(raw.pageType ?? "").toLowerCase()

	if (value === "static" || value === "dynamic" || value === "folder" || value === "link") return value
	if (value === "1" || value === "custom") return "link"
	if (value === "2" || value === "container") return "folder"

	if (raw.dynamic?.referenceName) return "dynamic"
	if (raw.redirectUrl && !raw.zones) return "link"
	return "static"
}

/**
 * The rendered URLs for ONE page. These are the page-level endpoints the
 * manager's own preview button uses (see useLayoutPreviewUrl.ts).
 */
export async function getPagePreviewUrl(
	mgmtApiUrl: string,
	token: string,
	guid: string,
	locale: string,
	pageID: number
): Promise<string | null> {
	const url = await call<string>({
		mgmtApiUrl,
		token,
		path: `/instance/${guid}/${locale}/page/previewUrl/${pageID}?digitalChannelDomainID=0`
	})

	return cleanUrl(url)
}

export async function getPageLiveUrl(
	mgmtApiUrl: string,
	token: string,
	guid: string,
	locale: string,
	pageID: number
): Promise<string | null> {
	const url = await call<string>({
		mgmtApiUrl,
		token,
		path: `/instance/${guid}/${locale}/page/liveUrl/${pageID}?digitalChannelDomainID=0`
	})

	return cleanUrl(url)
}

/**
 * Writes a new meta description onto a page.
 *
 * The Management API has no field-level update: a save is the whole page. So
 * this re-posts the page exactly as it was fetched, with one change. Two query
 * flags matter:
 *
 * - `linkExistingComponents=true` keeps the page's components attached to the
 *   content items they already have. Without it the API creates a fresh copy
 *   of every component on every save.
 * - `parentPageID` is the page's own parent, so it stays where it is in the
 *   tree. `placeBeforePageItemID=-1` is the API's "no reordering" default for
 *   an existing page, which is what its own SDK passes on update.
 *
 * Saves are queued: the API answers with a batch ID, and the page is only
 * updated once that batch has processed, which is what `waitForBatch` waits
 * for so the caller can report success honestly.
 */
export async function savePageMetaDescription(
	mgmtApiUrl: string,
	token: string,
	guid: string,
	locale: string,
	page: AgilityPage,
	metaDescription: string
): Promise<void> {
	const body = {
		...page.raw,
		seo: { ...(page.raw.seo ?? {}), metaDescription }
	}

	const batchID = await call<number | string>({
		mgmtApiUrl,
		token,
		method: "POST",
		path:
			`/instance/${guid}/${locale}/page` +
			`?parentPageID=${page.parentPageID}&placeBeforePageItemID=-1&linkExistingComponents=true`,
		body
	})

	const id = Number(batchID)
	if (!Number.isFinite(id) || id <= 0) {
		throw new Error(`Page save did not return a batch ID (got ${JSON.stringify(batchID)})`)
	}

	await waitForBatch(mgmtApiUrl, token, guid, id)
}

/** BatchState.Processed in the Management SDK's enum. */
const BATCH_PROCESSED = 3

/**
 * Polls a batch until it has processed. Gives up after ~15s: a save that slow
 * is reported as an error rather than a false success, and the CMS will still
 * show the real state on its next refresh.
 */
async function waitForBatch(
	mgmtApiUrl: string,
	token: string,
	guid: string,
	batchID: number,
	{ attempts = 20, intervalMs = 750 } = {}
): Promise<void> {
	for (let attempt = 0; attempt < attempts; attempt++) {
		const batch = await call<any>({
			mgmtApiUrl,
			token,
			path: `/instance/${guid}/batch/${batchID}?expandItems=true`
		})

		const failed = (batch?.items ?? []).find((item: any) => item?.errorMessage)
		if (failed) throw new Error(`Page save failed: ${failed.errorMessage}`)

		if (batch?.batchState === BATCH_PROCESSED) return

		await new Promise((resolve) => setTimeout(resolve, intervalMs))
	}

	throw new Error(`Page save batch ${batchID} did not finish in time`)
}
