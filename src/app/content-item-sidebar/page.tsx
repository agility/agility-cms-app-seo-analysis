"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { contentItemMethods, getManagementAPIToken, useAgilityAppSDK } from "@agility/app-sdk"

import type { EditFieldName } from "@/analysis/types"
import { AGILITY_SEO_FIELDS, findSlugValue } from "@/agility/fieldNames"
import { resolveManagementApiUrl } from "@/agility/mgmtApiUrl"
import { ErrorState, KeyphraseUnlockPrompt, NotDynamicPageState } from "@/components/EmptyState"
import { KeyphraseInput } from "@/components/KeyphraseInput"
import { Refresh } from "@/components/icons"
import { ResultList } from "@/components/ResultList"
import { AnalysisSkeleton } from "@/components/Skeleton"
import { ScoreSummary } from "@/components/ScoreSummary"
import { SnippetEditor } from "@/components/SnippetEditor"
import { Tabs, type TabKey } from "@/components/Tabs"
import { measureTitleWidth } from "@/lib/pixelWidth"
import { useAnalysis } from "@/lib/useAnalysis"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import { useKeyphraseSave } from "@/lib/useKeyphraseSave"
import { usePageContent } from "@/lib/usePageContent"

/**
 * The content item sidebar.
 *
 * Chosen over the page sidebar because dynamic-page content items - posts,
 * articles, products - are where SEO volume lives, and because this surface can
 * write: it has setFieldValue and saveContentItem, which the page sidebar does
 * not. Meta description edits land on the item's own Agility fields, so an
 * existing site picks them up through the Fetch API with no changes.
 */
export default function ContentItemSidebar() {
	const { initializing, appInstallContext, instance, locale, contentItem, contentModel } =
		useAgilityAppSDK()

	const [activeTab, setActiveTab] = useState<TabKey>("seo")
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

	if (pageState.status === "not-a-dynamic-page") {
		return (
			<Panel>
				<Header onRefresh={null} />
				<NotDynamicPageState />
				<Footer />
			</Panel>
		)
	}

	return (
		<Panel>
			<Header onRefresh={() => void loadRenderedPage()} />

			<KeyphraseInput
				value={keyphrase}
				onChange={setKeyphrase}
				onCommit={onKeyphraseCommit}
				hint={KEYPHRASE_HINTS[saveState]}
			/>

			{pageState.status === "error" ? (
				<ErrorState message={pageState.message} onRetry={() => void loadRenderedPage()} />
			) : null}

			{pageState.status === "loading" ? (
				<AnalysisSkeleton label="Analyzing rendered page&hellip;" />
			) : null}

			{pageState.status === "ready" ? (
				<>
					{analysisState.status === "ready" ? (
						<>
							<ScoreSummary
								seo={analysisState.data.scores.seo}
								readability={analysisState.data.scores.readability}
							/>

							<Tabs active={activeTab} onChange={setActiveTab} />

							{activeTab === "seo" ? (
								<>
									<KeyphraseUnlockPrompt
										lockedCount={analysisState.data.lockedKeyphraseCheckCount}
									/>
									<ResultList
										results={analysisState.data.seoResults}
										onFix={onFix}
										emptyMessage="No SEO findings for this page."
									/>
								</>
							) : (
								<ResultList
									results={analysisState.data.readabilityResults}
									onFix={onFix}
									emptyMessage="No readability results for this page."
								/>
							)}

							<div className="pt-1">
								<SnippetEditor
									title={seoTitle}
									description={description}
									url={pageData?.liveUrl ?? pageData?.previewUrl ?? null}
									onDescriptionChange={onDescriptionChange}
									descriptionRef={descriptionRef}
								/>
							</div>

							{analysisState.data.fullLanguageSupport ? null : (
								<p className="pt-3 text-2xs leading-[14px] tracking-tiny text-gray-400">
									This language has no dedicated analysis support, so some checks are
									skipped.
								</p>
							)}
						</>
					) : null}

					{analysisState.status === "loading" ? (
						<AnalysisSkeleton label="Scoring&hellip;" />
					) : null}

					{analysisState.status === "error" ? (
						<ErrorState message={analysisState.message} />
					) : null}
				</>
			) : null}

			<Footer wordCount={analysisState.status === "ready" ? analysisState.data.wordCount : null} />
		</Panel>
	)
}

const KEYPHRASE_HINTS: Record<ReturnType<typeof useKeyphraseSave>["state"], string> = {
	idle: "Saved for this item when you leave the field. The analysis updates as you type.",
	saving: "Saving\u2026",
	saved: "Saved for this item.",
	error: "Could not save the keyphrase. The analysis still uses it for this session.",
	"not-configured":
		"This app has no keyphrase storage configured, so the phrase is not saved. Ask whoever hosts it to connect Redis."
}

function Panel({ children }: { children: React.ReactNode }) {
	// The CMS panel already supplies px-6 pt-3 pb-4 around this iframe, so the
	// app adds no outer padding of its own.
	return <div className="flex w-full flex-col">{children}</div>
}

function Header({ onRefresh }: { onRefresh: (() => void) | null }) {
	return (
		<div className="flex items-center justify-between">
			<h1 className="text-sm font-semibold leading-5 tracking-label text-gray-900"></h1>
			{onRefresh ? (
				<button
					type="button"
					onClick={onRefresh}
					title="Re-analyze the rendered page"
					className="text-gray-400 transition-colors hover:text-gray-600"
				>
					<Refresh />
				</button>
			) : null}
		</div>
	)
}

function Footer({ wordCount }: { wordCount?: number | null }) {
	return (
		<div className="mt-4 flex flex-col gap-0.5 border-t border-gray-200 pt-2.5">
			{wordCount ? (
				<span className="text-2xs leading-[14px] tracking-tiny text-gray-400">
					{wordCount} words analyzed
				</span>
			) : null}
			<span className="text-2xs leading-[14px] tracking-tiny text-gray-400">
				Uses the open-source YoastSEO.js library
			</span>
		</div>
	)
}
