/**
 * Production server boilerplate for ConvStack services.
 * Wraps Bun.serve with static file handling and startup hooks.
 */

import { join } from "node:path";

const MIME_TYPES: Record<string, string> = {
	".js": "application/javascript",
	".css": "text/css",
	".html": "text/html",
	".json": "application/json",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".avif": "image/avif",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".map": "application/json",
	".txt": "text/plain",
	".xml": "application/xml",
	".webmanifest": "application/manifest+json",
};

function getMimeType(path: string): string {
	const ext = path.slice(path.lastIndexOf("."));
	return MIME_TYPES[ext] || "application/octet-stream";
}

export interface ServiceServerOptions {
	/** Port to listen on. Falls back to PORT env var. */
	port: number;
	/** Service display name for logging. */
	name: string;
	/** Path to the built server entry. Default: "./dist/server/server.js" */
	appEntry?: string;
	/** Startup hooks — run after server starts. */
	onStart?: () => Promise<void>;
}

/**
 * Create and start a production Bun server for a ConvStack service.
 */
export function createServiceServer(options: ServiceServerOptions): void {
	const port = Number(process.env.PORT) || options.port;
	const distClient = join(process.cwd(), "dist", "client");

	// Dynamic import of the built TanStack Start server
	const appPath = options.appEntry || "./dist/server/server.js";

	import(appPath).then((mod) => {
		const app = mod.default;

		Bun.serve({
			port,
			async fetch(request: Request) {
				const url = new URL(request.url);
				if (url.pathname.startsWith("/assets/")) {
					const filePath = join(distClient, url.pathname);
					const file = Bun.file(filePath);
					if (await file.exists()) {
						return new Response(file, {
							headers: {
								"Content-Type": getMimeType(url.pathname),
								"Cache-Control": "public, max-age=31536000, immutable",
							},
						});
					}
				}
				return app.fetch(request);
			},
		});

		console.log(`${options.name} server listening on http://localhost:${port}`);

		if (options.onStart) {
			options
				.onStart()
				.catch((err) =>
					console.warn(`${options.name} startup hook failed:`, err),
				);
		}
	});
}
