import { describe, expect, it } from "vitest";
import type { HandlerContext } from "../../src/handlers/context";
import {
	requireAnyCoordinator,
	requireAnyPermission,
	requireAuth,
	requireCoordinatorOf,
	requireOwnResource,
	requirePermission,
} from "../../src/permissions";

function ctx(overrides: Partial<HandlerContext>): HandlerContext {
	return {
		db: null,
		user: null,
		caller: null,
		orgRoles: [],
		permissions: [],
		request: new Request("http://svc.test/api/x"),
		...overrides,
	};
}

function statusOf(check: () => void): number | null {
	try {
		check();
		return null;
	} catch (err) {
		return (err as { status: number }).status;
	}
}

const caller = { slug: "schedule", scope: ["ledger:invoices:create"] };
const user = { id: "user-1", email: "ada@x.dev", name: "Ada" };

describe("permission helpers", () => {
	it("let a caller through when its scope carries the permission", () => {
		expect(
			statusOf(() =>
				requirePermission(ctx({ caller }), "ledger:invoices:create"),
			),
		).toBeNull();
	});

	it("refuse a caller whose scope lacks the permission", () => {
		expect(
			statusOf(() => requirePermission(ctx({ caller }), "ledger:manage")),
		).toBe(403);
	});

	it("accept a caller holding one of several permissions", () => {
		expect(
			statusOf(() =>
				requireAnyPermission(ctx({ caller }), [
					"ledger:manage",
					"ledger:invoices:create",
				]),
			),
		).toBeNull();
		expect(
			statusOf(() => requireAnyPermission(ctx({ caller }), ["ledger:manage"])),
		).toBe(403);
	});

	it("still treat a caller as nobody where a user is required", () => {
		expect(statusOf(() => requireAuth(ctx({ caller })))).toBe(401);
	});

	it("keep checking a user's own permissions", () => {
		expect(
			statusOf(() =>
				requirePermission(
					ctx({ user, permissions: ["ledger:manage"] }),
					"ledger:manage",
				),
			),
		).toBeNull();
		expect(
			statusOf(() => requirePermission(ctx({ user }), "ledger:manage")),
		).toBe(403);
		expect(statusOf(() => requirePermission(ctx({}), "ledger:manage"))).toBe(
			401,
		);
	});
});

describe("department and ownership helpers", () => {
	const coordinator = {
		user,
		orgRoles: [
			{ orgId: "d1", slug: "stage", role: "admin" },
			{ orgId: "d2", slug: "bar", role: "member" },
		],
	};

	it("let a coordinator act on their own department only", () => {
		expect(
			statusOf(() => requireCoordinatorOf(ctx(coordinator), "d1")),
		).toBeNull();
		expect(statusOf(() => requireCoordinatorOf(ctx(coordinator), "d2"))).toBe(
			403,
		);
		expect(statusOf(() => requireCoordinatorOf(ctx(coordinator), "d9"))).toBe(
			403,
		);
	});

	it("count an owner as a coordinator too", () => {
		const owner = {
			user,
			orgRoles: [{ orgId: "d1", slug: "s", role: "owner" }],
		};
		expect(statusOf(() => requireCoordinatorOf(ctx(owner), "d1"))).toBeNull();
		expect(statusOf(() => requireAnyCoordinator(ctx(owner)))).toBeNull();
	});

	it("refuse a plain member where any coordinator role is needed", () => {
		const member = {
			user,
			orgRoles: [{ orgId: "d1", slug: "s", role: "member" }],
		};
		expect(statusOf(() => requireAnyCoordinator(ctx(member)))).toBe(403);
		expect(statusOf(() => requireAnyCoordinator(ctx({ user })))).toBe(403);
	});

	it("treat a service caller and an anonymous request as nobody", () => {
		for (const check of [
			() => requireCoordinatorOf(ctx({ caller }), "d1"),
			() => requireAnyCoordinator(ctx({ caller })),
			() => requireOwnResource(ctx({ caller }), "user-1"),
			() => requireOwnResource(ctx({}), "user-1"),
		]) {
			expect(statusOf(check)).toBe(401);
		}
	});

	it("let a user act on their own resource and nobody else's", () => {
		expect(
			statusOf(() => requireOwnResource(ctx({ user }), "user-1")),
		).toBeNull();
		expect(statusOf(() => requireOwnResource(ctx({ user }), "user-2"))).toBe(
			403,
		);
	});
});
