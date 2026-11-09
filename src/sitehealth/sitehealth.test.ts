import { describe, expect, it } from "vitest"

import { runChecks } from "./checks"
import { groupIssues } from "./group"

/** A page shaped like what the Agility starters render. */
function page(body: string, head = '<title>A fine page title</title><meta name="description" content="A meta description that is long enough to pass the minimum length check, comfortably.">') {
	return `<!doctype html><html><head>${head}</head><body data-agility-page="11">
<header><nav><a href="/">Home</a></nav></header>
<main><h1>Title</h1>${body}</main>
<footer><a href="/privacy">Privacy</a></footer></body></html>`
}

const AD = `<a href="/blog/unveiling-agility-cms-revamped-ui?utm_source=infeedcta"><img src="https://cdn.aglty.io/blog-images/infeed-ad.png?w=800"></a>`

describe("runChecks", () => {
	it("finds an image without alt and locates it in the component and field", () => {
		const html = page(`<div data-agility-component="2713"><div data-agility-field="content"><p>x</p>${AD}</div></div>`)
		const issues = runChecks("https://example.com/blog/a", html)
		const img = issues.find((i) => i.check === "img-alt-missing")
		expect(img?.origin).toEqual({ pageID: 11, contentID: 2713, field: "content", confidence: "exact" })
		expect(img?.snippet).toBe("img: infeed-ad.png")
	})

	it("treats image alt as a link's text, and flags the link only when there is none", () => {
		const withAlt = runChecks("u", page(`<a href="/x"><img src="a.png" alt="See the redesigned interface"></a>`))
		expect(withAlt.some((i) => i.check === "link-text-empty")).toBe(false)
		const without = runChecks("u", page(AD))
		expect(without.some((i) => i.check === "link-text-empty")).toBe(true)
	})

	it("flags generic link text but not an aria-label that names the target", () => {
		const issues = runChecks("u", page(`<a href="/a">Read more</a><a href="/b" aria-label="Read more about pricing">Read more</a>`))
		expect(issues.filter((i) => i.check === "link-text-generic")).toHaveLength(1)
	})

	it("flags a second H1 in the content but ignores one in the header chrome", () => {
		const issues = runChecks("u", page(`<h1>Second</h1>`))
		expect(issues.filter((i) => i.check === "h1-multiple")).toHaveLength(1)
		const chromeOnly = runChecks("u", page("").replace("<header>", "<header><h1>Logo</h1>"))
		expect(chromeOnly.some((i) => i.check === "h1-multiple")).toBe(false)
	})

	it("counts an H1 inside an article's own <header>", () => {
		const html = page("").replace("<main><h1>Title</h1>", "<main><article><header><h1>Title</h1></header></article>")
		expect(runChecks("u", html).some((i) => i.check === "h1-missing")).toBe(false)
	})

	it("flags alt text that is a file name", () => {
		const issues = runChecks("u", page(`<img src="https://cdn/x/photo-123.jpg" alt="photo-123.jpg">`))
		expect(issues.some((i) => i.check === "img-alt-filename")).toBe(true)
	})

	it("reports missing title and meta description as page-level issues", () => {
		const issues = runChecks("u", page("", ""))
		const checks = issues.filter((i) => i.pageLevel).map((i) => i.check)
		expect(checks).toEqual(expect.arrayContaining(["title-missing", "meta-description-missing"]))
	})

	it("flags a very long paragraph", () => {
		const long = `<p>${"word ".repeat(200)}</p>`
		expect(runChecks("u", page(long)).some((i) => i.check === "paragraph-long")).toBe(true)
	})
})

describe("groupIssues", () => {
	it("folds the same pasted snippet in many items into one group with each place", () => {
		const issues = [2713, 2714, 2715].flatMap((id) =>
			runChecks(`https://example.com/blog/${id}`, page(`<div data-agility-component="${id}"><div data-agility-field="content">${AD}</div></div>`))
		)
		const groups = groupIssues(issues).filter((g) => g.check === "img-alt-missing")
		expect(groups).toHaveLength(1)
		expect(groups[0].instances.map((i) => i.origin?.contentID)).toEqual([2713, 2714, 2715])
	})

	it("keeps page-level issues one group per page", () => {
		const issues = ["a", "b"].flatMap((u) => runChecks(u, page("", "")))
		expect(groupIssues(issues).filter((g) => g.check === "title-missing")).toHaveLength(2)
	})

	it("orders errors first, then by how many places an issue affects", () => {
		const issues = ["a", "b"].flatMap((u) => runChecks(u, page(AD, "")))
		const groups = groupIssues(issues)
		expect(groups[0].severity).toBe("error")
	})
})
