import cn from "classnames"

export type TabKey = "seo" | "readability"

interface TabsProps {
	active: TabKey
	onChange: (tab: TabKey) => void
	counts?: Partial<Record<TabKey, number>>
}

const TABS: { key: TabKey; label: string }[] = [
	{ key: "seo", label: "SEO" },
	{ key: "readability", label: "Readability" }
]

export function Tabs({ active, onChange }: TabsProps) {
	return (
		<div className="mb-3 flex border-b border-gray-200" role="tablist">
			{TABS.map((tab) => (
				<button
					key={tab.key}
					type="button"
					role="tab"
					aria-selected={active === tab.key}
					onClick={() => onChange(tab.key)}
					className={cn(
						"-mb-px px-2.5 py-1.5 text-xs leading-4 tracking-body transition-colors",
						active === tab.key
							? "border-b-2 border-violet-800 font-semibold text-gray-900"
							: "text-gray-500 hover:text-gray-700"
					)}
				>
					{tab.label}
				</button>
			))}
		</div>
	)
}
