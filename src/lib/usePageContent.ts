import { useCallback, useState } from "react"

export interface PageContent {
	previewUrl: string
	liveUrl: string | null
	/** The focus keyphrase saved for this item, if any. */
	keyphrase: string | null
	html: string
	documentTitle: string
	metaDescription: string
	matchedSelector: string | null
}

export type PageContentState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ready"; data: PageContent }
	| { status: "not-a-dynamic-page" }
	| { status: "error"; message: string }

export interface PageContentContext {
	mgmtApiUrl: string
	token: string
	guid: string
	locale: string
	referenceName: string
	contentID: number
	contentSelector?: string
}

/** Human wording for the route's error codes. */
const ERROR_MESSAGES: Record<string, string> = {
	"container-not-found": "This item's container could not be found.",
	"no-preview-url": "Agility has no preview URL for this item yet. Save it once, then try again.",
	"preview-fetch-failed": "The rendered page could not be loaded. Check that the site is running.",
	"page-content-failed": "Something went wrong resolving this item's page."
}

/**
 * Fetches the rendered dynamic page for a content item.
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

			if (body?.error === "not-a-dynamic-page") {
				setState({ status: "not-a-dynamic-page" })
				return
			}

			setState({
				status: "error",
				message: ERROR_MESSAGES[body?.error] ?? "This item's page could not be loaded."
			})
		} catch {
			setState({ status: "error", message: "This item's page could not be loaded." })
		}
	}, [])

	return { state, load }
}
