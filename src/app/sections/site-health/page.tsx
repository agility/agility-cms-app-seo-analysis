"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { hasPermission, navigate, Permission, useAgilityAppSDK } from "@agility/app-sdk"
import cn from "classnames"

import { CHECK_LABELS, siteHealthCall } from "@/sitehealth/client"
import type { ScanReport } from "@/sitehealth/scan"
import type { IssueGroup, Severity } from "@/sitehealth/types"

/**
 * The Site Health section: the whole site's issues, grouped by cause.
 *
 * A group is one check on one element in one field, wherever it appears, so a
 * component shared by many pages, or a snippet pasted into many items, is one
 * line here with every place listed under it. Each place opens the content
 * item (or page) to fix.
 */
export default function SiteHealthSection() {
	const { initializing, instance, appInstallContext, user } = useAgilityAppSDK()
	const guid = instance?.guid ?? null
	const canManage = hasPermission(user, [Permission.Manage])

	const [report, setReport] = useState<ScanReport | null>(null)
	const [loaded, setLoaded] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [scanning, setScanning] = useState(false)
	const [siteUrl, setSiteUrl] = useState("")

	const [severity, setSeverity] = useState<Severity | "all">("all")
	const [source, setSource] = useState<string>("all")
	const [check, setCheck] = useState<string>("all")
	const [query, setQuery] = useState("")

	useEffect(() => {
		const configured = appInstallContext?.configuration?.siteUrl
		if (typeof configured === "string" && configured) setSiteUrl(configured)
	}, [appInstallContext?.configuration?.siteUrl])

	const load = useCallback(async () => {
		if (!guid) return
		try {
			const { report } = await siteHealthCall<{ report: ScanReport | null }>("report", guid)
			setReport(report)
			if (report?.siteUrl) setSiteUrl((s) => s || report.siteUrl!)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setLoaded(true)
		}
	}, [guid])

	useEffect(() => {
		if (!initializing) void load()
	}, [initializing, load])

	const scan = useCallback(async () => {
		if (!guid || !siteUrl) return
		setScanning(true)
		setError(null)
		try {
			await siteHealthCall("scan", guid, { siteUrl })
			await load()
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setScanning(false)
		}
	}, [guid, siteUrl, load])

	const groups = useMemo(() => {
		const q = query.trim().toLowerCase()
		return (report?.groups ?? []).filter(
			(g) =>
				(severity === "all" || g.severity === severity) &&
				(source === "all" || g.source === source) &&
				(check === "all" || g.check === check) &&
				(!q || g.snippet.toLowerCase().includes(q) || g.message.toLowerCase().includes(q) || g.instances.some((i) => i.url.toLowerCase().includes(q)))
		)
	}, [report, severity, source, check, query])

	const checks = useMemo(() => [...new Set((report?.groups ?? []).map((g) => g.check))].sort(), [report])
	const counts = useMemo(() => {
		const c = { error: 0, warning: 0, notice: 0 }
		for (const g of report?.groups ?? []) c[g.severity]++
		return c
	}, [report])

	if (initializing || !guid) return <div className="p-6 text-sm text-gray-500">Connecting to Agility…</div>

	return (
		<div className="flex h-full flex-col gap-5 overflow-auto p-6">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-lg font-semibold text-gray-900">Site Health</h1>
					<p className="text-sm text-gray-500">
						{report
							? `Scanned ${report.scanned} of ${report.urls} pages on ${new Date(report.generatedAt).toLocaleString()}${report.skipped ? ` (${report.skipped} left for the next scan)` : ""}.`
							: loaded
								? "No scan yet."
								: "Loading…"}
					</p>
				</div>
				<div className="flex items-end gap-2">
					<label className="flex flex-col text-xs text-gray-600">
						Site URL
						<input
							className="mt-1 w-72 rounded border border-gray-300 px-2 py-1.5 text-sm"
							value={siteUrl}
							onChange={(e) => setSiteUrl(e.target.value)}
							placeholder="https://www.example.com"
						/>
					</label>
					<button
						type="button"
						onClick={() => void scan()}
						disabled={scanning || !siteUrl}
						className="rounded bg-violet-800 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
					>
						{scanning ? "Scanning… (up to 5 minutes)" : "Scan site"}
					</button>
				</div>
			</div>

			{error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

			<SemrushPanel guid={guid} canManage={canManage} userName={user?.fullName} />

			{report ? (
				<>
					<div className="flex flex-wrap gap-3 text-sm">
						<Count label="Errors" value={counts.error} tone="bg-red-600" />
						<Count label="Warnings" value={counts.warning} tone="bg-amber-500" />
						<Count label="Notices" value={counts.notice} tone="bg-gray-400" />
						{report.semrush?.health != null ? <span className="text-gray-600">Semrush Site Health {report.semrush.health}%</span> : null}
					</div>

					<div className="flex flex-wrap gap-2 text-sm">
						<Select value={severity} onChange={(v) => setSeverity(v as Severity | "all")} options={["all", "error", "warning", "notice"]} />
						<Select value={source} onChange={setSource} options={["all", "builtin", "semrush"]} />
						<Select value={check} onChange={setCheck} options={["all", ...checks]} labels={CHECK_LABELS} />
						<input
							className="w-64 rounded border border-gray-300 px-2 py-1"
							placeholder="Filter by text or URL"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
						/>
						<span className="self-center text-gray-500">{groups.length} groups</span>
					</div>

					<ul className="flex flex-col gap-2">
						{groups.slice(0, 500).map((g) => (
							<GroupRow key={g.key} group={g} />
						))}
					</ul>
					{groups.length > 500 ? <p className="text-sm text-gray-500">Showing the first 500. Narrow the filter to see the rest.</p> : null}
				</>
			) : null}
		</div>
	)
}

function GroupRow({ group }: { group: IssueGroup }) {
	const [open, setOpen] = useState(false)
	const items = new Set(group.instances.map((i) => i.origin?.contentID).filter(Boolean))
	const field = group.instances.find((i) => i.origin?.field)?.origin?.field

	return (
		<li className="rounded bg-gray-50 px-3 py-2">
			<button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setOpen((o) => !o)}>
				<span
					className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", {
						"bg-red-600": group.severity === "error",
						"bg-amber-500": group.severity === "warning",
						"bg-gray-400": group.severity === "notice"
					})}
				/>
				<span className="min-w-0 flex-1">
					<span className="block text-sm font-semibold text-gray-900">
						{CHECK_LABELS[group.check] ?? group.message}
						<span className="ml-2 font-normal text-gray-500">
							{group.instances.length} page{group.instances.length === 1 ? "" : "s"}
							{items.size ? `, ${items.size} item${items.size === 1 ? "" : "s"}` : ""}
							{field ? `, field ${field}` : ""}
						</span>
					</span>
					<span className="block truncate font-mono text-xs text-gray-500">{group.snippet}</span>
				</span>
				<span className="text-xs text-gray-400">{group.source}</span>
			</button>

			{open ? (
				<ul className="mt-2 flex flex-col gap-1 border-t border-gray-200 pt-2">
					<li className="text-xs text-gray-600">{group.message}</li>
					{group.instances.map((i) => (
						<li key={i.url} className="flex flex-wrap items-center gap-3 text-xs">
							<a href={i.url} target="_blank" rel="noreferrer" className="truncate text-gray-700 hover:underline">
								{i.url}
							</a>
							{i.origin?.contentID ? (
								<button type="button" className="text-violet-800 hover:underline" onClick={() => void navigate({ target: { type: "contentItem", contentID: i.origin!.contentID! } })}>
									Open item {i.origin.contentID}
								</button>
							) : null}
							{i.origin?.pageID ? (
								<button type="button" className="text-violet-800 hover:underline" onClick={() => void navigate({ target: { type: "page", pageID: i.origin!.pageID! } })}>
									Open page
								</button>
							) : null}
						</li>
					))}
				</ul>
			) : null}
		</li>
	)
}

function SemrushPanel({ guid, canManage, userName }: { guid: string; canManage: boolean; userName?: string }) {
	type Status = { connected: boolean; projectID?: number; site?: string; health?: number | null; lastCrawl?: number | null; error?: string; connectedBy?: string | null }
	const [status, setStatus] = useState<Status | null>(null)
	const [apiKey, setApiKey] = useState("")
	const [projectID, setProjectID] = useState("")
	const [busy, setBusy] = useState(false)
	const [message, setMessage] = useState<string | null>(null)

	const refresh = useCallback(async () => {
		try {
			setStatus(await siteHealthCall<Status>("semrush", guid, { action: "status" }))
		} catch (e) {
			setMessage((e as Error).message)
		}
	}, [guid])

	useEffect(() => {
		void refresh()
	}, [refresh])

	const act = async (action: "connect" | "disconnect" | "launch") => {
		setBusy(true)
		setMessage(null)
		try {
			const res = await siteHealthCall<{ snapshotID?: string }>("semrush", guid, {
				action,
				...(action === "connect" ? { apiKey, projectID: Number(projectID), userName } : {})
			})
			if (action === "connect") setApiKey("")
			if (action === "launch") setMessage(`Semrush crawl started (snapshot ${res.snapshotID}). Scan the site again once it finishes.`)
			await refresh()
		} catch (e) {
			setMessage((e as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="rounded border border-gray-200 px-4 py-3 text-sm">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<span className="font-semibold text-gray-900">Semrush</span>{" "}
					{status?.connected ? (
						<span className="text-gray-600">
							Connected to project {status.projectID}
							{status.site ? ` (${status.site})` : ""}
							{status.health != null ? `, Site Health ${status.health}%` : ""}
							{status.lastCrawl ? `, last crawl ${new Date(status.lastCrawl).toLocaleDateString()}` : ""}
							{status.error ? `. ${status.error}` : "."}
						</span>
					) : (
						<span className="text-gray-500">Not connected. Connect it to add your Semrush Site Audit to every scan.</span>
					)}
				</div>
				{status?.connected ? (
					<div className="flex gap-2">
						<button type="button" disabled={busy} onClick={() => void act("launch")} className="rounded border border-gray-300 px-2.5 py-1 disabled:opacity-50">
							Run Semrush crawl
						</button>
						{canManage ? (
							<button type="button" disabled={busy} onClick={() => void act("disconnect")} className="rounded border border-gray-300 px-2.5 py-1 text-red-700 disabled:opacity-50">
								Disconnect
							</button>
						) : null}
					</div>
				) : null}
			</div>

			{!status?.connected && canManage ? (
				<div className="mt-3 flex flex-wrap items-end gap-2">
					<label className="flex flex-col text-xs text-gray-600">
						Project ID
						<input className="mt-1 w-32 rounded border border-gray-300 px-2 py-1" value={projectID} onChange={(e) => setProjectID(e.target.value.replace(/\D/g, ""))} />
					</label>
					<label className="flex flex-col text-xs text-gray-600">
						API key
						<input type="password" autoComplete="off" className="mt-1 w-72 rounded border border-gray-300 px-2 py-1" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
					</label>
					<button type="button" disabled={busy || !apiKey || !projectID} onClick={() => void act("connect")} className="rounded bg-violet-800 px-3 py-1 font-semibold text-white disabled:opacity-50">
						Connect
					</button>
					<p className="w-full text-xs text-gray-500">
						The key is stored encrypted on the app's server and never shown again or sent to anyone's browser. Each Semrush call uses your account's API units.
					</p>
				</div>
			) : null}

			{message ? <p className="mt-2 text-xs text-gray-700">{message}</p> : null}
		</div>
	)
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
	return (
		<span className="flex items-center gap-1.5 text-gray-700">
			<span className={cn("h-2 w-2 rounded-full", tone)} />
			{value} {label.toLowerCase()}
		</span>
	)
}

function Select({ value, onChange, options, labels }: { value: string; onChange: (v: string) => void; options: string[]; labels?: Record<string, string> }) {
	return (
		<select className="rounded border border-gray-300 px-2 py-1" value={value} onChange={(e) => onChange(e.target.value)}>
			{options.map((o) => (
				<option key={o} value={o}>
					{o === "all" ? "All" : (labels?.[o] ?? o)}
				</option>
			))}
		</select>
	)
}
