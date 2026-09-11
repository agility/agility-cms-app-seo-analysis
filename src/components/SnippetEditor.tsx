import { useMemo } from "react"

import {
	DESCRIPTION_PIXEL_LIMIT,
	TITLE_PIXEL_LIMIT,
	measureDescriptionWidth,
	measureTitleWidth
} from "@/lib/pixelWidth"
import { AGILITY_SEO_FIELDS } from "@/agility/fieldNames"
import { PixelMeter } from "./PixelMeter"
import { SnippetPreview } from "./SnippetPreview"

interface SnippetEditorProps {
	title: string
	description: string
	url: string | null
	onDescriptionChange: (value: string) => void
	isReadOnly?: boolean
	descriptionRef?: React.Ref<HTMLTextAreaElement>
}

/**
 * Search appearance: the Google card plus the fields that drive it.
 *
 * Only the description is editable here. The SEO title on a dynamic page comes
 * from the page template's title formula, not from a field on the content item,
 * so this panel can show its measured width but cannot honestly offer to change
 * it - that lives on the page, which this surface has no write access to.
 */
export function SnippetEditor({
	title,
	description,
	url,
	onDescriptionChange,
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
					{title || <span className="text-gray-400">Set by the page template</span>}
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
					className="w-full resize-y rounded border border-gray-300 px-3 py-2 text-sm font-normal leading-5 text-gray-900 outline-none transition-colors placeholder:text-gray-500 hover:border-gray-500 focus:border-violet-700 disabled:bg-gray-50 disabled:text-gray-500"
					placeholder="Summarize the page in about 155 characters."
				/>
				<PixelMeter width={descriptionWidth} limit={DESCRIPTION_PIXEL_LIMIT} />
			</div>

			<p className="text-2xs leading-[14px] tracking-tiny text-gray-400">
				Saves to{" "}
				<code className="font-mono text-gray-500">{AGILITY_SEO_FIELDS.metaDescription}</code> on
				this content item.
			</p>
		</div>
	)
}
