/**
 * The shapes crossing the client/server boundary.
 *
 * Modelled on upstream's `yoastseo/contract` ResultDto so that swapping to the
 * real thing is a rename when a release finally ships it (see contract.ts).
 */

export type ResultRating = "error" | "feedback" | "bad" | "ok" | "good"

/** Fields a result can ask the editor to jump to. Set by the engine. */
export type EditFieldName = "title" | "description" | "slug" | ""

export interface AnalysisResult {
	identifier: string
	score: number
	rating: ResultRating
	/** Feedback sentence. Contains inline markup from the engine - see stripLinks. */
	text: string
	/**
	 * The field this result wants fixed, or "" when it has none. This is the sole
	 * signal for showing a "Fix" affordance: the engine only ever sets a jump
	 * target together with the affordance, so its presence is the source of truth.
	 * (`hasAIFixes` exists but is a Yoast Premium signal and always false here.)
	 */
	editFieldName: EditFieldName
}

export interface AnalysisScores {
	/**
	 * 0-100, or null when no keyphrase is set.
	 *
	 * Null rather than a number on purpose: an overall SEO score is a
	 * keyphrase-relative measure, and scoring only the structural subset would
	 * produce a number that is not comparable to the one shown after a keyphrase
	 * is set. Better to show no score than a misleading one.
	 */
	seo: number | null
	readability: number | null
}

export interface AnalysisResponse {
	scores: AnalysisScores
	/**
	 * The SEO results to show. With no keyphrase this is the structural subset
	 * only - the keyphrase-relative checks are withheld rather than reported as
	 * failures the editor cannot act on.
	 */
	seoResults: AnalysisResult[]
	readabilityResults: AnalysisResult[]
	/** How many further checks a keyphrase would unlock. 0 once one is set. */
	lockedKeyphraseCheckCount: number
	/** False when the locale fell back to the language-agnostic researcher. */
	fullLanguageSupport: boolean
	wordCount: number
}

export interface AnalyzeRequest {
	text: string
	keyphrase?: string
	synonyms?: string
	title?: string
	description?: string
	slug?: string
	permalink?: string
	locale?: string
	/** Measured in the browser - the server has no font metrics. */
	titleWidth?: number
	/**
	 * Swaps in the stricter cornerstone assessors.
	 *
	 * Supported here but deliberately not exposed in the UI yet: cornerstone is a
	 * durable claim about a page ("this is one we most want to rank"), not a view
	 * setting, so a session-only toggle would be meaningless. It returns with
	 * keyphrase persistence.
	 */
	isCornerstone?: boolean
}
