/**
 * Service self-registration via Lanyard heartbeat.
 */

import { lanyardBaseUrl } from "./lanyard-url";
import type { UIManifest } from "./types";

export interface RegisterServiceOptions {
	/** The UI manifest to send to Lanyard. */
	manifest: UIManifest;
	/** Lanyard URL. Defaults to LANYARD_URL env var or http://localhost:3000. */
	lanyardUrl?: string;
	/** ServiceKey for authentication. Defaults to LANYARD_SERVICE_KEY env var. */
	serviceKey?: string;
}

const NO_KEY =
	"LANYARD_SERVICE_KEY is not set: not registering, and every request will be answered 503 until it is";

// the heartbeat carries the service key: it never follows a redirect, and
// a lanyard that doesn't answer doesn't hold startup forever
function heartbeat(
	lanyardUrl: string,
	serviceKey: string,
	manifest: UIManifest,
) {
	return fetch(`${lanyardUrl}/api/services/heartbeat`, {
		method: "POST",
		headers: {
			Authorization: `ServiceKey ${serviceKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ status: "healthy", uiManifest: manifest }),
		redirect: "error",
		signal: AbortSignal.timeout(5_000),
	});
}

// lanyard's own words help, the key must never be among them
async function refusal(response: Response, serviceKey: string) {
	const text = (await response.text()).replaceAll(serviceKey, "<service key>");
	return `(${response.status}): ${text}`;
}

/** Lanyard still answers 200 when it ignores a manifest that doesn't validate. */
async function warnAboutIgnoredManifest(
	name: string,
	response: Response,
): Promise<boolean> {
	const body = (await response.json().catch(() => null)) as {
		manifestIssues?: string[];
	} | null;
	if (!body?.manifestIssues?.length) return false;
	console.warn(
		`[${name}] lanyard ignored the manifest:\n  ${body.manifestIssues.join("\n  ")}`,
	);
	return true;
}

/**
 * Register a service with Lanyard by sending a heartbeat with the UI manifest.
 * Call this on service startup.
 */
export async function registerService(
	options: RegisterServiceOptions,
): Promise<void> {
	const lanyardUrl = lanyardBaseUrl(options.lanyardUrl);
	const serviceKey = options.serviceKey || process.env.LANYARD_SERVICE_KEY;

	if (!serviceKey) {
		console.warn(NO_KEY);
		return;
	}

	try {
		const response = await heartbeat(lanyardUrl, serviceKey, options.manifest);

		if (response.ok) {
			if (!(await warnAboutIgnoredManifest(options.manifest.name, response))) {
				console.log(`${options.manifest.name} registered with Lanyard`);
			}
		} else {
			console.warn(
				`Registration failed ${await refusal(response, serviceKey)}`,
			);
		}
	} catch (error) {
		console.warn(
			"Failed to register with Lanyard:",
			error instanceof Error ? error.message : error,
		);
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
		const LANYARD_URL = lanyardBaseUrl();
		const SERVICE_KEY = process.env.LANYARD_SERVICE_KEY;
		if (!SERVICE_KEY) {
			console.warn(`[${manifest.name}] ${NO_KEY}`);
			return;
		}
		try {
			const response = await heartbeat(LANYARD_URL, SERVICE_KEY, manifest);
			if (!response.ok) {
				console.warn(
					`[${manifest.name}] self-register failed ${await refusal(response, SERVICE_KEY)}`,
				);
			} else if (!(await warnAboutIgnoredManifest(manifest.name, response))) {
				console.log(`[${manifest.name}] registered with lanyard`);
			}
		} catch (err) {
			console.warn(
				`[${manifest.name}] self-register error:`,
				err instanceof Error ? err.message : err,
			);
		}
	};
}
