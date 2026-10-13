<img width="1400" height="400" alt="1400x400" src="https://github.com/user-attachments/assets/915029bd-f7a0-4442-9041-d6d46dca7320" />

# @convstack/service-sdk

Shared SDK for ConvStack services. Provides manifest DSL, request handlers, auth helpers, DB utilities, and Vite config.

---

## Writing a service

### Quick start

```bash
npx @convstack/create-service my-service
cd my-service
cp .env.example .env
bun run db:generate     # writes the first migration
bun run service:setup   # creates the database and runs the migrations
bun run dev
```

`bunx` works in place of `npx`. Without a database or pages the matching steps are left out of the printed next steps.

In the lanyard admin UI go to Services, then Register Service, and enter the service's name and slug, its base URL (`http://localhost:` plus the `PORT` in `.env`) and `/api/health` as the health path. Put the key it shows into `.env` as `LANYARD_SERVICE_KEY`; the service registers itself on start.

### Project structure

| File | Purpose |
|------|---------|
| `vite.config.ts` | Calls `defineServiceConfig` — sets port, plugins, dev-init hook |
| `src/lib/manifest.ts` | Defines every page, sidebar, and widget the dashboard renders |
| `server.ts` | Serves the built service in production (`bun run start`) |
| `scripts/bootstrap.ts`, `src/db/` | Database setup, schema and migrations; only with a database |
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

### Version

Every manifest needs a `version`. `defineManifest` reads it from your `package.json`, so bumping the package is how a service changes its version. Lanyard stores what the manifest says on each registration and shows it in the catalog; it can't be edited in the admin UI, and a manifest without one is refused.

A `color` form field (`colorField`) renders a colour picker next to a hex box, so people can see the colour they are choosing; its value is `#rrggbb`. A form section can also set `preview: { kind: "theme", endpoint }` to draw a live preview beside the form: the dashboard posts the form's current values to the endpoint and paints the preview from the tokens it returns (lanyard's Branding page uses this).

### Adding endpoints

Create a file route under `src/routes/api/`. Use `createHandler` from `@convstack/service-sdk/handlers`:

```ts
// src/routes/api/foo.tsx
import { createHandler } from "@convstack/service-sdk/handlers";
import { requirePermission } from "@convstack/service-sdk/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "~/db";

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

Input is merged from query params, body, and path params. A path param wins over a body key of the same name, and a body key over a query one. A body that is not a JSON object, and input that fails the schema, return 400. Unhandled throws, and an answer that fails the `output` schema, return 500 and are logged.

Every `createHandler` route checks the proof lanyard signs for each request (`Authorization: Bearer <proof>`). Without a valid one it answers 401, and while lanyard can't be reached for this service's slug or signing keys it answers 503. Pass `skipAuth: true` only for a health check, which lanyard calls without a proof.

Lanyard's signing keys are fetched at most once every 5 seconds, so lanyard has to publish a new key before it signs with it. A proof naming a key that isn't published is answered 401 and logged once a minute.

### Upgrading from 0.2

- Every request needs lanyard's proof; `X-User-*` headers count for nothing. `requireServiceOrPermission`, `validateServiceKey` and `requireServiceKey` are gone: a service calls another with a proof from `getServiceToken`, and `requirePermission` accepts it when an admin granted the permission under Allowed Callers.
- `getRequestUser`, `hasPermission`, `requirePermission` and `requireAnyPermission` are async now, so await them.
- `ctx.user.role` is gone, and so is `role` on the user `getRequestUser` returns.
- Give the health route `skipAuth: true`. Lanyard's health check carries no proof, and after about 10 minutes of 401s lanyard marks the service inactive.
- In a raw route only users may call, use `requireUser`: `const user = await requireUser(request); if (user instanceof Response) return user;`. It answers 401 without a user proof and 503 while lanyard can't be reached.

### Available helpers

| Import | Exports |
|--------|---------|
| `@convstack/service-sdk/manifest` | `defineManifest`, `page`, `sidebar`, `item`, `coordinatorItem`, `conventionAdminItem`, all section helpers |
| `@convstack/service-sdk/manifest/fields` | `textField`, `textareaField`, `numberField`, `selectField`, `colorField`, `datetimeField`, `dateField`, `emailField`, `checkboxesField` |
| `@convstack/service-sdk/handlers` | `createHandler`, `HandlerContext`, `ServiceError`, `httpError` |
| `@convstack/service-sdk/permissions` | `requireAuth`, `requireCoordinatorOf`, `requireAnyCoordinator`, `requirePermission`, `requireAnyPermission`, `requireOwnResource` |
| `@convstack/service-sdk/auth` | `getRequestUser`, `getRequestCaller`, `requireUser`, `requirePermission`, `requireAnyPermission`, `hasPermission`, for routes that don't use `createHandler` |
| `@convstack/service-sdk/lanyard` | `lanyardFetch`, a fetch to lanyard with this service's key |
| `@convstack/service-sdk/service-token` | `getServiceToken`, a proof for calling another service |
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

Permissions are assigned to department roles in the lanyard admin panel. They arrive in the proof lanyard signs for each request, as `ctx.permissions` and `ctx.orgRoles`. When another service calls, `ctx.user` is null and `ctx.caller` holds its slug and the permissions an admin granted it under Allowed Callers; `requirePermission` and `requireAnyPermission` accept those too.

---

## OpenAPI artifacts

`dist/manifest.schema.json` — JSON Schema for `UIManifest`.  
`dist/wire-contract.openapi.json` — OpenAPI spec for the lanyard wire contract.

Regenerate with:

```bash
bun run openapi:export
```
