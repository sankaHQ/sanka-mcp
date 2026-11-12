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

The hosted server is a standard MCP OAuth 2.1 protected resource (MCP
authorization spec 2026-07-28). Sanka (`sanka-api`) is the authorization server,
issuer `https://api-v2.sanka.com/oauth/mcp`; the consent page is
`https://app.sanka.com/oauth/mcp/authorize`.

- Every MCP request needs `Authorization: Bearer <token>`. Without one the server
  answers `401` with
  `WWW-Authenticate: Bearer scope="mcp:access", resource_metadata="…"`; an invalid
  or expired token adds `error="invalid_token"`.
- Each endpoint is its own resource, named by the URL clients connect to:
  `https://mcp.sanka.com/mcp`, `https://mcp.sanka.com/sse` and
  `https://mcp.sanka.com`. Its RFC 9728 metadata is at
  `/.well-known/oauth-protected-resource/mcp`, `…/sse` and
  `/.well-known/oauth-protected-resource`. A token is bound to one resource.
- `/.well-known/oauth-authorization-server` mirrors Sanka's metadata for clients
  built for the 2025-03-26 protocol.
- Clients register with a Client ID Metadata Document (preferred) or dynamic client
  registration, and always use PKCE (S256); Sanka issues no client secrets.
- The server never passes the client's token to the business API. It exchanges it
  through `POST /oauth/internal/mcp-oauth-token` (authenticated with
  `MCP_SERVER_OAUTH_RESOURCE_SERVER_SECRET`, shared with `sanka-api` only) for its
  own short-lived API token bound to the same connection. Sanka checks the
  connection on every API call, so disconnecting a client takes effect at once.
- `switch_workspace` moves the whole connection to the chosen workspace, so later
  token exchanges and record URLs follow it.
- The server keeps no MCP session: a client-sent `mcp-session-id` is ignored and
  never forwarded. Developer API keys (`X-Sanka-API-Key`) are refused.

The ChatGPT connector keeps its own resource at `/chatgpt` with its own issuer
(`https://api-v2.sanka.com/oauth/chatgpt`).

## Local development

```sh
pnpm install
pnpm build
export MCP_SERVER_OAUTH_ISSUER="http://localhost:8000/oauth/mcp"
export MCP_SERVER_INTERNAL_AUTHORIZATION_SERVER_URL="http://localhost:8000"
export MCP_SERVER_OAUTH_RESOURCE_SERVER_SECRET="<at least 32 characters>"
export MCP_SERVER_RESOURCE_URL="http://localhost:8080/mcp"
export SANKA_BASE_URL="http://localhost:8000"
node packages/mcp-server/dist/index.js --transport=http --port=8080
```

The local API needs the matching settings: `MCP_OAUTH_ISSUER`,
`MCP_OAUTH_AUTHORIZE_URL` (the local React app's `/oauth/mcp/authorize`),
`MCP_OAUTH_RESOURCES` (a JSON list with `http://localhost:8080/mcp` and the other
local endpoints) and the same `MCP_OAUTH_RESOURCE_SERVER_SECRET`.

Stdio remains a local-development transport. `SANKA_API_KEY` there is process
configuration, not a client-supplied bearer mode.

Then verify:

```sh
curl http://127.0.0.1:8080/health
curl -sS -D - http://127.0.0.1:8080/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0.1"}}}'
```

The `initialize` request answers `401` with the `WWW-Authenticate` challenge.
Point an HTTP MCP client (for example the MCP Inspector) at
`http://127.0.0.1:8080/mcp` without static auth headers; it discovers the
authorization server, opens the Sanka consent page, and retries with its token.
`curl http://127.0.0.1:8080/.well-known/oauth-protected-resource/mcp` shows the
resource metadata.

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

## Retry policy

The TypeScript client retries 408, 409, 429, 5xx and connection errors twice by
default. Only tools with `metadata.operation: 'read'` keep those automatic retries.
Every write tool calls the API once and returns any error to the agent: a write can
fail after its side effect happened, such as an email Gmail accepted before Sanka
recorded it, and a retry would repeat it. The API also marks errors from delivery
routes with `x-should-retry: false`. Reply tools report `DELIVERY_UNKNOWN` as a
do-not-resend error.

## Maintenance direction

This repository no longer depends on Stainless project access at runtime or for ongoing development. API coverage should be maintained directly in this repo.

The recommended next step is to adopt open-source OpenAPI tooling for updates to the TypeScript client, rather than reintroducing a hosted generator dependency. See [openapi-maintenance.md](docs/openapi-maintenance.md).

The repo now includes a starter typegen command:

```sh
pnpm generate:openapi-types
```

By default it reads the sibling Sanka spec at `../sanka-sdks/openapi.json`.

## Developer Cloud (release candidate)

The hosted tools expose the same V2 source, run, receipt, certificate and Fleet
contracts as the CLI and SDKs. This source change does not enable production
execution. Read `get_developer_cloud_availability` first and obey each capability's
availability flag. Free local migration and client-evidence registration are
unchanged.

Every call takes a pinned `workspace_id`. Paid creates and selective retries
require an explicit request, approved cap, `confirm: true`, and stable
`idempotency_key`. Existing user authorization is sufficient. A lost response
must not create a new intent: read back or replay the identical key and request.
No tool purchases credits, creates repository PRs, merges, or deploys.

- Source/run: `upload_developer_cloud_source`, `create_developer_cloud_run`,
  `list_developer_cloud_runs`, `get_developer_cloud_run`, `cancel_developer_cloud_run`.
- Evidence: `list_developer_cloud_events`, `get_developer_cloud_receipt`,
  `list_developer_cloud_artifacts`, `download_developer_cloud_artifact`.
- Certificates: `list_developer_cloud_certificate_keys`,
  `get_developer_cloud_certificate`, `revoke_developer_cloud_certificate`.
- Fleet: `create_developer_cloud_fleet`, `list_developer_cloud_fleets`,
  `get_developer_cloud_fleet`, `cancel_developer_cloud_fleet`,
  `retry_developer_cloud_fleet`.

Repair and certificate issuance use `create_developer_cloud_run.request.repair`
and `.certification`, respectively. Compute is 100 credits per worker-minute,
rounded once per run. Successful Repair adds 1,000 credits; independent certificate
issuance adds 2,000. All compute and premiums remain within the approved cap.
Failed gates have no premium. Fleet adds no surcharge: its cap is the sum of
explicit child caps, reserved atomically, with at most five active workers per
workspace. Retry selects only failed children after the original Fleet settles;
it creates a new Fleet and preserves completed children's receipts.

Upload the exact ZIP digest and declared full revision; the service pins uploaded
bytes but does not independently prove their Git provenance. Inspect certificate
scope, scenarios, limitations and revocation. Downloading a certificate does not
verify its signature: use the CLI's offline verification with the published key.
Artifact downloads verify bytes against recorded SHA-256 metadata. MCP supports
up to 64 MiB; larger artifacts use the CLI/API. Large downloads use the existing
session-bound URL or `read_binary_download_chunk` flow.

Request-schema regeneration uses the shared V2 SDK input:

```sh
python3 scripts/sync-developer-cloud-contract.py ../sanka-sdks/openapi.json
pnpm exec prettier --write packages/mcp-server/src/generated/developer-cloud-schemas.ts
```

## Embedded workspace

The Sanka app opens the connected full Flow workspace: its sidebar, dashboards,
record tables, workflows and reports. Full workspace access requires explicit
Sanka authorization. Connections with narrower access show the authorization
controls; the earlier Invoice assistant pilot screen is no longer offered.

The hosted invoice MCP tools remain available under their existing scopes and
confirmation requirements. Removing the pilot screen does not change invoice
records or the API contract.
