import type { Metadata } from "next"

import "./globals.css"

export const metadata: Metadata = {
	title: "SEO Analysis",
	description: "SEO and readability analysis for Agility CMS.",
	robots: { index: false, follow: false }
}

/**
 * Every surface of this app renders inside an iframe in the Agility manager,
 * so the document deliberately has no chrome of its own - no page background,
 * no container, no max width. The CMS panel is the frame.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body className="font-sans text-gray-900 antialiased">{children}</body>
		</html>
	)
}
