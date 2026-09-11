import { useMemo, useState } from "react"

import type { AnalysisResult, EditFieldName, ResultRating } from "@/analysis/types"
import { ChevronDown, ChevronRight } from "./icons"
import { ScoreDot } from "./ScoreDot"

interface ResultListProps {
	results: AnalysisResult[]
	/** Called when a result's "Fix" affordance is used. */
	onFix?: (field: EditFieldName) => void
	emptyMessage: string
}

/**
 * Groups results the way Yoast does - problems first, good news collapsed.
 *
 * The grouping is the point: fifteen undifferentiated rows is a wall, but
 * "3 problems" above the fold and "7 good" collapsed is a to-do list.
 */
export function ResultList({ results, onFix, emptyMessage }: ResultListProps) {
	const groups = useMemo(() => groupResults(results), [results])

	if (results.length === 0) {
		return <p className="py-2 text-xs tracking-body text-gray-500">{emptyMessage}</p>
	}

	return (
		<div className="flex flex-col">
			<ResultSection title="Problems" results={groups.problems} onFix={onFix} defaultOpen />
			<ResultSection title="Improvements" results={groups.improvements} onFix={onFix} defaultOpen />
			<ResultSection title="Good" results={groups.good} onFix={onFix} defaultOpen={false} />
		</div>
	)
}

interface Groups {
	problems: AnalysisResult[]
	improvements: AnalysisResult[]
	good: AnalysisResult[]
}

/**
 * `error` and `feedback` ratings are informational, not failures - the engine
 * uses them for "this could not be scored". They sit with the improvements
 * rather than alarming the editor in the problems group.
 */
function groupResults(results: AnalysisResult[]): Groups {
	const groups: Groups = { problems: [], improvements: [], good: [] }

	for (const result of results) {
		if (result.rating === "bad") groups.problems.push(result)
		else if (result.rating === "good") groups.good.push(result)
		else groups.improvements.push(result)
	}

	return groups
}

interface ResultSectionProps {
	title: string
	results: AnalysisResult[]
	onFix?: (field: EditFieldName) => void
	defaultOpen: boolean
}

function ResultSection({ title, results, onFix, defaultOpen }: ResultSectionProps) {
	const [isOpen, setIsOpen] = useState(defaultOpen)

	if (results.length === 0) return null

	return (
		<div className="flex flex-col gap-2.5 pb-3.5">
			<button
				type="button"
				onClick={() => setIsOpen((open) => !open)}
				className="flex w-full items-center gap-1.5 text-gray-700"
				aria-expanded={isOpen}
			>
				{isOpen ? <ChevronDown /> : <ChevronRight />}
				<span className="text-xs font-semibold tracking-body">
					{title} ({results.length})
				</span>
			</button>

			{isOpen
				? results.map((result) => <ResultRow key={result.identifier} result={result} onFix={onFix} />)
				: null}
		</div>
	)
}

const FIX_LABEL: Record<Exclude<EditFieldName, "">, string> = {
	title: "Edit title",
	description: "Edit description",
	slug: "Edit slug"
}

function ResultRow({ result, onFix }: { result: AnalysisResult; onFix?: (field: EditFieldName) => void }) {
	const { heading, body } = splitFeedback(result.text)
	const canFix = Boolean(result.editFieldName) && Boolean(onFix)

	return (
		<div className="flex items-start gap-2">
			<ScoreDot rating={result.rating} className="mt-1" />
			<div className="flex grow flex-col gap-0.5">
				<p className="text-xs leading-4 tracking-body text-gray-700">
					{heading ? <span className="font-semibold">{heading} </span> : null}
					{body}
				</p>
				{canFix ? (
					<div className="flex justify-end">
						<button
							type="button"
							onClick={() => onFix?.(result.editFieldName)}
							className="text-[11px] leading-[14px] text-purple-700 hover:underline"
						>
							{FIX_LABEL[result.editFieldName as Exclude<EditFieldName, "">]}
						</button>
					</div>
				) : null}
			</div>
		</div>
	)
}

/**
 * Engine feedback reads "Keyphrase in introduction: Well done!" - the part
 * before the first colon is the assessment name. Bolding it is what makes a
 * long list scannable, and it costs nothing to split.
 */
function splitFeedback(text: string): { heading: string | null; body: string } {
	const separator = text.indexOf(": ")

	// Only treat it as a heading when it is short enough to actually be one;
	// some feedback contains a colon mid-sentence.
	if (separator > 0 && separator < 42) {
		return { heading: text.slice(0, separator + 1), body: text.slice(separator + 2) }
	}

	return { heading: null, body: text }
}

export type { ResultRating }
