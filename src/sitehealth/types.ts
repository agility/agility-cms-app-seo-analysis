/**
 * The shapes every part of Site Health shares: the built-in checks, the vendor
 * adapters (Semrush first) and the surfaces that show the results.
 *
 * An issue is always about one element on one URL. Where it came from in
 * Agility - the page, the component's content item and the field - is resolved
 * separately (locate.ts), because a vendor reports URLs and nothing else.
 */

export type Severity = "error" | "warning" | "notice"

/** Who found the issue. "builtin" needs no vendor account. */
export type IssueSource = "builtin" | "semrush" | "siteimprove" | "ahrefs"

export interface Issue {
	/** Stable check id, e.g. "img-alt-missing". Vendor checks are prefixed: "semrush:123". */
	check: string
	severity: Severity
	source: IssueSource
	/** The page the issue was found on. */
	url: string
	/** A short, stable rendering of the offending element, used to group and to find it again. */
	snippet: string
	/** What is wrong, in one sentence an editor can act on. */
	message: string
	/** Where the element came from in Agility, when it could be resolved. */
	origin?: Origin
	/** For a broken link or image, the URL that failed. */
	target?: string
	/** About the page as a whole (its title, its H1 count), not one element on it. */
	pageLevel?: boolean
}

export interface Origin {
	/** `data-agility-page` on the document: the Agility page ID. */
	pageID?: number
	/** `data-agility-component` on the nearest component: its content ID. */
	contentID?: number
	/** `data-agility-field` on the nearest field wrapper, e.g. "content". */
	field?: string
	/**
	 * "exact": read from the attributes our starters render.
	 * "approximate": matched by text against the instance's fields.
	 */
	confidence: "exact" | "approximate"
}

/** Issues that share a check and a source element, across every page and item they appear on. */
export interface IssueGroup {
	key: string
	check: string
	severity: Severity
	source: IssueSource
	message: string
	snippet: string
	/** Each place it occurs: one per URL, with the item and field it came from there. */
	instances: { url: string; origin?: Origin }[]
}
