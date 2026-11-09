/**
 * Runs Site Health over a whole site from the command line, with no CMS in the loop.
 *
 *   npm run site-health -- <urls.txt | https://site/sitemap.xml> [--out report.json] [--concurrency 8]
 *   npm run site-health -- <urls> --semrush <projectID>     (needs SEMRUSH_API_KEY in the environment)
 *
 * Fetches every URL, runs the built-in checks, optionally adds the latest Semrush
 * Site Audit, groups the lot by cause, and prints the groups that affect the most
 * places. The JSON report holds every group with every instance.
 *
 * This is step 1 of plans/seo-tool-apps.md: the core proven on a real site
 * before any CMS surface is built on it.
 */
import { readFileSync, writeFileSync } from "node:fs"

import { runChecks } from "../src/sitehealth/checks"
import { groupIssues } from "../src/sitehealth/group"
import { SemrushClient } from "../src/sitehealth/semrush"
import type { Issue } from "../src/sitehealth/types"

async function main() {
	const args = process.argv.slice(2)
	const source = args.find((a) => !a.startsWith("--") && !isFlagValue(args, a))
	if (!source) {
		console.error("usage: site-health <urls.txt | sitemap.xml URL> [--out report.json] [--concurrency 8] [--semrush <projectID>]")
		process.exit(2)
	}
	const out = flag(args, "--out") ?? "site-health-report.json"
	const concurrency = Number(flag(args, "--concurrency") ?? 8)
	const semrushProject = flag(args, "--semrush")

	const urls = await loadUrls(source)
	console.error(`${urls.length} URLs`)

	const issues: Issue[] = []
	const failed: { url: string; status: number | string }[] = []
	let done = 0

	await pool(urls, concurrency, async (url) => {
		try {
			const res = await fetch(url, { headers: { "User-Agent": "AgilitySiteHealth/0.1 (+https://agilitycms.com)" }, redirect: "follow" })
			if (!res.ok) {
				failed.push({ url, status: res.status })
				return
			}
			if (!(res.headers.get("content-type") ?? "").includes("html")) return
			issues.push(...runChecks(url, await res.text()))
		} catch (err) {
			failed.push({ url, status: (err as Error).message })
		} finally {
			if (++done % 100 === 0) console.error(`  ${done}/${urls.length}`)
		}
	})

	if (semrushProject) {
		const key = process.env.SEMRUSH_API_KEY
		if (!key) throw new Error("--semrush needs SEMRUSH_API_KEY in the environment.")
		const client = new SemrushClient(key, Number(semrushProject))
		const [info, meta] = await Promise.all([client.info(), client.issueMeta()])
		const vendor = await client.issues(info, meta)
		console.error(`Semrush: snapshot ${info.current_snapshot?.snapshot_id}, ${vendor.length} issue instances`)
		issues.push(...vendor)
	}

	const groups = groupIssues(issues)
	writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), urls: urls.length, failed, groups }, null, "\t"))

	const located = issues.filter((i) => i.origin?.contentID || i.origin?.field).length
	console.log(`\n${issues.length} issues in ${groups.length} groups; ${located} located to a content item or field; ${failed.length} URLs failed.\n`)
	for (const g of groups.filter((g) => !g.check.startsWith("meta-") && !g.check.startsWith("title-")).slice(0, 25)) {
		const items = new Set(g.instances.map((i) => i.origin?.contentID).filter(Boolean))
		const field = g.instances[0]?.origin?.field
		console.log(
			`${g.severity.padEnd(7)} ${String(g.instances.length).padStart(4)} pages  ${g.check.padEnd(20)} ${g.snippet.slice(0, 70)}` +
				(field ? `  [field ${field}, ${items.size} item${items.size === 1 ? "" : "s"}]` : "")
		)
	}
	console.log(`\nFull report: ${out}`)
}

async function loadUrls(source: string): Promise<string[]> {
	if (/^https?:\/\//.test(source)) {
		const xml = await (await fetch(source)).text()
		return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1])
	}
	return readFileSync(source, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => /^https?:\/\//.test(l))
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
	let next = 0
	await Promise.all(Array.from({ length: Math.max(1, size) }, async () => {
		while (next < items.length) await fn(items[next++])
	}))
}

function flag(args: string[], name: string): string | undefined {
	const i = args.indexOf(name)
	return i >= 0 ? args[i + 1] : undefined
}

function isFlagValue(args: string[], value: string): boolean {
	const i = args.indexOf(value)
	return i > 0 && args[i - 1].startsWith("--")
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err)
	process.exit(1)
})
