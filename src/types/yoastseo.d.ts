/**
 * Minimal type declarations for the parts of `yoastseo` this app uses.
 *
 * The package has a `types` field but does not publish the directory it points
 * at (`files` is ["build","!*.map","vendor","images"]), so TypeScript sees an
 * untyped CommonJS module. Rather than `declare module "yoastseo"` as `any`,
 * these describe the surface we actually touch - narrow enough to catch a typo,
 * loose enough not to fight the engine's own loose shapes.
 */

declare module "yoastseo" {
	/** The document under analysis, plus everything scored alongside its text. */
	export class Paper {
		constructor(text: string, attributes?: Record<string, unknown>)
		getText(): string
	}

	/** One assessment's verdict. Mapped to our own shape in analysis/contract.ts. */
	export interface AssessmentResult {
		getIdentifier(): string
		getScore(): number
		getText(): string
		hasEditFieldName?(): boolean
		getEditFieldName?(): string
		hasAIFixes?(): boolean
	}

	export interface Assessor {
		assess(paper: Paper): void
		getValidResults(): AssessmentResult[]
		calculateOverallScore(): number
	}

	/** Researcher shape is language-specific; only its use as a ctor arg matters. */
	export type Researcher = unknown

	export type AssessorConstructor = new (researcher: Researcher) => Assessor

	export const assessors: {
		SEOAssessor: AssessorConstructor
		ContentAssessor: AssessorConstructor
		CornerstoneSEOAssessor: AssessorConstructor
		CornerstoneContentAssessor: AssessorConstructor
		InclusiveLanguageAssessor: AssessorConstructor
		[name: string]: AssessorConstructor
	}

	export const interpreters: {
		/** error=-1, feedback=0, bad=1-4, ok=5-7, good>7. */
		scoreToRating(score: number): string
	}
}

/**
 * Language Researchers live under build/. The documented `yoastseo/researcher`
 * factory is not in any published release, so these deep paths are how a
 * Researcher is obtained - see analysis/researcher.ts for why.
 */
declare module "yoastseo/build/languageProcessing/languages/*/Researcher" {
	const Researcher: new () => unknown
	export default Researcher
}
