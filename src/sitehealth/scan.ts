import { runChecks } from "./checks"
import { groupIssues } from "./group"
import type { Issue, IssueGroup } from "./types"

/**
 * Fetches a set of pages and runs the built-in checks on each.
 *
 * Shared by the CLI (scripts/site-health.ts) and the scan route. The route runs
 * inside a serverless function with a time limit, so `deadline` stops starting
 * new fetches once it passes, and the report says how many URLs were left.
 */

export interface ScanReport {
	generatedAt: string
	siteUrl?: string
	urls: number
	scanned: number
	/** URLs not reached before the deadline. */
	skipped: number
	failed: { url: string; status: number | string }[]
	groups: IssueGroup[]
	/** The Semrush snapshot merged in, if any. */
	semrush?: { snapshotID: string; finishedAt: number; health?: number; pagesCrawled?: number }
}

export interface ScanOptions {
	concurrency?: number
	/** Epoch ms after which no new fetch starts. */
	deadline?: number
	onProgress?: (done: number, total: number) => void
}

const USER_AGENT = "AgilitySiteHealth/0.1 (+https://agilitycms.com/docs/apps/site-health)"

export async function scanUrls(urls: string[], options: ScanOptions = {}): Promise<{ issues: Issue[]; scanned: number; skipped: number; failed: ScanReport["failed"] }> {
	const issues: Issue[] = []
	const failed: ScanReport["failed"] = []
	let next = 0
	let scanned = 0

	const worker = async () => {
		while (next < urls.length) {
			if (options.deadline && Date.now() > options.deadline) return
			const url = urls[next++]
			try {
				const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "follow", cache: "no-store" })
				if (!res.ok) failed.push({ url, status: res.status })
				else if ((res.headers.get("content-type") ?? "").includes("html")) issues.push(...runChecks(url, await res.text()))
			} catch (err) {
				failed.push({ url, status: (err as Error).message })
			}
			scanned++
			options.onProgress?.(scanned, urls.length)
		}
	}

	await Promise.all(Array.from({ length: Math.max(1, options.concurrency ?? 8) }, worker))
	return { issues, scanned, skipped: urls.length - scanned, failed }
}

/** Every page URL in a sitemap, following one level of sitemap index. */
export async function sitemapUrls(sitemapUrl: string): Promise<string[]> {
	const xml = await (await fetch(sitemapUrl, { headers: { "User-Agent": USER_AGENT }, cache: "no-store" })).text()
	const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => decodeXml(m[1]))
	if (!/<sitemapindex[\s>]/.test(xml)) return locs

	const nested = await Promise.all(locs.map(async (loc) => {
		const child = await (await fetch(loc, { headers: { "User-Agent": USER_AGENT }, cache: "no-store" })).text()
		return [...child.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => decodeXml(m[1]))
	}))
	return nested.flat()
}

export function buildReport(issues: Issue[], scan: Omit<ScanReport, "groups" | "generatedAt">): ScanReport {
	return { generatedAt: new Date().toISOString(), ...scan, groups: groupIssues(issues) }
}

function decodeXml(s: string): string {
	return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}
