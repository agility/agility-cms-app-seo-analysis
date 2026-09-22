import { NextResponse } from "next/server"

import { getPage, savePageMetaDescription } from "@/agility/managementApi"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface SavePageSeoRequest {
	mgmtApiUrl: string
	token: string
	guid: string
	locale: string
	pageID: number
	metaDescription: string
}

/** Generous: Google truncates around 155 characters, but the field itself is free text. */
const MAX_META_DESCRIPTION_LENGTH = 1000

/**
 * Saves a regular page's meta description.
 *
 * The content item sidebar never needs this: there, the App SDK's setFieldValue
 * writes to the item and the CMS's own save flow persists it. The page sidebar
 * has no such method - the SDK is read-only on pages - so the edit goes through
 * the Management API instead, with the editor's own token as authorization.
 *
 * The description is re-read from the page right before saving rather than
 * trusting the client's copy of the rest of the page: the save is a whole-page
 * write (see savePageMetaDescription), and the freshest page is the safest
 * base for it.
 */
export async function PUT(request: Request) {
	let body: SavePageSeoRequest

	try {
		body = await request.json()
	} catch {
		return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 })
	}

	const { mgmtApiUrl, token, guid, locale, pageID } = body

	if (!mgmtApiUrl || !token || !guid || !locale || !pageID || typeof body.metaDescription !== "string") {
		return NextResponse.json({ error: "Missing required context." }, { status: 400 })
	}

	const metaDescription = body.metaDescription.trim().slice(0, MAX_META_DESCRIPTION_LENGTH)

	try {
		const page = await getPage(mgmtApiUrl, token, guid, locale, pageID)

		if (!page) {
			return NextResponse.json({ error: "page-not-found" }, { status: 404 })
		}

		if (page.metaDescription !== metaDescription) {
			await savePageMetaDescription(mgmtApiUrl, token, guid, locale, page, metaDescription)
		}

		return NextResponse.json({ metaDescription })
	} catch (error) {
		console.error("[seo-analysis] page SEO save failed", error)
		return NextResponse.json({ error: "page-seo-save-failed" }, { status: 500 })
	}
}
