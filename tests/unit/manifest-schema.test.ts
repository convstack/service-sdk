import { describe, expect, it } from "vitest";
import {
	callout,
	dataTable,
	emptyState,
	tabs,
} from "../../src/manifest/sections";
import {
	formConfigSchema,
	pageSectionSchema,
	uiManifestSchema,
} from "../../src/manifest-schema";

const detail = (endpoint: string) => ({ type: "detail", endpoint, config: {} });

describe("section endpoints", () => {
	it.each([
		"",
		"/api/items",
		"/api/items/:id?view=full",
		"/%2F/x",
	])("accept %j", (endpoint) => {
		expect(pageSectionSchema.safeParse(detail(endpoint)).success).toBe(true);
	});

	it.each([
		"//evil.test/x",
		"/\\evil.test/x",
		"/\t/evil.test/x",
		"/api/items x",
		"https://evil.test/x",
		"@evil.test/x",
		"api/items",
	])("refuse %j, which could leave the service's host", (endpoint) => {
		expect(pageSectionSchema.safeParse(detail(endpoint)).success).toBe(false);
	});

	it.each([
		"/a/../b",
		"/a/./b",
		"/..",
		"/a/%2e%2e/b",
		"/a/%2E./b",
	])("refuse %j, whose dot segments URL parsing would resolve", (endpoint) => {
		expect(pageSectionSchema.safeParse(detail(endpoint)).success).toBe(false);
	});

	it.each([
		"/a/b?x=../y",
		"/a/..b/c",
	])("accept %j, which has no dot segment in its path", (endpoint) => {
		expect(pageSectionSchema.safeParse(detail(endpoint)).success).toBe(true);
	});

	it("check the sections inside tabs as well", () => {
		const tab = (endpoint: string) =>
			tabs({
				tabs: [{ key: "a", label: "A", sections: [dataTable(endpoint)] }],
			});
		expect(pageSectionSchema.safeParse(tab("//evil.test/x")).success).toBe(
			false,
		);
		expect(pageSectionSchema.safeParse(tab("/api/items")).success).toBe(true);
	});

	it("refuse a backslash later in the path", () => {
		expect(pageSectionSchema.safeParse(detail("/api\\x")).success).toBe(false);
	});

	it("check the sections of tabs inside tabs", () => {
		const nested = (endpoint: string) =>
			tabs({
				tabs: [
					{
						key: "a",
						label: "A",
						sections: [
							tabs({
								tabs: [
									{ key: "b", label: "B", sections: [dataTable(endpoint)] },
								],
							}),
						],
					},
				],
			});

		const refused = pageSectionSchema.safeParse(nested("//evil.test/x"));
		expect(refused.error?.issues.map((issue) => issue.path)).toEqual([
			[
				"config",
				"tabs",
				0,
				"sections",
				0,
				"config",
				"tabs",
				0,
				"sections",
				0,
				"endpoint",
			],
		]);
		expect(pageSectionSchema.safeParse(nested("/api/items")).success).toBe(
			true,
		);
	});

	it("refuse a tabs section whose config has no tabs", () => {
		const result = pageSectionSchema.safeParse({
			type: "tabs",
			endpoint: "",
			config: {},
		});
		expect(result.error?.issues.map((issue) => issue.path)).toEqual([
			["config", "tabs"],
		]);
	});

	it("keep the builders' empty endpoints valid", () => {
		for (const section of [
			tabs({ tabs: [] }),
			callout({ variant: "info", body: "Note" }),
			emptyState({ title: "Nothing here" }),
		]) {
			expect(pageSectionSchema.safeParse(section).success).toBe(true);
		}
	});
});

describe("a manifest's version", () => {
	const manifest = {
		name: "Ledger",
		icon: "receipt",
		navigation: [],
		widgets: [],
		pages: [],
		permissions: [],
	};

	it("is required, since lanyard shows it for every service", () => {
		expect(uiManifestSchema.safeParse(manifest).success).toBe(false);
		expect(
			uiManifestSchema.safeParse({ ...manifest, version: "" }).success,
		).toBe(false);
	});

	it("is accepted when the service gives one", () => {
		expect(
			uiManifestSchema.safeParse({ ...manifest, version: "1.2.3" }).success,
		).toBe(true);
	});
});

describe("a colour field and a theme preview", () => {
	const field = (type: string) => ({ key: "accent", label: "Accent", type });

	it("accepts a color field", () => {
		expect(
			formConfigSchema.safeParse({ fields: [field("color")] }).success,
		).toBe(true);
	});

	it("still refuses a field type it does not know", () => {
		expect(formConfigSchema.safeParse({ fields: [field("hue")] }).success).toBe(
			false,
		);
	});

	it("accepts a theme preview with an endpoint", () => {
		expect(
			formConfigSchema.safeParse({
				fields: [field("color")],
				preview: { kind: "theme", endpoint: "/api/admin/branding/preview" },
			}).success,
		).toBe(true);
	});

	it.each([
		{ kind: "theme" },
		{ kind: "gallery", endpoint: "/x" },
		{ kind: "theme", endpoint: "//evil.test/x" },
		{ kind: "theme", endpoint: "" },
	])("refuses the preview %j", (preview) => {
		expect(
			formConfigSchema.safeParse({ fields: [field("color")], preview }).success,
		).toBe(false);
	});
});
