/**
 * Request-level checks for raw route handlers. Every request carries a proof
 * lanyard signed for this service, as `Authorization: Bearer <proof>`: a user
 * proof when the dashboard proxies a user, a service proof when another
 * service calls with a grant. createHandler routes get the same answers as
 * ctx.user and ctx.caller.
 */

import { checkProof, type RequestUser, type ServiceCaller } from "./proof";

export type { RequestUser, ServiceCaller } from "./proof";

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

/** The user behind the request; null without a proof, with a bad one, or for a service. */
export async function getRequestUser(
	request: Request,
): Promise<RequestUser | null> {
	const proof = await checkProof(request);
	return proof.ok && proof.principal.kind === "user"
		? proof.principal.user
		: null;
}

/**
 * The user behind the request, for routes only users may call. Otherwise the
 * response to send: the proof check's 401 or 503, or 401 for a service proof.
 */
export async function requireUser(
	request: Request,
): Promise<RequestUser | Response> {
	const proof = await checkProof(request);
	if (!proof.ok) return json(proof.status, { error: proof.error });
	if (proof.principal.kind !== "user") {
		return json(401, { error: "Unauthorized" });
	}
	return proof.principal.user;
}

/** The calling service, when the request carries a service proof. */
export async function getRequestCaller(
	request: Request,
): Promise<ServiceCaller | null> {
	const proof = await checkProof(request);
	return proof.ok && proof.principal.kind === "service"
		? proof.principal.caller
		: null;
}

// a user's permissions, or the scope an admin granted a calling service
async function grantedPermissions(
	request: Request,
): Promise<string[] | Response> {
	const proof = await checkProof(request);
	if (!proof.ok) return json(proof.status, { error: proof.error });
	return proof.principal.kind === "user"
		? proof.principal.user.permissions
		: proof.principal.caller.scope;
}

/**
 * Check if the request has a specific permission.
 */
export async function hasPermission(
	request: Request,
	permission: string,
): Promise<boolean> {
	const granted = await grantedPermissions(request);
	return !(granted instanceof Response) && granted.includes(permission);
}

/**
 * Require a specific permission. Returns an error Response if missing, null if granted.
 */
export async function requirePermission(
	request: Request,
	permission: string,
): Promise<Response | null> {
	const granted = await grantedPermissions(request);
	if (granted instanceof Response) return granted;
	if (!granted.includes(permission)) {
		return json(403, { error: "Forbidden", required: permission });
	}
	return null;
}

/**
 * Require any one of the listed permissions.
 */
export async function requireAnyPermission(
	request: Request,
	permissions: string[],
): Promise<Response | null> {
	const granted = await grantedPermissions(request);
	if (granted instanceof Response) return granted;
	if (!permissions.some((p) => granted.includes(p))) {
		return json(403, { error: "Forbidden", required: permissions });
	}
	return null;
}
