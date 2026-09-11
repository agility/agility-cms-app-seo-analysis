/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			fontFamily: {
				// Matches the Agility manager app. The face is not served by this
				// app, but the CMS shell loads it and the iframe inherits nothing,
				// so the fallback stack is what actually renders in most installs.
				sans: ["TTInterphasesPro", "system-ui", "-apple-system", "Segoe UI", "sans-serif"]
			},
			fontSize: {
				"2xs": ["0.625rem", "0.875rem"],
				xs: ["0.75rem", "1rem"],
				sm: ["0.875rem", "1.25rem"]
			},
			colors: {
				// Lifted from agility-cms-manager-app-react/tailwind.config.cjs so the
				// app is the same color as the panel it renders inside.
				gray: {
					50: "#F9FAFB",
					100: "#F3F4F6",
					200: "#E5E7EB",
					300: "#D1D5DB",
					400: "#9CA3AF",
					500: "#6B7280",
					600: "#4B5563",
					700: "#374151",
					900: "#111827"
				},
				violet: {
					400: "#A78BFA",
					700: "#6D28D9",
					800: "#5B21B6"
				},
				purple: {
					50: "#EEE6FB",
					100: "#DECCF6",
					400: "#9B66E5",
					700: "#5800D4"
				},
				red: { 50: "#FEF2F2", 500: "#EF4444", 600: "#DC2626", 700: "#B91C1C" },
				orange: { 50: "#FFF7ED", 500: "#F97316", 600: "#EA580C", 700: "#C2410C" },
				green: { 50: "#ECFDF5", 500: "#10B981", 600: "#059669", 700: "#047857" }
			},
			letterSpacing: {
				label: "-0.28px",
				body: "-0.24px",
				tiny: "-0.2px"
			},
			keyframes: {
				pulseSoft: {
					"0%, 100%": { opacity: "1" },
					"50%": { opacity: "0.45" }
				}
			},
			animation: {
				pulseSoft: "pulseSoft 1.6s ease-in-out infinite"
			}
		}
	},
	plugins: []
}
