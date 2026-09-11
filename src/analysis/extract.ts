import { parseHTML } from "linkedom"

/** Chrome that is on every page and would skew link, image and word counts. */
const CHROME_SELECTORS = [
	"script", "style", "noscript", "template", "svg",
	"nav", "header", "footer", "aside",
	"[role=navigation]", "[role=banner]", "[role=contentinfo]",
	"[aria-hidden=true]"
]

/** Selectors tried in order when the install screen doesn't name one. */
const DEFAULT_CONTENT_SELECTORS = ["main", "[role=main]", "article", "#content", ".content"]

export interface ExtractedPage {
	/** The main content region as HTML, ready to hand to Paper. */
	html: string
	/** The document title, used as a fallback SEO title. */
	documentTitle: string
	/** The meta description already on the rendered page, if any. */
	metaDescription: string
	/** Which selector actually matched, for showing the editor what was analyzed. */
	matchedSelector: string | null
}

/**
 * Reduces a rendered page to the content Yoast should score.
 *
 * The assessments that matter most here - internal links, image count, single
 * H1, word count - are all counts over the main content region. Leaving the nav
 * and footer in would inflate every one of them, identically on every page, and
 * make the scores meaningless.
 */
export function extractMainContent(rawHtml: string, contentSelector?: string | null): ExtractedPage {
	const { document } = parseHTML(rawHtml)

	const documentTitle = document.querySelector("title")?.textContent?.trim() ?? ""
	const metaDescription =
		document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? ""

	const candidates = contentSelector
		? [contentSelector, ...DEFAULT_CONTENT_SELECTORS]
		: DEFAULT_CONTENT_SELECTORS

	let root: Element | null = null
	let matchedSelector: string | null = null

	for (const selector of candidates) {
		try {
			const found = document.querySelector(selector)
			if (found) {
				root = found as unknown as Element
				matchedSelector = selector
				break
			}
		} catch {
			// An invalid selector from the install screen shouldn't fail the analysis.
			continue
		}
	}

	// No main region found - fall back to <body> and strip chrome harder.
	if (!root) {
		root = document.querySelector("body") as unknown as Element | null
	}

	if (!root) {
		return { html: "", documentTitle, metaDescription, matchedSelector }
	}

	for (const selector of CHROME_SELECTORS) {
		root.querySelectorAll(selector).forEach((node) => node.remove())
	}

	return {
		html: (root as any).innerHTML?.trim() ?? "",
		documentTitle,
		metaDescription,
		matchedSelector
	}
}
