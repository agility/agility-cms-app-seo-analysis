/**
 * Who may call the Site Health routes.
 *
 * The browser sends the user's Management API token (from the App SDK) with
 * the instance guid and the regional Management API base. Before a route reads
 * or writes anything stored for an instance, it checks that the token really
 * opens that instance, by asking the Management API for its locales.
 *
 * The Management API base comes from the browser, so it is checked against
 * Agility's own regional hosts first. Otherwise the route would send the
 * token, and make requests, to any host a caller named.
 */

const MGMT_HOSTS = new Set([
	"mgmt.aglty.io",
	"mgmt-dev.aglty.io",
	"mgmt-ca.aglty.io",
	"mgmt-eu.aglty.io",
	"mgmt-aus.aglty.io",
	"mgmt-usa2.aglty.io"
])

export interface InstanceAuth {
	mgmtApiUrl: string
	token: string
	guid: string
}

export class AuthError extends Error {
	constructor(message: string, readonly status: 400 | 401 | 403) {
		super(message)
		this.name = "AuthError"
	}
}

/** Throws AuthError unless the token opens the instance on an Agility Management API host. */
export async function verifyInstanceAccess(auth: Partial<InstanceAuth>): Promise<InstanceAuth> {
	const { mgmtApiUrl, token, guid } = auth
	if (!mgmtApiUrl || !token || !guid) throw new AuthError("Missing mgmtApiUrl, token or guid.", 400)
	if (!/^[a-z0-9-]{4,40}$/i.test(guid)) throw new AuthError("Invalid instance guid.", 400)

	let base: URL
	try {
		base = new URL(mgmtApiUrl)
	} catch {
		throw new AuthError("Invalid Management API URL.", 400)
	}
	if (base.protocol !== "https:" || !MGMT_HOSTS.has(base.hostname)) {
		throw new AuthError("Not an Agility Management API host.", 400)
	}

	const res = await fetch(`${base.origin}/api/v1/instance/${encodeURIComponent(guid)}/locales`, {
		headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
		cache: "no-store"
	})
	if (res.status === 401) throw new AuthError("The token is not valid.", 401)
	if (!res.ok) throw new AuthError("The token does not open this instance.", 403)

	return { mgmtApiUrl: base.origin, token, guid: guid.toLowerCase() }
}
