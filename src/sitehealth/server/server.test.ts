import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { decrypt, encrypt, SecretNotConfiguredError } from "./crypto"
import { publicSiteUrl } from "./routes"

describe("crypto", () => {
	const previous = process.env.SITE_HEALTH_SECRET
	beforeEach(() => {
		process.env.SITE_HEALTH_SECRET = "x".repeat(40)
	})
	afterEach(() => {
		process.env.SITE_HEALTH_SECRET = previous
	})

	it("round-trips, and never stores the plain value", () => {
		const sealed = encrypt("semrush-key-123", "abc-u")
		expect(sealed).not.toContain("semrush-key-123")
		expect(decrypt(sealed, "abc-u")).toBe("semrush-key-123")
	})

	it("won't decrypt a value copied to another instance", () => {
		const sealed = encrypt("semrush-key-123", "abc-u")
		expect(() => decrypt(sealed, "other-u")).toThrow()
	})

	it("refuses to work without a strong secret", () => {
		process.env.SITE_HEALTH_SECRET = "short"
		expect(() => encrypt("k", "abc-u")).toThrow(SecretNotConfiguredError)
	})
})

describe("publicSiteUrl", () => {
	it("accepts a public https site", () => {
		expect(publicSiteUrl("https://agilitycms.com").hostname).toBe("agilitycms.com")
	})

	it.each(["http://example.com", "https://169.254.169.254", "https://10.0.0.1/x", "https://intranet", "https://db.internal", "not a url"])(
		"refuses %s",
		(value) => {
			expect(() => publicSiteUrl(value)).toThrow()
		}
	)
})
