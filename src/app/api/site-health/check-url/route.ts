import { NextResponse } from "next/server"

import { runChecks } from "@/sitehealth/checks"
import { groupIssues } from "@/sitehealth/group"
import { publicSiteUrl, withInstance } from "@/sitehealth/server/routes"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Runs the built-in checks on one page now, for a sidebar's "Check now".
 * Nothing is saved; the next scan picks the page up with the rest.
 *
 * Body: { mgmtApiUrl, token, guid, url, siteUrl }. The URL must be on the site's host.
 */
export async function POST(request: Request) {
	return withInstance<{ url?: string; siteUrl?: string }>(request, async (body) => {
		const site = publicSiteUrl(body.siteUrl)
		const target = publicSiteUrl(body.url)
		if (target.hostname !== site.hostname) {
			return NextResponse.json({ error: "The page must be on the site's own host." }, { status: 400 })
		}

		const res = await fetch(target, { redirect: "follow", cache: "no-store", headers: { "User-Agent": "AgilitySiteHealth/0.1" } })
		if (!res.ok) return NextResponse.json({ error: `The page answered ${res.status}.` }, { status: 502 })

		const groups = groupIssues(runChecks(target.toString(), await res.text()))
		return NextResponse.json({ checkedAt: new Date().toISOString(), url: target.toString(), groups })
	})
}
