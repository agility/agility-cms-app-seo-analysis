import { toResearcherLanguage } from "./locale"

/**
 * Resolves a language Researcher.
 *
 * The published `yoastseo` (3.6.0) does NOT ship the `yoastseo/researcher`
 * factory its README documents - `files` is ["build","!*.map","vendor","images"],
 * so the factory exists only on the project's trunk. The language Researchers
 * themselves ARE published under build/, so we reach them directly.
 *
 * The map is written out longhand rather than built from a template string
 * because a computed `require` is invisible to webpack: it warns "the request of
 * a dependency is an expression" at build time and then throws MODULE_NOT_FOUND
 * at runtime. Static calls are seen by webpack and bundled into the route (see
 * next.config.js for why yoastseo is bundled rather than left external).
 *
 * Deep paths under build/ are documented as internal, so this map is the one
 * place a yoastseo upgrade can break us - which is also why it is a visible
 * list rather than string concatenation.
 *
 * SERVER ONLY - each language pulls in its own function words, stemmer and
 * transition word lists.
 */
const RESEARCHERS: Record<string, () => any> = {
	ar: () => require("yoastseo/build/languageProcessing/languages/ar/Researcher"),
	ca: () => require("yoastseo/build/languageProcessing/languages/ca/Researcher"),
	cs: () => require("yoastseo/build/languageProcessing/languages/cs/Researcher"),
	de: () => require("yoastseo/build/languageProcessing/languages/de/Researcher"),
	el: () => require("yoastseo/build/languageProcessing/languages/el/Researcher"),
	en: () => require("yoastseo/build/languageProcessing/languages/en/Researcher"),
	es: () => require("yoastseo/build/languageProcessing/languages/es/Researcher"),
	fa: () => require("yoastseo/build/languageProcessing/languages/fa/Researcher"),
	fr: () => require("yoastseo/build/languageProcessing/languages/fr/Researcher"),
	he: () => require("yoastseo/build/languageProcessing/languages/he/Researcher"),
	hu: () => require("yoastseo/build/languageProcessing/languages/hu/Researcher"),
	id: () => require("yoastseo/build/languageProcessing/languages/id/Researcher"),
	it: () => require("yoastseo/build/languageProcessing/languages/it/Researcher"),
	ja: () => require("yoastseo/build/languageProcessing/languages/ja/Researcher"),
	nb: () => require("yoastseo/build/languageProcessing/languages/nb/Researcher"),
	nl: () => require("yoastseo/build/languageProcessing/languages/nl/Researcher"),
	pl: () => require("yoastseo/build/languageProcessing/languages/pl/Researcher"),
	pt: () => require("yoastseo/build/languageProcessing/languages/pt/Researcher"),
	ru: () => require("yoastseo/build/languageProcessing/languages/ru/Researcher"),
	sk: () => require("yoastseo/build/languageProcessing/languages/sk/Researcher"),
	sv: () => require("yoastseo/build/languageProcessing/languages/sv/Researcher"),
	tr: () => require("yoastseo/build/languageProcessing/languages/tr/Researcher"),
	default: () => require("yoastseo/build/languageProcessing/languages/_default/Researcher")
}

/** The languages with dedicated analysis support, for locale.ts to check. */
export const SUPPORTED_LANGUAGES = Object.keys(RESEARCHERS).filter((key) => key !== "default")

const researcherClassCache = new Map<string, any>()

/**
 * Returns a FRESH Researcher for this locale.
 *
 * Only the class is cached. A Researcher is stateful - `assessor.assess(paper)`
 * calls `researcher.setPaper(paper)` on it - so a shared instance would let two
 * concurrent analyses overwrite each other's paper and return results for the
 * wrong document. Constructing one is cheap; loading the class is not.
 */
export function createResearcherForLocale(yoastLocale: string): any {
	const language = toResearcherLanguage(yoastLocale)

	let ResearcherClass = researcherClassCache.get(language)

	if (!ResearcherClass) {
		ResearcherClass = loadResearcherClass(language)
		researcherClassCache.set(language, ResearcherClass)
	}

	return new ResearcherClass()
}

function loadResearcherClass(language: string): any {
	const load = RESEARCHERS[language] ?? RESEARCHERS.default

	try {
		return interopDefault(load())
	} catch (error) {
		console.warn(`[seo-analysis] no Researcher for "${language}", using the default one.`, error)
		return interopDefault(RESEARCHERS.default())
	}
}

function interopDefault(module: any): any {
	return module?.default ?? module
}
