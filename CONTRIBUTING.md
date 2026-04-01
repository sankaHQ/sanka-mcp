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

- `src/` is the internal API client used by the MCP server.
- `packages/mcp-server/` contains the MCP transport, tool wiring, and Docker entrypoint.
- When the Sanka OpenAPI contract changes, update this repo intentionally instead of assuming a hosted generator will rewrite it for you.

See [docs/openapi-maintenance.md](/Users/haegwan/Sites/sanka/sanka-mcp/docs/openapi-maintenance.md) for the preferred update workflow.

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
