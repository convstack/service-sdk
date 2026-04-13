import { getRequestUser } from "../auth";

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
		role?: string;
	} | null;
	orgRoles: Array<{ orgId: string; name?: string; slug: string; role: string }>;
	permissions: string[];
	/** Raw Request for escape hatches (cookies, custom headers, etc.) */
	request: Request;
}

/**
 * Build a HandlerContext from the proxy-injected headers on the request.
 * Called once per request by `createHandler`.
 */
export function buildHandlerContext<TDb>(
	request: Request,
	db: TDb,
): HandlerContext<TDb> {
	const parsed = getRequestUser(request);
	return {
		db,
		user: parsed
			? {
					id: parsed.id,
					email: parsed.email,
					name: parsed.name,
					role: parsed.role,
				}
			: null,
		orgRoles: parsed?.orgRoles ?? [],
		permissions: parsed?.permissions ?? [],
		request,
	};
}
