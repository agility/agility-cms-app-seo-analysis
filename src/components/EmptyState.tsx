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

/**
 * Shown when the item's container is not a dynamic page list.
 *
 * This is not an error - most content models are building blocks, not pages.
 * The panel mounts on every content item, so this state is common and should
 * read as information rather than a failure.
 */
export function NotDynamicPageState() {
	return (
		<div className="flex flex-col items-center gap-2.5 px-3 py-7 text-center">
			<BrokenLink className="text-gray-300" />
			<p className="text-[13px] font-semibold leading-[18px] text-gray-700">
				This content item isn&rsquo;t connected to a dynamic page.
			</p>
			<p className="text-[11px] leading-4 tracking-tiny text-gray-500">
				SEO analysis needs a rendered URL to score against. Enable a dynamic page on this
				container to turn it on.
			</p>
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
