import { useEffect, useState } from "react"

/**
 * Debounces a value.
 *
 * Analysis is a network round trip plus a few hundred ms of CPU, so it must not
 * run on every keystroke. 700ms is long enough that typing a keyphrase produces
 * one analysis, short enough that it still feels live.
 */
export function useDebouncedValue<T>(value: T, delayMs = 700): T {
	const [debounced, setDebounced] = useState(value)

	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delayMs)
		return () => clearTimeout(timer)
	}, [value, delayMs])

	return debounced
}
