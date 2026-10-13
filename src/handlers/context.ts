import type { Principal } from "../proof";

/**
 * The typed context every handler receives via `createHandler`. The TDb
 * generic is the service's drizzle client type — callers pass their own
 * `typeof db` so handler code gets full autocomplete on table queries.
 */
export interface HandlerContext<TDb = unknown> {
	db: TDb;
	user: {
		id: string;
		email: string;
		name: string;
	} | null;
	/** Set instead of `user` when another service calls with a service proof. */
	caller: { slug: string; scope: string[] } | null;
	orgRoles: Array<{ orgId: string; name?: string; slug: string; role: string }>;
	permissions: string[];
	/** Raw Request for escape hatches (cookies, custom headers, etc.) */
	request: Request;
}

/**
 * Build a HandlerContext from the principal lanyard's proof names.
 * Called once per request by `createHandler`.
 */
export function buildHandlerContext<TDb>(
	request: Request,
	db: TDb,
	principal: Principal | null,
): HandlerContext<TDb> {
	const user = principal?.kind === "user" ? principal.user : null;
	return {
		db,
		user: user ? { id: user.id, email: user.email, name: user.name } : null,
		caller: principal?.kind === "service" ? principal.caller : null,
		orgRoles: user?.orgRoles ?? [],
		permissions: user?.permissions ?? [],
		request,
	};
}
