import { NextResponse } from "next/server"

import { extractMainContent } from "@/analysis/extract"
import {
	getContainerByReferenceName,
	getContentLiveUrl,
	getContentPreviewUrl,
	getItemDetails,
	getPage,
	getPageLiveUrl,
	getPagePreviewUrl
} from "@/agility/managementApi"
import { buildItemUrl } from "@/agility/itemUrl"
import { getKeyphraseStore, keyphraseKey, pageKeyphraseKey } from "@/store/keyphraseStore"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface PageContentRequest {
	mgmtApiUrl: string
	token: string
	guid: string
	locale: string
	contentSelector?: string
	/** Content item sidebar: the item and the container the SDK says it is in. */
	referenceName?: string
	contentID?: number
	/** Page sidebar: the page's ID (the SDK's pageItem.ItemContainerID). */
	pageID?: number
}

/** What the two surfaces have in common once their target is resolved. */
interface ResolvedTarget {
	previewUrl: string
	liveUrl: string | null
	/** Where this target's keyphrase lives in the store. */
	keyphraseKey: string
	/**
	 * The meta description as Agility stores it, for the page sidebar. Null for
	 * content items, where the SDK's contentItem.values is the source of truth.
	 */
	storedMetaDescription: string | null
}

type Resolution = { ok: true; target: ResolvedTarget } | { ok: false; response: NextResponse }

/**
 * Resolves a content item's dynamic page, or a regular page, to its rendered
 * HTML and returns the main content.
 *
 * Runs server-side for three reasons: the browser cannot follow the preview
 * cookie handshake, the rendered site is a different origin (so CORS would block
 * it), and the management token should not make more trips than it must.
 */
export async function POST(request: Request) {
	let body: PageContentRequest

	try {
		body = await request.json()
	} catch {
		return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 })
	}

	const { mgmtApiUrl, token, guid, locale } = body
	const hasContentTarget = Boolean(body.referenceName && body.contentID)
	const hasPageTarget = Boolean(body.pageID)

	if (!mgmtApiUrl || !token || !guid || !locale || (!hasContentTarget && !hasPageTarget)) {
		return NextResponse.json({ error: "Missing required context." }, { status: 400 })
	}

	try {
		const resolution = hasPageTarget
			? await resolvePage(body as PageContentRequest & { pageID: number })
			: await resolveContentItem(body as PageContentRequest & { referenceName: string; contentID: number })

		if (!resolution.ok) return resolution.response

		const { previewUrl, liveUrl, storedMetaDescription } = resolution.target

		// The stored keyphrase rides along with the page: this route has already
		// proven the caller can read the target, so no second authorization trip.
		const [{ html, status }, stored] = await Promise.all([
			fetchRenderedPage(previewUrl),
			readStoredKeyphrase(resolution.target.keyphraseKey)
		])

		if (!html) {
			return NextResponse.json({ error: "preview-fetch-failed", previewUrl, status }, { status: 502 })
		}

		const extracted = extractMainContent(html, body.contentSelector)

		return NextResponse.json({
			previewUrl,
			liveUrl,
			keyphrase: stored?.keyphrase ?? null,
			storedMetaDescription,
			...extracted
		})
	} catch (error) {
		console.error("[seo-analysis] page content failed", error)
		return NextResponse.json({ error: "page-content-failed" }, { status: 500 })
	}
}

/** A content item in a dynamic page list: resolve the per-item URL. */
async function resolveContentItem(
	body: PageContentRequest & { referenceName: string; contentID: number }
): Promise<Resolution> {
	const { mgmtApiUrl, token, guid, locale, referenceName, contentID } = body

	// The SDK's contentItem.referenceName is the container's DISPLAY name, not
	// its reference name (see getItemDetails), so ask the item which container
	// it is really in. It also carries the slug we need to build the item's
	// real URL. The value we were handed is only a fallback for the minority
	// of containers where the two names happen to match.
	const item = await getItemDetails(mgmtApiUrl, token, guid, locale, contentID)

	const container = await getContainerByReferenceName(
		mgmtApiUrl,
		token,
		guid,
		item?.referenceName ?? referenceName
	)

	if (!container) {
		return fail("container-not-found", 404)
	}

	// The whole feature rests on the item having a rendered URL. A container
	// that is not a dynamic page list has none, and the sidebar shows its
	// "not a dynamic page" state rather than a broken analysis.
	if (!container.isDynamicPageList) {
		return fail("not-a-dynamic-page", 409)
	}

	const previewUrl = await getContentPreviewUrl(
		mgmtApiUrl,
		token,
		guid,
		locale,
		container.contentViewID,
		contentID
	)

	const liveUrl = await getContentLiveUrl(
		mgmtApiUrl,
		token,
		guid,
		locale,
		container.contentViewID,
		contentID
	).catch(() => null)

	if (!previewUrl) {
		return fail("no-preview-url", 404)
	}

	// The API's URLs select the item with a legacy ?ContentID= that modern
	// sites ignore, so every item in a container renders as the same page.
	// Rebuild them around the item's slug; fall back to the API's own URL only
	// when there is no slug to build from.
	const itemPreviewUrl = buildItemUrl(previewUrl, container, item?.slug ?? null) ?? previewUrl
	const itemLiveUrl = liveUrl ? buildItemUrl(liveUrl, container, item?.slug ?? null) ?? liveUrl : null

	if (!item?.slug) {
		console.warn(
			`[seo-analysis] no slug field on content ${contentID}; falling back to the ` +
				`API's dynamic-page URL, which may render a different item.`
		)
	}

	return {
		ok: true,
		target: {
			previewUrl: itemPreviewUrl,
			liveUrl: itemLiveUrl,
			keyphraseKey: keyphraseKey(guid, locale, contentID),
			storedMetaDescription: null
		}
	}
}

/**
 * A regular page from the page tree.
 *
 * Simpler than the content item case: the page IS the rendered thing, and the
 * Management API has page-level preview/live URL endpoints (the ones the
 * manager's own preview button uses), so there is no slug to rebuild around.
 */
async function resolvePage(body: PageContentRequest & { pageID: number }): Promise<Resolution> {
	const { mgmtApiUrl, token, guid, locale, pageID } = body

	const page = await getPage(mgmtApiUrl, token, guid, locale, pageID)

	if (!page) {
		return fail("page-not-found", 404)
	}

	// Folders and links render nothing. A dynamic page node is the template its
	// content items render through: analyzing it would score whichever item the
	// site picks as the default, which is misleading - the item's own sidebar is
	// where that analysis lives.
	if (page.pageType === "folder" || page.pageType === "link") {
		return fail("folder-or-link", 409)
	}

	if (page.pageType === "dynamic") {
		return fail("dynamic-page-node", 409)
	}

	const [previewUrl, liveUrl] = await Promise.all([
		getPagePreviewUrl(mgmtApiUrl, token, guid, locale, pageID),
		getPageLiveUrl(mgmtApiUrl, token, guid, locale, pageID).catch(() => null)
	])

	if (!previewUrl) {
		return fail("no-preview-url", 404)
	}

	return {
		ok: true,
		target: {
			previewUrl,
			liveUrl,
			keyphraseKey: pageKeyphraseKey(guid, locale, pageID),
			storedMetaDescription: page.metaDescription
		}
	}
}

function fail(error: string, status: number): Resolution {
	return { ok: false, response: NextResponse.json({ error }, { status }) }
}

/**
 * The stored keyphrase, or null. A store that is missing or down must not take
 * the analysis down with it: the page still scores, the field is just empty.
 */
async function readStoredKeyphrase(key: string) {
	try {
		return await getKeyphraseStore().get(key)
	} catch (error) {
		console.warn("[seo-analysis] keyphrase read failed", error)
		return null
	}
}

/**
 * Fetches a preview URL the way a browser would.
 *
 * Agility preview URLs on a Next.js site typically hit a preview route that sets
 * a draft-mode cookie and redirects. `fetch` with the default redirect: "follow"
 * drops that Set-Cookie, so the followed request silently returns the PUBLISHED
 * page - or a 404 for an unpublished item. Following redirects by hand and
 * carrying the cookie jar forward is what makes draft content analyzable.
 */
async function fetchRenderedPage(
	url: string,
	maxRedirects = 5
): Promise<{ html: string | null; status: number }> {
	let currentUrl = url
	const cookies = new Map<string, string>()

	for (let hop = 0; hop <= maxRedirects; hop++) {
		const response: Response = await fetch(currentUrl, {
			redirect: "manual",
			cache: "no-store",
			headers: {
				// Some hosts vary rendering (or block) on an absent UA.
				"User-Agent": "AgilityCMS-SEO-Analysis/0.1 (+https://agilitycms.com)",
				Accept: "text/html,application/xhtml+xml",
				...(cookies.size ? { Cookie: serializeCookies(cookies) } : {})
			}
		})

		collectCookies(response, cookies)

		const isRedirect = response.status >= 300 && response.status < 400
		if (!isRedirect) {
			if (!response.ok) return { html: null, status: response.status }
			return { html: await response.text(), status: response.status }
		}

		const location = response.headers.get("location")
		if (!location) return { html: null, status: response.status }

		currentUrl = new URL(location, currentUrl).toString()
	}

	return { html: null, status: 508 }
}

function collectCookies(response: Response, jar: Map<string, string>) {
	// getSetCookie() is the only way to read multiple Set-Cookie headers; older
	// runtimes collapse them into one, so fall back to the single header.
	const raw =
		typeof (response.headers as any).getSetCookie === "function"
			? (response.headers as any).getSetCookie()
			: [response.headers.get("set-cookie")].filter(Boolean)

	for (const header of raw as string[]) {
		const pair = header.split(";")[0]
		const separator = pair.indexOf("=")
		if (separator < 1) continue

		jar.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim())
	}
}

function serializeCookies(jar: Map<string, string>): string {
	return Array.from(jar.entries())
		.map(([name, value]) => `${name}=${value}`)
		.join("; ")
}
