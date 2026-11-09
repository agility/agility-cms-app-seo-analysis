/**
 * Semrush Site Audit from the command line, so nobody has to open the Semrush UI
 * to read a score, rerun a crawl or list the pages behind one issue.
 *
 *   npm run semrush -- status               health, pages crawled, every issue with its count and change   (200 units)
 *   npm run semrush -- history              past crawls, newest first                                       (100 units)
 *   npm run semrush -- launch               start a crawl with the project's saved settings                 (100 units)
 *   npm run semrush -- pages <issueID> [--max 500] [--out pages.json]
 *                                           the URLs one issue was found on                                 (100 units per 100 URLs)
 *
 * Needs SEMRUSH_API_KEY and SEMRUSH_PROJECT_ID, read from .env.local or the
 * environment. The key is never printed. Units come from the Semrush
 * subscription's API balance, so each command says what it costs before the
 * caller runs it.
 *
 * For a full Site Health report merged with Semrush, use `npm run site-health -- <urls> --semrush <projectID>`.
 */
import { writeFileSync } from "node:fs"

import { SemrushClient, type SemrushAuditInfo, type SemrushIssueMeta } from "../src/sitehealth/semrush"

async function main() {
	const [command, ...args] = process.argv.slice(2)
	const key = process.env.SEMRUSH_API_KEY
	const project = Number(flag(args, "--project") ?? process.env.SEMRUSH_PROJECT_ID)
	if (!command || !["status", "history", "launch", "pages"].includes(command)) {
		console.error("usage: semrush <status | history | launch | pages <issueID>> [--project <id>]")
		process.exit(2)
	}
	if (!key) throw new Error("SEMRUSH_API_KEY is not set. Put it in .env.local (see .env.local.example).")
	if (!project) throw new Error("SEMRUSH_PROJECT_ID is not set, and no --project was given.")
	const client = new SemrushClient(key, project)

	if (command === "status") {
		const [info, meta] = await Promise.all([client.info(), client.issueMeta()])
		printStatus(info, meta)
	} else if (command === "history") {
		for (const s of await client.snapshots()) console.log(`${date(s.finish_date)}  ${s.snapshot_id}`)
	} else if (command === "launch") {
		const id = await client.launch()
		console.log(`Crawl started: snapshot ${id}. Run \`npm run semrush -- status\` once it finishes.`)
	} else {
		const issueID = Number(args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--"))))
		if (!issueID) throw new Error("pages needs an issue id (from `status`).")
		const snapshot = (await client.info()).current_snapshot?.snapshot_id
		if (!snapshot) throw new Error("The project has no finished crawl yet.")
		const max = Number(flag(args, "--max") ?? 500)
		const rows: { source_url: string; target_url?: string }[] = []
		for (let page = 1; rows.length < max; page++) {
			const res = await client.issuePages(snapshot, issueID, page)
			if (!res.data?.length) break
			rows.push(...res.data)
		}
		const out = flag(args, "--out")
		if (out) writeFileSync(out, JSON.stringify(rows, null, 1))
		for (const r of rows) console.log(r.target_url && r.target_url !== r.source_url ? `${r.source_url}  →  ${r.target_url}` : r.source_url)
		console.error(`${rows.length} rows${out ? `, written to ${out}` : ""}`)
	}
}

function printStatus(info: SemrushAuditInfo, meta: SemrushIssueMeta[]) {
	const s = info.current_snapshot
	if (!s) {
		console.log(`${info.url}: no finished crawl yet (status ${info.status}).`)
		return
	}
	const titles = new Map(meta.map((m) => [m.id, m.title]))
	console.log(`${info.url}  crawl ${date(s.finish_date)}  (${info.status})`)
	console.log(`Site Health ${s.quality?.value ?? "?"}%${delta(s.quality?.delta)}  pages crawled ${info.pages_crawled ?? "?"}`)
	for (const [label, list] of [["Errors", s.errors], ["Warnings", s.warnings], ["Notices", s.notices]] as const) {
		const rows = (list ?? []).filter((r) => r.count).sort((a, b) => b.count - a.count)
		console.log(`\n${label}: ${rows.reduce((n, r) => n + r.count, 0)}`)
		for (const r of rows) console.log(`  ${String(r.count).padStart(6)}${delta(r.delta).padEnd(8)} [${r.id}] ${titles.get(r.id) ?? "?"}`)
	}
}

const date = (t: number) => new Date(t < 1e12 ? t * 1000 : t).toISOString().slice(0, 16).replace("T", " ")
const delta = (d?: number) => (d ? ` (${d > 0 ? "+" : ""}${d})` : "")

function flag(args: string[], name: string): string | undefined {
	const i = args.indexOf(name)
	return i >= 0 ? args[i + 1] : undefined
}

main().catch((e) => {
	console.error(e instanceof Error ? e.message : e)
	process.exit(1)
})
