import { describe, expect, it } from "vitest";
import { colorField } from "../../src/manifest/fields";
import { formConfigSchema } from "../../src/manifest-schema";

describe("colorField", () => {
	it("builds a field the schema accepts", () => {
		const field = colorField("accent", "Accent colour", { required: true });

		expect(field).toEqual({
			key: "accent",
			label: "Accent colour",
			type: "color",
			required: true,
		});
		expect(formConfigSchema.safeParse({ fields: [field] }).success).toBe(true);
	});
});
