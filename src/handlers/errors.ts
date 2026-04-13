import type { ZodError } from "zod";

/**
 * Typed HTTP error thrown by permission checks and handler code.
 * `errorToResponse` maps it to a JSON Response with the right status code.
 */
export class ServiceError extends Error {
	constructor(
		public readonly status: number,
		public readonly code: string,
		message: string,
		public readonly details?: Record<string, unknown>,
	) {
		super(message);
		this.name = "ServiceError";
	}
}

/** Constructor shortcuts for common HTTP error types. */
export const httpError = {
	unauthorized: (msg = "Login required") =>
		new ServiceError(401, "UNAUTHORIZED", msg),
	forbidden: (msg = "Forbidden") => new ServiceError(403, "FORBIDDEN", msg),
	notFound: (msg = "Not found") => new ServiceError(404, "NOT_FOUND", msg),
	conflict: (msg = "Conflict") => new ServiceError(409, "CONFLICT", msg),
	capacityFull: (msg = "At capacity") =>
		new ServiceError(409, "CAPACITY_FULL", msg),
	badRequest: (msg = "Bad request") =>
		new ServiceError(400, "BAD_REQUEST", msg),
};

/**
 * Convert any thrown value into a JSON Response with the correct HTTP status.
 *
 * - ServiceError → status from the error, structured body
 * - ZodError → 400 with validation issues
 * - Anything else → logged 500
 */
export function errorToResponse(err: unknown): Response {
	if (err instanceof ServiceError) {
		return new Response(
			JSON.stringify({
				error: err.message,
				code: err.code,
				details: err.details,
			}),
			{
				status: err.status,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	// Zod validation errors (input parsing or output validation)
	if (
		err &&
		typeof err === "object" &&
		"issues" in err &&
		Array.isArray((err as { issues: unknown[] }).issues)
	) {
		return new Response(
			JSON.stringify({
				error: "Validation failed",
				code: "VALIDATION_ERROR",
				issues: (err as ZodError).issues,
			}),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	console.error("[service-sdk] uncaught handler error:", err);
	return new Response(
		JSON.stringify({
			error: "Internal server error",
			code: "INTERNAL_ERROR",
		}),
		{
			status: 500,
			headers: { "Content-Type": "application/json" },
		},
	);
}
