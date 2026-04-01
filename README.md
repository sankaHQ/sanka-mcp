# Sanka MCP Server

This repository contains the hosted Sanka MCP service and the internal TypeScript API client it depends on. It is now maintained as a normal TypeScript workspace, not as a Stainless-managed repository.

The production service is a remote Streamable HTTP MCP endpoint:

- `POST /mcp` as the primary endpoint
- `POST /sse` as a compatibility alias for clients that still expect an SSE-style path
- `POST /` as a compatibility alias
- `GET /health` for health checks

Live endpoints:

- `https://mcp.sanka.com/mcp`
- `https://mcp.sanka.com/sse`

## Repository layout

- `src/`: internal Sanka API client used by the MCP service
- `packages/mcp-server/`: the MCP server application and Docker entrypoint
- `.github/workflows/`: CI plus Fly deployment on `main`
- `fly.toml`: production Fly app configuration
- `docs/openapi-maintenance.md`: guidance for keeping API coverage current without Stainless

## Auth

Remote clients authenticate with either:

- `Authorization: Bearer <token>`
- `x-sanka-api-key: <token>`

The server forwards those credentials to the Sanka public API.

## Local development

```sh
pnpm install
pnpm build
node packages/mcp-server/dist/index.js --transport=http --port=8080
```

Then verify:

```sh
curl http://127.0.0.1:8080/health
curl -sS -D - http://127.0.0.1:8080/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0.1"}}}'
```

## Deployment

This repo deploys to Fly from `packages/mcp-server/Dockerfile`.

- Manual deploy: `fly deploy -c fly.toml`
- Automatic deploy: push to `main`

## Maintenance direction

This repository no longer depends on Stainless project access at runtime or for ongoing development. API coverage should be maintained directly in this repo.

The recommended next step is to adopt open-source OpenAPI tooling for updates to the internal client, rather than reintroducing a hosted generator dependency. See [openapi-maintenance.md](/Users/haegwan/Sites/sanka/sanka-mcp/docs/openapi-maintenance.md).

The repo now includes a starter typegen command:

```sh
pnpm generate:openapi-types
```

By default it reads the sibling Sanka spec at `../sanka-sdks/openapi.json`.
