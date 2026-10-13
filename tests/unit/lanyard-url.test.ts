import { afterEach, describe, expect, it, vi } from "vitest";
import { lanyardBaseUrl } from "../../src/lanyard-url";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("lanyardBaseUrl", () => {
	it.each([
		["http://lanyard:3000", "http://lanyard:3000"],
		["http://lanyard:3000/", "http://lanyard:3000"],
		["http://lanyard:3000///", "http://lanyard:3000"],
		["https://x.test/lanyard/", "https://x.test/lanyard"],
	])("turns %j into %j", (configured, expected) => {
		vi.stubEnv("LANYARD_URL", configured);
		expect(lanyardBaseUrl()).toBe(expected);
	});

	it("falls back to localhost when unset or empty", () => {
		vi.stubEnv("LANYARD_URL", "");
		expect(lanyardBaseUrl()).toBe("http://localhost:3000");
	});

	it("prefers an explicit url and trims that too", () => {
		vi.stubEnv("LANYARD_URL", "http://env:3000");
		expect(lanyardBaseUrl("http://explicit:3000/")).toBe(
			"http://explicit:3000",
		);
	});
});

describe("calls with a trailing slash in LANYARD_URL", () => {
	it("lanyardFetch doesn't double the slash", async () => {
		vi.stubEnv("LANYARD_URL", "http://lanyard.test:3000/");
		vi.stubEnv("LANYARD_SERVICE_KEY", "key");
		const fetchSpy = vi.fn(async (_url: string) => new Response("{}"));
		vi.stubGlobal("fetch", fetchSpy);
		const { lanyardFetch } = await import("../../src/lanyard");
		await lanyardFetch("/api/services/me");
		expect(fetchSpy.mock.calls[0][0]).toBe(
			"http://lanyard.test:3000/api/services/me",
		);
	});

	it("self-registration posts to a single-slash heartbeat url", async () => {
		vi.stubEnv("LANYARD_URL", "http://lanyard.test:3000/");
		vi.stubEnv("LANYARD_SERVICE_KEY", "key");
		const fetchSpy = vi.fn(async (_url: string) => new Response("{}"));
		vi.stubGlobal("fetch", fetchSpy);
		const { createSelfRegister } = await import("../../src/registration");
		await createSelfRegister({ name: "T" } as never)();
		expect(fetchSpy.mock.calls[0][0]).toBe(
			"http://lanyard.test:3000/api/services/heartbeat",
		);
	});
});
