# Publishing

For the maintainer(s). mostly faye.

## One-time setup

1. Create an account at [npmjs.com](https://www.npmjs.com).
2. Generate a publish token (`Automation` type) in npm Settings → Access Tokens.
3. Add to `~/.npmrc`:
   ```
   //registry.npmjs.org/:_authToken=<your-token>
   ```

## Release checklist

### 1. Version bump

Bump both packages together (patch / minor / major):

```bash
cd G:/git/headpat/convention-apps/service-sdk  && bun version patch
cd G:/git/headpat/convention-apps/create-service && bun version patch
```

### 2. Build create-service CLI

```bash
cd G:/git/headpat/convention-apps/create-service && bun run build
```

Outputs `dist/cli.js`. This is what npm ships.

### 3. Refresh OpenAPI artifacts

```bash
cd G:/git/headpat/convention-apps/service-sdk && bun run openapi:export
```

Updates `dist/manifest.schema.json` and `dist/wire-contract.openapi.json`.

### 4. Publish

```bash
cd G:/git/headpat/convention-apps/service-sdk  && bun publish
cd G:/git/headpat/convention-apps/create-service && bun publish
```

`prepublishOnly` runs typecheck + openapi:export automatically for `service-sdk`.

### 5. Verify

```bash
bunx @convstack/create-service@latest test-verify --yes && rm -rf test-verify
```

Scaffolds a service into `test-verify/`, then deletes it. If it errors, the publish was broken.
