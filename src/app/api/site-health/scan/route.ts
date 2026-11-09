import { NextResponse } from "next/server"

import { buildReport, scanUrls, sitemapUrls } from "@/sitehealth/scan"
import { SemrushClient } from "@/sitehealth/semrush"
import { decrypt } from "@/sitehealth/server/crypto"
import { publicSiteUrl, withInstance } from "@/sitehealth/server/routes"
import { loadSemrush, saveReport } from "@/sitehealth/server/store"
import type { Issue } from "@/sitehealth/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Stop starting new fetches this long before the function's limit, to leave time to save. */
const BUDGET_MS = 250_000

/**
 * Scans the instance's site: every URL in its sitemap through the built-in
 * checks, plus the latest Semrush Site Audit when Semrush is connected. Saves
 * the report for the section and the sidebars to read.
 *
 * Body: { mgmtApiUrl, token, guid, siteUrl, sitemapUrl? }
 */
export async function POST(request: Request) {
	return withInstance<{ siteUrl?: string; sitemapUrl?: string }>(request, async (body, auth) => {
		const started = Date.now()
		const site = publicSiteUrl(body.siteUrl)
		const sitemap = body.sitemapUrl ? publicSiteUrl(body.sitemapUrl) : new URL("/sitemap.xml", site)
		if (sitemap.hostname !== site.hostname) {
			return NextResponse.json({ error: "The sitemap must be on the site's own host." }, { status: 400 })
		}

		// Only the site's own pages: a sitemap can list other hosts, and the scan must not wander.
		const urls = (await sitemapUrls(sitemap.toString())).filter((u) => {
			try {
				return new URL(u).hostname === site.hostname
			} catch {
				return false
			}
		})
		if (!urls.length) return NextResponse.json({ error: `No pages found in ${sitemap}.` }, { status: 422 })

		const scan = await scanUrls(urls, { concurrency: 12, deadline: started + BUDGET_MS })
		const issues: Issue[] = [...scan.issues]

		let semrush
		const connection = await loadSemrush(auth.guid)
		if (connection) {
			const client = new SemrushClient(decrypt(connection.sealedKey, auth.guid), connection.projectID)
			const [info, meta] = await Promise.all([client.info(), client.issueMeta()])
			issues.push(...(await client.issues(info, meta)))
			if (info.current_snapshot) {
				semrush = {
					snapshotID: info.current_snapshot.snapshot_id,
					finishedAt: info.current_snapshot.finish_date,
					health: info.current_snapshot.quality?.value,
					pagesCrawled: info.pages_crawled
				}
			}
		}

		const report = buildReport(issues, {
			siteUrl: site.origin,
			urls: urls.length,
			scanned: scan.scanned,
			skipped: scan.skipped,
			failed: scan.failed,
			semrush
		})
		await saveReport(auth.guid, report)

		return NextResponse.json({
			generatedAt: report.generatedAt,
			urls: report.urls,
			scanned: report.scanned,
			skipped: report.skipped,
			failed: report.failed.length,
			groups: report.groups.length,
			semrush: report.semrush ?? null
		})
	})
}
