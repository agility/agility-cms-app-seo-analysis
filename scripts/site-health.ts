/**
 * Runs Site Health over a whole site from the command line, with no CMS in the loop.
 *
 *   npm run site-health -- <urls.txt | https://site/sitemap.xml> [--out report.json] [--concurrency 8]
 *   npm run site-health -- <urls> --semrush <projectID>     (needs SEMRUSH_API_KEY in the environment)
 *
 * Fetches every URL, runs the built-in checks, optionally adds the latest Semrush
 * Site Audit, groups the lot by cause, and prints the groups that affect the most
 * places. The JSON report is the same shape the app stores.
 *
 * This is step 1 of plans/seo-tool-apps.md: the core proven on a real site
 * before any CMS surface is built on it.
 */
import { readFileSync, writeFileSync } from "node:fs"

import { buildReport, scanUrls, sitemapUrls } from "../src/sitehealth/scan"
import { SemrushClient } from "../src/sitehealth/semrush"
import type { Issue } from "../src/sitehealth/types"

async function main() {
	const args = process.argv.slice(2)
	const source = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")))
	if (!source) {
		console.error("usage: site-health <urls.txt | sitemap.xml URL> [--out report.json] [--concurrency 8] [--semrush <projectID>]")
		process.exit(2)
	}
	const out = flag(args, "--out") ?? "site-health-report.json"
	const semrushProject = flag(args, "--semrush")

	const urls = /^https?:\/\//.test(source)
		? await sitemapUrls(source)
		: readFileSync(source, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => /^https?:\/\//.test(l))
	console.error(`${urls.length} URLs`)

	const scan = await scanUrls(urls, {
		concurrency: Number(flag(args, "--concurrency") ?? 8),
		onProgress: (done, total) => done % 100 === 0 && console.error(`  ${done}/${total}`)
	})
	const issues: Issue[] = [...scan.issues]

	let semrush
	if (semrushProject) {
		const key = process.env.SEMRUSH_API_KEY
		if (!key) throw new Error("--semrush needs SEMRUSH_API_KEY in the environment.")
		const client = new SemrushClient(key, Number(semrushProject))
		const [info, meta] = await Promise.all([client.info(), client.issueMeta()])
		const vendor = await client.issues(info, meta)
		console.error(`Semrush: snapshot ${info.current_snapshot?.snapshot_id}, ${vendor.length} issue instances`)
		issues.push(...vendor)
		if (info.current_snapshot) {
			semrush = { snapshotID: info.current_snapshot.snapshot_id, finishedAt: info.current_snapshot.finish_date, health: info.current_snapshot.quality?.value, pagesCrawled: info.pages_crawled }
		}
	}

	const report = buildReport(issues, { urls: urls.length, scanned: scan.scanned, skipped: scan.skipped, failed: scan.failed, semrush })
	writeFileSync(out, JSON.stringify(report, null, "\t"))

	const located = issues.filter((i) => i.origin?.contentID || i.origin?.field).length
	console.log(`\n${issues.length} issues in ${report.groups.length} groups; ${located} located to a content item or field; ${scan.failed.length} URLs failed.\n`)
	for (const g of report.groups.filter((g) => !g.check.startsWith("meta-") && !g.check.startsWith("title-")).slice(0, 25)) {
		const items = new Set(g.instances.map((i) => i.origin?.contentID).filter(Boolean))
		const field = g.instances[0]?.origin?.field
		console.log(
			`${g.severity.padEnd(7)} ${String(g.instances.length).padStart(4)} pages  ${g.check.padEnd(20)} ${g.snippet.slice(0, 70)}` +
				(field ? `  [field ${field}, ${items.size} item${items.size === 1 ? "" : "s"}]` : "")
		)
	}
	console.log(`\nFull report: ${out}`)
}

function flag(args: string[], name: string): string | undefined {
	const i = args.indexOf(name)
	return i >= 0 ? args[i + 1] : undefined
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err)
	process.exit(1)
})
