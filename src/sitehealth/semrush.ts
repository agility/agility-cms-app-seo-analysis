import type { Issue, Severity } from "./types"

/**
 * Semrush Site Audit, read through the Projects API.
 *
 * SERVER ONLY. The API key is the customer's own, held by the app's backend and
 * never written to install config, where every editor's browser could read it.
 * (Semrush's OAuth needs client credentials issued by their support team and is
 * deprecated for Projects; Site Audit takes a key.)
 *
 * Semrush reports per URL and only after its crawl. What this adapter adds is a
 * way to start a crawl (launch), so a publish can be rechecked, and a flat list
 * of issues the core can locate in Agility and group.
 *
 * Every call costs the customer API units; the cost is noted on each method.
 * Docs: https://developer.semrush.com/api/v3/projects/site-audit/
 *
 * ⚠️ The endpoints and costs are from those docs (read 2026-11-09). The response
 * field names below (`current_snapshot`, `errors[].id`, `data[].source_url`) are
 * as far as the docs show them and have NOT yet been checked against a live
 * response; do that before relying on `issues()`.
 */

const BASE = "https://api.semrush.com/reports/v1/projects"

export interface SemrushSnapshot {
	snapshot_id: string
	finish_date: number
}

export interface SemrushIssueMeta {
	id: number
	title: string
	desc?: string
	/** Semrush's own buckets. */
	type?: "error" | "warning" | "notice"
}

export interface SemrushAuditInfo {
	id: number
	url: string
	status: string
	current_snapshot?: {
		snapshot_id: string
		finish_date: number
		quality?: { value: number; delta?: number }
		errors?: { id: number; count: number; delta?: number }[]
		warnings?: { id: number; count: number; delta?: number }[]
		notices?: { id: number; count: number; delta?: number }[]
	}
	pages_crawled?: number
}

export class SemrushError extends Error {
	constructor(message: string, readonly status: number) {
		super(message)
		this.name = "SemrushError"
	}
}

export class SemrushClient {
	constructor(
		private readonly apiKey: string,
		private readonly projectID: number,
		private readonly fetchImpl: typeof fetch = fetch
	) {}

	/** 100 units. Health score, the latest snapshot and its issue counts by id. */
	info(): Promise<SemrushAuditInfo> {
		return this.get("/siteaudit/info")
	}

	/** 100 units. Past crawls, newest first. */
	async snapshots(): Promise<SemrushSnapshot[]> {
		const res = await this.get<{ snapshots: SemrushSnapshot[] }>("/siteaudit/snapshots")
		return res.snapshots ?? []
	}

	/** 100 units. The text of every check Semrush runs. Cache it: it rarely changes. */
	async issueMeta(): Promise<SemrushIssueMeta[]> {
		const res = await this.get<{ issues: SemrushIssueMeta[] }>("/siteaudit/meta/issues")
		return res.issues ?? []
	}

	/** 100 units per page of results. The URLs one issue was found on. */
	async issuePages(snapshotID: string, issueID: number, page = 1, limit = 100) {
		return this.get<{
			total: number
			data: { page_id?: number; source_url: string; target_url?: string }[]
		}>(`/siteaudit/snapshot/${encodeURIComponent(snapshotID)}/issue/${issueID}`, { page: String(page), limit: String(limit) })
	}

	/** 100 units. Starts a crawl. Semrush runs it in the background and returns the new snapshot's id. */
	async launch(): Promise<string> {
		const res = await this.request<{ snapshot_id: string }>("POST", "/siteaudit/launch")
		return res.snapshot_id
	}

	/**
	 * Every issue in a snapshot, as core issues. Reads every page of every issue
	 * the snapshot has, so its cost is 100 units × (issues + extra result pages).
	 * The caller caches the result per snapshot id.
	 */
	async issues(info: SemrushAuditInfo, meta: SemrushIssueMeta[]): Promise<Issue[]> {
		const snapshot = info.current_snapshot
		if (!snapshot) return []

		const byId = new Map(meta.map((m) => [m.id, m]))
		const buckets: [Severity, { id: number; count: number }[] | undefined][] = [
			["error", snapshot.errors],
			["warning", snapshot.warnings],
			["notice", snapshot.notices]
		]

		const out: Issue[] = []
		for (const [severity, list] of buckets) {
			for (const { id, count } of list ?? []) {
				if (!count) continue
				const m = byId.get(id)
				for (let page = 1, seen = 0; seen < count; page++) {
					const res = await this.issuePages(snapshot.snapshot_id, id, page)
					if (!res.data?.length) break
					for (const row of res.data) {
						out.push({
							check: `semrush:${id}`,
							severity,
							source: "semrush",
							url: row.source_url,
							target: row.target_url && row.target_url !== row.source_url ? row.target_url : undefined,
							snippet: row.target_url && row.target_url !== row.source_url ? `target: ${row.target_url}` : `semrush:${id}`,
							message: m?.title ?? `Semrush check ${id}`,
							pageLevel: !row.target_url || row.target_url === row.source_url
						})
					}
					seen += res.data.length
				}
			}
		}
		return out
	}

	private get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
		return this.request<T>("GET", path, params)
	}

	private async request<T>(method: "GET" | "POST", path: string, params: Record<string, string> = {}): Promise<T> {
		const url = new URL(`${BASE}/${this.projectID}${path}`)
		url.searchParams.set("key", this.apiKey)
		for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

		const res = await this.fetchImpl(url, { method, headers: { Accept: "application/json" } })
		const body = await res.text()
		if (!res.ok) {
			// Never echo the URL: it carries the key.
			throw new SemrushError(`Semrush ${method} ${path} failed: ${res.status} ${body.slice(0, 200)}`, res.status)
		}
		try {
			return JSON.parse(body) as T
		} catch {
			throw new SemrushError(`Semrush ${method} ${path} returned non-JSON: ${body.slice(0, 200)}`, res.status)
		}
	}
}
