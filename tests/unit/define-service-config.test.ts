import { describe, expect, it, vi } from "vitest";
import { defineServiceConfig } from "../../src/vite";

function bootPlugin(options: { registerModule?: string } = {}) {
	const config = defineServiceConfig({
		slug: "lost-found",
		plugins: [],
		...options,
	});
	const plugin = config.plugins.find(
		(p: { name?: string }) => p.name === "lost-found-dev-init",
	);
	const register = vi.fn();
	const ssrLoadModule = vi.fn(async () => ({ registerLostFound: register }));
	const server = {
		httpServer: { once: (_event: string, run: () => void) => run() },
		ssrLoadModule,
		watcher: { add: () => {}, on: () => {} },
	};
	plugin.configureServer(server);
	return { ssrLoadModule, register };
}

describe("defineServiceConfig", () => {
	it("loads the self-register module by a path that needs no alias, since newer vite does not resolve ~ for a module without an importer", async () => {
		const { ssrLoadModule, register } = bootPlugin();
		await vi.waitFor(() => expect(register).toHaveBeenCalled());

		expect(ssrLoadModule.mock.calls[0][0]).toBe(
			"/src/server/services/self-register.ts",
		);
	});

	it("keeps a module path the service chose", async () => {
		const { ssrLoadModule, register } = bootPlugin({
			registerModule: "/src/boot/register.ts",
		});
		await vi.waitFor(() => expect(register).toHaveBeenCalled());

		expect(ssrLoadModule.mock.calls[0][0]).toBe("/src/boot/register.ts");
	});
});
