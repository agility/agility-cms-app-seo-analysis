import { useCallback, useEffect, useRef, useState } from "react"

import type { AnalysisResponse, AnalyzeRequest } from "@/analysis/types"

export type AnalysisState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ready"; data: AnalysisResponse }
	| { status: "error"; message: string }

/**
 * Posts a paper to the analysis route and tracks the result.
 *
 * In-flight requests are aborted when a newer one starts: the editor types, and
 * a slow analysis of a stale keyphrase must never land after a fast analysis of
 * the current one and overwrite it.
 */
export function useAnalysis() {
	const [state, setState] = useState<AnalysisState>({ status: "idle" })
	const abortRef = useRef<AbortController | null>(null)

	useEffect(() => {
		return () => abortRef.current?.abort()
	}, [])

	const run = useCallback(async (request: AnalyzeRequest) => {
		abortRef.current?.abort()

		const controller = new AbortController()
		abortRef.current = controller

		setState({ status: "loading" })

		try {
			const response = await fetch("/api/analyze", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(request),
				signal: controller.signal
			})

			if (!response.ok) {
				const { error } = await response.json().catch(() => ({ error: null }))
				setState({ status: "error", message: error ?? "The analysis could not be run." })
				return
			}

			setState({ status: "ready", data: await response.json() })
		} catch (error) {
			// An abort is this hook working as intended, not a failure to report.
			if ((error as Error)?.name === "AbortError") return

			setState({ status: "error", message: "The analysis could not be reached." })
		}
	}, [])

	return { state, run }
}
