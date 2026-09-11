/**
 * Not a surface the CMS ever loads - Agility only requests the specific routes
 * declared in agility-app.json. This exists so that opening the app's base URL
 * in a browser explains what it is instead of 404ing.
 */
export default function HomePage() {
	return (
		<main className="mx-auto flex max-w-xl flex-col gap-4 p-10">
			<h1 className="text-xl font-semibold text-gray-900">SEO Analysis for Agility CMS</h1>
			<p className="text-sm leading-6 text-gray-600">
				This is an Agility CMS app. It has no interface of its own &mdash; install it on an
				Agility instance and it renders in the content item sidebar.
			</p>
			<p className="text-sm leading-6 text-gray-600">
				Analysis is powered by{" "}
				<a href="https://github.com/Yoast/wordpress-seo" className="text-purple-700 underline">
					YoastSEO.js
				</a>
				, the open-source engine behind Yoast SEO for WordPress.
			</p>
			<p className="text-xs leading-5 text-gray-500">
				Register this URL as an app in Agility, without a trailing slash.
			</p>
		</main>
	)
}
