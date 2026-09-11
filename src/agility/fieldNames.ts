/**
 * Agility's own SEO field names on a dynamic-page content item.
 *
 * These are not ours - the CMS's built-in SEO tab reads and writes exactly these
 * keys on contentItem.Values (see ContentItemSEO.tsx in the manager app), and
 * the Fetch API surfaces them. Writing here rather than to app-private storage
 * is what makes the app's output visible to an existing site with no changes.
 */
export const AGILITY_SEO_FIELDS = {
	metaDescription: "DynamicPageMetaDescription",
	metaKeywords: "DynamicPageMetaKeywords",
	additionalHeaderCode: "DynamicPageAdditionalHeaderCode"
} as const

/**
 * Best guess at which field holds the page slug, used for the slug assessment
 * and the snippet preview's URL. Agility has no single convention, so the common
 * names are tried in order.
 */
const SLUG_FIELD_CANDIDATES = ["URL", "Slug", "PageSlug", "FriendlyURL"]

export function findSlugValue(values: Record<string, any> | undefined): string {
	if (!values) return ""

	for (const candidate of SLUG_FIELD_CANDIDATES) {
		const value = values[candidate]
		if (typeof value === "string" && value.trim()) return value.trim()
	}

	return ""
}
