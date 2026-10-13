import { generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	makeKey,
	type SigningKey,
	sign,
	stubLanyard,
	withProof,
} from "./lanyard-stub";

const unauthorized = { ok: false, status: 401, error: "Unauthorized" };
const unavailable = { ok: false, status: 503, error: "Service unavailable" };
let key: SigningKey;

beforeEach(async () => {
	vi.resetModules();
	key = await makeKey("k1");
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

async function check(request: Request) {
	const { checkProof } = await import("../../src/proof");
	return checkProof(request);
}

const now = () => Math.floor(Date.now() / 1000);

const USER_PROOF = "convstack-user+jwt";
const userClaims = {
	sub: "user-1",
	name: "Ada",
	email: "ada@x.dev",
	perms: [],
	orgs: [],
};

// the claims lanyard always sets; a test overrides one, or drops it with undefined
const lanyardClaims = (over: Record<string, unknown>) => ({
	iss: "lanyard",
	aud: "guidebook",
	iat: now(),
	exp: now() + 60,
	...over,
});

// lanyard's key over exactly this typ and these claims
function signAs(typ: string | undefined, claims: Record<string, unknown>) {
	return new SignJWT(claims)
		.setProtectedHeader({ alg: "ES256", kid: key.kid, typ })
		.sign(key.privateKey);
}

describe("checkProof", () => {
	it("accepts a user proof lanyard signed for this service", async () => {
		stubLanyard({ keys: [key.jwk] });
		expect(await check(withProof(await sign(key)))).toEqual({
			ok: true,
			principal: {
				kind: "user",
				user: {
					id: "user-1",
					name: "Ada",
					email: "ada@x.dev",
					permissions: ["guidebook:pages:read"],
					orgRoles: [
						{
							orgId: "o1",
							name: "Stage Crew",
							slug: "stage-crew",
							role: "admin",
						},
					],
				},
			},
		});
	});

	it("accepts a service proof and names the caller", async () => {
		stubLanyard({ keys: [key.jwk] });
		const token = await sign(key, { typ: "convstack-service+jwt" });
		expect(await check(withProof(token))).toEqual({
			ok: true,
			principal: {
				kind: "service",
				caller: { slug: "schedule", scope: ["ledger:invoices:create"] },
			},
		});
	});

	it("refuses a proof made out to another service", async () => {
		stubLanyard({ keys: [key.jwk] });
		expect(await check(withProof(await sign(key, { aud: "ledger" })))).toEqual(
			unauthorized,
		);
	});

	it("allows 30 seconds of clock skew past exp", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.spyOn(console, "error").mockImplementation(() => {});
		stubLanyard({ keys: [key.jwk] });
		// signed the way lanyard signs: exp is iat + 60
		const expiredAgo = (s: number) =>
			signAs(
				USER_PROOF,
				lanyardClaims({ ...userClaims, iat: now() - 60 - s, exp: now() - s }),
			);

		expect((await check(withProof(await expiredAgo(29)))).ok).toBe(true);
		expect(await check(withProof(await expiredAgo(31)))).toEqual(unauthorized);
	});

	it("allows an iat up to 30 seconds ahead of this host's clock", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.spyOn(console, "error").mockImplementation(() => {});
		stubLanyard({ keys: [key.jwk] });
		const issuedAhead = (s: number) =>
			signAs(
				USER_PROOF,
				lanyardClaims({ ...userClaims, iat: now() + s, exp: now() + s + 60 }),
			);

		expect((await check(withProof(await issuedAhead(29)))).ok).toBe(true);
		expect(await check(withProof(await issuedAhead(31)))).toEqual(unauthorized);
	});

	it("refuses a proof issued more than 90 seconds ago, whatever its exp says", async () => {
		stubLanyard({ keys: [key.jwk] });
		const old = lanyardClaims({
			...userClaims,
			iat: now() - 120,
			exp: now() + 3600,
		});
		expect(await check(withProof(await signAs(USER_PROOF, old)))).toEqual(
			unauthorized,
		);
	});

	it("refuses the wrong typ", async () => {
		stubLanyard({ keys: [key.jwk] });
		expect(await check(withProof(await sign(key, { typ: "JWT" })))).toEqual(
			unauthorized,
		);
		const userClaimsAsService = await sign(key, {
			typ: "convstack-service+jwt",
			sub: "user-1",
			claims: { perms: ["ledger:manage"] },
		});
		expect(await check(withProof(userClaimsAsService))).toEqual(unauthorized);
	});

	it("refuses service claims under typ JWT or without a typ", async () => {
		stubLanyard({ keys: [key.jwk] });
		const service = lanyardClaims({
			sub: "service:schedule",
			scope: ["ledger:invoices:create"],
		});

		expect(await check(withProof(await signAs("JWT", service)))).toEqual(
			unauthorized,
		);
		expect(await check(withProof(await signAs(undefined, service)))).toEqual(
			unauthorized,
		);
	});

	it("refuses a proof without exp or without iat", async () => {
		stubLanyard({ keys: [key.jwk] });
		const noExp = lanyardClaims({ ...userClaims, exp: undefined });
		const noIat = lanyardClaims({ ...userClaims, iat: undefined });

		expect(await check(withProof(await signAs(USER_PROOF, noExp)))).toEqual(
			unauthorized,
		);
		expect(await check(withProof(await signAs(USER_PROOF, noIat)))).toEqual(
			unauthorized,
		);
	});

	it("refuses another issuer's proof, even with lanyard's typ, kid and aud", async () => {
		stubLanyard({ keys: [key.jwk] });
		const authentik = lanyardClaims({
			...userClaims,
			iss: "http://localhost:9000/application/o/convstack/",
		});
		expect(await check(withProof(await signAs(USER_PROOF, authentik)))).toEqual(
			unauthorized,
		);
	});

	it("refuses a signature from another key under the same kid", async () => {
		stubLanyard({ keys: [key.jwk] });
		const impostor = await makeKey("k1");
		expect(await check(withProof(await sign(impostor)))).toEqual(unauthorized);
	});

	it("refuses an Authentik access token", async () => {
		stubLanyard({ keys: [key.jwk] });
		const authentik = await generateKeyPair("RS256");
		const token = await new SignJWT({
			azp: "convstack-dashboard",
			scope: "openid profile email",
		})
			.setProtectedHeader({ alg: "RS256", kid: "authentik", typ: "JWT" })
			.setIssuer("http://localhost:9000/application/o/convstack/")
			.setAudience("guidebook")
			.setSubject("user-1")
			.setIssuedAt()
			.setExpirationTime("5m")
			.sign(authentik.privateKey);
		expect(await check(withProof(token))).toEqual(unauthorized);
	});

	it("refuses a request without a proof, without asking lanyard", async () => {
		const lanyard = stubLanyard({ keys: [key.jwk] });
		expect(await check(new Request("http://svc.test/api/x"))).toEqual(
			unauthorized,
		);
		expect(lanyard.calls).toEqual([]);
	});

	it("refuses X-User-* headers alone", async () => {
		stubLanyard({ keys: [key.jwk] });
		const forged = new Request("http://svc.test/api/x", {
			headers: {
				"X-User-Id": "user-1",
				"X-User-Permissions": "guidebook:admin",
				"X-User-Org-Roles": JSON.stringify([
					{ orgId: "o1", slug: "stage-crew", role: "admin" },
				]),
			},
		});
		expect(await check(forged)).toEqual(unauthorized);
	});

	it("asks lanyard for its slug once, however many requests arrive together", async () => {
		const lanyard = stubLanyard({ keys: [key.jwk] });
		const token = await sign(key);

		const results = await Promise.all(
			Array.from({ length: 5 }, () => check(withProof(token))),
		);

		expect(results.every((r) => r.ok)).toBe(true);
		expect(
			lanyard.calls.filter((c) => c === "GET /api/services/me"),
		).toHaveLength(1);
	});

	it("keeps the slug for later requests", async () => {
		const lanyard = stubLanyard({ keys: [key.jwk] });

		expect((await check(withProof(await sign(key)))).ok).toBe(true);
		expect((await check(withProof(await sign(key)))).ok).toBe(true);

		expect(
			lanyard.calls.filter((c) => c === "GET /api/services/me"),
		).toHaveLength(1);
	});

	it("uses the slug lanyard reports, not the code's name", async () => {
		stubLanyard({ keys: [key.jwk], slug: "wiki" });
		expect((await check(withProof(await sign(key, { aud: "wiki" })))).ok).toBe(
			true,
		);
		expect(
			await check(withProof(await sign(key, { aud: "guidebook" }))),
		).toEqual(unauthorized);
	});

	it("answers 503 while lanyard can't name the service, then recovers", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		const lanyard = stubLanyard({ keys: [key.jwk], meStatus: 500 });

		expect(await check(withProof(await sign(key)))).toEqual(unavailable);
		expect(errors).toHaveBeenCalledWith(
			"[service-sdk] refusing requests until lanyard names this service:",
			"lanyard /api/services/me answered 500",
		);

		lanyard.meStatus = 200;
		expect(await check(withProof(await sign(key)))).toEqual(unavailable);
		vi.setSystemTime(Date.now() + 11_000);
		expect((await check(withProof(await sign(key)))).ok).toBe(true);
		expect(
			lanyard.calls.filter((c) => c === "GET /api/services/me"),
		).toHaveLength(2);
	});

	it("answers 503 while lanyard's key set can't be fetched", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		stubLanyard({ keys: [key.jwk], jwksStatus: 500 });
		expect(await check(withProof(await sign(key)))).toEqual(unavailable);
	});

	it.each([
		["invalid JSON", () => new Response("{", { status: 200 })],
		["no keys", () => Response.json({ sets: [] })],
	])("answers 503 for a key set with %s", async (_, keySetAnswer) => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		stubLanyard({ keys: [key.jwk] });
		const answer = globalThis.fetch;
		vi.stubGlobal(
			"fetch",
			async (input: RequestInfo | URL, init?: RequestInit) =>
				String(input).endsWith("/.well-known/jwks.json")
					? keySetAnswer()
					: answer(input, init),
		);

		expect(await check(withProof(await sign(key)))).toEqual(unavailable);
	});

	it("answers 503 and names the cause when the key set fetch is rejected", async () => {
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		stubLanyard({ keys: [key.jwk], jwksError: new TypeError("fetch failed") });

		expect(await check(withProof(await sign(key)))).toEqual(unavailable);
		expect(errors).toHaveBeenCalledWith(
			"[service-sdk] can't load lanyard's signing keys from http://lanyard.test/.well-known/jwks.json:",
			"fetch failed",
		);
	});

	it("names the key set's URL and lanyard's status when it answers otherwise", async () => {
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		stubLanyard({ keys: [key.jwk], jwksStatus: 301 });

		expect(await check(withProof(await sign(key)))).toEqual(unavailable);
		expect(errors).toHaveBeenCalledWith(
			"[service-sdk] can't load lanyard's signing keys from http://lanyard.test/.well-known/jwks.json (status 301):",
			"Expected 200 OK from the JSON Web Key Set HTTP response",
		);
	});

	it("doesn't follow lanyard's redirect for its slug, and names the URL", async () => {
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		stubLanyard({ keys: [key.jwk] });
		const answer = globalThis.fetch;
		const requests: string[] = [];
		// lanyard behind an http -> https redirect, the way fetch meets it
		vi.stubGlobal(
			"fetch",
			async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				requests.push(url);
				if (url !== "http://lanyard.test/api/services/me") {
					return answer(input, init);
				}
				if (init?.redirect === "error") throw new TypeError("fetch failed");
				requests.push("https://lanyard.test/api/services/me");
				return answer(input, init);
			},
		);

		expect(await check(withProof(await sign(key)))).toEqual(unavailable);
		expect(requests).toEqual(["http://lanyard.test/api/services/me"]);
		expect(errors).toHaveBeenCalledWith(
			"[service-sdk] refusing requests until lanyard names this service:",
			"lanyard http://lanyard.test/api/services/me failed: fetch failed",
		);
	});

	it("answers 503 when the key set fetch times out", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		stubLanyard({
			keys: [key.jwk],
			jwksError: new DOMException("The operation timed out", "TimeoutError"),
		});
		expect(await check(withProof(await sign(key)))).toEqual(unavailable);
	});

	it("accepts a proof from a key lanyard published after the key set was cached", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		const lanyard = stubLanyard({ keys: [key.jwk] });
		expect((await check(withProof(await sign(key)))).ok).toBe(true);

		const next = await makeKey("k2");
		lanyard.keys = [next.jwk, key.jwk];
		vi.setSystemTime(Date.now() + 6_000);

		expect((await check(withProof(await sign(next)))).ok).toBe(true);
	});

	it("logs a refusal after lanyard's signature once a minute per claim", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		stubLanyard({ keys: [key.jwk] });
		const ahead = () =>
			signAs(
				USER_PROOF,
				lanyardClaims({ ...userClaims, iat: now() + 40, exp: now() + 100 }),
			);

		expect(await check(withProof(await ahead()))).toEqual(unauthorized);
		expect(errors.mock.calls).toEqual([
			[
				"[service-sdk] refused a proof lanyard signed: claim iat, reason check_failed; this host's clock may be behind lanyard's",
			],
		]);

		expect(await check(withProof(await ahead()))).toEqual(unauthorized);
		expect(errors).toHaveBeenCalledTimes(1);

		const expired = lanyardClaims({
			...userClaims,
			iat: now() - 100,
			exp: now() - 40,
		});
		await check(withProof(await signAs(USER_PROOF, expired)));
		expect(errors).toHaveBeenCalledTimes(2);
		expect(errors.mock.calls[1]?.[0]).toContain("claim exp");

		vi.setSystemTime(Date.now() + 60_000);
		await check(withProof(await ahead()));
		expect(errors).toHaveBeenCalledTimes(3);
	});

	it("names the slug this service expected when aud doesn't match", async () => {
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		stubLanyard({ keys: [key.jwk] });

		await check(withProof(await sign(key, { aud: "ledger" })));

		expect(errors.mock.calls).toEqual([
			[
				"[service-sdk] refused a proof lanyard signed: claim aud, reason check_failed; this service expects aud guidebook",
			],
		]);
	});

	it("logs which claims don't match lanyard's contract, without their values", async () => {
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		stubLanyard({ keys: [key.jwk] });
		const noOrgName = lanyardClaims({
			...userClaims,
			orgs: [{ orgId: "o1", slug: "stage-crew", role: "admin" }],
		});
		const scopeAsString = lanyardClaims({
			sub: "service:schedule",
			scope: "ledger:manage",
		});

		expect(await check(withProof(await signAs(USER_PROOF, noOrgName)))).toEqual(
			unauthorized,
		);
		expect(
			await check(
				withProof(await signAs("convstack-service+jwt", scopeAsString)),
			),
		).toEqual(unauthorized);

		expect(errors.mock.calls).toEqual([
			[
				"[service-sdk] refused a proof lanyard signed: user claims don't match at orgs.0.name",
			],
			[
				"[service-sdk] refused a proof lanyard signed: service claims don't match at scope",
			],
		]);
	});

	it("says so, once, when a proof names a signing key lanyard doesn't publish", async () => {
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		stubLanyard({ keys: [key.jwk] });
		const unpublished = await makeKey("k-unpublished");
		const token = await sign(unpublished);

		expect(await check(withProof(token))).toEqual(unauthorized);
		expect(await check(withProof(token))).toEqual(unauthorized);

		expect(errors).toHaveBeenCalledTimes(1);
		const logged = JSON.stringify(errors.mock.calls);
		expect(logged).toContain("signing key");
		expect(logged).not.toContain(token);
	});

	it("never logs the proof or what it says about the user", async () => {
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		stubLanyard({ keys: [key.jwk] });
		const tokens = [
			await sign(key, { aud: "ledger" }),
			await sign(key, { exp: now() - 40 }),
			await signAs(
				USER_PROOF,
				lanyardClaims({ ...userClaims, iat: now() + 40, exp: now() + 100 }),
			),
			await signAs(USER_PROOF, lanyardClaims({ ...userClaims, perms: "all" })),
		];

		for (const token of tokens) {
			expect(await check(withProof(token))).toEqual(unauthorized);
		}

		const logged = JSON.stringify(errors.mock.calls);
		expect(errors).toHaveBeenCalledTimes(4);
		for (const token of tokens) expect(logged).not.toContain(token);
		expect(logged).not.toContain("ada@x.dev");
	});

	it("fetches the key set again once it is a minute old, even for a kid it knows", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		const lanyard = stubLanyard({ keys: [key.jwk] });
		expect((await check(withProof(await sign(key)))).ok).toBe(true);

		lanyard.keys = [(await makeKey("k2")).jwk];
		vi.setSystemTime(Date.now() + 59_000);
		expect((await check(withProof(await sign(key)))).ok).toBe(true);
		vi.setSystemTime(Date.now() + 2_000);

		expect(await check(withProof(await sign(key)))).toEqual(unauthorized);
		expect(
			lanyard.calls.filter((c) => c === "GET /.well-known/jwks.json"),
		).toHaveLength(2);
	});
});
