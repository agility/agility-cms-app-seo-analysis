interface SnippetPreviewProps {
	title: string
	description: string
	url: string | null
	siteName?: string
}

/**
 * A Google result card.
 *
 * Deliberately uses Google's colors rather than the CMS palette - this is the
 * one part of the panel that is a simulation of somewhere else, and making it
 * look like the rest of the app would defeat its purpose.
 */
export function SnippetPreview({ title, description, url, siteName }: SnippetPreviewProps) {
	const { host, crumbs } = splitUrl(url)

	return (
		<div className="mb-4 flex flex-col gap-[3px] rounded border border-gray-200 p-3">
			<div className="flex items-center gap-1.5">
				<div className="h-4 w-4 shrink-0 rounded-full bg-gray-100" />
				<div className="flex min-w-0 flex-col">
					<span className="truncate text-[11px] leading-[14px] text-[#202124]">
						{siteName || host || "Your site"}
					</span>
					<span className="truncate text-2xs leading-[13px] text-[#5F6368]">
						{host}
						{crumbs}
					</span>
				</div>
			</div>

			<p className="pt-[3px] text-[15px] leading-5 text-[#1a0dab] line-clamp-2">
				{title || "Untitled page"}
			</p>
			<p className="text-[11px] leading-4 text-[#4d5156] line-clamp-2">
				{description || "No meta description set. Search engines will use copy from the page."}
			</p>
		</div>
	)
}

/** Renders a URL as Google does: host, then path segments as breadcrumbs. */
function splitUrl(url: string | null): { host: string; crumbs: string } {
	if (!url) return { host: "", crumbs: "" }

	try {
		const parsed = new URL(url)
		const segments = parsed.pathname.split("/").filter(Boolean)

		return {
			host: parsed.host,
			crumbs: segments.length ? ` › ${segments.join(" › ")}` : ""
		}
	} catch {
		return { host: url, crumbs: "" }
	}
}
