import type { z } from "zod";
import { buildHandlerContext, type HandlerContext } from "./context";
import { errorToResponse } from "./errors";

export type { HandlerContext } from "./context";
export { buildHandlerContext } from "./context";
export { errorToResponse, httpError, ServiceError } from "./errors";

export interface CreateHandlerOptions<TDb, TInput, TOutput> {
	/** Zod schema to validate merged input (query + path + body). Optional. */
	input?: z.ZodType<TInput>;
	/** Zod schema to validate handler return value. Optional, dev-only. */
	output?: z.ZodType<TOutput>;
	/** The service's drizzle DB instance, injected into every handler's ctx. */
	db?: TDb;
	/** Handler body. Gets typed ctx + validated input, returns typed output. */
	handler: (ctx: HandlerContext<TDb> & { input: TInput }) => Promise<TOutput>;
}

/**
 * Wrap a handler function with auth-context injection, input parsing,
 * output validation, and error-to-HTTP mapping. The returned function
 * matches TanStack Start's `server.handlers` shape:
 *
 * ```ts
 * export const Route = createFileRoute("/api/foo")({
 *   server: { handlers: { GET: createHandler({ handler: async (ctx) => ... }) } },
 * });
 * ```
 */
export function createHandler<
	TDb = unknown,
	TInput = Record<string, unknown>,
	TOutput = unknown,
>(options: CreateHandlerOptions<TDb, TInput, TOutput>) {
	return async ({
		request,
		params,
	}: {
		request: Request;
		params?: Record<string, string>;
	}): Promise<Response> => {
		try {
			// 1. Build context from proxy headers
			const ctx = buildHandlerContext<TDb>(request, options.db as TDb);

			// 2. Parse input: merge query + path params + body
			const url = new URL(request.url, "http://localhost");
			const queryEntries = Object.fromEntries(url.searchParams.entries());
			let bodyEntries: Record<string, unknown> = {};
			if (
				request.method !== "GET" &&
				request.method !== "HEAD" &&
				request.headers.get("content-type")?.includes("json")
			) {
				try {
					bodyEntries = await request.json();
				} catch {
					// Empty or malformed body — fine, leave bodyEntries empty
				}
			}

			// Merge order: query → path → body (body wins on collision)
			const rawInput = {
				...queryEntries,
				...(params ?? {}),
				...bodyEntries,
			};

			const parsedInput = options.input
				? options.input.parse(rawInput)
				: (rawInput as TInput);

			// 3. Call the handler
			const result = await options.handler({
				...ctx,
				input: parsedInput,
			});

			// 4. Validate output (dev-only if desired, but runs always if schema provided)
			if (options.output) {
				options.output.parse(result);
			}

			// 5. Serialize to JSON response
			return new Response(JSON.stringify(result), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		} catch (err) {
			return errorToResponse(err);
		}
	};
}
