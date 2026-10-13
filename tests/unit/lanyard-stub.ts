import { exportJWK, generateKeyPair, type JWK, SignJWT } from "jose";
import { vi } from "vitest";

export const LANYARD = "http://lanyard.test";
export const SERVICE_KEY = "sk_svc_stub";

export interface SigningKey {
	kid: string;
	privateKey: CryptoKey;
	jwk: JWK;
}

export async function makeKey(kid: string): Promise<SigningKey> {
	const pair = await generateKeyPair("ES256", { extractable: true });
	return {
		kid,
		privateKey: pair.privateKey,
		jwk: {
			...(await exportJWK(pair.publicKey)),
			kid,
			alg: "ES256",
			use: "sig",
		},
	};
}

export interface Lanyard {
	slug: string;
	meStatus: number;
	jwksStatus: number;
	jwksError?: unknown;
	keys: JWK[];
	token: { status: number; body: unknown };
	calls: string[];
}

/** Answers lanyard's service-facing endpoints through a stubbed fetch. */
export function stubLanyard(overrides: Partial<Lanyard> = {}): Lanyard {
	const lanyard: Lanyard = {
		slug: "guidebook",
		meStatus: 200,
		jwksStatus: 200,
		keys: [],
		token: { status: 200, body: { token: "service-proof", expiresIn: 60 } },
		calls: [],
		...overrides,
	};
	vi.stubEnv("LANYARD_URL", LANYARD);
	vi.stubEnv("LANYARD_SERVICE_KEY", SERVICE_KEY);
	vi.stubGlobal(
		"fetch",
		async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			const method = init?.method ?? "GET";
			const path = url.replace(LANYARD, "");
			lanyard.calls.push(
				`${method} ${path}${typeof init?.body === "string" ? ` ${init.body}` : ""}`,
			);
			const keyed =
				new Headers(init?.headers).get("authorization") ===
				`ServiceKey ${SERVICE_KEY}`;
			if (path === "/.well-known/jwks.json") {
				if (lanyard.jwksError) throw lanyard.jwksError;
				return Response.json(
					{ keys: lanyard.keys },
					{ status: lanyard.jwksStatus },
				);
			}
			if (!keyed)
				return Response.json({ error: "Unauthorized" }, { status: 401 });
			if (path === "/api/services/me") {
				return Response.json(
					{ id: "svc-id", slug: lanyard.slug, name: "Svc" },
					{ status: lanyard.meStatus },
				);
			}
			if (path === "/api/services/token" && method === "POST") {
				return Response.json(lanyard.token.body, {
					status: lanyard.token.status,
				});
			}
			throw new Error(`unexpected fetch: ${method} ${url}`);
		},
	);
	return lanyard;
}

export async function sign(
	key: { kid: string; privateKey: CryptoKey },
	options: {
		typ?: string;
		aud?: string;
		sub?: string;
		exp?: number;
		claims?: Record<string, unknown>;
	} = {},
): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const typ = options.typ ?? "convstack-user+jwt";
	const service = typ === "convstack-service+jwt";
	const claims =
		options.claims ??
		(service
			? { scope: ["ledger:invoices:create"] }
			: {
					name: "Ada",
					email: "ada@x.dev",
					perms: ["guidebook:pages:read"],
					orgs: [
						{
							orgId: "o1",
							name: "Stage Crew",
							slug: "stage-crew",
							role: "admin",
						},
					],
				});
	return new SignJWT(claims)
		.setProtectedHeader({ alg: "ES256", kid: key.kid, typ })
		.setIssuer("lanyard")
		.setAudience(options.aud ?? "guidebook")
		.setSubject(options.sub ?? (service ? "service:schedule" : "user-1"))
		.setIssuedAt(now)
		.setExpirationTime(options.exp ?? now + 60)
		.sign(key.privateKey);
}

export function withProof(token: string): Request {
	return new Request("http://svc.test/api/x", {
		headers: { Authorization: `Bearer ${token}` },
	});
}
