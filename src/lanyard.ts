import { lanyardBaseUrl } from "./lanyard-url";

/**
 * fetch against lanyard with this service's own key (LANYARD_URL,
 * LANYARD_SERVICE_KEY). Throws when no key is configured, or when `path`
 * would leave lanyard's origin.
 */
export async function lanyardFetch(
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const key = process.env.LANYARD_SERVICE_KEY;
	if (!key) throw new Error("LANYARD_SERVICE_KEY is not set");
	const base = lanyardBaseUrl();
	const url = new URL(base + path);
	// ".evil.test/x" or "@evil.test/x" would send the key to another host
	if (url.origin !== new URL(base).origin) {
		throw new Error(`lanyardFetch path leaves lanyard's origin: ${path}`);
	}
	const headers = new Headers(init.headers);
	headers.set("Authorization", `ServiceKey ${key}`);
	if (init.body && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}
	try {
		return await fetch(url.href, {
			...init,
			headers,
			// the key never follows a redirect, and a redirecting LANYARD_URL fails
			// here the way it fails jose's key set fetch
			redirect: "error",
			signal: init.signal ?? AbortSignal.timeout(5_000),
		});
	} catch (err) {
		throw new Error(
			`lanyard ${url.origin}${url.pathname} failed: ${err instanceof Error ? err.message : err}`,
			{ cause: err },
		);
	}
}
