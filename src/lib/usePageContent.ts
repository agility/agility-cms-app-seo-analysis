import { useCallback, useState } from "react"

import type { UnsupportedReason } from "@/components/EmptyState"

export interface PageContent {
	previewUrl: string
	liveUrl: string | null
	/** The focus keyphrase saved for this item or page, if any. */
	keyphrase: string | null
	html: string
	documentTitle: string
	/** From the rendered page's <meta name="description">. */
	metaDescription: string
	/**
	 * The meta description as stored in Agility. Page sidebar only: a regular
	 * page's description lives on the page record, which the App SDK does not
	 * hand us, so the route reads it. Null on the content item surface, where
	 * the SDK's contentItem.values is the source.
	 */
	storedMetaDescription: string | null
	matchedSelector: string | null
}

export type PageContentState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ready"; data: PageContent }
	| { status: "unsupported"; reason: UnsupportedReason }
	| { status: "error"; message: string }

/** A content item in a dynamic page list, or a regular page from the page tree. */
export type PageContentTarget =
	| { referenceName: string; contentID: number; pageID?: undefined }
	| { pageID: number; contentID?: undefined; referenceName?: undefined }

export type PageContentContext = {
	mgmtApiUrl: string
	token: string
	guid: string
	locale: string
	contentSelector?: string
} & PageContentTarget

/** Route error codes that mean "nothing to score here", not "something broke". */
const UNSUPPORTED_REASONS: Record<string, UnsupportedReason> = {
	"not-a-dynamic-page": "not-a-dynamic-page",
	"folder-or-link": "folder-or-link",
	"dynamic-page-node": "dynamic-page-node"
}

/** Human wording for the route's error codes. */
const ERROR_MESSAGES: Record<string, string> = {
	"container-not-found": "This item's container could not be found.",
	"no-preview-url": "Agility has no preview URL for this item yet. Save it once, then try again.",
	"preview-fetch-failed": "The rendered page could not be loaded. Check that the site is running.",
	"page-not-found": "This page could not be found. It may not exist in this locale yet.",
	"page-content-failed": "Something went wrong resolving this page."
}

/**
 * Fetches the rendered page for a content item or a regular page.
 *
 * Kept separate from useAnalysis because the two have very different cadences:
 * the rendered page is fetched once per item (and on explicit re-analysis),
 * while the analysis re-runs on every debounced keystroke.
 */
export function usePageContent() {
	const [state, setState] = useState<PageContentState>({ status: "idle" })

	const load = useCallback(async (context: PageContentContext) => {
		setState({ status: "loading" })

		try {
			const response = await fetch("/api/page-content", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(context)
			})

			const body = await response.json().catch(() => ({}))

			if (response.ok) {
				setState({ status: "ready", data: body as PageContent })
				return
			}

			const unsupported = UNSUPPORTED_REASONS[body?.error]
			if (unsupported) {
				setState({ status: "unsupported", reason: unsupported })
				return
			}

			setState({
				status: "error",
				message: ERROR_MESSAGES[body?.error] ?? "This page could not be loaded."
			})
		} catch {
			setState({ status: "error", message: "This page could not be loaded." })
		}
	}, [])

	return { state, load }
}
