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

Hosted HTTP clients authenticate through Connect Sanka. The MCP server issues a
resource-bound session id, returns a signed `https://app.sanka.com/oauth/mcp/connect`
URL from `connect_sanka` or a protected tool result, and exchanges the approved
session internally for a short-lived Sanka access token through
`POST /oauth/internal/mcp-session-token`.

Native MCP OAuth is intentionally disabled until Sanka V2 implements the full
authorization-code server. The MCP service does not publish OAuth authorization
server or protected-resource metadata, and it rejects client-supplied
`Authorization` and `X-Sanka-API-Key` headers. The token-exchange secret is used
only between `sanka-mcp` and `sanka-api`; it must never be sent to MCP clients.

Workspace reads and successful `switch_workspace` calls refresh the resolved
workspace identity held for the MCP session. Record URL
enrichment therefore uses the selected workspace code immediately after a
switch instead of retaining the code captured during the initial connection.
Workflow preview/start calls also re-read the current MCP session immediately
before posting, bind the request to that workspace, and fail closed if the API
resolves a different workspace. This keeps accounting dry-runs and workflow
writes in the same tenant shown by `current_workspace`.

All hosted clients, including Codex and Claude, use the same Connect Sanka URL
flow. Unauthenticated initialize and tool-list requests remain available so the
client can load `connect_sanka` and the protected-tool fallback.

Developer API tokens are intentionally not supported for MCP access. They remain
valid for direct Sanka API and SDK usage outside MCP.

## Local development

```sh
pnpm install
pnpm build
export MCP_SERVER_AUTHORIZATION_SERVER_URL="http://app.localhost:8000"
export MCP_SERVER_INTERNAL_AUTHORIZATION_SERVER_URL="http://api.localhost:8000"
export MCP_SERVER_TOKEN_EXCHANGE_SHARED_SECRET="local-shared-secret"
export SANKA_BASE_URL="http://api.localhost:8000"
node packages/mcp-server/dist/index.js --transport=http --port=8080
```

Local Sanka prerequisites:

- `app.localhost:8000` serves `/oauth/mcp/connect`
- `api.localhost:8000` serves `/api/v2/public/*`
- `api.localhost:8000` serves `/oauth/internal/mcp-session-token`
- the MCP server and API use the same local token-exchange secret

Stdio remains a local-development transport. `SANKA_API_KEY` there is process
configuration, not a client-supplied bearer mode; hosted clients must use
Connect Sanka.

Then verify:

```sh
curl http://127.0.0.1:8080/health
curl -sS -D - http://127.0.0.1:8080/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0.1"}}}'
```

Point HTTP MCP clients at `http://127.0.0.1:8080/mcp` without static auth
headers. Call `connect_sanka` or a protected tool, open the returned Connect
Sanka URL, and retry with the server-issued MCP session id.

## Browser Use worker

The `browser_use` MCP tool dispatches allowlisted browser workflows to a separate worker. The MCP server keeps session authentication, audit metadata, workflow routing, and confirmation gates; the worker owns browser state and third-party UI interaction. The first registered workflow is:

- `demo.hubspot.company_avatar`: update HubSpot demo company avatars through the HubSpot UI when CRM APIs cannot set the visible avatar.

Run a local worker with `agent-browser`:

```sh
npm install -g agent-browser
agent-browser install

export SANKA_BROWSER_USE_WORKER_TOKEN="local-worker-token"
export SANKA_BROWSER_USE_PROFILE_ROOT=".browser-use-profiles"
export SANKA_BROWSER_USE_ARTIFACT_DIR=".browser-use-artifacts"
pnpm --dir packages/mcp-server browser-use-worker
```

Point the MCP server at it:

```sh
export SANKA_BROWSER_USE_WORKER_URL="http://127.0.0.1:8787/run"
export SANKA_BROWSER_USE_WORKER_TOKEN="local-worker-token"
```

For production, deploy the worker as a separate service, for example on Fly, with a persistent volume mounted at `SANKA_BROWSER_USE_PROFILE_ROOT` so HubSpot login cookies survive restarts. Keep the worker private or token-protected and only expose `/run` to the MCP service.

See [docs/browser-use-worker-fly.md](docs/browser-use-worker-fly.md) for the Fly worker app, persistent volume, secret wiring, and profile seeding runbook.

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
