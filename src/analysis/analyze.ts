import { Paper, assessors } from "yoastseo"

import { toAnalysisResult, toPaperAttributes } from "./contract"
import { isKeyphraseDependent } from "./keyphraseChecks"
import { createResearcherForLocale } from "./researcher"
import { isFullySupported, toYoastLocale } from "./locale"
import type { AnalysisResponse, AnalysisResult, AnalyzeRequest } from "./types"

const { SEOAssessor, ContentAssessor, CornerstoneSEOAssessor, CornerstoneContentAssessor } = assessors as any

/**
 * Runs the Yoast engine over one rendered page.
 *
 * SERVER ONLY. `yoastseo` is GPL-3.0: keeping it behind a route handler means
 * the browser only ever receives JSON, so this app's client bundle is not a
 * combined work being conveyed. Do not import this from a client component.
 */
export function analyze(request: AnalyzeRequest): AnalysisResponse {
	const locale = toYoastLocale(request.locale)

	const paper = new Paper(
		request.text,
		toPaperAttributes({
			keyphrase: request.keyphrase,
			synonyms: request.synonyms,
			locale,
			title: request.title,
			description: request.description,
			slug: request.slug,
			permalink: request.permalink,
			titleWidth: request.titleWidth
		})
	)

	// Each assessor gets its own Researcher: assess() calls setPaper() on it, so
	// sharing one would leave the second assessor reading the first's state.
	const SeoAssessorClass = request.isCornerstone ? CornerstoneSEOAssessor : SEOAssessor
	const ReadabilityAssessorClass = request.isCornerstone ? CornerstoneContentAssessor : ContentAssessor

	// The SEO assessor always runs. With no keyphrase it still produces seven
	// structural findings - meta description length, text length, internal and
	// outbound links, image count, title width, single H1 - which is most of the
	// app's value and needs no setup from the editor. Only the keyphrase-relative
	// results are withheld, because without a keyphrase they all report failure.
	const hasKeyphrase = Boolean(request.keyphrase?.trim())

	const seoAssessor = new SeoAssessorClass(createResearcherForLocale(locale))
	seoAssessor.assess(paper)

	const allSeoResults = seoAssessor.getValidResults().map(toAnalysisResult)

	const seoResults = hasKeyphrase
		? allSeoResults
		: allSeoResults.filter((result: AnalysisResult) => !isKeyphraseDependent(result.identifier))

	const lockedKeyphraseCheckCount = hasKeyphrase ? 0 : allSeoResults.length - seoResults.length

	// An overall SEO score is keyphrase-relative, so there isn't an honest one to
	// show without a keyphrase - scoring the structural subset alone would give a
	// number that is not comparable to the one shown once a keyphrase is set.
	const seoScore = hasKeyphrase ? seoAssessor.calculateOverallScore() : null

	const readabilityAssessor = new ReadabilityAssessorClass(createResearcherForLocale(locale))
	readabilityAssessor.assess(paper)

	return {
		scores: {
			seo: seoScore,
			readability: readabilityAssessor.calculateOverallScore()
		},
		seoResults,
		readabilityResults: readabilityAssessor.getValidResults().map(toAnalysisResult),
		lockedKeyphraseCheckCount,
		fullLanguageSupport: isFullySupported(locale),
		wordCount: countWords(request.text)
	}
}

/** Rough count for the footer. The engine does its own, per language, internally. */
function countWords(html: string): number {
	const text = html
		.replace(/<[^>]+>/g, " ")
		.replace(/&[a-z]+;/gi, " ")
		.trim()

	return text ? text.split(/\s+/).length : 0
}
