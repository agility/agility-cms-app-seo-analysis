"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { contentItemMethods, getManagementAPIToken, useAgilityAppSDK } from "@agility/app-sdk"

import type { EditFieldName } from "@/analysis/types"
import { AGILITY_SEO_FIELDS, findSlugValue } from "@/agility/fieldNames"
import { resolveManagementApiUrl } from "@/agility/mgmtApiUrl"
import { AnalysisPanel, Panel } from "@/components/AnalysisPanel"
import { AnalysisSkeleton } from "@/components/Skeleton"
import { measureTitleWidth } from "@/lib/pixelWidth"
import { useAnalysis } from "@/lib/useAnalysis"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { useKeyphraseSave } from "@/lib/useKeyphraseSave"
import { usePageContent } from "@/lib/usePageContent"

/**
 * The content item sidebar: dynamic-page items - posts, articles, products.
 *
 * This surface can *write* through the App SDK: it has setFieldValue and
 * saveContentItem, so meta description edits land on the item's own Agility
 * fields as the editor types and the CMS's own save flow persists them. The
 * page sidebar (src/app/page-sidebar) is the same panel for regular pages,
 * with a different way of finding its page and saving its description.
 */
export default function ContentItemSidebar() {
	const { initializing, appInstallContext, instance, locale, contentItem } = useAgilityAppSDK()

	// Seeded from the app's own store when the page loads, written back on
	// commit (blur / Enter). Not a field on the content item - see
	// src/store/keyphraseStore.ts for why.
	const [keyphrase, setKeyphrase] = useState("")
	const [description, setDescription] = useState("")

	const descriptionRef = useRef<HTMLTextAreaElement>(null)

	const { state: pageState, load: loadPage } = usePageContent()
	const { state: analysisState, run: runAnalysis } = useAnalysis()
	const { state: saveState, save: saveKeyphrase, markSaved } = useKeyphraseSave()

	const contentSelector = appInstallContext?.configuration?.contentSelector
	const defaultLocale = appInstallContext?.configuration?.defaultLocale

	// Only the meta description is seeded from the item. Editing is local from
	// there - writing back on every keystroke would mark the item dirty
	// continuously and fight the CMS's own unsaved-changes handling.
	useEffect(() => {
		if (!contentItem?.values) return
		setDescription(contentItem.values[AGILITY_SEO_FIELDS.metaDescription] ?? "")
	}, [contentItem?.contentID, contentItem?.values])

	const loadRenderedPage = useCallback(async () => {
		if (!contentItem?.contentID || !contentItem?.referenceName || !instance?.guid || !locale) return

		const token = await getManagementAPIToken()
		if (!token) return

		await loadPage({
			mgmtApiUrl: resolveManagementApiUrl(),
			token,
			guid: instance.guid,
			locale,
			referenceName: contentItem.referenceName,
			contentID: contentItem.contentID,
			contentSelector
		})
	}, [
		contentItem?.contentID,
		contentItem?.referenceName,
		instance?.guid,
		locale,
		loadPage,
		contentSelector
	])

	// Fetch the rendered page once per item.
	useEffect(() => {
		if (initializing) return
		void loadRenderedPage()
	}, [initializing, loadRenderedPage])

	// Seed the keyphrase from the store, once per page load. Loading a new item
	// goes through here too, so the previous item's phrase never carries over.
	useEffect(() => {
		if (pageState.status !== "ready") return
		const stored = pageState.data.keyphrase ?? ""
		setKeyphrase(stored)
		markSaved(stored)
	}, [pageState, markSaved])

	const onKeyphraseCommit = useCallback(
		async (value: string) => {
			if (!contentItem?.contentID || !instance?.guid || !locale) return

			const token = await getManagementAPIToken()
			if (!token) return

			await saveKeyphrase(
				{
					mgmtApiUrl: resolveManagementApiUrl(),
					token,
					guid: instance.guid,
					locale,
					contentID: contentItem.contentID
				},
				value
			)
		},
		[contentItem?.contentID, instance?.guid, locale, saveKeyphrase]
	)

	const debouncedKeyphrase = useDebouncedValue(keyphrase)
	const debouncedDescription = useDebouncedValue(description)

	const pageData = pageState.status === "ready" ? pageState.data : null
	const seoTitle = pageData?.documentTitle ?? ""
	const slug = useMemo(() => findSlugValue(contentItem?.values), [contentItem?.values])

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
			// The item's own locale, falling back to the one configured at install.
			locale: locale || defaultLocale || undefined,
			// Only the browser has font metrics; the server cannot measure this.
			titleWidth: measureTitleWidth(seoTitle)
		})
	}, [
		pageData,
		debouncedKeyphrase,
		debouncedDescription,
		seoTitle,
		slug,
		locale,
		defaultLocale,
		runAnalysis
	])

	const onDescriptionChange = useCallback((value: string) => {
		setDescription(value)
		contentItemMethods.setFieldValue({
			name: AGILITY_SEO_FIELDS.metaDescription,
			value
		})
	}, [])

	/** A result's "Fix" affordance - scroll to and focus the field it names. */
	const onFix = useCallback((field: EditFieldName) => {
		if (field === "description") {
			descriptionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
			descriptionRef.current?.focus()
		}
		// `title` and `slug` are not editable from this surface - title comes from
		// the page template's formula, slug from a model field the editor owns.
		// The engine still reports them; we just do not claim to fix them.
	}, [])

	if (initializing) {
		return (
			<Panel>
				<AnalysisSkeleton label="Connecting to Agility&hellip;" />
			</Panel>
		)
	}

	return (
		<AnalysisPanel
			pageState={pageState}
			analysisState={analysisState}
			onRefresh={() => void loadRenderedPage()}
			keyphrase={{
				value: keyphrase,
				onChange: setKeyphrase,
				onCommit: onKeyphraseCommit,
				hint: KEYPHRASE_HINTS[saveState]
			}}
			description={{
				value: description,
				onChange: onDescriptionChange,
				ref: descriptionRef,
				savesTo: (
					<>
						Saves to{" "}
						<code className="font-mono text-gray-500">{AGILITY_SEO_FIELDS.metaDescription}</code>{" "}
						on this content item.
					</>
				)
			}}
			seoTitle={seoTitle}
			onFix={onFix}
		/>
	)
}

const KEYPHRASE_HINTS: Record<ReturnType<typeof useKeyphraseSave>["state"], string> = {
	idle: "Saved for this item when you leave the field. The analysis updates as you type.",
	saving: "Saving…",
	saved: "Saved for this item.",
	error: "Could not save the keyphrase. The analysis still uses it for this session.",
	"not-configured":
		"This app has no keyphrase storage configured, so the phrase is not saved. Ask whoever hosts it to connect Redis."
}
