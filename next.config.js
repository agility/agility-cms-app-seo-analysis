/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,

	/*
	 * `yoastseo` is deliberately NOT in `serverExternalPackages`, so webpack
	 * bundles it into the analyze route (~2.8MB of server code, all 22 language
	 * Researchers included). It was external once, to keep that data out of the
	 * build - but yoastseo's CommonJS build does `require("parse5")`, and parse5
	 * v8 is ESM-only. Node 20.19+/22.12+/24 allow require(esm) so that works
	 * locally, while Vercel's function loader does not: every call to
	 * /api/analyze failed at module load with ERR_REQUIRE_ESM and the sidebar
	 * showed "The analysis could not be run". Bundled, webpack handles the ESM
	 * interop and the runtime never sees the require.
	 *
	 * To check the fix locally, run the production server with require(esm) off:
	 *   NODE_OPTIONS=--no-experimental-require-module npm start
	 */

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
