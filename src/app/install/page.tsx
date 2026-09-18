"use client"

import { useState } from "react"
import { setExtraConfigValues, useAgilityPreInstall } from "@agility/app-sdk"

/**
 * The install screen.
 *
 * Two things about this surface are easy to get wrong, and both are silent:
 *
 * 1. It must use `useAgilityPreInstall`, NOT `useAgilityAppSDK`. The CMS mounts
 *    this in AppSetupScreenFrame, which handles exactly two operations -
 *    `preInstall` and `setExtraConfigValues`. `useAgilityAppSDK` sends
 *    `initialize`, which this surface does not implement, so the context never
 *    arrives and the screen sits initializing forever.
 *
 * 2. **The app owns the "continue" action.** While an install screen is
 *    showing, the CMS hides its own Next button (AppConfigurationPanel.tsx:
 *    `!showingInstallScreen && ...`) and waits for the app to call
 *    `setExtraConfigValues`, which is what fires its onSetupComplete and
 *    submits the install. A screen without that call is a dead end - the user
 *    gets "Go Back" and nothing else.
 *
 * The two real settings (contentSelector, defaultLocale) are declared in
 * agility-app.json and collected by the CMS's own form on the previous step, so
 * this screen gathers no extra configuration. It exists for the onboarding step
 * that is not otherwise discoverable: the app does nothing until an SEO
 * Keyphrase field is added to a content model.
 */
export default function InstallScreen() {
	const { initializing } = useAgilityPreInstall()
	const [isFinishing, setIsFinishing] = useState(false)

	const finish = () => {
		setIsFinishing(true)

		// Deliberately NOT awaited. The CMS's handler for this operation calls
		// onSetupComplete and returns void, so it never sends a reply and the
		// SDK's promise never settles. Awaiting it hangs the button forever.
		setExtraConfigValues([])
	}

	if (initializing) {
		return (
			<main className="flex h-full items-center justify-center p-6">
				<p className="text-sm text-gray-500">Loading&hellip;</p>
			</main>
		)
	}

	return (
		<main className="flex flex-col gap-4 p-6">
			<div className="flex flex-col gap-1.5">
				<h1 className="text-base font-semibold text-gray-900">One more step</h1>
				<p className="text-sm leading-6 text-gray-600">
					SEO Analysis is configured. It appears in the sidebar for content items whose
					container is a dynamic page list &mdash; but only once a model has a keyphrase field.
				</p>
			</div>

			<div className="flex flex-col gap-2.5 rounded border border-gray-200 bg-gray-50 p-4">
				<h2 className="text-sm font-semibold text-gray-900">After installing</h2>
				<ol className="flex list-decimal flex-col gap-2 pl-4 text-sm leading-6 text-gray-600">
					<li>
						Add an <strong className="font-semibold text-gray-900">SEO Keyphrase</strong> field
						to any content model whose container is a dynamic page list.
					</li>
					<li>
						Open an item in that container &mdash; the{" "}
						<strong className="font-semibold text-gray-900">SEO Analysis</strong> panel is in
						the sidebar.
					</li>
				</ol>
			</div>

			<div className="flex items-center justify-between gap-4 pt-1">
				<p className="text-xs leading-5 text-gray-500">
					This app uses the open-source YoastSEO.js library (GPL-3.0). The library runs
					on this app&rsquo;s server; your browser receives only scores and feedback text.
					Not affiliated with or endorsed by Yoast BV.
				</p>

				<button
					type="button"
					onClick={finish}
					disabled={isFinishing}
					className="shrink-0 rounded bg-violet-800 px-[17px] py-[9px] text-sm text-white transition-colors hover:bg-violet-700 disabled:bg-violet-400"
				>
					{isFinishing ? "Installing…" : "Finish setup"}
				</button>
			</div>
		</main>
	)
}
