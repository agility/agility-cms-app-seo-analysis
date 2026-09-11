/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,

	/*
	 * `yoastseo` stays out of the bundle and is resolved by Node at runtime.
	 * Two reasons: researcher.ts resolves a language Researcher by computed path
	 * (which webpack cannot statically analyze - it warns "the request of a
	 * dependency is an expression" and bundles every language to be safe), and
	 * the package is ~2.4MB of language data that has no business in a build.
	 */
	serverExternalPackages: ["yoastseo"],

	/*
	 * The whole app renders inside an iframe in the Agility manager, so nothing
	 * here may send X-Frame-Options or a restrictive frame-ancestors. This is
	 * the reminder not to add one.
	 */
	async headers() {
		return [
			{
				// Fetched cross-origin by Agility's own API when it reads the manifest.
				source: "/.well-known/agility-app.json",
				headers: [{ key: "Access-Control-Allow-Origin", value: "*" }]
			}
		]
	}

	/*
	 * NOTE: the @agility/app-sdk README suggests aliasing react/react-dom to
	 * this package's node_modules. Do NOT do that here. It is a fix for a
	 * duplicate React introduced by `yarn link` during SDK development, and on a
	 * normal install it instead overrides the React that Next's App Router
	 * server runtime resolves for itself - which fails at build with
	 * "(0, d.cache) is not a function".
	 */
}

module.exports = nextConfig
