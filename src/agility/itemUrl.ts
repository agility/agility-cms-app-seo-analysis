import type { AgilityContainer } from "./managementApi"

/**
 * Builds the real, rendered URL for one dynamic-page content item.
 *
 * This exists because the Management API's content previewUrl/liveUrl endpoints
 * cannot be used directly. They return the LEGACY dynamic-page form -
 * `/blog/post-details?ContentID=1501` - which modern Agility sites (the Next.js
 * starters included) do not honour: they route on friendly slugs, ignore the
 * query string, and render whatever the dynamic page's default item is. Every
 * item in a container therefore comes back as the same page, and the analysis
 * silently scores the wrong post. Verified on a live instance: two different
 * items both resolved to ContentID=1501, which rendered a third, unrelated post.
 *
 * The friendly URL is the details-page path with its final segment - the
 * dynamic page node, e.g. "post-details" - replaced by the item's slug.
 *
 * The endpoints are still worth calling: they give us the site's origin and, for
 * preview, the `agilitypreviewkey` query string, neither of which we can derive.
 */
export function buildItemUrl(
	baseUrlFromApi: string,
	container: AgilityContainer,
	slug: string | null
): string | null {
	if (!slug) return null

	let base: URL
	try {
		base = new URL(baseUrlFromApi)
	} catch {
		return null
	}

	const detailsPath = normalizePath(container.defaultDetailsPage)
	const listingPath = normalizePath(container.defaultListingPage)

	// "~/blog/post-details" -> "/blog", then + the slug.
	const parentPath = detailsPath ? detailsPath.replace(/\/[^/]*$/, "") : listingPath

	if (parentPath === null) return null

	const url = new URL(base.origin)
	url.pathname = `${parentPath}/${slug}`.replace(/\/{2,}/g, "/")

	// Carry the query string across: for a preview URL it holds agilitypreviewkey
	// and agilityts, which is what makes draft content render. ContentID is the
	// legacy selector we are replacing, so it is dropped.
	base.searchParams.forEach((value, key) => {
		if (key.toLowerCase() === "contentid") return
		url.searchParams.set(key, value)
	})

	return url.toString()
}

/** "~/blog/post-details" -> "/blog/post-details". */
function normalizePath(agilityPath: string | null): string | null {
	if (!agilityPath) return null

	const path = agilityPath.replace(/^~/, "").trim()
	if (!path) return null

	return path.startsWith("/") ? path.replace(/\/+$/, "") : `/${path}`.replace(/\/+$/, "")
}
