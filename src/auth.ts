/**
 * Authentication and permission utilities for ConvStack services.
 *
 * Services receive user context via proxy headers set by the Dashboard:
 * - X-User-Id: User's unique ID
 * - X-User-Name: User's display name
 * - X-User-Email: User's email
 * - X-User-Role: User's global role ("admin" | "user")
 * - X-User-Permissions: Comma-separated list of granted permissions
 * - X-User-Org-Roles: JSON array of {orgId, slug, role} for department memberships
 * - Authorization: Bearer token or ServiceKey
 */

export interface RequestUser {
	id: string;
	name: string;
	email: string;
	role: string;
	permissions: string[];
	orgRoles: Array<{ orgId: string; name?: string; slug: string; role: string }>;
}

/**
 * Extract user context from proxy headers.
 * Returns null if no user ID is present (unauthenticated request).
 */
export function getRequestUser(request: Request): RequestUser | null {
	const id = request.headers.get("x-user-id");
	if (!id) return null;

	const name = request.headers.get("x-user-name") || "";
	const email = request.headers.get("x-user-email") || "";
	const role = request.headers.get("x-user-role") || "user";

	const permHeader = request.headers.get("x-user-permissions");
	const permissions = permHeader
		? permHeader
				.split(",")
				.map((p) => p.trim())
				.filter(Boolean)
		: [];

	let orgRoles: RequestUser["orgRoles"] = [];
	const orgHeader = request.headers.get("x-user-org-roles");
	if (orgHeader) {
		try {
			orgRoles = JSON.parse(orgHeader);
		} catch {
			orgRoles = [];
		}
	}

	return { id, name, email, role, permissions, orgRoles };
}

/**
 * Check if the request has a specific permission.
 */
export function hasPermission(request: Request, permission: string): boolean {
	const user = getRequestUser(request);
	if (!user) return false;
	return user.permissions.includes(permission);
}

/**
 * Require a specific permission. Returns an error Response if missing, null if granted.
 */
export function requirePermission(
	request: Request,
	permission: string,
): Response | null {
	const user = getRequestUser(request);
	if (!user) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}
	if (!user.permissions.includes(permission)) {
		return new Response(
			JSON.stringify({
				error: "Forbidden",
				required: permission,
			}),
			{ status: 403, headers: { "Content-Type": "application/json" } },
		);
	}
	return null;
}

/**
 * Require any one of the listed permissions.
 */
export function requireAnyPermission(
	request: Request,
	permissions: string[],
): Response | null {
	const user = getRequestUser(request);
	if (!user) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}
	if (!permissions.some((p) => user.permissions.includes(p))) {
		return new Response(
			JSON.stringify({
				error: "Forbidden",
				required: permissions,
			}),
			{ status: 403, headers: { "Content-Type": "application/json" } },
		);
	}
	return null;
}

// --- ServiceKey auth (for service-to-service calls) ---

const verifiedKeys = new Map<string, { valid: boolean; expires: number }>();
const KEY_CACHE_TTL = 5 * 60 * 1000;

/**
 * Validate a ServiceKey by forwarding it to Lanyard's heartbeat endpoint.
 * Caches results for 5 minutes.
 */
export async function validateServiceKey(request: Request): Promise<boolean> {
	const auth = request.headers.get("authorization");
	if (!auth?.startsWith("ServiceKey ")) return false;

	const cached = verifiedKeys.get(auth);
	if (cached && cached.expires > Date.now()) {
		return cached.valid;
	}

	const lanyardUrl = process.env.LANYARD_URL || "http://localhost:3000";

	try {
		const res = await fetch(`${lanyardUrl}/api/services/heartbeat`, {
			method: "POST",
			headers: {
				Authorization: auth,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ status: "healthy" }),
			signal: AbortSignal.timeout(3000),
		});

		const valid = res.ok;
		verifiedKeys.set(auth, {
			valid,
			expires: Date.now() + KEY_CACHE_TTL,
		});
		return valid;
	} catch {
		return false;
	}
}

/**
 * Require a valid ServiceKey. Returns error Response if invalid, null if valid.
 */
export async function requireServiceKey(
	request: Request,
): Promise<Response | null> {
	const valid = await validateServiceKey(request);
	if (!valid) {
		return new Response(
			JSON.stringify({ error: "Invalid or missing ServiceKey" }),
			{ status: 401, headers: { "Content-Type": "application/json" } },
		);
	}
	return null;
}

/**
 * Require either a valid ServiceKey OR a specific permission.
 * Use this on endpoints that both admin users and external services need.
 */
export async function requireServiceOrPermission(
	request: Request,
	permission: string,
): Promise<Response | null> {
	const isService = await validateServiceKey(request);
	if (isService) return null;

	return requirePermission(request, permission);
}
