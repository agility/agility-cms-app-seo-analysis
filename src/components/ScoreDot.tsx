import cn from "classnames"

import type { ResultRating } from "@/analysis/types"

interface ScoreDotProps {
	rating: ResultRating
	className?: string
}

/** Tailwind class per rating. One place so the traffic lights never disagree. */
export const RATING_COLOR: Record<ResultRating, string> = {
	error: "bg-gray-400",
	feedback: "bg-gray-400",
	bad: "bg-red-500",
	ok: "bg-orange-500",
	good: "bg-green-500"
}

export const RATING_LABEL: Record<ResultRating, string> = {
	error: "Not scored",
	feedback: "Feedback",
	bad: "Needs work",
	ok: "OK",
	good: "Good"
}

export function ScoreDot({ rating, className }: ScoreDotProps) {
	return <span className={cn("block h-2 w-2 shrink-0 rounded-full", RATING_COLOR[rating], className)} />
}

/**
 * Overall 0-100 scores use the same bands the engine uses for individual
 * results, so a panel showing "OK" next to an orange dot is consistent with
 * every row beneath it.
 */
export function ratingForScore(score: number | null): ResultRating {
	if (score === null) return "feedback"
	if (score > 80) return "good"
	if (score >= 41) return "ok"
	return "bad"
}
