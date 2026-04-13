import { resolve } from "node:path";
// Use the package's own export path so Node's ESM resolver finds it
// regardless of whether the SDK is consumed via workspace link or npm.
import { devInitPlugin } from "@convstack/service-sdk/vite-plugins";

function toPascalCase(slug: string): string {
	return slug
		.split("-")
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
		.join("");
}

/**
 * Build a Vite config for a ConvStack service. Handles `devInitPlugin`
 * wiring (manifest hot-reload + self-registration) and sensible defaults.
 *
 * Vite plugins like tailwindcss, tanstackStart, and viteReact are passed
 * by the caller — they live in each service's devDeps, not in the SDK,
 * so the SDK can't import them without cross-package resolution issues.
 *
 * Usage:
 * ```ts
 * import { defineConfig } from "vite";
 * import tailwindcss from "@tailwindcss/vite";
 * import { tanstackStart } from "@tanstack/react-start/plugin/vite";
 * import viteReact from "@vitejs/plugin-react";
 * import { defineServiceConfig } from "@convstack/service-sdk/vite";
 *
 * export default defineConfig(defineServiceConfig({
 *   slug: "my-service",
 *   plugins: [tailwindcss(), tanstackStart({ srcDirectory: "src" }), viteReact()],
 * }));
 * ```
 */
export function defineServiceConfig(options: {
	slug: string;
	/** Vite plugins from the service's own devDeps (tailwindcss, tanstackStart, viteReact, etc.) */
	// biome-ignore lint/suspicious/noExplicitAny: plugin types vary across vite versions
	plugins: any[];
	port?: number;
	manifestPath?: string;
	registerModule?: string;
	registerFunction?: string;
	extend?: Record<string, unknown>;
}) {
	const slug = options.slug;
	const port = options.port ?? 5050;
	const manifestPath = options.manifestPath ?? "src/lib/manifest.ts";
	const registerModule =
		options.registerModule ?? "~/server/services/self-register";
	const registerFunction =
		options.registerFunction ?? `register${toPascalCase(slug)}`;

	return {
		server: { port },
		resolve: { tsconfigPaths: true },
		plugins: [
			// Service-provided plugins first (tailwindcss, tanstackStart, viteReact, etc.)
			...options.plugins,
			// SDK-provided: hot-reload manifest re-registration during dev
			devInitPlugin(slug, {
				registerModule,
				registerFunction,
				watchPaths: [resolve(process.cwd(), manifestPath)],
			}),
		],
		...options.extend,
	};
}
