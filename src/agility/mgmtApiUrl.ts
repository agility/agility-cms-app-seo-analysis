/**
 * Resolves which regional Management API to talk to.
 *
 * Agility runs one manager and one Management API per region, and an instance
 * in Canada cannot be reached through the US host. The App SDK's context does
 * not carry the manager URL (IInstance is just {guid, websiteName}), so this
 * derives it the only way an iframe can: from the parent that embedded us.
 *
 * The region mapping is ported from the manager's own getMgmtAPIUrl.ts. Keep it
 * in step if Agility adds a region.
 */

const US_PROD = "https://mgmt.aglty.io"

const REGIONS: { match: string; mgmtUrl: string }[] = [
	{ match: "manager-dev", mgmtUrl: "https://mgmt-dev.aglty.io" },
	{ match: "manager-qa", mgmtUrl: "https://mgmt-dev.aglty.io" },
	{ match: "manager-ca", mgmtUrl: "https://mgmt-ca.aglty.io" },
	{ match: "manager-eu", mgmtUrl: "https://mgmt-eu.aglty.io" },
	{ match: "manager-aus", mgmtUrl: "https://mgmt-aus.aglty.io" },
	{ match: "manager-us2", mgmtUrl: "https://mgmt-usa2.aglty.io" }
]

/**
 * The Management API base for the manager currently hosting this iframe.
 *
 * `document.referrer` is the embedding manager's URL. An explicit env override
 * exists for local development, where the app may be opened directly rather
 * than through the CMS.
 */
export function resolveManagementApiUrl(): string {
	const override = process.env.NEXT_PUBLIC_AGILITY_MGMT_API_URL
	if (override) return override.replace(/\/+$/, "")

	if (typeof document === "undefined") return US_PROD

	const referrer = document.referrer
	if (!referrer) return US_PROD

	const region = REGIONS.find(({ match }) => referrer.includes(match))
	return region ? region.mgmtUrl : US_PROD
}
