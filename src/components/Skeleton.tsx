import { Spinner } from "./icons"

/** The loading state. Mirrors the real layout so nothing jumps when it resolves. */
export function AnalysisSkeleton({ label }: { label: string }) {
	return (
		<div className="flex flex-col">
			<div className="flex items-center gap-1.5 pb-3 text-gray-500">
				<Spinner />
				<span className="text-[11px] leading-[15px] tracking-tiny">{label}</span>
			</div>

			<div className="mb-3 flex flex-col rounded border border-gray-200">
				<SkeletonScoreRow className="border-b border-gray-200" />
				<SkeletonScoreRow />
			</div>

			<div className="flex flex-col gap-3.5">
				{[100, 92, 78, 84].map((width, index) => (
					<div key={index} className="flex items-start gap-2">
						<Bar className="mt-1 h-2 w-2 shrink-0 rounded-full" />
						<div className="flex grow flex-col gap-1.5">
							<Bar className="h-2.5" style={{ width: `${width}%` }} />
							<Bar className="h-2.5" style={{ width: `${width - 25}%` }} />
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

function SkeletonScoreRow({ className }: { className?: string }) {
	return (
		<div className={`flex items-center gap-2 px-3 py-2.5 ${className ?? ""}`}>
			<Bar className="h-2 w-2 rounded-full" />
			<Bar className="h-2.5 w-16" />
			<span className="grow" />
			<Bar className="h-2.5 w-6" />
		</div>
	)
}

function Bar({ className, style }: { className?: string; style?: React.CSSProperties }) {
	return <span className={`block animate-pulseSoft rounded-sm bg-gray-100 ${className ?? ""}`} style={style} />
}
