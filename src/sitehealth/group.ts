import type { Issue, IssueGroup } from "./types"

/**
 * Folds issues that have one cause into one group.
 *
 * Two findings share a cause when they are the same check on the same element
 * (the same snippet) in the same field. That covers both ways one mistake shows
 * up on many pages:
 * - a shared component: one content item rendered on N pages;
 * - a pasted snippet: the same markup in the same field of N items, as the
 *   in-post ad image was in 95 blog posts on agilitycms.com in 2026-11.
 * Either way the editor sees one issue with N places, not N issues.
 *
 * Page-level checks (no element: a missing meta description) stay one group per
 * page, because each page needs its own fix.
 */
export function groupIssues(issues: Issue[]): IssueGroup[] {
	const groups = new Map<string, IssueGroup>()

	for (const issue of issues) {
		const key = groupKey(issue)
		const existing = groups.get(key)
		if (existing) {
			if (!existing.instances.some((i) => i.url === issue.url)) existing.instances.push({ url: issue.url, origin: issue.origin })
			continue
		}
		groups.set(key, {
			key,
			check: issue.check,
			severity: issue.severity,
			source: issue.source,
			message: issue.message,
			snippet: issue.snippet,
			instances: [{ url: issue.url, origin: issue.origin }]
		})
	}

	const rank = { error: 0, warning: 1, notice: 2 }
	return [...groups.values()].sort(
		(a, b) =>
			rank[a.severity] - rank[b.severity] ||
			b.instances.length - a.instances.length ||
			a.check.localeCompare(b.check)
	)
}

function groupKey(issue: Issue): string {
	const where = issue.pageLevel ? `url:${issue.url}` : `field:${issue.origin?.field ?? "-"}`
	return [issue.source, issue.check, where, issue.snippet].join("|")
}
