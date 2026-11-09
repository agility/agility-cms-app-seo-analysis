import { NextResponse } from "next/server"

import { withInstance } from "@/sitehealth/server/routes"
import { loadReport } from "@/sitehealth/server/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * The instance's latest scan.
 *
 * Body: { mgmtApiUrl, token, guid, contentID?, pageID?, url? }
 * With a filter, only the groups that touch that item, page or URL come back,
 * each with only its matching instances (plus the group's total, so a sidebar
 * can say "also on 94 other pages").
 */
export async function POST(request: Request) {
	return withInstance<{ contentID?: number; pageID?: number; url?: string }>(request, async (body, auth) => {
		const report = await loadReport(auth.guid)
		if (!report) return NextResponse.json({ report: null })

		const { contentID, pageID, url } = body
		if (!contentID && !pageID && !url) return NextResponse.json({ report })

		const path = url ? safePath(url) : null
		const groups = report.groups
			.map((g) => {
				const matching = g.instances.filter(
					(i) =>
						(contentID && i.origin?.contentID === contentID) ||
						(pageID && i.origin?.pageID === pageID) ||
						(path && safePath(i.url) === path)
				)
				return matching.length ? { ...g, total: g.instances.length, instances: matching } : null
			})
			.filter(Boolean)

		return NextResponse.json({ report: { ...report, groups } })
	})
}

/** Compare URLs by path, so a preview host and the live host match. */
function safePath(u: string): string | null {
	try {
		return new URL(u).pathname.replace(/\/+$/, "") || "/"
	} catch {
		return null
	}
}
