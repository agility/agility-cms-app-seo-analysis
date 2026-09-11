import cn from "classnames"

import { type LengthVerdict, verdictForWidth } from "@/lib/pixelWidth"

interface PixelMeterProps {
	width: number
	limit: number
}

const VERDICT_TEXT: Record<LengthVerdict, string> = {
	empty: "Not set",
	short: "Too short",
	good: "Good length",
	long: "Too long"
}

const VERDICT_BAR: Record<LengthVerdict, string> = {
	empty: "bg-gray-300",
	short: "bg-orange-500",
	good: "bg-green-500",
	long: "bg-red-500"
}

const VERDICT_LABEL: Record<LengthVerdict, string> = {
	empty: "text-gray-400",
	short: "text-orange-700",
	good: "text-green-600",
	long: "text-red-600"
}

/**
 * The pixel-width bar under the title and description inputs.
 *
 * Google truncates by pixel width, so this is the honest measure - a character
 * counter would call 60 capitals and 60 lowercase letters equally safe when only
 * one of them fits.
 */
export function PixelMeter({ width, limit }: PixelMeterProps) {
	const verdict = verdictForWidth(width, limit)
	const percent = Math.min(100, Math.round((width / limit) * 100))

	return (
		<div className="flex flex-col gap-1">
			<div className="h-[3px] w-full overflow-hidden rounded-full bg-gray-200">
				<div
					className={cn("h-[3px] rounded-full transition-all", VERDICT_BAR[verdict])}
					style={{ width: `${percent}%` }}
				/>
			</div>
			<div className="flex justify-between">
				<span className="text-2xs tracking-tiny text-gray-400">
					{width} / {limit} px
				</span>
				<span className={cn("text-2xs tracking-tiny", VERDICT_LABEL[verdict])}>
					{VERDICT_TEXT[verdict]}
				</span>
			</div>
		</div>
	)
}
