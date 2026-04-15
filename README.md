<img width="1400" height="400" alt="1400x400" src="https://github.com/user-attachments/assets/915029bd-f7a0-4442-9041-d6d46dca7320" />

# @convstack/service-sdk

Shared SDK for ConvStack services. Provides manifest DSL, request handlers, auth helpers, DB utilities, and Vite config.

---

## Writing a service

### Quick start

```bash
bun create @convstack/service my-service
cd my-service
cp .env.example .env
bun run service:setup   # creates DB, runs migrations, registers with lanyard
bun run dev
```

### Project structure

| File | Purpose |
|------|---------|
| `vite.config.ts` | Calls `defineServiceConfig` — sets port, plugins, dev-init hook |
| `src/lib/manifest.ts` | Defines every page, sidebar, and widget the dashboard renders |
| `src/server/services/self-register.ts` | Exports `createSelfRegister(manifest)` — called on startup to heartbeat lanyard |
| `src/routes/api/health.tsx` | Health-check endpoint; lanyard polls this to detect downtime |

### Adding pages

Import helpers from `@convstack/service-sdk/manifest` and add entries to the `pages` array in your manifest:

```ts
import { defineManifest, page, sidebar, item, dataTable } from "@convstack/service-sdk/manifest";

export const MY_MANIFEST = defineManifest({
  name: "My Service",
  slug: "my-service",
  sidebar: sidebar({ items: [item("Foo", "/foo", { icon: "list" })] }),
  pages: [
    page("/foo", "Foo", { layout: "default" }, [
      dataTable("/api/foo", { columns: ["name", "status"] }),
    ]),
  ],
});
```

`defineManifest` validates the manifest at call time (service boot), so schema errors surface immediately.

### Adding endpoints

Create a file route under `src/routes/api/`. Use `createHandler` from `@convstack/service-sdk/handlers`:

```ts
// src/routes/api/foo.tsx
import { createHandler } from "@convstack/service-sdk/handlers";
import { requirePermission } from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "~/server/db";

export const Route = createFileRoute("/api/foo")({
  server: {
    handlers: {
      GET: createHandler({
        db,
        input: z.object({ limit: z.coerce.number().default(50) }),
        handler: async (ctx) => {
          requirePermission(ctx, "foo:read");
          return db.query.foo.findMany({ limit: ctx.input.limit });
        },
      }),
    },
  },
});
```

Input is merged from query params, path params, and body (body wins on collision). Validation errors automatically return 422. Unhandled throws return 500.

### Available helpers

| Import | Exports |
|--------|---------|
| `@convstack/service-sdk/manifest` | `defineManifest`, `page`, `sidebar`, `item`, `coordinatorItem`, `conventionAdminItem`, all section helpers |
| `@convstack/service-sdk/manifest/fields` | `textField`, `textareaField`, `numberField`, `selectField`, `datetimeField`, `dateField`, `emailField`, `checkboxesField` |
| `@convstack/service-sdk/handlers` | `createHandler`, `HandlerContext`, `ServiceError`, `httpError` |
| `@convstack/service-sdk/permissions` | `requireAuth`, `requireCoordinatorOf`, `requireAnyCoordinator`, `requirePermission`, `requireAnyPermission`, `requireOwnResource` |
| `@convstack/service-sdk/db` | `createDb`, `runMigrations` |
| `@convstack/service-sdk/response` | `scheduleData`, `approvalQueueData`, `ok` |
| `@convstack/service-sdk/bootstrap` | `bootstrap()` |
| `@convstack/service-sdk/vite` | `defineServiceConfig` |
| `@convstack/service-sdk/registration` | `createSelfRegister` |

### Permissions

Declare permissions in the manifest so lanyard can display them in the admin UI:

```ts
defineManifest({
  // ...
  permissions: ["foo:read", "foo:write"],
});
```

Enforce them in handlers with `requirePermission`:

```ts
import { requirePermission } from "@convstack/service-sdk/permissions";

handler: async (ctx) => {
  requirePermission(ctx, "foo:write"); // throws 403 if not granted
  // ...
}
```

Permissions are assigned to department roles in the lanyard admin panel. `ctx.permissions` is populated from the proxy headers on every request.

---

## OpenAPI artifacts

`dist/manifest.schema.json` — JSON Schema for `UIManifest`.  
`dist/wire-contract.openapi.json` — OpenAPI spec for the lanyard wire contract.

Regenerate with:

```bash
bun run openapi:export
```
