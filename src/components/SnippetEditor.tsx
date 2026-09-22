import { useMemo } from "react"

import {
	DESCRIPTION_PIXEL_LIMIT,
	TITLE_PIXEL_LIMIT,
	measureDescriptionWidth,
	measureTitleWidth
} from "@/lib/pixelWidth"
import { PixelMeter } from "./PixelMeter"
import { SnippetPreview } from "./SnippetPreview"

interface SnippetEditorProps {
	title: string
	description: string
	url: string | null
	onDescriptionChange: (value: string) => void
	/** Fired when the editor settles on a description: blur. Surfaces that save on commit use this. */
	onDescriptionCommit?: (value: string) => void
	/** Status line under the description, e.g. "Saving…". */
	descriptionHint?: string
	/** Where the description is written, shown under the editor. */
	savesTo: React.ReactNode
	/** Shown in the read-only title box when the page has no title yet. */
	titlePlaceholder?: string
	isReadOnly?: boolean
	descriptionRef?: React.Ref<HTMLTextAreaElement>
}

/**
 * Search appearance: the Google card plus the fields that drive it.
 *
 * Only the description is editable here. The SEO title is read from the
 * rendered page: on a dynamic page it comes from the template's title formula,
 * and on a regular page the site usually decorates the page title (a suffix,
 * the site name), so offering to edit the raw field would preview something the
 * site never renders. The width meter still shows what Google will see.
 */
export function SnippetEditor({
	title,
	description,
	url,
	onDescriptionChange,
	onDescriptionCommit,
	descriptionHint,
	savesTo,
	titlePlaceholder = "Set by the page template",
	isReadOnly,
	descriptionRef
}: SnippetEditorProps) {
	const titleWidth = useMemo(() => measureTitleWidth(title), [title])
	const descriptionWidth = useMemo(() => measureDescriptionWidth(description), [description])

	return (
		<div className="flex flex-col">
			<h2 className="pb-2.5 text-xs font-semibold tracking-body text-gray-900">Search appearance</h2>

			<SnippetPreview title={title} description={description} url={url} />

			<div className="flex flex-col gap-1 pb-3.5">
				<span className="text-sm leading-5 tracking-label text-gray-700">SEO title</span>
				<div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-5 text-gray-600">
					{title || <span className="text-gray-400">{titlePlaceholder}</span>}
				</div>
				<PixelMeter width={titleWidth} limit={TITLE_PIXEL_LIMIT} />
			</div>

			<div className="flex flex-col gap-1 pb-3.5">
				<label
					htmlFor="seo-meta-description"
					className="text-sm leading-5 tracking-label text-gray-700"
				>
					Meta description
				</label>
				<textarea
					id="seo-meta-description"
					ref={descriptionRef}
					value={description}
					disabled={isReadOnly}
					rows={3}
					onChange={(event) => onDescriptionChange(event.target.value)}
					onBlur={(event) => onDescriptionCommit?.(event.target.value)}
					className="w-full resize-y rounded border border-gray-300 px-3 py-2 text-sm font-normal leading-5 text-gray-900 outline-none transition-colors placeholder:text-gray-500 hover:border-gray-500 focus:border-violet-700 disabled:bg-gray-50 disabled:text-gray-500"
					placeholder="Summarize the page in about 155 characters."
				/>
				<PixelMeter width={descriptionWidth} limit={DESCRIPTION_PIXEL_LIMIT} />
				{descriptionHint ? (
					<p className="text-[11px] leading-[15px] tracking-tiny text-gray-500">{descriptionHint}</p>
				) : null}
			</div>

			<p className="text-2xs leading-[14px] tracking-tiny text-gray-400">{savesTo}</p>
		</div>
	)
}
