import { NextResponse } from "next/server"

import { getItemDetails, getPage } from "@/agility/managementApi"
import {
	KeyphraseStoreNotConfiguredError,
	getKeyphraseStore,
	keyphraseKey,
	pageKeyphraseKey
} from "@/store/keyphraseStore"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface SaveKeyphraseRequest {
	mgmtApiUrl: string
	token: string
	guid: string
	locale: string
	/** One of the two: a content item (content item sidebar) or a page (page sidebar). */
	contentID?: number
	pageID?: number
	keyphrase: string
}

const MAX_KEYPHRASE_LENGTH = 200

/**
 * Saves (or, when empty, clears) the focus keyphrase for one content item or
 * one page.
 *
 * Reads happen in /api/page-content, which already resolves the target and can
 * return the stored keyphrase alongside the rendered page for free. Only writes
 * come here.
 *
 * The caller's Management API token is the authorization: the write is allowed
 * only if that token can read the item or page it names. Without this, anyone
 * who knew an instance guid could overwrite its editors' keyphrases.
 */
export async function PUT(request: Request) {
	let body: SaveKeyphraseRequest

	try {
		body = await request.json()
	} catch {
		return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 })
	}

	const { mgmtApiUrl, token, guid, locale, contentID, pageID } = body

	if (!mgmtApiUrl || !token || !guid || !locale || (!contentID && !pageID) || typeof body.keyphrase !== "string") {
		return NextResponse.json({ error: "Missing required context." }, { status: 400 })
	}

	const keyphrase = body.keyphrase.trim().slice(0, MAX_KEYPHRASE_LENGTH)

	try {
		const key = pageID
			? await authorizePage(mgmtApiUrl, token, guid, locale, pageID)
			: await authorizeContentItem(mgmtApiUrl, token, guid, locale, contentID as number)

		if (!key) {
			return NextResponse.json({ error: "forbidden" }, { status: 403 })
		}

		const store = getKeyphraseStore()

		if (keyphrase) {
			await store.set(key, { keyphrase, updatedAt: new Date().toISOString() })
		} else {
			await store.delete(key)
		}

		return NextResponse.json({ keyphrase })
	} catch (error) {
		if (error instanceof KeyphraseStoreNotConfiguredError) {
			console.error("[seo-analysis]", error.message)
			return NextResponse.json({ error: "keyphrase-store-not-configured" }, { status: 503 })
		}

		console.error("[seo-analysis] keyphrase save failed", error)
		return NextResponse.json({ error: "keyphrase-save-failed" }, { status: 500 })
	}
}

/** The store key for a content item the token can read, or null. */
async function authorizeContentItem(
	mgmtApiUrl: string,
	token: string,
	guid: string,
	locale: string,
	contentID: number
): Promise<string | null> {
	const item = await getItemDetails(mgmtApiUrl, token, guid, locale, contentID)
	return item ? keyphraseKey(guid, locale, contentID) : null
}

/** The store key for a page the token can read, or null. */
async function authorizePage(
	mgmtApiUrl: string,
	token: string,
	guid: string,
	locale: string,
	pageID: number
): Promise<string | null> {
	const page = await getPage(mgmtApiUrl, token, guid, locale, pageID)
	return page ? pageKeyphraseKey(guid, locale, pageID) : null
}
