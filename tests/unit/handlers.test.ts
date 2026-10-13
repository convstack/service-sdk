import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	makeKey,
	type SigningKey,
	sign,
	stubLanyard,
	withProof,
} from "./lanyard-stub";

let key: SigningKey;

beforeEach(async () => {
	vi.resetModules();
	key = await makeKey("k1");
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

async function handlerSeeing(options: { skipAuth?: boolean } = {}) {
	const { createHandler } = await import("../../src/handlers");
	const seen: unknown[] = [];
	const handle = createHandler({
		...options,
		handler: async (ctx) => {
			seen.push({
				user: ctx.user,
				caller: ctx.caller,
				permissions: ctx.permissions,
				orgRoles: ctx.orgRoles,
			});
			return { ok: true };
		},
	});
	return { handle, seen };
}

describe("createHandler", () => {
	it("refuses a request without a proof and never runs the handler", async () => {
		stubLanyard({ keys: [key.jwk] });
		const { handle, seen } = await handlerSeeing();

		const res = await handle({ request: new Request("http://svc.test/api/x") });

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({
			error: "Unauthorized",
			code: "UNAUTHORIZED",
		});
		expect(seen).toEqual([]);
	});

	it("answers a health check without a proof or a call to lanyard", async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		const { handle } = await handlerSeeing({ skipAuth: true });

		const res = await handle({
			request: new Request("http://svc.test/api/health"),
		});

		expect(res.status).toBe(200);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("gives the handler the user a user proof names", async () => {
		stubLanyard({ keys: [key.jwk] });
		const { handle, seen } = await handlerSeeing();

		const res = await handle({ request: withProof(await sign(key)) });

		expect(res.status).toBe(200);
		expect(seen).toEqual([
			{
				user: { id: "user-1", email: "ada@x.dev", name: "Ada" },
				caller: null,
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
		]);
	});

	it("gives the handler the caller a service proof names, and no user", async () => {
		stubLanyard({ keys: [key.jwk] });
		const { handle, seen } = await handlerSeeing();

		await handle({
			request: withProof(await sign(key, { typ: "convstack-service+jwt" })),
		});

		expect(seen).toEqual([
			{
				user: null,
				caller: { slug: "schedule", scope: ["ledger:invoices:create"] },
				permissions: [],
				orgRoles: [],
			},
		]);
	});

	it("answers 503 while lanyard can't name the service", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		stubLanyard({ keys: [key.jwk], meStatus: 500 });
		const { handle } = await handlerSeeing();

		const res = await handle({ request: withProof(await sign(key)) });

		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({
			error: "Service unavailable",
			code: "UNAVAILABLE",
		});
	});
});
