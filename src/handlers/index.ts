import type { z } from "zod";
import { checkProof, type Principal } from "../proof";
import { buildHandlerContext, type HandlerContext } from "./context";
import { errorToResponse, httpError, ServiceError } from "./errors";

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
	/** Answer without lanyard's proof; only for health checks, which lanyard calls without one. */
	skipAuth?: boolean;
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
			// 1. Check lanyard's proof and build the context from it
			let principal: Principal | null = null;
			if (!options.skipAuth) {
				const proof = await checkProof(request);
				if (!proof.ok) {
					throw new ServiceError(
						proof.status,
						proof.status === 401 ? "UNAUTHORIZED" : "UNAVAILABLE",
						proof.error,
					);
				}
				principal = proof.principal;
			}
			const ctx = buildHandlerContext<TDb>(
				request,
				options.db as TDb,
				principal,
			);

			// 2. Parse input: merge query + body + path params
			const url = new URL(request.url, "http://localhost");
			const queryEntries = Object.fromEntries(url.searchParams.entries());
			let bodyEntries: Record<string, unknown> = {};
			if (
				request.method !== "GET" &&
				request.method !== "HEAD" &&
				request.headers.get("content-type")?.includes("json")
			) {
				const text = await request.text();
				if (text) {
					let parsed: unknown;
					try {
						parsed = JSON.parse(text);
					} catch {
						throw httpError.badRequest("Request body is not valid JSON");
					}
					if (
						typeof parsed !== "object" ||
						parsed === null ||
						Array.isArray(parsed)
					) {
						throw httpError.badRequest("Request body must be a JSON object");
					}
					bodyEntries = parsed as Record<string, unknown>;
				}
			}

			// Merge order: query → body → path. The path wins: it is what the
			// route was matched on, and a body key must not point it elsewhere.
			const rawInput = {
				...queryEntries,
				...bodyEntries,
				...(params ?? {}),
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
				const checked = options.output.safeParse(result);
				// the handler's own mistake, not the caller's
				if (!checked.success) {
					console.error(
						"[service-sdk] handler answer doesn't match its output schema:",
						checked.error.issues,
					);
					throw new ServiceError(
						500,
						"INTERNAL_ERROR",
						"Internal server error",
					);
				}
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
