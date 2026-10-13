import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import * as schemas from "../manifest-schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readSdkVersion(): string {
	try {
		const pkg = JSON.parse(
			readFileSync(join(__dirname, "../../package.json"), "utf-8"),
		);
		return pkg.version ?? "0.1.0";
	} catch {
		return "0.1.0";
	}
}

/**
 * Build a JSON Schema document for the full UIManifest shape, including
 * every transitively-referenced schema as a $defs entry.
 */
export function buildManifestJsonSchema(): object {
	return z.toJSONSchema(schemas.uiManifestSchema, {
		reused: "ref",
	});
}

/**
 * Build an OpenAPI 3.1 document describing the service wire contract.
 * This documents shared shapes (request headers, response bodies, errors),
 * NOT per-service paths — services define their own endpoints.
 */
export function buildWireContractOpenApi(): object {
	const version = readSdkVersion();
	return {
		openapi: "3.1.0",
		info: {
			title: "ConvStack Service Wire Contract",
			version,
			description:
				"The contract every ConvStack service implements. Describes the " +
				"proof every request carries, the response shapes " +
				"each section type expects, and the standard error format.",
		},
		components: {
			schemas: {
				ScheduleData: z.toJSONSchema(schemas.scheduleDataSchema),
				ApprovalQueueData: z.toJSONSchema(schemas.approvalQueueDataSchema),
				FormConfig: z.toJSONSchema(schemas.formConfigSchema),
				ErrorResponse: {
					type: "object",
					required: ["error", "code"],
					properties: {
						error: { type: "string" },
						code: {
							type: "string",
							enum: [
								"UNAUTHORIZED",
								"FORBIDDEN",
								"NOT_FOUND",
								"CONFLICT",
								"CAPACITY_FULL",
								"BAD_REQUEST",
								"VALIDATION_ERROR",
								"INTERNAL_ERROR",
								"UNAVAILABLE",
							],
						},
						details: { type: "object" },
					},
				},
			},
			parameters: {
				Proof: {
					name: "Authorization",
					in: "header",
					schema: { type: "string" },
					required: true,
					description:
						"Bearer <proof>: an ES256 JWT lanyard signs for this service, checked against lanyard's /.well-known/jwks.json. A user proof (typ convstack-user+jwt) carries sub, name, email, perms and orgs; a service proof (typ convstack-service+jwt) carries sub service:<caller slug> and scope. Both expire 60 seconds after iat.",
				},
			},
		},
	};
}
