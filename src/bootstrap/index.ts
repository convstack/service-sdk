import { execSync } from "node:child_process";

interface BootstrapOptions {
	/** Service slug — used for log prefixes and default DB name derivation. */
	slug: string;
	/** Path to the drizzle migrations folder. Default: "./src/db/migrations" */
	migrationsFolder?: string;
}

/**
 * One-shot database setup: create the Postgres database if it doesn't exist,
 * then run Drizzle migrations. Fully idempotent — safe to re-run.
 *
 * Service registration with lanyard is done manually via the lanyard admin
 * UI (Services → Create Service). Copy the generated key into your .env as
 * LANYARD_SERVICE_KEY.
 *
 * Usage in a service's scripts/setup.ts:
 * ```ts
 * import { bootstrap } from "@convstack/service-sdk/bootstrap";
 * await bootstrap({ slug: "my-service" });
 * ```
 */
export async function bootstrap(options: BootstrapOptions): Promise<void> {
	const { slug } = options;
	console.log(`[${slug}:setup] starting`);

	const dbUrl =
		process.env.DATABASE_URL ??
		`postgresql://${slug}:${slug}@localhost:5432/${slug}_dev`;
	const match = dbUrl.match(
		/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/,
	);
	if (match) {
		const [, user, pass, host, portStr, dbName] = match;
		try {
			const { Client } = await import("pg");
			const admin = new Client({
				host,
				port: Number(portStr),
				user,
				password: pass,
				database: "postgres",
			});
			await admin.connect();
			const exists = await admin.query(
				"SELECT 1 FROM pg_database WHERE datname = $1",
				[dbName],
			);
			if (exists.rowCount === 0) {
				await admin.query(`CREATE DATABASE "${dbName}"`);
				console.log(`[${slug}:setup] created database ${dbName}`);
			} else {
				console.log(`[${slug}:setup] database ${dbName} already exists`);
			}
			await admin.end();
		} catch (err) {
			console.error(`[${slug}:setup] fatal: cannot connect to Postgres`, err);
			process.exit(1);
		}
	}

	console.log(`[${slug}:setup] running migrations`);
	execSync("bun run db:migrate", { stdio: "inherit" });

	console.log(`[${slug}:setup] done`);
	console.log(
		`[${slug}:setup] Next: create the service in the lanyard admin UI and copy the key into .env as LANYARD_SERVICE_KEY`,
	);
}
