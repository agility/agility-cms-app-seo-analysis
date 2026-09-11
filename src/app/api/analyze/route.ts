import { NextResponse } from "next/server"

import { analyze } from "@/analysis/analyze"
import type { AnalyzeRequest } from "@/analysis/types"

// The analysis is CPU-bound and pulls in a few MB of language data, so it must
// run on the Node runtime, not the edge.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Runs the Yoast analysis.
 *
 * This route exists so `yoastseo` never reaches the browser. That keeps ~2.4MB
 * of language data out of the client bundle, and - the reason it is not
 * negotiable - keeps this app's client bundle from being a conveyance of
 * GPL-3.0 code. See docs/LICENSING.md.
 */
export async function POST(request: Request) {
	let body: AnalyzeRequest

	try {
		body = await request.json()
	} catch {
		return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 })
	}

	if (typeof body?.text !== "string") {
		return NextResponse.json({ error: "`text` is required." }, { status: 400 })
	}

	// Nothing to score. Returning empty beats returning a wall of failures that
	// only say "there is no content here".
	if (!body.text.trim()) {
		return NextResponse.json({
			scores: { seo: null, readability: null },
			seoResults: [],
			readabilityResults: [],
			fullLanguageSupport: true,
			wordCount: 0
		})
	}

	try {
		return NextResponse.json(analyze(body))
	} catch (error) {
		console.error("[seo-analysis] analysis failed", error)
		return NextResponse.json({ error: "The analysis engine failed on this content." }, { status: 500 })
	}
}
