import { RATING_LABEL, ScoreDot, ratingForScore } from "./ScoreDot"

interface ScoreSummaryProps {
	seo: number | null
	readability: number | null
}

/** The two-row score box at the top of the panel. */
export function ScoreSummary({ seo, readability }: ScoreSummaryProps) {
	return (
		<div className="mb-3 flex flex-col rounded border border-gray-200">
			<ScoreRow label="SEO" score={seo} className="border-b border-gray-200" />
			<ScoreRow label="Readability" score={readability} />
		</div>
	)
}

interface ScoreRowProps {
	label: string
	score: number | null
	className?: string
}

function ScoreRow({ label, score, className }: ScoreRowProps) {
	const rating = ratingForScore(score)

	return (
		<div className={`flex items-center gap-2 px-3 py-2.5 ${className ?? ""}`}>
			<ScoreDot rating={rating} />
			<span className="text-xs font-semibold tracking-body text-gray-700">{label}</span>
			<span className="grow" />
			<span className="text-xs tracking-body text-gray-500">
				{score === null ? "Needs a keyphrase" : RATING_LABEL[rating]}
			</span>
			{score === null ? null : (
				<span className="text-xs font-semibold tabular-nums text-gray-900">{score}</span>
			)}
		</div>
	)
}
