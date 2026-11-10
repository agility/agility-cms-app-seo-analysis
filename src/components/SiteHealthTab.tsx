"use client"

import { useCallback, useEffect, useState } from "react"
import { navigate } from "@agility/app-sdk"
import cn from "classnames"

import { CHECK_LABELS, siteHealthCall } from "@/sitehealth/client"
import type { IssueGroup } from "@/sitehealth/types"

type Group = IssueGroup & { total?: number }

interface SiteHealthTabProps {
	guid: string
	/** Content item sidebar: issues whose element came from this item. */
	contentID?: number
	/** Page sidebar: issues on this page. */
	pageID?: number
	/** The rendered page, for "Check now" and to match issues by URL. */
	pageUrl: string | null
	/** The site's origin, from install config or the page's live URL. */
	siteUrl: string | null
}

/**
 * The "Site health" tab in both sidebars.
 *
 * Shows what the last site scan found on this item or page, each issue on the
 * field it came from, and how many other pages share it. "Check now" re-runs
 * the built-in checks on the rendered page without waiting for a scan.
 */
export function SiteHealthTab({ guid, contentID, pageID, pageUrl, siteUrl }: SiteHealthTabProps) {
	const [groups, setGroups] = useState<Group[] | null>(null)
	const [scannedAt, setScannedAt] = useState<string | null>(null)
	const [checkedNow, setCheckedNow] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)

	const loadStored = useCallback(async () => {
		setError(null)
		try {
			const { report } = await siteHealthCall<{ report: { generatedAt: string; groups: Group[] } | null }>("report", guid, {
				contentID,
				pageID,
				url: pageUrl ?? undefined
			})
			setGroups(report?.groups ?? [])
			setScannedAt(report?.generatedAt ?? null)
			setCheckedNow(false)
		} catch (e) {
			setError((e as Error).message)
		}
	}, [guid, contentID, pageID, pageUrl])

	useEffect(() => {
		void loadStored()
	}, [loadStored])

	const checkNow = useCallback(async () => {
		if (!pageUrl || !siteUrl) return
		setBusy(true)
		setError(null)
		try {
			const res = await siteHealthCall<{ groups: Group[] }>("check-url", guid, { url: pageUrl, siteUrl })
			// On the content item surface, keep only what this item produced.
			setGroups(contentID ? res.groups.filter((g) => g.instances.some((i) => !i.origin?.contentID || i.origin.contentID === contentID)) : res.groups)
			setCheckedNow(true)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(false)
		}
	}, [guid, pageUrl, siteUrl, contentID])

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between text-2xs leading-[14px] tracking-tiny text-gray-500">
				<span>
					{checkedNow
						? "Checked just now (built-in checks)."
						: scannedAt
							? `From the site scan of ${new Date(scannedAt).toLocaleString()}.`
							: "No site scan yet. Run one from the Site Health section."}
				</span>
				{pageUrl && siteUrl ? (
					<button type="button" onClick={() => void checkNow()} disabled={busy} className="font-semibold text-violet-800 hover:underline disabled:opacity-50">
						{busy ? "Checking…" : "Check now"}
					</button>
				) : null}
			</div>

			{error ? <p className="text-xs text-red-700">{error}</p> : null}

			{groups === null ? null : groups.length === 0 ? (
				<p className="py-2 text-xs text-gray-500">No site health issues on this {contentID ? "item" : "page"}.</p>
			) : (
				<ul className="flex flex-col gap-2">
					{groups.map((g) => (
						<IssueRow key={g.key} group={g} currentContentID={contentID} />
					))}
				</ul>
			)}
		</div>
	)
}

function IssueRow({ group, currentContentID }: { group: Group; currentContentID?: number }) {
	const origin = group.instances[0]?.origin
	const others = (group.total ?? group.instances.length) - group.instances.length
	const otherItem = origin?.contentID && origin.contentID !== currentContentID ? origin.contentID : null

	return (
		<li className="rounded bg-gray-50 px-2.5 py-2">
			<div className="flex items-start gap-2">
				<span
					className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", {
						"bg-red-600": group.severity === "error",
						"bg-amber-500": group.severity === "warning",
						"bg-gray-400": group.severity === "notice"
					})}
				/>
				<div className="min-w-0 flex-1">
					<p className="text-xs font-semibold leading-4 text-gray-900">{CHECK_LABELS[group.check] ?? group.message}</p>
					<p className="text-xs leading-4 text-gray-600">{group.message}</p>
					<p className="mt-0.5 truncate font-mono text-2xs text-gray-500" title={group.snippet}>
						{group.snippet}
					</p>
					<p className="mt-0.5 text-2xs text-gray-500">
						{origin?.field ? <>In the <code className="font-mono">{origin.field}</code> field</> : "On the page"}
						{otherItem ? (
							<>
								{" "}of{" "}
								<button type="button" className="text-violet-800 hover:underline" onClick={() => void navigate({ target: { type: "contentItem", contentID: otherItem } })}>
									item {otherItem}
								</button>
							</>
						) : null}
						{others > 0 ? `. Also on ${others} other page${others === 1 ? "" : "s"}.` : "."}
					</p>
				</div>
			</div>
		</li>
	)
}
