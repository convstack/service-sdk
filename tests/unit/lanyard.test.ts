import { afterEach, describe, expect, it, vi } from "vitest";
import { lanyardFetch } from "../../src/lanyard";
import { stubLanyard } from "./lanyard-stub";

afterEach(() => {
	vi.useRealTimers();
	// the spy wraps the stubbed fetch; unstubbing first would leave the stub behind
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("lanyardFetch", () => {
	it("aborts a call lanyard never answers after 5 seconds", async () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		// Node's AbortSignal.timeout runs on an internal timer fake timers can't move
		vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
			const controller = new AbortController();
			setTimeout(
				() =>
					controller.abort(
						new DOMException(
							"The operation was aborted due to timeout",
							"TimeoutError",
						),
					),
				ms,
			);
			return controller.signal;
		});
		stubLanyard();
		vi.stubGlobal(
			"fetch",
			(_input: RequestInfo | URL, init?: RequestInit) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () =>
						reject(init.signal?.reason),
					);
				}),
		);
		const drain = () => new Promise((resolve) => setImmediate(resolve));
		const settled = vi.fn();

		const call = lanyardFetch("/api/services/me");
		call.catch(settled);
		vi.advanceTimersByTime(4_999);
		await drain();
		expect(settled).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		await drain();

		expect(settled).toHaveBeenCalledTimes(1);
		await expect(call).rejects.toThrow(
			"lanyard http://lanyard.test/api/services/me failed: The operation was aborted due to timeout",
		);
	});

	it("fails on a redirect rather than follow it with the service key", async () => {
		stubLanyard();
		const requests: string[] = [];
		// a 301 from http:// to https://, the way fetch meets it
		vi.stubGlobal(
			"fetch",
			async (input: RequestInfo | URL, init?: RequestInit) => {
				requests.push(String(input));
				if (init?.redirect === "error") throw new TypeError("fetch failed");
				requests.push("https://lanyard.test/api/services/me");
				return Response.json({ slug: "guidebook" });
			},
		);

		await expect(lanyardFetch("/api/services/me")).rejects.toThrow(
			"lanyard http://lanyard.test/api/services/me failed: fetch failed",
		);
		expect(requests).toEqual(["http://lanyard.test/api/services/me"]);
	});

	it("refuses a path that would take the service key to another host", async () => {
		const lanyard = stubLanyard();

		await expect(lanyardFetch(".evil.test/x")).rejects.toThrow(
			"lanyardFetch path leaves lanyard's origin: .evil.test/x",
		);
		await expect(lanyardFetch("@evil.test/x")).rejects.toThrow(
			"lanyardFetch path leaves lanyard's origin: @evil.test/x",
		);
		expect(lanyard.calls).toEqual([]);
	});
});
