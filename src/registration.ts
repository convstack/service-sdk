/**
 * Service self-registration via Lanyard heartbeat.
 */

import type { UIManifest } from "./types";

export interface RegisterServiceOptions {
	/** The UI manifest to send to Lanyard. */
	manifest: UIManifest;
	/** Lanyard URL. Defaults to LANYARD_URL env var or http://localhost:3000. */
	lanyardUrl?: string;
	/** ServiceKey for authentication. Defaults to LANYARD_SERVICE_KEY env var. */
	serviceKey?: string;
}

/**
 * Register a service with Lanyard by sending a heartbeat with the UI manifest.
 * Call this on service startup.
 */
export async function registerService(
	options: RegisterServiceOptions,
): Promise<void> {
	const lanyardUrl =
		options.lanyardUrl || process.env.LANYARD_URL || "http://localhost:3000";
	const serviceKey = options.serviceKey || process.env.LANYARD_SERVICE_KEY;

	if (!serviceKey) {
		console.warn("LANYARD_SERVICE_KEY not set — skipping registration");
		return;
	}

	try {
		const response = await fetch(`${lanyardUrl}/api/services/heartbeat`, {
			method: "POST",
			headers: {
				Authorization: `ServiceKey ${serviceKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				status: "healthy",
				uiManifest: options.manifest,
			}),
		});

		if (response.ok) {
			console.log(`${options.manifest.name} registered with Lanyard`);
		} else {
			const text = await response.text();
			console.warn(`Registration failed (${response.status}): ${text}`);
		}
	} catch (error) {
		console.warn("Failed to register with Lanyard:", error);
	}
}

/**
 * Factory that returns a self-register function for use with devInitPlugin.
 * Replaces the hand-rolled self-register.ts every service currently has.
 *
 * Usage:
 * ```ts
 * import { createSelfRegister } from "@convstack/service-sdk/registration";
 * import { MY_MANIFEST } from "~/lib/manifest";
 * export const registerMyService = createSelfRegister(MY_MANIFEST);
 * ```
 */
export function createSelfRegister(manifest: UIManifest): () => Promise<void> {
	return async function selfRegister() {
		const LANYARD_URL = process.env.LANYARD_URL ?? "http://localhost:3000";
		const SERVICE_KEY = process.env.LANYARD_SERVICE_KEY;
		if (!SERVICE_KEY) {
			console.warn(
				`[${manifest.name}] LANYARD_SERVICE_KEY missing — skipping self-register`,
			);
			return;
		}
		try {
			const response = await fetch(`${LANYARD_URL}/api/services/heartbeat`, {
				method: "POST",
				headers: {
					Authorization: `ServiceKey ${SERVICE_KEY}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					status: "healthy",
					uiManifest: manifest,
				}),
			});
			if (!response.ok) {
				console.warn(
					`[${manifest.name}] self-register failed:`,
					await response.text(),
				);
			} else {
				console.log(`[${manifest.name}] registered with lanyard`);
			}
		} catch (err) {
			console.warn(`[${manifest.name}] self-register error:`, err);
		}
	};
}
