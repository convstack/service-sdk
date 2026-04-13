import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

// Cache the drizzle client per connection string so Vite's SSR module
// re-evaluation doesn't create a new pg.Pool on every file change.
// Without this, each hot-reload leaks a pool (10 connections default)
// until Postgres runs out of connections.
const clientCache = new Map<string, ReturnType<typeof drizzle>>();

/**
 * Create a typed Drizzle client. Reads DATABASE_URL from env by default.
 * Caches per connection string — safe to call multiple times (e.g. during
 * Vite dev hot-reload) without leaking connection pools.
 *
 * Usage:
 * ```ts
 * import { createDb } from "@convstack/service-sdk/db";
 * export const db = createDb();
 * ```
 */
export function createDb(options: { connectionString?: string } = {}) {
	const url = options.connectionString ?? process.env.DATABASE_URL;
	if (!url) {
		throw new Error(
			"DATABASE_URL is required. Set it in .env or pass connectionString to createDb()",
		);
	}
	const cached = clientCache.get(url);
	if (cached) return cached;
	const client = drizzle(url);
	clientCache.set(url, client);
	return client;
}

/**
 * Run Drizzle Kit migrations. Reads DATABASE_URL from env by default.
 * Reuses the cached drizzle client to avoid leaking a connection pool.
 */
export async function runMigrations(options: {
	migrationsFolder: string;
	connectionString?: string;
}): Promise<void> {
	const url = options.connectionString ?? process.env.DATABASE_URL;
	if (!url) throw new Error("DATABASE_URL is required for migrations");
	const db = createDb({ connectionString: url });
	await migrate(db, { migrationsFolder: options.migrationsFolder });
	console.log("[service-sdk] migrations applied");
}
