import { BrokenLink, Search } from "./icons"

/**
 * The keyphrase unlock prompt.
 *
 * Deliberately NOT an empty state. The panel has already shown the editor real
 * structural findings and a readability score by this point; a keyphrase adds
 * nine further checks. Framing it as "here is what more you get" rather than
 * "you must do this first" is the difference between an app that works on
 * install and one that demands setup before it says anything.
 */
export function KeyphraseUnlockPrompt({ lockedCount }: { lockedCount: number }) {
	if (lockedCount <= 0) return null

	return (
		<div className="mb-3 flex items-start gap-2 rounded border border-dashed border-gray-300 px-3 py-2.5">
			<Search size={14} className="mt-0.5 shrink-0 text-gray-400" />
			<p className="text-[11px] leading-4 tracking-tiny text-gray-500">
				Set a focus keyphrase to unlock {lockedCount} more{" "}
				{lockedCount === 1 ? "check" : "checks"} &mdash; whether your phrase appears in the
				title, intro, subheadings, slug and meta description.
			</p>
		</div>
	)
}

/** The reasons a surface can be open on something that has no rendered page. */
export type UnsupportedReason = "not-a-dynamic-page" | "folder-or-link" | "dynamic-page-node"

const UNSUPPORTED_COPY: Record<UnsupportedReason, { title: string; body: string }> = {
	"not-a-dynamic-page": {
		title: "This content item isn\u2019t connected to a dynamic page.",
		body:
			"SEO analysis needs a rendered URL to score against. Enable a dynamic page on this " +
			"container to turn it on."
	},
	"folder-or-link": {
		title: "This page has no content of its own.",
		body: "Folders and links don\u2019t render a page, so there is nothing to score here."
	},
	"dynamic-page-node": {
		title: "This is a dynamic page template.",
		body:
			"The content items it lists are the pages that actually render. Open one of them - " +
			"the analysis is in its sidebar."
	}
}

/**
 * Shown when the thing in the sidebar has no rendered page to score.
 *
 * This is not an error - most content models are building blocks, not pages,
 * and a page tree is full of folders. The panel mounts on every item and every
 * page, so this state is common and should read as information rather than a
 * failure.
 */
export function UnsupportedState({ reason }: { reason: UnsupportedReason }) {
	const copy = UNSUPPORTED_COPY[reason]

	return (
		<div className="flex flex-col items-center gap-2.5 px-3 py-7 text-center">
			<BrokenLink className="text-gray-300" />
			<p className="text-[13px] font-semibold leading-[18px] text-gray-700">{copy.title}</p>
			<p className="text-[11px] leading-4 tracking-tiny text-gray-500">{copy.body}</p>
		</div>
	)
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
	return (
		<div className="mt-3.5 flex flex-col items-start gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-3">
			<p className="text-xs leading-4 tracking-body text-gray-700">{message}</p>
			{onRetry ? (
				<button
					type="button"
					onClick={onRetry}
					className="text-[11px] leading-[14px] text-purple-700 hover:underline"
				>
					Try again
				</button>
			) : null}
		</div>
	)
}
