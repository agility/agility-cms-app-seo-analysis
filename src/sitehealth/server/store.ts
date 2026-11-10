import { gunzipSync, gzipSync } from "node:zlib"
import { Redis } from "@upstash/redis"

import type { ScanReport } from "../scan"

/**
 * What Site Health keeps per instance, in the same Upstash Redis as the
 * keyphrase store (see store/keyphraseStore.ts for why Redis).
 *
 * - `sitehealth:{guid}:report`: the latest scan, gzipped. A 1,700-page site's
 *   report is ~540 KB of JSON and ~40 KB gzipped, well inside Upstash's limits.
 * - `sitehealth:{guid}:semrush`: the Semrush connection. The API key is
 *   encrypted (server/crypto.ts) and never leaves the server.
 *
 * Development without Redis falls back to memory; production refuses, as the
 * keyphrase store does.
 *
 * SERVER ONLY.
 */

export interface SemrushConnection {
	projectID: number
	/** Sealed with server/crypto.ts. */
	sealedKey: string
	connectedAt: string
	/** The Agility user who connected it, for the settings screen. */
	connectedBy?: string
}

interface KV {
	get(key: string): Promise<string | null>
	set(key: string, value: string): Promise<void>
	del(key: string): Promise<void>
}

let kv: KV | null = null

function store(): KV {
	if (kv) return kv
	const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
	const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
	if (url && token) {
		// automaticDeserialization off: values are our own strings, not JSON for the client to guess at.
		const redis = new Redis({ url, token, automaticDeserialization: false })
		kv = {
			get: (k) => redis.get<string>(k),
			set: async (k, v) => void (await redis.set(k, v)),
			del: async (k) => void (await redis.del(k))
		}
		return kv
	}
	if (process.env.NODE_ENV === "production") {
		throw new Error("Site Health store is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.")
	}
	const memory = new Map<string, string>()
	kv = {
		get: async (k) => memory.get(k) ?? null,
		set: async (k, v) => void memory.set(k, v),
		del: async (k) => void memory.delete(k)
	}
	return kv
}

const reportKey = (guid: string) => `sitehealth:${guid.toLowerCase()}:report`
const semrushKey = (guid: string) => `sitehealth:${guid.toLowerCase()}:semrush`

export async function saveReport(guid: string, report: ScanReport): Promise<void> {
	await store().set(reportKey(guid), gzipSync(JSON.stringify(report)).toString("base64"))
}

export async function loadReport(guid: string): Promise<ScanReport | null> {
	const raw = await store().get(reportKey(guid))
	return raw ? (JSON.parse(gunzipSync(Buffer.from(raw, "base64")).toString("utf8")) as ScanReport) : null
}

export async function saveSemrush(guid: string, connection: SemrushConnection): Promise<void> {
	await store().set(semrushKey(guid), JSON.stringify(connection))
}

export async function loadSemrush(guid: string): Promise<SemrushConnection | null> {
	const raw = await store().get(semrushKey(guid))
	return raw ? (JSON.parse(raw) as SemrushConnection) : null
}

export async function deleteSemrush(guid: string): Promise<void> {
	await store().del(semrushKey(guid))
}
