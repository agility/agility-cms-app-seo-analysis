/**
 * Inline stroke icons on a 24px grid, sized down at the call site.
 *
 * Drawn rather than pulled from a library: the panel needs five glyphs, and a
 * dependency for that would outweigh them in the bundle.
 */

interface IconProps {
	className?: string
	size?: number
}

function Icon({ size = 12, className, children }: IconProps & { children: React.ReactNode }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			{children}
		</svg>
	)
}

export function ChevronDown(props: IconProps) {
	return (
		<Icon {...props}>
			<polyline points="6 9 12 15 18 9" />
		</Icon>
	)
}

export function ChevronRight(props: IconProps) {
	return (
		<Icon {...props}>
			<polyline points="9 18 15 12 9 6" />
		</Icon>
	)
}

export function Refresh({ size = 14, className }: IconProps) {
	return (
		<Icon size={size} className={className}>
			<polyline points="23 4 23 10 17 10" />
			<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
		</Icon>
	)
}

export function Search({ size = 24, className }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<circle cx="11" cy="11" r="7" />
			<line x1="21" y1="21" x2="16.65" y2="16.65" />
		</svg>
	)
}

export function BrokenLink({ size = 28, className }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
			<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
			<line x1="2" y1="2" x2="22" y2="22" />
		</svg>
	)
}

export function Spinner({ size = 12, className }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2.5}
			strokeLinecap="round"
			className={`animate-spin ${className ?? ""}`}
			aria-hidden="true"
		>
			<path d="M21 12a9 9 0 1 1-6.219-8.56" />
		</svg>
	)
}
