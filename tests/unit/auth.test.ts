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

const auth = () => import("../../src/auth");
const serviceProof = () => sign(key, { typ: "convstack-service+jwt" });

describe("request-level checks", () => {
	it("getRequestUser returns the user a user proof names", async () => {
		stubLanyard({ keys: [key.jwk] });
		const { getRequestUser } = await auth();
		expect(await getRequestUser(withProof(await sign(key)))).toMatchObject({
			id: "user-1",
			permissions: ["guidebook:pages:read"],
		});
	});

	it("getRequestUser returns null for a service proof, so user-only routes stay closed", async () => {
		stubLanyard({ keys: [key.jwk] });
		const { getRequestCaller, getRequestUser } = await auth();
		const request = withProof(await serviceProof());
		expect(await getRequestUser(request)).toBeNull();
		expect(await getRequestCaller(request)).not.toBeNull();
	});

	it("getRequestCaller names the calling service and ignores users", async () => {
		stubLanyard({ keys: [key.jwk] });
		const { getRequestCaller } = await auth();
		expect(await getRequestCaller(withProof(await serviceProof()))).toEqual({
			slug: "schedule",
			scope: ["ledger:invoices:create"],
		});
		expect(await getRequestCaller(withProof(await sign(key)))).toBeNull();
	});

	it("requirePermission answers 401 without a proof", async () => {
		stubLanyard({ keys: [key.jwk] });
		const { requirePermission } = await auth();
		const res = await requirePermission(
			new Request("http://svc.test/api/x"),
			"guidebook:pages:read",
		);
		expect(res?.status).toBe(401);
		expect(await res?.json()).toEqual({ error: "Unauthorized" });
	});

	it("requirePermission answers 403 when the user lacks the permission", async () => {
		stubLanyard({ keys: [key.jwk] });
		const { requirePermission } = await auth();
		const res = await requirePermission(
			withProof(await sign(key)),
			"guidebook:admin",
		);
		expect(res?.status).toBe(403);
		expect(await res?.json()).toEqual({
			error: "Forbidden",
			required: "guidebook:admin",
		});
	});

	it("requirePermission accepts a service proof whose scope carries it", async () => {
		stubLanyard({ keys: [key.jwk] });
		const { requirePermission } = await auth();
		expect(
			await requirePermission(
				withProof(await serviceProof()),
				"ledger:invoices:create",
			),
		).toBeNull();
	});

	it("requireAnyPermission accepts one of several", async () => {
		stubLanyard({ keys: [key.jwk] });
		const { requireAnyPermission } = await auth();
		expect(
			await requireAnyPermission(withProof(await sign(key)), [
				"guidebook:admin",
				"guidebook:pages:read",
			]),
		).toBeNull();
	});

	it("answers 503 while lanyard can't name the service", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		stubLanyard({ keys: [key.jwk], meStatus: 500 });
		const { requirePermission } = await auth();
		const res = await requirePermission(
			withProof(await sign(key)),
			"guidebook:pages:read",
		);
		expect(res?.status).toBe(503);
	});

	it("checks each request's proof once, however many helpers ask", async () => {
		stubLanyard({ keys: [key.jwk] });
		const { getRequestCaller, getRequestUser, requirePermission } =
			await auth();
		const { createHandler } = await import("../../src/handlers");
		const handle = createHandler({
			handler: async (ctx) => {
				await requirePermission(ctx.request, "guidebook:pages:read");
				return getRequestCaller(ctx.request);
			},
		});
		const request = withProof(await sign(key));
		const other = withProof(await sign(key));
		const signatureChecks = vi.spyOn(crypto.subtle, "verify");

		expect((await handle({ request })).status).toBe(200);
		expect(await getRequestUser(request)).not.toBeNull();
		expect(signatureChecks).toHaveBeenCalledTimes(1);

		expect(await getRequestUser(other)).not.toBeNull();
		expect(signatureChecks).toHaveBeenCalledTimes(2);
	});

	it("requireUser returns the user a user proof names", async () => {
		stubLanyard({ keys: [key.jwk] });
		const { requireUser } = await auth();
		expect(await requireUser(withProof(await sign(key)))).toMatchObject({
			id: "user-1",
			email: "ada@x.dev",
		});
	});

	it("requireUser answers 401 without a proof, with a bad one, or for a service", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		stubLanyard({ keys: [key.jwk] });
		const { requireUser } = await auth();
		const impostor = await makeKey("k1");

		for (const request of [
			new Request("http://svc.test/api/x"),
			withProof(await sign(impostor)),
			withProof(await serviceProof()),
		]) {
			const res = await requireUser(request);
			expect(res).toBeInstanceOf(Response);
			expect((res as Response).status).toBe(401);
			expect(await (res as Response).json()).toEqual({ error: "Unauthorized" });
		}
	});

	it("requireUser answers 503 while lanyard can't name the service", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		stubLanyard({ keys: [key.jwk], meStatus: 500 });
		const { requireUser } = await auth();

		const res = await requireUser(withProof(await sign(key)));

		expect(res).toBeInstanceOf(Response);
		expect((res as Response).status).toBe(503);
		expect(await (res as Response).json()).toEqual({
			error: "Service unavailable",
		});
	});
});
