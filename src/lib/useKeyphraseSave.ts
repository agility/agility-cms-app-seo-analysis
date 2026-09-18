import { useCallback, useRef, useState } from "react"

export type KeyphraseSaveState = "idle" | "saving" | "saved" | "error" | "not-configured"

export interface KeyphraseSaveContext {
	mgmtApiUrl: string
	token: string
	guid: string
	locale: string
	contentID: number
}

/**
 * Persists the focus keyphrase to the app's own store.
 *
 * Called on commit (blur, Enter), never per keystroke: the analysis re-runs as
 * the editor types, but a write is only worth making once they have settled on
 * a phrase. Skips the request when the value is unchanged from the last save.
 */
export function useKeyphraseSave() {
	const [state, setState] = useState<KeyphraseSaveState>("idle")
	const lastSaved = useRef<string | null>(null)

	/** Marks a value as already persisted, e.g. the one seeded from the store. */
	const markSaved = useCallback((value: string) => {
		lastSaved.current = value.trim()
		setState("idle")
	}, [])

	const save = useCallback(async (context: KeyphraseSaveContext, value: string) => {
		const keyphrase = value.trim()
		if (keyphrase === lastSaved.current) return

		setState("saving")

		try {
			const response = await fetch("/api/keyphrase", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...context, keyphrase })
			})

			if (!response.ok) {
				const { error } = await response.json().catch(() => ({ error: null }))
				setState(error === "keyphrase-store-not-configured" ? "not-configured" : "error")
				return
			}

			lastSaved.current = keyphrase
			setState("saved")
		} catch {
			setState("error")
		}
	}, [])

	return { state, save, markSaved }
}
