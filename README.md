# Sanka MCP Server

This repository packages the Stainless-generated Sanka TypeScript SDK together with the generated MCP server in `packages/mcp-server`.

The hosted deployment target is a remote Streamable HTTP server for MCP clients. The server exposes:

- `POST /mcp` as the primary MCP endpoint
- `POST /sse` as a compatibility alias for clients that still expect an SSE-style path
- `POST /` as a compatibility alias
- `GET /health` for Fly health checks

Current live URL:

- `https://sanka-mcp.fly.dev/mcp`

Planned custom domain after DNS cutover:

- `https://mcp.sanka.com/mcp`

## Auth

Remote clients authenticate with either:

- `Authorization: Bearer <token>`
- `x-sanka-api-key: <token>`

The server forwards those credentials to the Sanka public API.

## Local Development

```sh
pnpm install
pnpm build
node packages/mcp-server/dist/index.js --transport=http --port=8080 --docs-search-mode=local --code-execution-mode=local
```

Then verify:

```sh
curl http://127.0.0.1:8080/health
```

## Fly Deployment

This repo includes a root `fly.toml` that builds from `packages/mcp-server/Dockerfile` and runs one always-on machine in HTTP mode.

Deploy with:

```sh
fly deploy -c fly.toml
```

Pushes to `main` also deploy automatically through GitHub Actions once the `FLY_API_TOKEN` repository secret is set.

## Notes

- The MCP server code is generated from the Sanka OpenAPI contract with Stainless.
- The bundled runtime currently defaults to local docs search and local code execution inside the Fly machine, so it does not require a Stainless API key at runtime.
- If we later want Stainless-hosted sandboxes or hosted docs search, we can switch the container args and add the appropriate Stainless credentials.
