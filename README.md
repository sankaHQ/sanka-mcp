# Sanka MCP Server

This repository contains the hosted Sanka MCP service and the TypeScript client it uses to call Sanka's externally callable API surface. It is now maintained as a normal TypeScript workspace, not as a Stainless-managed repository.

The production service is a remote Streamable HTTP MCP endpoint:

- `POST /mcp` as the primary endpoint
- `POST /sse` as a compatibility alias for clients that still expect an SSE-style path
- `POST /` as a compatibility alias
- `GET /health` for health checks

The `/mcp` endpoint exposes both the general SDK tools and the read-only CRM tools from a single MCP surface.

Live endpoints:

- `https://mcp.sanka.com/mcp`
- `https://mcp.sanka.com/sse`

Staging endpoint:

- `https://sanka-mcp-staging.fly.dev/mcp`

## Repository layout

- `src/`: TypeScript client for Sanka's externally callable API surface, used by the MCP service
- `src/internal/`: package-private SDK runtime helpers, not Sanka private backend code
- `packages/mcp-server/`: the MCP server application and Docker entrypoint
- `.github/workflows/`: CI plus staging and production Fly deployment workflows
- `fly.toml`: production Fly app configuration
- `fly.staging.toml`: staging Fly app configuration
- `docs/openapi-maintenance.md`: guidance for keeping API coverage current without Stainless

## Auth

`sanka-mcp` does not run its own OAuth stack. It uses Sanka OAuth directly:

- Authorization server: `https://app.sanka.com`
- Authorization page: `/oauth/authorize`
- Token endpoint: `/api/v1/oauth/token`
- Revocation endpoint: `/api/v1/oauth/revoke`

For hosted or local HTTP transport, MCP clients should use native OAuth against
the Sanka authorization server exposed in the protected resource metadata. The
MCP server accepts only Sanka OAuth bearer tokens and validates them through:

- `GET /api/v1/oauth/introspect`

The same bearer token is then forwarded to the Sanka public API.

Developer API tokens are intentionally not supported for MCP access. They remain
valid for direct Sanka API and SDK usage outside MCP.

## Local development

```sh
pnpm install
pnpm build
export MCP_SERVER_AUTHORIZATION_SERVER_URL="http://app.localhost:8000"
export MCP_SERVER_OAUTH_CLIENT_ID="your-public-oauth-client-id"
export SANKA_BASE_URL="http://api.localhost:8000"
node packages/mcp-server/dist/index.js --transport=http --port=8080
```

`MCP_SERVER_OAUTH_CLIENT_ID` is optional. When present, the server advertises
that OAuth `client_id` in its authorization server metadata.

Local Sanka prerequisites:

- `app.localhost:8000` serves `/oauth/authorize` and `/api/v1/oauth/token`
- `api.localhost:8000` serves `/api/v1/public/*`
- create the OAuth app/client in Sanka first:
  - first-party: `/manage/oauth`
  - third-party: `/:wsid/developers/oauth`
- register the MCP redirect URI/origin on that OAuth client

If you want to use stdio locally instead of HTTP transport, native OAuth is not
part of the stdio handshake. In that case pass an already-issued Sanka OAuth
access token through `SANKA_API_KEY` as a local development convenience.

Then verify:

```sh
curl http://127.0.0.1:8080/health
curl -sS -D - http://127.0.0.1:8080/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0.1"}}}'
```

For a native OAuth-capable MCP client, point the client at `http://127.0.0.1:8080/mcp` without static auth headers and let the client follow the protected resource metadata to Sanka OAuth.

For manual bearer-token testing:

```sh
curl -sS -D - http://127.0.0.1:8080/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'authorization: Bearer soat_your_access_token' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0.1"}}}'
```

## Deployment

This repo deploys to Fly from `packages/mcp-server/Dockerfile`.

- Manual production deploy: `fly deploy -c fly.toml`
- Manual staging deploy: `fly deploy -c fly.staging.toml`
- Automatic staging deploy: push to `staging`
- Automatic production deploy: publish a GitHub release that targets `main`

## Release Flow

Use the same promotion shape as the main Sanka app:

1. Open feature PRs into `staging`.
2. Merge `staging` after CI passes to deploy `sanka-mcp-staging`.
3. Validate the staging MCP endpoint.
4. Open `staging -> main`.
5. After `main` is ready, run `Create new Sanka MCP Tag and Release`.
6. The published release deploys production.

Required Fly apps and secrets:

- Production app: `sanka-mcp`
- Staging app: `sanka-mcp-staging`
- Set the same `MCP_SERVER_*` secrets on both apps unless staging intentionally uses a different auth stack.

## Maintenance direction

This repository no longer depends on Stainless project access at runtime or for ongoing development. API coverage should be maintained directly in this repo.

The recommended next step is to adopt open-source OpenAPI tooling for updates to the TypeScript client, rather than reintroducing a hosted generator dependency. See [openapi-maintenance.md](docs/openapi-maintenance.md).

The repo now includes a starter typegen command:

```sh
pnpm generate:openapi-types
```

By default it reads the sibling Sanka spec at `../sanka-sdks/openapi.json`.
