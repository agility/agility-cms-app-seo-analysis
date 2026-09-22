"use client"

import { useState } from "react"

import type { EditFieldName } from "@/analysis/types"
import type { AnalysisState } from "@/lib/useAnalysis"
import type { PageContentState } from "@/lib/usePageContent"
import { ErrorState, KeyphraseUnlockPrompt, UnsupportedState } from "./EmptyState"
import { KeyphraseInput } from "./KeyphraseInput"
import { Refresh } from "./icons"
import { ResultList } from "./ResultList"
import { AnalysisSkeleton } from "./Skeleton"
import { ScoreSummary } from "./ScoreSummary"
import { SnippetEditor } from "./SnippetEditor"
import { Tabs, type TabKey } from "./Tabs"

export interface AnalysisPanelProps {
	pageState: PageContentState
	analysisState: AnalysisState
	/** Re-fetches the rendered page. */
	onRefresh: () => void
	keyphrase: {
		value: string
		onChange: (value: string) => void
		onCommit: (value: string) => void
		hint: string
	}
	description: {
		value: string
		onChange: (value: string) => void
		/** Surfaces that persist on blur rather than per keystroke. */
		onCommit?: (value: string) => void
		hint?: string
		/** Where the description is written, shown under the editor. */
		savesTo: React.ReactNode
		ref: React.RefObject<HTMLTextAreaElement>
	}
	/** The SEO title as the rendered page reports it. Read-only on both surfaces. */
	seoTitle: string
	titlePlaceholder?: string
	/** A result's "Fix" affordance - scroll to and focus the field it names. */
	onFix: (field: EditFieldName) => void
}

/**
 * The analysis panel, shared by the content item sidebar and the page sidebar.
 *
 * The two surfaces differ only in how they find their page and where they write
 * the meta description; everything the editor sees is the same. Keeping one
 * component means the two cannot drift apart visually, and a new check or score
 * lands on both at once.
 */
export function AnalysisPanel({
	pageState,
	analysisState,
	onRefresh,
	keyphrase,
	description,
	seoTitle,
	titlePlaceholder,
	onFix
}: AnalysisPanelProps) {
	const [activeTab, setActiveTab] = useState<TabKey>("seo")

	if (pageState.status === "unsupported") {
		return (
			<Panel>
				<Header onRefresh={null} />
				<UnsupportedState reason={pageState.reason} />
				<Footer />
			</Panel>
		)
	}

	const pageData = pageState.status === "ready" ? pageState.data : null

	return (
		<Panel>
			<Header onRefresh={onRefresh} />

			<KeyphraseInput
				value={keyphrase.value}
				onChange={keyphrase.onChange}
				onCommit={keyphrase.onCommit}
				hint={keyphrase.hint}
			/>

			{pageState.status === "error" ? (
				<ErrorState message={pageState.message} onRetry={onRefresh} />
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
									titlePlaceholder={titlePlaceholder}
									description={description.value}
									url={pageData?.liveUrl ?? pageData?.previewUrl ?? null}
									onDescriptionChange={description.onChange}
									onDescriptionCommit={description.onCommit}
									descriptionHint={description.hint}
									savesTo={description.savesTo}
									descriptionRef={description.ref}
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

export function Panel({ children }: { children: React.ReactNode }) {
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
