import type { HandlerContext } from "../handlers/context";
import { httpError } from "../handlers/errors";

export function requireAuth<TDb>(
	ctx: HandlerContext<TDb>,
): asserts ctx is HandlerContext<TDb> & {
	user: NonNullable<HandlerContext<TDb>["user"]>;
} {
	if (!ctx.user) throw httpError.unauthorized();
}

export function requireCoordinatorOf<TDb>(
	ctx: HandlerContext<TDb>,
	departmentId: string,
) {
	requireAuth(ctx);
	const role = ctx.orgRoles.find((r) => r.orgId === departmentId);
	if (!role || (role.role !== "admin" && role.role !== "owner")) {
		throw httpError.forbidden("Coordinator role required for this department");
	}
}

export function requireAnyCoordinator<TDb>(ctx: HandlerContext<TDb>) {
	requireAuth(ctx);
	const hasAny = ctx.orgRoles.some(
		(r) => r.role === "admin" || r.role === "owner",
	);
	if (!hasAny) throw httpError.forbidden("Coordinator role required");
}

export function requirePermission<TDb>(
	ctx: HandlerContext<TDb>,
	permission: string,
) {
	requireAuth(ctx);
	if (!ctx.permissions.includes(permission)) {
		throw httpError.forbidden(
			`The "${permission}" permission is required. Ask a lanyard admin to map it to your department role in Manage permissions.`,
		);
	}
}

export function requireAnyPermission<TDb>(
	ctx: HandlerContext<TDb>,
	permissions: string[],
) {
	requireAuth(ctx);
	if (!permissions.some((p) => ctx.permissions.includes(p))) {
		throw httpError.forbidden(
			`One of these permissions is required: ${permissions.join(", ")}`,
		);
	}
}

export function requireOwnResource<TDb>(
	ctx: HandlerContext<TDb>,
	resourceUserId: string,
) {
	requireAuth(ctx);
	if (ctx.user.id !== resourceUserId) {
		throw httpError.forbidden("Not your resource");
	}
}
