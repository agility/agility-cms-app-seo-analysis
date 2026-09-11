/**
 * Which SEO assessments are relative to the focus keyphrase.
 *
 * The engine runs all of them regardless and reports the keyphrase ones as
 * failures when no keyphrase is set ("your keyphrase does not appear in..."),
 * which is noise an editor cannot act on. Splitting them lets the panel show
 * real structural findings immediately and offer the rest as an unlock.
 *
 * Measured against yoastseo 3.6.0's SEOAssessor by running it with an empty
 * keyphrase and reading which results still say something actionable:
 *
 *   structural (7)  metaDescriptionLength, images, textLength, externalLinks,
 *                   internalLinks, titleWidth, singleH1
 *   keyphrase  (9)  everything below
 */
const KEYPHRASE_DEPENDENT = new Set([
	"introductionKeyword",
	"keyphraseLength",
	"keyphraseDensity",
	"metaDescriptionKeyword",
	"subheadingsKeyword",
	"textCompetingLinks",
	"imageKeyphrase",
	"keyphraseInSEOTitle",
	"slugKeyword",
	// Only fires once a keyphrase exists, so it never appears in the no-keyphrase
	// run - listed because it is unambiguously keyphrase-relative.
	"functionWordsInKeyphrase"
])

/**
 * Whether a result should be hidden until a keyphrase is set.
 *
 * Unknown identifiers - a future engine version adding an assessment - are
 * treated as keyphrase-dependent. That is the safer default of the two: a new
 * assessment hidden until the editor sets a keyphrase is recoverable, whereas
 * a new keyphrase check shown in the no-keyphrase state is exactly the
 * "set your keyphrase" noise this split exists to remove.
 */
export function isKeyphraseDependent(identifier: string): boolean {
	return KEYPHRASE_DEPENDENT.has(identifier)
}
