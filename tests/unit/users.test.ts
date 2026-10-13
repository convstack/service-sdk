import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SERVICE_KEY, stubLanyard } from "./lanyard-stub";

beforeEach(() => {
	vi.resetModules();
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("resolveUserName", () => {
	it("asks lanyard for the name with the service key", async () => {
		stubLanyard();
		const asked: Array<[string, string | null]> = [];
		vi.stubGlobal(
			"fetch",
			async (input: RequestInfo | URL, init?: RequestInit) => {
				asked.push([
					String(input),
					new Headers(init?.headers).get("authorization"),
				]);
				return Response.json({ name: "Ada" });
			},
		);
		const { resolveUserName } = await import("../../src/users");

		expect(await resolveUserName("user-1")).toBe("Ada");
		expect(asked).toEqual([
			["http://lanyard.test/api/users/user-1", `ServiceKey ${SERVICE_KEY}`],
		]);
	});

	it("sends a stored id to lanyard as one encoded segment", async () => {
		const lanyard = stubLanyard();
		const { resolveUserName } = await import("../../src/users");

		await resolveUserName("../services/me");

		expect(lanyard.calls).toEqual(["GET /api/users/..%2Fservices%2Fme"]);
	});
});

describe("resolveUserName when lanyard can't answer", () => {
	it("says why once, and still shows a shortened id", async () => {
		stubLanyard();
		vi.stubEnv("LANYARD_SERVICE_KEY", "");
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { resolveUserName } = await import("../../src/users");

		expect(await resolveUserName("user-1234567890")).toBe("user-123...");
		await resolveUserName("user-2222222222");

		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls.flat().join(" ")).toContain("LANYARD_SERVICE_KEY");
		warn.mockRestore();
	});

	it("says which status lanyard answered with", async () => {
		stubLanyard();
		vi.stubGlobal("fetch", async () => new Response("no", { status: 403 }));
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { resolveUserName } = await import("../../src/users");

		await resolveUserName("user-1234567890");

		expect(warn.mock.calls.flat().join(" ")).toContain("403");
		warn.mockRestore();
	});

	it("stays quiet about a user lanyard doesn't know", async () => {
		stubLanyard();
		vi.stubGlobal("fetch", async () => new Response("no", { status: 404 }));
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { resolveUserName } = await import("../../src/users");

		await resolveUserName("user-1234567890");

		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});
});

describe("resolveUserNames", () => {
	it("asks lanyard for at most ten names at a time", async () => {
		stubLanyard();
		let running = 0;
		let most = 0;
		vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
			most = Math.max(most, ++running);
			await new Promise((done) => setTimeout(done, 1));
			running--;
			return Response.json({ name: `N-${String(input).split("/").pop()}` });
		});
		const { resolveUserNames } = await import("../../src/users");
		const ids = Array.from({ length: 25 }, (_, i) => `u${i}`);

		const names = await resolveUserNames([...ids, "u0"]);

		expect(names.size).toBe(25);
		expect(names.get("u24")).toBe("N-u24");
		expect(most).toBe(10);
	});
});
