import { NextResponse } from "next/server"

import { SemrushClient, SemrushError } from "@/sitehealth/semrush"
import { decrypt, encrypt } from "@/sitehealth/server/crypto"
import { withInstance } from "@/sitehealth/server/routes"
import { deleteSemrush, loadSemrush, saveSemrush } from "@/sitehealth/server/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Body = {
	action?: "status" | "connect" | "disconnect" | "launch"
	apiKey?: string
	projectID?: number
	userName?: string
}

/**
 * The instance's Semrush connection.
 *
 * - status: whether Semrush is connected, which project, its latest audit. Never the key.
 * - connect: { apiKey, projectID }. The key is tried against the project first,
 *   then encrypted and stored. It is never sent back.
 * - disconnect: forgets the key.
 * - launch: starts a Semrush Site Audit crawl now (100 of the customer's API units).
 *
 * The UI shows connect/disconnect only to users with Manage permission.
 * TODO: check that permission here too, once the Management API offers a
 * current-user call the app can make with the user's token.
 */
export async function POST(request: Request) {
	return withInstance<Body>(request, async (body, auth) => {
		switch (body.action) {
			case "connect": {
				const apiKey = body.apiKey?.trim()
				const projectID = Number(body.projectID)
				if (!apiKey || !Number.isInteger(projectID) || projectID <= 0) {
					return NextResponse.json({ error: "An API key and a Semrush project ID are needed." }, { status: 400 })
				}
				try {
					const info = await new SemrushClient(apiKey, projectID).info()
					await saveSemrush(auth.guid, {
						projectID,
						sealedKey: encrypt(apiKey, auth.guid),
						connectedAt: new Date().toISOString(),
						connectedBy: body.userName
					})
					return NextResponse.json({ connected: true, projectID, site: info.url, status: info.status })
				} catch (error) {
					if (error instanceof SemrushError) {
						return NextResponse.json({ error: "Semrush rejected that key or project ID." }, { status: 400 })
					}
					throw error
				}
			}

			case "disconnect":
				await deleteSemrush(auth.guid)
				return NextResponse.json({ connected: false })

			case "launch": {
				const connection = await loadSemrush(auth.guid)
				if (!connection) return NextResponse.json({ error: "Semrush is not connected." }, { status: 409 })
				const snapshotID = await new SemrushClient(decrypt(connection.sealedKey, auth.guid), connection.projectID).launch()
				return NextResponse.json({ launched: true, snapshotID })
			}

			case "status":
			default: {
				const connection = await loadSemrush(auth.guid)
				if (!connection) return NextResponse.json({ connected: false })
				try {
					const info = await new SemrushClient(decrypt(connection.sealedKey, auth.guid), connection.projectID).info()
					return NextResponse.json({
						connected: true,
						projectID: connection.projectID,
						connectedAt: connection.connectedAt,
						connectedBy: connection.connectedBy ?? null,
						site: info.url,
						status: info.status,
						health: info.current_snapshot?.quality?.value ?? null,
						lastCrawl: info.current_snapshot?.finish_date ?? null
					})
				} catch (error) {
					if (error instanceof SemrushError) {
						return NextResponse.json({ connected: true, projectID: connection.projectID, error: "Semrush rejected the stored key." })
					}
					throw error
				}
			}
		}
	})
}
