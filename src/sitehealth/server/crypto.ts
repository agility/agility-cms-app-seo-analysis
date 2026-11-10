import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

/**
 * Encrypts vendor credentials (a customer's Semrush API key) before they are stored.
 *
 * AES-256-GCM with a key derived from SITE_HEALTH_SECRET, an app-wide secret set
 * on the deployment. The stored value is useless without it, so a leaked Redis
 * snapshot does not leak customers' keys. The instance guid is bound in as
 * additional data, so a value copied to another instance's record won't decrypt.
 *
 * SERVER ONLY.
 */

export class SecretNotConfiguredError extends Error {
	constructor() {
		super("SITE_HEALTH_SECRET is not set; vendor credentials cannot be stored.")
		this.name = "SecretNotConfiguredError"
	}
}

function key(): Buffer {
	const secret = process.env.SITE_HEALTH_SECRET
	if (!secret || secret.length < 32) throw new SecretNotConfiguredError()
	return createHash("sha256").update(secret).digest()
}

export function encrypt(plain: string, guid: string): string {
	const iv = randomBytes(12)
	const cipher = createCipheriv("aes-256-gcm", key(), iv)
	cipher.setAAD(Buffer.from(guid.toLowerCase()))
	const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
	return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".")
}

export function decrypt(sealed: string, guid: string): string {
	const [version, iv, tag, body] = sealed.split(".")
	if (version !== "v1" || !iv || !tag || !body) throw new Error("Unrecognised sealed value.")
	const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"))
	decipher.setAAD(Buffer.from(guid.toLowerCase()))
	decipher.setAuthTag(Buffer.from(tag, "base64url"))
	return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8")
}
