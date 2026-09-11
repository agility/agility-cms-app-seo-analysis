interface KeyphraseInputProps {
	value: string
	onChange: (value: string) => void
	isDisabled?: boolean
	label?: string
	hint?: string
	inputRef?: React.Ref<HTMLInputElement>
}

/**
 * Styled to match @agility/plenum-ui's TextInput exactly - rounded, border
 * gray-300, py-2 px-3, text-sm, focus to violet-700 - so it does not read as a
 * foreign control inside the CMS panel.
 */
export function KeyphraseInput({
	value,
	onChange,
	isDisabled,
	label = "Focus keyphrase",
	hint,
	inputRef
}: KeyphraseInputProps) {
	return (
		<div className="flex flex-col gap-1 pb-3">
			<label htmlFor="seo-keyphrase" className="text-sm leading-5 tracking-label text-gray-700">
				{label}
			</label>
			<input
				id="seo-keyphrase"
				ref={inputRef}
				type="text"
				value={value}
				disabled={isDisabled}
				placeholder="e.g. headless CMS migration"
				onChange={(event) => onChange(event.target.value)}
				className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-normal leading-5 text-gray-900 outline-none transition-colors placeholder:text-gray-500 hover:border-gray-500 focus:border-violet-700 disabled:bg-gray-50 disabled:text-gray-500"
			/>
			{hint ? <p className="text-[11px] leading-[15px] tracking-tiny text-gray-500">{hint}</p> : null}
		</div>
	)
}
