import { parseHTML } from "linkedom"

import { locate } from "./locate"
import type { Issue, Severity } from "./types"

/**
 * The built-in checks: what every install gets with no vendor account.
 *
 * They run on the full rendered HTML of one page, so they see what a crawler
 * sees. Each finding is tied to an element, located in Agility (locate.ts), and
 * given a short snippet that is the same on every page the element appears on,
 * which is what lets group.ts fold "the same ad image on 95 posts" into one.
 *
 * The set is the one agilitycms.com's own Semrush clean-up needed in 2026-11:
 * alt text, empty and generic link text, H1s, title and meta description
 * length, very long paragraphs.
 */

export interface CheckOptions {
	/** Elements inside these are site chrome, the same on every page: checked, but reported once per site. */
	chromeSelector?: string
}

/** Link text that says nothing about where the link goes. */
const GENERIC_LINK_TEXT = new Set([
	"click here", "here", "read more", "learn more", "more", "this", "link", "this link",
	"see more", "find out more", "continue", "continue reading", "details", "go", "view", "view more"
])

const TITLE_MAX = 70
const META_MIN = 70
const META_MAX = 160
/** Words. Semrush's "paragraphs are too long" flags well under what readability guides allow; 150 is conservative. */
const PARAGRAPH_MAX_WORDS = 150

export function runChecks(url: string, html: string, options: CheckOptions = {}): Issue[] {
	const { document } = parseHTML(html)
	const issues: Issue[] = []
	// Only the page's own banner, navigation and footer. A <header> inside an <article> holds the
	// article's H1 (agilitycms.com's marketplace and blog pages do this), so plain "header" is wrong.
	const chrome =
		options.chromeSelector ??
		"body > header, body > footer, body > nav, nav, [role=navigation], [role=banner], [role=contentinfo]"

	const add = (check: string, severity: Severity, message: string, element: Element | null, snippet: string, target?: string) => {
		issues.push({
			check,
			severity,
			source: "builtin",
			url,
			message,
			snippet,
			target,
			origin: element ? locate(element) : undefined,
			pageLevel: element ? undefined : true
		})
	}

	// Images
	for (const img of document.querySelectorAll("img")) {
		if (img.getAttribute("aria-hidden") === "true" || img.getAttribute("role") === "presentation") continue
		const alt = img.getAttribute("alt")
		const src = img.getAttribute("src") ?? ""
		if (alt === null) {
			add("img-alt-missing", "warning", "Image has no alt text.", img, imgSnippet(img))
		} else if (alt.trim() && looksLikeFileName(alt, src)) {
			add("img-alt-filename", "notice", `Alt text is a file name or URL ("${clip(alt, 60)}"), not a description.`, img, imgSnippet(img))
		}
	}

	// Links
	for (const a of document.querySelectorAll("a[href]")) {
		const name = accessibleName(a)
		if (!name) {
			add("link-text-empty", "warning", "Link has no text, and no image alt or aria-label to stand in for it.", a, linkSnippet(a))
		} else if (GENERIC_LINK_TEXT.has(normalise(name))) {
			add("link-text-generic", "notice", `Link text "${clip(name, 40)}" doesn't say where it goes.`, a, linkSnippet(a))
		}
	}

	// Headings
	const h1s = [...document.querySelectorAll("h1")].filter((h) => !h.closest(chrome))
	if (h1s.length === 0) {
		add("h1-missing", "warning", "Page has no H1.", null, "h1")
	} else if (h1s.length > 1) {
		for (const h of h1s.slice(1)) {
			add("h1-multiple", "notice", `Page has ${h1s.length} H1s; this one could be an H2.`, h, `h1: ${clip(text(h), 60)}`)
		}
	}

	// Title and meta description
	const title = text(document.querySelector("title"))
	if (!title) add("title-missing", "error", "Page has no title.", null, "title")
	else if (title.length > TITLE_MAX) add("title-long", "notice", `Title is ${title.length} characters; search results cut it near ${TITLE_MAX}.`, null, "title")

	const meta = document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? ""
	if (!meta) add("meta-description-missing", "warning", "Page has no meta description.", null, "meta-description")
	else if (meta.length < META_MIN) add("meta-description-short", "notice", `Meta description is ${meta.length} characters; aim for ${META_MIN}–${META_MAX}.`, null, "meta-description")
	else if (meta.length > META_MAX) add("meta-description-long", "notice", `Meta description is ${meta.length} characters; search results cut it near ${META_MAX}.`, null, "meta-description")

	// Paragraphs
	for (const p of document.querySelectorAll("p")) {
		if (p.closest(chrome)) continue
		const words = text(p).split(/\s+/).filter(Boolean).length
		if (words > PARAGRAPH_MAX_WORDS) {
			add("paragraph-long", "notice", `Paragraph is ${words} words long; break it up for readers and AI search.`, p, `p: ${clip(text(p), 60)}`)
		}
	}

	return issues
}

/** What a screen reader would announce for a link: its text, else image alts, else aria-label/title. */
function accessibleName(a: Element): string {
	const label = a.getAttribute("aria-label")?.trim()
	if (label) return label
	const own = text(a)
	if (own) return own
	const alts = [...a.querySelectorAll("img[alt]")].map((i) => i.getAttribute("alt")?.trim()).filter(Boolean)
	if (alts.length) return alts.join(" ")
	const svgTitle = a.querySelector("svg title")?.textContent?.trim()
	if (svgTitle) return svgTitle
	return a.getAttribute("title")?.trim() ?? ""
}

/**
 * Alt text that is a URL, ends in an image extension, or is a camera or export
 * name ("IMG_1671", "DSC0042", "screenshot-2024-01-02"). Matching the file's
 * name alone isn't enough: a logo named pepsico.svg with the alt "Pepsico" is
 * correctly described.
 */
function looksLikeFileName(alt: string, src: string): boolean {
	const a = alt.trim().toLowerCase()
	if (/^https?:\/\//.test(a)) return true
	if (/\.(jpe?g|png|gif|webp|svg|avif|jfif)\b/.test(a)) return true
	if (/^(img|dsc|dscn|dcim|image|photo|pxl|screenshot|screen shot)[-_ ]?\d/.test(a)) return true
	const file = src.split("?")[0].split("/").pop()?.toLowerCase().replace(/\.[a-z0-9]+$/, "") ?? ""
	const machineLike = !/\s/.test(a) && (/_/.test(a) || /\d{3,}/.test(a))
	return Boolean(file) && a === file && machineLike
}

/** The image's file name without query or size suffix: the same on every page it is used. */
function imgSnippet(img: Element): string {
	const src = (img.getAttribute("src") ?? img.getAttribute("data-src") ?? "").split("?")[0]
	return `img: ${src.split("/").pop() || "(no src)"}`
}

/** The link's target without query string, plus what is inside it. */
function linkSnippet(a: Element): string {
	const href = (a.getAttribute("href") ?? "").split("?")[0].split("#")[0]
	const img = a.querySelector("img")
	const inner = img ? imgSnippet(img) : clip(text(a), 40) || "(empty)"
	return `a ${href} → ${inner}`
}

function text(el: Element | null): string {
	return (el?.textContent ?? "").replace(/\s+/g, " ").trim()
}

function normalise(s: string): string {
	return s.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim()
}

function clip(s: string, n: number): string {
	return s.length > n ? `${s.slice(0, n - 1)}…` : s
}
