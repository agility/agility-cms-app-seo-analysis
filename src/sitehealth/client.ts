"use client"

import { getManagementAPIToken } from "@agility/app-sdk"

import { resolveManagementApiUrl } from "@/agility/mgmtApiUrl"

/**
 * Calls a Site Health route with the auth every route checks: the user's
 * Management API token, the instance and the regional API base.
 */
export async function siteHealthCall<T>(route: string, guid: string, body: Record<string, unknown> = {}): Promise<T> {
	const token = await getManagementAPIToken()
	if (!token) throw new Error("No Management API token from the CMS.")

	const res = await fetch(`/api/site-health/${route}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ mgmtApiUrl: resolveManagementApiUrl(), token, guid, ...body })
	})
	const json = await res.json().catch(() => ({}))
	if (!res.ok) throw new Error(json.error ?? `Site Health ${route} failed (${res.status}).`)
	return json as T
}

/** Human names for the built-in checks. Vendor checks carry their own message. */
export const CHECK_LABELS: Record<string, string> = {
	"img-alt-missing": "Image without alt text",
	"img-alt-filename": "Alt text is a file name",
	"link-text-empty": "Link with no text",
	"link-text-generic": "Link text says nothing",
	"h1-missing": "No H1",
	"h1-multiple": "More than one H1",
	"title-missing": "No title",
	"title-long": "Title too long",
	"meta-description-missing": "No meta description",
	"meta-description-short": "Meta description too short",
	"meta-description-long": "Meta description too long",
	"paragraph-long": "Very long paragraph"
}
