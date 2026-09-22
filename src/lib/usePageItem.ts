import { useEffect, useState } from "react"
import { pageMethods, type IPageItem } from "@agility/app-sdk"

/**
 * The page the page sidebar is open on.
 *
 * `useAgilityAppSDK()` declares a `pageItem` in its return value but never sets
 * it: its context handler copies app, instance, locale, field, contentItem,
 * contentModel and modalProps out of the manager's message and skips pageItem
 * (app-sdk 2.2.1, dist/cjs/index.js). So on this surface the hook's `pageItem`
 * is always null and the panel would sit idle forever.
 *
 * Two ways around it, both used here:
 *
 * 1. The manager DOES include `pageItem` in the context message it sends in
 *    reply to `initialize` (PageItemSidebarAppSurface.tsx spreads it into the
 *    arg). Listening for that message catches it with no extra round trip.
 * 2. `pageMethods.getPageItem()` asks the manager for it explicitly; the page
 *    surface has a handler for that operation. Used when the message was missed
 *    (this hook mounted after the reply, or an older manager).
 */
export function usePageItem(initializing: boolean): IPageItem | null {
	const [pageItem, setPageItem] = useState<IPageItem | null>(null)

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			const candidate = event?.data?.arg?.pageItem
			if (isPageItem(candidate)) setPageItem(candidate)
		}

		window.addEventListener("message", onMessage)
		return () => window.removeEventListener("message", onMessage)
	}, [])

	useEffect(() => {
		if (initializing || pageItem) return

		let cancelled = false

		pageMethods
			.getPageItem()
			?.then((item) => {
				if (!cancelled && isPageItem(item)) setPageItem(item)
			})
			.catch(() => {
				// Nothing to do: the context-message listener above is the other path.
			})

		return () => {
			cancelled = true
		}
	}, [initializing, pageItem])

	return pageItem
}

/** The one field everything else here depends on is the page ID. */
function isPageItem(value: unknown): value is IPageItem {
	return Boolean(value) && typeof (value as IPageItem).ItemContainerID === "number"
}
