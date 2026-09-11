import { interpreters } from "yoastseo"

import type { AnalysisResult, EditFieldName, ResultRating } from "./types"

/**
 * Our own input/output boundary for the analysis engine.
 *
 * Upstream has exactly this, better, as `yoastseo/contract` (toPaper /
 * toResultDto) - built for non-WordPress consumers. It is in no published
 * release yet (see researcher.ts), so this is the same idea in ~40 lines: one
 * place that knows how our field names land on the engine's, and one place that
 * maps an AssessmentResult to something serializable.
 *
 * When a release ships `yoastseo/contract`, delete this file and swap in
 * toPaper/toResultDto - the shapes were modelled on theirs to make that a
 * rename rather than a rewrite.
 */

export interface PaperInput {
	keyphrase?: string
	synonyms?: string
	locale?: string
	description?: string
	title?: string
	slug?: string
	permalink?: string
	titleWidth?: number
}

/** Maps our field names onto Paper's attributes (notably keyphrase -> keyword). */
export function toPaperAttributes(input: PaperInput) {
	return {
		keyword: input.keyphrase ?? "",
		synonyms: input.synonyms ?? "",
		locale: input.locale || "en_US",
		description: input.description ?? "",
		title: input.title ?? "",
		slug: input.slug ?? "",
		permalink: input.permalink ?? "",
		titleWidth: input.titleWidth ?? 0
	}
}

const EDIT_FIELD_NAMES: readonly string[] = ["title", "description", "slug"]

/**
 * Maps one engine AssessmentResult to the shape the browser receives.
 *
 * `rating` is derived here and never stored, so it cannot drift from `score` -
 * the same reason upstream's contract computes it at its boundary.
 */
export function toAnalysisResult(result: any): AnalysisResult {
	const score = result.getScore()

	return {
		identifier: result.getIdentifier(),
		score,
		rating: interpreters.scoreToRating(score) as ResultRating,
		text: stripLinks(result.getText()),
		editFieldName: readEditFieldName(result)
	}
}

/**
 * The engine sets a jump target on results whose fix is a single field. We only
 * surface the three we actually own an input for; anything else (a future
 * engine version adding targets) degrades to no affordance rather than a button
 * that goes nowhere.
 */
function readEditFieldName(result: any): EditFieldName {
	if (!result.hasEditFieldName?.()) return ""

	const name = result.getEditFieldName()
	return EDIT_FIELD_NAMES.includes(name) ? (name as EditFieldName) : ""
}

/**
 * Feedback text ships with <a> tags to yoast.com articles and <strong> around
 * the assessment name. The links open in the top window from inside our iframe,
 * which would navigate the whole CMS away, so they are unwrapped to their text.
 * The rest of the markup is dropped for the same reason we never dangerously
 * set this HTML: it is engine output, not ours to trust into the DOM.
 */
function stripLinks(text: string): string {
	return text
		.replace(/<a\b[^>]*>(.*?)<\/a>/gi, "$1")
		.replace(/<[^>]+>/g, "")
		.replace(/\s+/g, " ")
		.trim()
}
