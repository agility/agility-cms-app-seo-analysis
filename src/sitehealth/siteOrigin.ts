/**
 * The site's origin: the install's "Site URL" setting when it has one, else the
 * origin of the page's live URL (which the Management API derives from the
 * instance's own site settings).
 */
export function siteOrigin(configured: unknown, liveUrl: string | null | undefined): string | null {
	for (const candidate of [configured, liveUrl]) {
		if (typeof candidate !== "string" || !candidate.trim()) continue
		try {
			return new URL(candidate.trim()).origin
		} catch {
			// try the next one
		}
	}
	return null
}
