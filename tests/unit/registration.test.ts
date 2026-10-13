import { afterEach, describe, expect, it, vi } from "vitest";
import { createSelfRegister, registerService } from "../../src/registration";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

function lanyardAnswers(body: unknown) {
	vi.stubEnv("LANYARD_URL", "http://lanyard.test");
	vi.stubEnv("LANYARD_SERVICE_KEY", "key");
	vi.stubGlobal(
		"fetch",
		vi.fn(async (_url: string) => new Response(JSON.stringify(body))),
	);
	return {
		warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
		log: vi.spyOn(console, "log").mockImplementation(() => {}),
	};
}

const manifest = { name: "Svc" } as never;
const issues = ["pages.0.path: Required", "icon: Expected string"];

describe("createSelfRegister", () => {
	it("says why lanyard ignored the manifest", async () => {
		const { warn, log } = lanyardAnswers({
			status: "ok",
			manifestIssues: issues,
		});

		await createSelfRegister(manifest)();

		const text = warn.mock.calls.flat().join("\n");
		expect(text).toContain("pages.0.path: Required");
		expect(text).toContain("icon: Expected string");
		expect(log).not.toHaveBeenCalled();
	});

	it("reports success when the manifest was accepted", async () => {
		const { warn, log } = lanyardAnswers({ status: "ok" });

		await createSelfRegister(manifest)();

		expect(warn).not.toHaveBeenCalled();
		expect(log.mock.calls.flat().join(" ")).toContain(
			"registered with lanyard",
		);
	});
});

describe("registerService", () => {
	it("says why lanyard ignored the manifest", async () => {
		const { warn } = lanyardAnswers({ status: "ok", manifestIssues: issues });

		await registerService({ manifest });

		expect(warn.mock.calls.flat().join("\n")).toContain(
			"pages.0.path: Required",
		);
	});
});

describe.each([
	["createSelfRegister", (m: never) => createSelfRegister(m)()],
	["registerService", (m: never) => registerService({ manifest: m })],
])("%s when things go wrong", (_name, register) => {
	function lanyard(answer: () => Promise<Response>) {
		vi.stubEnv("LANYARD_URL", "http://lanyard.test");
		vi.stubEnv("LANYARD_SERVICE_KEY", "sk_svc_very_secret");
		const fetchSpy = vi.fn(
			async (_url: string, _init?: RequestInit) => await answer(),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const logs = [
			vi.spyOn(console, "warn").mockImplementation(() => {}),
			vi.spyOn(console, "log").mockImplementation(() => {}),
			vi.spyOn(console, "error").mockImplementation(() => {}),
		];
		const logged = () => logs.flatMap((l) => l.mock.calls.flat()).join("\n");
		return { fetchSpy, logged };
	}

	it("never follows a redirect with the service key, and gives up after a while", async () => {
		const { fetchSpy } = lanyard(async () => Response.json({ status: "ok" }));

		await register(manifest);

		const init = fetchSpy.mock.calls[0][1];
		expect(init?.redirect).toBe("error");
		expect(init?.signal).toBeInstanceOf(AbortSignal);
	});

	it("says so and calls nobody when the service key is missing", async () => {
		const { fetchSpy, logged } = lanyard(async () => Response.json({}));
		vi.stubEnv("LANYARD_SERVICE_KEY", "");

		await register(manifest);

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(logged()).toContain("LANYARD_SERVICE_KEY");
	});

	it("reports a refusal with its status", async () => {
		const { logged } = lanyard(
			async () => new Response("nope", { status: 403 }),
		);

		await register(manifest);

		expect(logged()).toContain("403");
	});

	it("survives lanyard being unreachable", async () => {
		const { logged } = lanyard(async () => {
			throw new Error("connect ECONNREFUSED");
		});

		await expect(register(manifest)).resolves.toBeUndefined();
		expect(logged()).toContain("ECONNREFUSED");
	});

	it("never writes the service key to the log", async () => {
		const outcomes = [
			async () => Response.json({ status: "ok" }),
			async () => new Response("bad key sk_svc_very_secret", { status: 401 }),
			async () => {
				throw new Error("down");
			},
		];
		for (const outcome of outcomes) {
			const { logged } = lanyard(outcome);
			await register(manifest);
			expect(logged()).not.toContain("sk_svc_very_secret");
			vi.restoreAllMocks();
		}
	});
});
