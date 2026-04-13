// service-sdk/scripts/export-openapi.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  buildManifestJsonSchema,
  buildWireContractOpenApi,
} from "../src/openapi/export";

const outDir = join(process.cwd(), "dist");
mkdirSync(outDir, { recursive: true });

writeFileSync(
  join(outDir, "manifest.schema.json"),
  JSON.stringify(buildManifestJsonSchema(), null, 2),
);
writeFileSync(
  join(outDir, "wire-contract.openapi.json"),
  JSON.stringify(buildWireContractOpenApi(), null, 2),
);

console.log("✔ dist/manifest.schema.json");
console.log("✔ dist/wire-contract.openapi.json");
