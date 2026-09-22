import { Redis } from "@upstash/redis"

/**
 * Where a content item's focus keyphrase lives.
 *
 * App-owned, not on the content item. Agility's own SEO fields hold the meta
 * description because an existing site reads them; nothing reads a keyphrase,
 * so writing it onto the item would either need a model change or hijack a
 * system field. A key-value record per item is the lightweight alternative.
 *
 * Backed by Upstash Redis, provisioned through the Vercel Marketplace: Vercel
 * bills it and injects its credentials, the data lives outside the app and
 * survives cold starts, deploys and scaling. The app is hosted on Vercel, whose
 * filesystem is ephemeral, which is why SQLite on the app itself is not an
 * option.
 *
 * With no Redis configured, development falls back to an in-memory map so
 * `npm run dev` works with no setup. Production does NOT fall back: it throws
 * `KeyphraseStoreNotConfiguredError`, so a misconfigured deploy fails visibly
 * instead of accepting keyphrases and losing them on the next cold start.
 *
 * SERVER ONLY. The token in the env is a write credential.
 */

export interface StoredKeyphrase {
	keyphrase: string
	/** ISO timestamp of the last write. */
	updatedAt: string
}

export interface KeyphraseStore {
	get(key: string): Promise<StoredKeyphrase | null>
	set(key: string, value: StoredKeyphrase): Promise<void>
	delete(key: string): Promise<void>
}

/**
 * `{guid}-{locale}-content-{contentID}`.
 *
 * Agility content IDs are shared across an item's locales, and a keyphrase is
 * language-specific, so the locale has to be in the key. Lower-cased because
 * the SDK and the Management API disagree on locale casing ("en-us" vs "en-US").
 */
export function keyphraseKey(guid: string, locale: string, contentID: number): string {
	return `${guid.toLowerCase()}-${locale.toLowerCase()}-content-${contentID}`
}

/**
 * `{guid}-{locale}-page-{pageID}` - the same idea for a regular page in the
 * page sidebar. Page IDs and content IDs are separate sequences, so the
 * segment name is what keeps the two from colliding.
 */
export function pageKeyphraseKey(guid: string, locale: string, pageID: number): string {
	return `${guid.toLowerCase()}-${locale.toLowerCase()}-page-${pageID}`
}

export class KeyphraseStoreNotConfiguredError extends Error {
	constructor() {
		super(
			"Keyphrase store is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN " +
				"(or KV_REST_API_URL / KV_REST_API_TOKEN, as Vercel's Upstash integration does)."
		)
		this.name = "KeyphraseStoreNotConfiguredError"
	}
}

class UpstashKeyphraseStore implements KeyphraseStore {
	constructor(private readonly redis: Redis) {}

	async get(key: string) {
		return (await this.redis.get<StoredKeyphrase>(key)) ?? null
	}

	async set(key: string, value: StoredKeyphrase) {
		await this.redis.set(key, value)
	}

	async delete(key: string) {
		await this.redis.del(key)
	}
}

/** Lost on restart. Local development only; production refuses to use it. */
class MemoryKeyphraseStore implements KeyphraseStore {
	private readonly items = new Map<string, StoredKeyphrase>()

	async get(key: string) {
		return this.items.get(key) ?? null
	}

	async set(key: string, value: StoredKeyphrase) {
		this.items.set(key, value)
	}

	async delete(key: string) {
		this.items.delete(key)
	}
}

let store: KeyphraseStore | null = null

export function getKeyphraseStore(): KeyphraseStore {
	if (store) return store

	// Vercel's Upstash integration sets KV_REST_API_*; Upstash's own console
	// gives UPSTASH_REDIS_REST_*. Accept either.
	const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
	const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN

	if (url && token) {
		store = new UpstashKeyphraseStore(new Redis({ url, token }))
		return store
	}

	if (process.env.NODE_ENV === "production") {
		throw new KeyphraseStoreNotConfiguredError()
	}

	store = new MemoryKeyphraseStore()
	return store
}
