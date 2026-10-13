import { lanyardFetch } from "./lanyard";

const tokens = new Map<string, { token: string; renewAt: number }>();
const pending = new Map<string, Promise<string>>();

/**
 * A proof lanyard signs for calls from this service to `audience`, reused
 * until 10 seconds before it expires. Throws when lanyard refuses, for
 * example because no admin granted this service anything on the target.
 */
export async function getServiceToken(audience: string): Promise<string> {
	const cached = tokens.get(audience);
	if (cached && Date.now() < cached.renewAt) return cached.token;

	let request = pending.get(audience);
	if (!request) {
		request = requestToken(audience).finally(() => pending.delete(audience));
		pending.set(audience, request);
	}
	return request;
}

async function requestToken(audience: string): Promise<string> {
	const res = await lanyardFetch("/api/services/token", {
		method: "POST",
		body: JSON.stringify({ audience }),
	});
	if (!res.ok) {
		throw new Error(
			`lanyard /api/services/token answered ${res.status} for ${audience}`,
		);
	}
	const { token, expiresIn } = (await res.json()) as {
		token?: unknown;
		expiresIn?: unknown;
	};
	if (typeof token !== "string" || typeof expiresIn !== "number") {
		throw new Error("lanyard /api/services/token sent no token");
	}
	tokens.set(audience, {
		token,
		renewAt: Date.now() + (expiresIn - 10) * 1000,
	});
	return token;
}
