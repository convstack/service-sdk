import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

beforeEach(() => {
	vi.resetModules();
});

afterEach(() => {
	vi.restoreAllMocks();
});

const put = (body: string, url = "http://svc.test/api/pages/a") =>
	new Request(url, {
		method: "PUT",
		headers: { "content-type": "application/json" },
		body,
	});

async function handlerFor(
	options: Record<string, unknown> = {},
	answer: unknown = { ok: true },
) {
	const { createHandler } = await import("../../src/handlers");
	const seen: unknown[] = [];
	const handle = createHandler({
		skipAuth: true,
		...options,
		handler: async (ctx) => {
			seen.push(ctx.input);
			if (answer instanceof Error || (answer as { thrown?: unknown })?.thrown) {
				throw (answer as { thrown?: unknown }).thrown ?? answer;
			}
			return answer;
		},
	});
	return { handle, seen };
}

describe("createHandler input", () => {
	it("takes the path parameter over a body or query key of the same name", async () => {
		const { handle, seen } = await handlerFor();

		await handle({
			request: put(
				JSON.stringify({ slug: "from-body", title: "T" }),
				"http://svc.test/api/pages/a?slug=from-query&page=2",
			),
			params: { slug: "a" },
		});

		expect(seen).toEqual([{ slug: "a", title: "T", page: "2" }]);
	});

	it("lets the body override a query key", async () => {
		const { handle, seen } = await handlerFor();

		await handle({
			request: put(
				JSON.stringify({ title: "from-body" }),
				"http://svc.test/api/pages/a?title=from-query",
			),
		});

		expect(seen).toEqual([{ title: "from-body" }]);
	});

	it.each([
		["text that isn't JSON", "{nope"],
		["a JSON array", "[1,2]"],
		["a JSON string", '"hello"'],
		["a JSON number", "5"],
		["JSON null", "null"],
	])("answers 400 for a body that is %s and never runs the handler", async (_label, body) => {
		const { handle, seen } = await handlerFor();

		const res = await handle({ request: put(body) });

		expect(res.status).toBe(400);
		expect((await res.json()).code).toBe("BAD_REQUEST");
		expect(seen).toEqual([]);
	});

	it("still accepts a request with a JSON content type and no body", async () => {
		const { handle, seen } = await handlerFor();

		const res = await handle({ request: put("") });

		expect(res.status).toBe(200);
		expect(seen).toEqual([{}]);
	});

	it("answers 400 with the issues when the input doesn't validate", async () => {
		const { handle, seen } = await handlerFor({
			input: z.object({ title: z.string().min(1) }),
		});

		const res = await handle({ request: put(JSON.stringify({ title: "" })) });

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.code).toBe("VALIDATION_ERROR");
		expect(body.issues[0].path).toEqual(["title"]);
		expect(seen).toEqual([]);
	});
});

describe("createHandler failures on the service's side", () => {
	it("answers 500, logged, when the answer doesn't match the output schema", async () => {
		const logged = vi.spyOn(console, "error").mockImplementation(() => {});
		const { handle } = await handlerFor(
			{ output: z.object({ internalCount: z.number() }) },
			{ internalCount: "not a number" },
		);

		const res = await handle({ request: put("{}") });

		expect(res.status).toBe(500);
		const text = await res.text();
		expect(JSON.parse(text).code).toBe("INTERNAL_ERROR");
		expect(text).not.toContain("internalCount");
		expect(logged).toHaveBeenCalled();
	});

	it("answers 500 without the message of an unknown error", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const { handle } = await handlerFor(
			{},
			new Error("connect ECONNREFUSED db.internal:5432"),
		);

		const res = await handle({ request: put("{}") });

		expect(res.status).toBe(500);
		expect(await res.text()).not.toContain("db.internal");
	});

	it("doesn't echo a thrown object just because it has an issues array", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const { handle } = await handlerFor(
			{},
			{ thrown: { issues: [{ secret: "row 42 of the users table" }] } },
		);

		const res = await handle({ request: put("{}") });

		expect(res.status).toBe(500);
		expect(await res.text()).not.toContain("row 42");
	});
});
