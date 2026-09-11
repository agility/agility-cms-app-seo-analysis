/**
 * Measures rendered text width in pixels.
 *
 * Google truncates titles and descriptions by PIXEL width, not character count,
 * so "60 characters" is a bad proxy - 60 capitals overflow where 60 lowercase
 * letters do not. Yoast's title-width assessment takes a real measurement, which
 * means it can only be taken in the browser; the server has no font metrics.
 * The measured value is passed to the analysis as `titleWidth`.
 */

const TITLE_FONT = "400 20px Arial, sans-serif"
const DESCRIPTION_FONT = "400 14px Arial, sans-serif"

/** Google's approximate desktop limits. */
export const TITLE_PIXEL_LIMIT = 580
export const DESCRIPTION_PIXEL_LIMIT = 920

let canvasContext: CanvasRenderingContext2D | null = null

function getContext(): CanvasRenderingContext2D | null {
	if (typeof document === "undefined") return null
	if (canvasContext) return canvasContext

	const canvas = document.createElement("canvas")
	canvasContext = canvas.getContext("2d")
	return canvasContext
}

function measure(text: string, font: string): number {
	const context = getContext()
	if (!context || !text) return 0

	context.font = font
	return Math.round(context.measureText(text).width)
}

export function measureTitleWidth(title: string): number {
	return measure(title, TITLE_FONT)
}

export function measureDescriptionWidth(description: string): number {
	return measure(description, DESCRIPTION_FONT)
}

export type LengthVerdict = "empty" | "short" | "good" | "long"

/**
 * Judges a measured width against Google's limit.
 *
 * The "too short" band matters as much as the overflow one: a description at
 * 40% of the limit is leaving result-page real estate on the table, which is
 * exactly what the meta description assessment complains about.
 */
export function verdictForWidth(width: number, limit: number): LengthVerdict {
	if (width === 0) return "empty"
	if (width < limit * 0.55) return "short"
	if (width > limit) return "long"
	return "good"
}
