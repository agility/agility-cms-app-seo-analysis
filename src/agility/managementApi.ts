/**
 * Thin client for the Agility Management API calls this app needs.
 *
 * We only need three things the App SDK does not hand us directly: the
 * container behind a content item's reference name, and the preview/live URL of
 * the dynamic page that container renders. The SDK's `getManagementAPIToken()`
 * supplies the bearer token, so the app never stores a credential of its own.
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
}

async function call<T>({ mgmtApiUrl, token, path }: CallOptions): Promise<T | null> {
	const base = mgmtApiUrl.replace(/\/+$/, "")

	const response = await fetch(`${base}/api/v1${path}`, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/json"
		},
		cache: "no-store"
	})

	if (response.status === 404) return null

	if (!response.ok) {
		throw new Error(`Management API ${response.status} on ${path}`)
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
