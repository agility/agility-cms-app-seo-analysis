import { SUPPORTED_LANGUAGES } from "./researcher"

/**
 * Agility locales look like "en-us"; Yoast wants "en_US" on the Paper and a bare
 * language code to pick a Researcher. Languages the engine does not ship fall
 * back to its language-agnostic Researcher, which still runs most assessments
 * but skips the morphology-dependent ones.
 */

/** "en-us" -> "en_US". Yoast's Paper wants the underscored form. */
export function toYoastLocale(agilityLocale: string | null | undefined, fallback = "en_US"): string {
	if (!agilityLocale) return fallback

	const [language, region] = agilityLocale.replace("_", "-").split("-")
	if (!language) return fallback

	return region ? `${language.toLowerCase()}_${region.toUpperCase()}` : language.toLowerCase()
}

/** "en_US" -> "en", but only when the engine actually ships that language. */
export function toResearcherLanguage(yoastLocale: string): string {
	const language = yoastLocale.split("_")[0]?.toLowerCase()
	if (!language) return "default"

	return SUPPORTED_LANGUAGES.includes(language) ? language : "default"
}

/** Whether this locale gets the full, language-aware analysis. */
export function isFullySupported(yoastLocale: string): boolean {
	return toResearcherLanguage(yoastLocale) !== "default"
}
