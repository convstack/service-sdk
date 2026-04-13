/**
 * Shared Vite plugins for ConvStack services.
 */

import type { Plugin } from "vite";

/**
 * Vite plugin that generates the OpenAPI spec on dev startup and build.
 */
export function openApiPlugin(serviceName: string): Plugin {
	return {
		name: `${serviceName}-openapi`,
		buildStart() {
			import("node:child_process").then(({ execSync }) => {
				try {
					execSync("bun run openapi:generate", { stdio: "inherit" });
				} catch {
					console.warn("Failed to generate OpenAPI spec");
				}
			});
		},
	};
}

/**
 * Vite plugin that runs service initialization on dev server startup, and
 * optionally re-runs it whenever the manifest source file changes during
 * `vite dev`. Without hot-reload, services keep their stale UIManifest in
 * lanyard until every process is restarted.
 */
export function devInitPlugin(
	serviceName: string,
	options: {
		/** Module path to import (e.g. "~/server/services/self-register") */
		registerModule: string;
		/** Function name to call from the module (e.g. "registerGuidebook") */
		registerFunction: string;
		/**
		 * Absolute paths whose changes should trigger re-registration. Usually
		 * the manifest source file(s). Omit to disable hot-reload.
		 */
		watchPaths?: string[];
	},
): Plugin {
	const register = async (
		server: import("vite").ViteDevServer,
		reason: string,
	) => {
		try {
			// Invalidate the cached SSR module so the next load picks up
			// any edits to the manifest or its transitive imports.
			const mod = await server.ssrLoadModule(options.registerModule, {
				fixStacktrace: true,
			});
			await mod[options.registerFunction]();
			if (reason !== "boot") {
				console.log(`[${serviceName}] re-registered manifest (${reason})`);
			}
		} catch (err) {
			console.warn(`Failed to self-register ${serviceName} (${reason}):`, err);
		}
	};

	return {
		name: `${serviceName}-dev-init`,
		configureServer(server) {
			server.httpServer?.once("listening", () => register(server, "boot"));

			if (options.watchPaths?.length) {
				// chokidar normalizes paths; add() is idempotent.
				server.watcher.add(options.watchPaths);
				server.watcher.on("change", (file) => {
					if (options.watchPaths?.some((p) => file === p || file.endsWith(p))) {
						// Drop the cached SSR module so the next load is fresh.
						const cached = server.moduleGraph.getModuleById(
							options.registerModule,
						);
						if (cached) server.moduleGraph.invalidateModule(cached);
						register(server, `change: ${file}`);
					}
				});
			}
		},
	};
}
