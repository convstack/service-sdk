import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubLanyard } from "./lanyard-stub";

beforeEach(() => {
	vi.resetModules();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("getServiceToken", () => {
	it("asks lanyard with the service key and reuses the proof until 10 seconds before it expires", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		const lanyard = stubLanyard();
		const { getServiceToken } = await import("../../src/service-token");

		expect(await getServiceToken("ledger")).toBe("service-proof");
		vi.setSystemTime(Date.now() + 49_000);
		expect(await getServiceToken("ledger")).toBe("service-proof");
		expect(lanyard.calls).toEqual([
			'POST /api/services/token {"audience":"ledger"}',
		]);

		vi.setSystemTime(Date.now() + 2_000);
		await getServiceToken("ledger");
		expect(lanyard.calls).toHaveLength(2);
	});

	it("keeps one proof per audience", async () => {
		const lanyard = stubLanyard();
		const { getServiceToken } = await import("../../src/service-token");

		await getServiceToken("ledger");
		await getServiceToken("schedule");
		await getServiceToken("ledger");

		expect(lanyard.calls).toEqual([
			'POST /api/services/token {"audience":"ledger"}',
			'POST /api/services/token {"audience":"schedule"}',
		]);
	});

	it("throws when lanyard refuses", async () => {
		stubLanyard({
			token: { status: 403, body: { error: "No grant for this audience" } },
		});
		const { getServiceToken } = await import("../../src/service-token");

		await expect(getServiceToken("ledger")).rejects.toThrow(
			"lanyard /api/services/token answered 403 for ledger",
		);
	});
});

describe("getServiceToken under load", () => {
	it("asks lanyard once when several calls need the same first proof", async () => {
		const lanyard = stubLanyard();
		const { getServiceToken } = await import("../../src/service-token");

		const proofs = await Promise.all([
			getServiceToken("ledger"),
			getServiceToken("ledger"),
			getServiceToken("ledger"),
		]);

		expect(proofs).toEqual(["service-proof", "service-proof", "service-proof"]);
		expect(lanyard.calls).toHaveLength(1);
	});

	it("asks again after a failed attempt", async () => {
		const lanyard = stubLanyard({ token: { status: 503, body: {} } });
		const { getServiceToken } = await import("../../src/service-token");

		await expect(getServiceToken("ledger")).rejects.toThrow();
		lanyard.token = { status: 200, body: { token: "p", expiresIn: 60 } };

		expect(await getServiceToken("ledger")).toBe("p");
	});
});
