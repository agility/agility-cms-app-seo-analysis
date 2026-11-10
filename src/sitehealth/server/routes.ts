import { NextResponse } from "next/server"

import { AuthError, verifyInstanceAccess, type InstanceAuth } from "./auth"
import { SecretNotConfiguredError } from "./crypto"

/**
 * Plumbing the Site Health routes share: parse the body, check the caller can
 * open the instance, turn known errors into the right status.
 */

export async function withInstance<B extends object>(
	request: Request,
	handler: (body: B & Partial<InstanceAuth>, auth: InstanceAuth) => Promise<Response>
): Promise<Response> {
	let body: B & Partial<InstanceAuth>
	try {
		body = await request.json()
	} catch {
		return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 })
	}
	try {
		const auth = await verifyInstanceAccess(body)
		return await handler(body, auth)
	} catch (error) {
		if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status })
		if (error instanceof SecretNotConfiguredError) {
			console.error("[site-health]", error.message)
			return NextResponse.json({ error: "site-health-secret-not-configured" }, { status: 503 })
		}
		console.error("[site-health]", error)
		return NextResponse.json({ error: (error as Error).message ?? "site-health-failed" }, { status: 500 })
	}
}

/**
 * A site URL the app may fetch: https (http only on localhost in development),
 * a real host name, never a bare IP or an internal name. The scan follows the
 * customer's sitemap; this stops it being pointed at an internal address.
 */
export function publicSiteUrl(value: unknown): URL {
	let url: URL
	try {
		url = new URL(String(value))
	} catch {
		throw new AuthError("Invalid site URL.", 400)
	}
	const local = url.hostname === "localhost" && process.env.NODE_ENV !== "production"
	if (!local) {
		if (url.protocol !== "https:") throw new AuthError("The site URL must use https.", 400)
		if (/^[\d.]+$/.test(url.hostname) || url.hostname.includes(":") || !url.hostname.includes(".")) {
			throw new AuthError("The site URL must be a public host name.", 400)
		}
		if (/(^|\.)(local|internal|localhost)$/.test(url.hostname)) throw new AuthError("The site URL must be a public host name.", 400)
	}
	return url
}
