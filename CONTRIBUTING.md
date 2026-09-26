## Setting up the environment

This repository uses [`pnpm`](https://pnpm.io/).
Other package managers may work but are not officially supported for development.

To set up the repository, run:

```sh
$ pnpm install
$ pnpm build
```

This will install all the required dependencies and build output files to `dist/`.

## Repository model

This repository is maintained directly. It is no longer treated as generated infrastructure.

- `src/` is the TypeScript client used by the MCP server to call Sanka's externally callable API surface.
- `src/internal/` contains package-private SDK runtime helpers, not Sanka private backend code.
- `packages/mcp-server/` contains the MCP transport, tool wiring, and Docker entrypoint.
- When the Sanka OpenAPI contract changes, update this repo intentionally instead of assuming a hosted generator will rewrite it for you.

## Adding and running examples

If you add examples or local verification scripts, keep them runnable against the current hosted/local MCP service.

```ts
// add an example to examples/<your-example>.ts

#!/usr/bin/env -S npm run tsn -T
…
```

```sh
$ chmod +x examples/<your-example>.ts
# run the example against your api
$ pnpm tsn -T examples/<your-example>.ts
```

## Using the repository from source

The main production artifact is the hosted MCP endpoint at `https://mcp.sanka.com/mcp`, not an SDK package published from this repo.

## Running tests

```sh
$ pnpm run test
```

## Writing tests

- Test each behaviour once, at the boundary that owns it. Do not add a second test for the same behaviour at another layer.
- Tool tests call the tool through the real SDK client with a fake `fetch` and assert the outgoing HTTP request (method, URL, body) and the result, as in `tests/mcp-server/mutation-passthrough-v2.test.ts`. Do not mock SDK methods to assert what the tool passed them.
- Keep a focused test for guards (confirmation, validation, auth, workspace scoping) and for output the tool computes; plain forwarding is one request row.
- Do not pin tool metadata such as `securitySchemes`, `httpPath`, descriptions or schema fields unless the value is a public contract clients depend on; assert invariants over all tools instead of listing literals.
- Do not read source, config or workflow files as text in tests (`fly.toml`, `.github/`, `src/`); test the behaviour they produce.

## Linting and formatting

This repository uses [prettier](https://www.npmjs.com/package/prettier) and
[eslint](https://www.npmjs.com/package/eslint) to format the code in the repository.

To lint:

```sh
$ pnpm lint
```

To format and fix all lint issues automatically:

```sh
$ pnpm fix
```
