/**
 * @convstack/service-sdk
 *
 * Shared utilities for building ConvStack services.
 *
 * Import specific modules:
 *   import { getRequestUser, requirePermission } from "@convstack/service-sdk/auth";
 *   import type { UIManifest } from "@convstack/service-sdk/types";
 *   import { resolveUserName } from "@convstack/service-sdk/users";
 *   import { createServiceServer } from "@convstack/service-sdk/server";
 *   import { registerService } from "@convstack/service-sdk/registration";
 *   import { openApiPlugin, devInitPlugin } from "@convstack/service-sdk/vite-plugins";
 *   import { generateOpenApiSpec } from "@convstack/service-sdk/openapi";
 */

export * from "./auth";
export * from "./registration";
export * from "./types";
export * from "./users";
