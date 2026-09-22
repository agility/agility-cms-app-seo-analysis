"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getManagementAPIToken, refresh, useAgilityAppSDK, type IPageItem } from "@agility/app-sdk"

import type { EditFieldName } from "@/analysis/types"
import { resolveManagementApiUrl } from "@/agility/mgmtApiUrl"
import { AnalysisPanel, Panel } from "@/components/AnalysisPanel"
import type { UnsupportedReason } from "@/components/EmptyState"
import { AnalysisSkeleton } from "@/components/Skeleton"
import { measureTitleWidth } from "@/lib/pixelWidth"
import { useAnalysis } from "@/lib/useAnalysis"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { useKeyphraseSave } from "@/lib/useKeyphraseSave"
import { type PageContentState, usePageContent } from "@/lib/usePageContent"
import { usePageItem } from "@/lib/usePageItem"
import { usePageSeoSave } from "@/lib/usePageSeoSave"

/**
 * The page sidebar: regular pages from the page tree.
 *
 * Same panel as the content item sidebar, two differences underneath:
 *
 * 1. The page is found by its own ID. The page item is the manager's legacy
 *    shape, where the page ID is `ItemContainerID` (pages are items
 *    internally) - the same field the manager itself passes as pageID. It is
 *    fetched by usePageItem, because useAgilityAppSDK never fills in its own
 *    `pageItem` (see that hook for why).
 * 2. The App SDK is read-only here - no setFieldValue - so the meta description
 *    is saved through the Management API on commit (blur), not per keystroke.
 *    Each save is a whole-page write and a new version, so one per edit.
 */
export default function PageSidebar() {
	const { initializing, appInstallContext, instance, locale: sdkLocale } = useAgilityAppSDK()
	const pageItem = usePageItem(initializing)

	const [keyphrase, setKeyphrase] = useState("")
	const [description, setDescription] = useState("")

	const descriptionRef = useRef<HTMLTextAreaElement>(null)

	const { state: loadedState, load: loadPage } = usePageContent()
	const { state: analysisState, run: runAnalysis } = useAnalysis()
	const { state: keyphraseSaveState, save: saveKeyphrase, markSaved: markKeyphraseSaved } = useKeyphraseSave()
	const { state: seoSaveState, save: saveSeo, markSaved: markSeoSaved } = usePageSeoSave()

	const contentSelector = appInstallContext?.configuration?.contentSelector
	const defaultLocale = appInstallContext?.configuration?.defaultLocale

	const pageID = pageItem?.ItemContainerID || null
	// The page's own language wins: an editor can be viewing a locale other
	// than the instance default, and the page record is per-locale.
	const locale = pageItem?.LanguageCode || sdkLocale || null

	// Folders, links and dynamic page templates render nothing scoreable, and
	// the pageItem already says which this is - no round trip needed to know.
	const unsupportedReason = useMemo(() => pageItem && unsupportedReasonFor(pageItem), [pageItem])

	const loadRenderedPage = useCallback(async () => {
		if (!pageID || !instance?.guid || !locale || unsupportedReason) return

		const token = await getManagementAPIToken()
		if (!token) return

		await loadPage({
			mgmtApiUrl: resolveManagementApiUrl(),
			token,
			guid: instance.guid,
			locale,
			pageID,
			contentSelector
		})
	}, [pageID, instance?.guid, locale, unsupportedReason, loadPage, contentSelector])

	// Fetch the rendered page once per page.
	useEffect(() => {
		if (initializing) return
		void loadRenderedPage()
	}, [initializing, loadRenderedPage])

	// Seed the keyphrase and the meta description from what the route read.
	// The description comes from the page record, not the rendered HTML: it is
	// what the editor is actually editing, and the two can differ while a draft
	// is unpublished.
	useEffect(() => {
		if (loadedState.status !== "ready") return

		const storedKeyphrase = loadedState.data.keyphrase ?? ""
		setKeyphrase(storedKeyphrase)
		markKeyphraseSaved(storedKeyphrase)

		const storedDescription = loadedState.data.storedMetaDescription ?? loadedState.data.metaDescription ?? ""
		setDescription(storedDescription)
		markSeoSaved(storedDescription)
	}, [loadedState, markKeyphraseSaved, markSeoSaved])

	const withContext = useCallback(async () => {
		if (!pageID || !instance?.guid || !locale) return null

		const token = await getManagementAPIToken()
		if (!token) return null

		return { mgmtApiUrl: resolveManagementApiUrl(), token, guid: instance.guid, locale, pageID }
	}, [pageID, instance?.guid, locale])

	const onKeyphraseCommit = useCallback(
		async (value: string) => {
			const context = await withContext()
			if (context) await saveKeyphrase(context, value)
		},
		[withContext, saveKeyphrase]
	)

	const onDescriptionCommit = useCallback(
		async (value: string) => {
			const context = await withContext()
			if (!context) return

			const saved = await saveSeo(context, value)

			// The manager is showing a page record that just changed underneath
			// it; this asks it to reload so its own SEO tab agrees with us.
			if (saved) refresh()
		},
		[withContext, saveSeo]
	)

	const debouncedKeyphrase = useDebouncedValue(keyphrase)
	const debouncedDescription = useDebouncedValue(description)

	const pageData = loadedState.status === "ready" ? loadedState.data : null
	const seoTitle = pageData?.documentTitle ?? ""
	// The page's URL segment, which is what the engine's slug check scores.
	const slug = pageItem?.PageName ?? ""

	// Re-analyze whenever the page content or any analyzed input settles.
	useEffect(() => {
		if (!pageData?.html) return

		void runAnalysis({
			text: pageData.html,
			keyphrase: debouncedKeyphrase,
			title: seoTitle,
			description: debouncedDescription,
			slug,
			permalink: pageData.liveUrl ?? pageData.previewUrl,
			locale: locale || defaultLocale || undefined,
			titleWidth: measureTitleWidth(seoTitle)
		})
	}, [pageData, debouncedKeyphrase, debouncedDescription, seoTitle, slug, locale, defaultLocale, runAnalysis])

	/** A result's "Fix" affordance - scroll to and focus the field it names. */
	const onFix = useCallback((field: EditFieldName) => {
		if (field === "description") {
			descriptionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
			descriptionRef.current?.focus()
		}
		// `title` and `slug` are the page's own Title and Name, edited in the
		// page's SEO tab. The engine still reports them; we don't claim to fix them.
	}, [])

	if (initializing || !pageItem) {
		return (
			<Panel>
				<AnalysisSkeleton label={initializing ? "Connecting to Agility\u2026" : "Loading page\u2026"} />
			</Panel>
		)
	}

	const pageState: PageContentState = unsupportedReason
		? { status: "unsupported", reason: unsupportedReason }
		: loadedState

	return (
		<AnalysisPanel
			pageState={pageState}
			analysisState={analysisState}
			onRefresh={() => void loadRenderedPage()}
			keyphrase={{
				value: keyphrase,
				onChange: setKeyphrase,
				onCommit: onKeyphraseCommit,
				hint: KEYPHRASE_HINTS[keyphraseSaveState]
			}}
			description={{
				value: description,
				onChange: setDescription,
				onCommit: onDescriptionCommit,
				hint: DESCRIPTION_HINTS[seoSaveState],
				ref: descriptionRef,
				savesTo: "Saves to this page's SEO settings in Agility, the same field as the page's SEO tab."
			}}
			seoTitle={seoTitle}
			titlePlaceholder="Set in the page's SEO tab"
			onFix={onFix}
		/>
	)
}

/** Manager page types: 0 is a page (static or dynamic), 1 a link, 2 a folder. */
const PAGE_TYPE_LINK = 1
const PAGE_TYPE_FOLDER = 2

/**
 * Why this page cannot be scored, or null when it can. Mirrors the checks the
 * route makes server-side; doing them here too saves a round trip for the
 * common case of clicking through folders in the tree.
 */
function unsupportedReasonFor(page: IPageItem): UnsupportedReason | null {
	if (page.PageType === PAGE_TYPE_LINK || page.PageType === PAGE_TYPE_FOLDER) return "folder-or-link"

	const isDynamic = page.DynamicPageContentViewID > 0 || Boolean(page.DynamicPageContentViewFieldName)
	if (isDynamic) return "dynamic-page-node"

	return null
}

const KEYPHRASE_HINTS: Record<ReturnType<typeof useKeyphraseSave>["state"], string> = {
	idle: "Saved for this page when you leave the field. The analysis updates as you type.",
	saving: "Saving…",
	saved: "Saved for this page.",
	error: "Could not save the keyphrase. The analysis still uses it for this session.",
	"not-configured":
		"This app has no keyphrase storage configured, so the phrase is not saved. Ask whoever hosts it to connect Redis."
}

const DESCRIPTION_HINTS: Record<ReturnType<typeof usePageSeoSave>["state"], string> = {
	idle: "Saved to the page when you leave the field.",
	saving: "Saving to the page…",
	saved: "Saved to the page.",
	error: "Could not save to the page. Try again, or set it in the page’s SEO tab."
}
