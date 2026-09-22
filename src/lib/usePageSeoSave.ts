import { useCallback, useRef, useState } from "react"

export type PageSeoSaveState = "idle" | "saving" | "saved" | "error"

export interface PageSeoSaveContext {
	mgmtApiUrl: string
	token: string
	guid: string
	locale: string
	pageID: number
}

/**
 * Persists a regular page's meta description through the Management API.
 *
 * The page sidebar's counterpart to setFieldValue on the content item sidebar.
 * Called on commit (blur), never per keystroke: each save is a whole-page write
 * and a new page version, so one per edit is plenty. Skips the request when the
 * value is unchanged from the last save.
 */
export function usePageSeoSave() {
	const [state, setState] = useState<PageSeoSaveState>("idle")
	const lastSaved = useRef<string | null>(null)

	/** Marks a value as already persisted, e.g. the one read from the page. */
	const markSaved = useCallback((value: string) => {
		lastSaved.current = value.trim()
		setState("idle")
	}, [])

	const save = useCallback(async (context: PageSeoSaveContext, value: string): Promise<boolean> => {
		const metaDescription = value.trim()
		if (metaDescription === lastSaved.current) return false

		setState("saving")

		try {
			const response = await fetch("/api/page-seo", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...context, metaDescription })
			})

			if (!response.ok) {
				setState("error")
				return false
			}

			lastSaved.current = metaDescription
			setState("saved")
			return true
		} catch {
			setState("error")
			return false
		}
	}, [])

	return { state, save, markSaved }
}
