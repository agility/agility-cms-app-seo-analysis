import { NextResponse } from "next/server"

import { extractMainContent } from "@/analysis/extract"
import {
	getContainerByReferenceName,
	getContentLiveUrl,
	getContentPreviewUrl,
	getItemDetails
} from "@/agility/managementApi"
import { buildItemUrl } from "@/agility/itemUrl"
import { getKeyphraseStore, keyphraseKey } from "@/store/keyphraseStore"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface PageContentRequest {
	mgmtApiUrl: string
	token: string
	guid: string
	locale: string
	referenceName: string
	contentID: number
	contentSelector?: string
}

/**
 * Resolves a content item's rendered dynamic page and returns its main content.
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

	const { mgmtApiUrl, token, guid, locale, referenceName, contentID } = body

	if (!mgmtApiUrl || !token || !guid || !locale || !referenceName || !contentID) {
		return NextResponse.json({ error: "Missing required context." }, { status: 400 })
	}

	try {
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
			return NextResponse.json({ error: "container-not-found" }, { status: 404 })
		}

		// The whole feature rests on the item having a rendered URL. A container
		// that is not a dynamic page list has none, and the sidebar shows its
		// "not a dynamic page" state rather than a broken analysis.
		if (!container.isDynamicPageList) {
			return NextResponse.json({ error: "not-a-dynamic-page" }, { status: 409 })
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
			return NextResponse.json({ error: "no-preview-url" }, { status: 404 })
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

		// The stored keyphrase rides along with the page: this route has already
		// proven the caller can read the item, so no second authorization trip.
		const [{ html, status }, stored] = await Promise.all([
			fetchRenderedPage(itemPreviewUrl),
			readStoredKeyphrase(guid, locale, contentID)
		])

		if (!html) {
			return NextResponse.json(
				{ error: "preview-fetch-failed", previewUrl: itemPreviewUrl, status },
				{ status: 502 }
			)
		}

		const extracted = extractMainContent(html, body.contentSelector)

		return NextResponse.json({
			previewUrl: itemPreviewUrl,
			liveUrl: itemLiveUrl,
			keyphrase: stored?.keyphrase ?? null,
			...extracted
		})
	} catch (error) {
		console.error("[seo-analysis] page content failed", error)
		return NextResponse.json({ error: "page-content-failed" }, { status: 500 })
	}
}

/**
 * The stored keyphrase, or null. A store that is missing or down must not take
 * the analysis down with it: the page still scores, the field is just empty.
 */
async function readStoredKeyphrase(guid: string, locale: string, contentID: number) {
	try {
		return await getKeyphraseStore().get(keyphraseKey(guid, locale, contentID))
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
