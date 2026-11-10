import type { Origin } from "./types"

/**
 * Where an element on a rendered page came from in Agility.
 *
 * Sites built on our starters (and anything using Web Studio) render three
 * attributes: `data-agility-page` once on the page, `data-agility-component`
 * on each component with its content ID, and `data-agility-field` on each field
 * wrapper with the field's name. Walking up from the element to the nearest of
 * each gives the content item and field that produced it, which is what lets an
 * issue open the field to fix instead of only naming a URL.
 *
 * Returns undefined when the page carries none of them; the caller can then
 * fall back to a text search ("approximate").
 */
export function locate(element: Element): Origin | undefined {
	const doc = element.ownerDocument
	const pageAttr = doc?.querySelector("[data-agility-page]")?.getAttribute("data-agility-page")

	let field: string | undefined
	let contentID: number | undefined

	for (let node: Element | null = element; node; node = node.parentElement) {
		if (field === undefined) {
			const value = node.getAttribute("data-agility-field")
			if (value) field = value
		}
		const component = node.getAttribute("data-agility-component")
		if (component) {
			const id = Number(component)
			if (Number.isInteger(id) && id > 0) contentID = id
			break
		}
	}

	const pageID = pageAttr && Number.isInteger(Number(pageAttr)) ? Number(pageAttr) : undefined

	if (contentID === undefined && field === undefined && pageID === undefined) return undefined

	return { pageID, contentID, field, confidence: "exact" }
}
