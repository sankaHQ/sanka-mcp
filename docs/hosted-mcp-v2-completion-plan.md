# Hosted MCP V2 Completion Plan

Last updated: 2026-06-01 JST

## Current State

Hosted MCP production is deployed from `sanka-mcp` main and points at the production
Sanka API V2 host:

- MCP app: `sanka-mcp`
- MCP release: Fly release `v608`
- MCP image: `registry.fly.io/sanka-mcp:deployment-01KSZY5HSPC673GDS4DM4FGG27`
- MCP commit: `4b24356f9d9947139ba15339c5a69605beb16509`
- API base URL: `https://sanka-api.fly.dev`

Smoke evidence confirms the hosted MCP tools are calling V2 API routes for the
covered read surfaces:

- `current_workspace` -> `GET /api/v2/auth/session`
- `list_companies` / `get_company` -> `/api/v2/companies`
- `list_orders` / `get_order` -> `/api/v2/orders`
- `list_invoices` / `get_invoice` -> `/api/v2/invoices`
- `preview_workflow` -> `POST /api/v2/public/workflow-runs/preview`
- PDF routes reach `/api/v2/{object}/{id}/pdf`

The important caveat is workflow runtime orchestration: preview/start endpoints
are exposed through V2, but the business workflow runtime is still classified
because provider gateways, governance checks, idempotency, and worker enqueue
contracts have not been fully migrated to V2.

## Priority Order

### P0 - Keep Read-Only Hosted MCP Stable

Goal: preserve the now-working V2 read path.

Status: done for the currently smoked production path.

Definition of done:

- Hosted MCP has `SANKA_BASE_URL=https://sanka-api.fly.dev`.
- Current workspace/read/list/get tools return V2 `http_path` metadata.
- `limit` handling is honored by V2 list tools.
- API health checks pass before MCP deploy checks.

Regression checks:

- `current_workspace`
- `list_companies({ limit: 1 })`
- `list_orders({ limit: 1 })`
- `list_invoices({ limit: 1 })`
- at least one matching `get_*` call from each list result

### P1 - Add Write-Capable OAuth Scope And Re-Sign-In Path

Goal: enable real write smoke for hosted MCP without using out-of-band API keys.

Why this is P1: write tools currently reach V2 but return `PERMISSION_DENIED`
because the OAuth principal has only `mcp:access`. This blocks upload attachment,
workspace switch, workflow start, and any create/update/delete smoke.

Required decisions:

- Decide whether hosted MCP should request `api-access`, a narrower write scope,
  or object-specific write scopes.
- Decide whether existing Codex/Claude read-only connections should remain valid
  while write-capable clients perform explicit reauthorization.
- Decide how the client should surface the reauthorization prompt when a write
  tool is called with read-only scopes.

Implementation tasks:

- Update MCP OAuth scope request/config for write-capable mode.
- Confirm Sanka API scope-to-method mapping allows intended write routes.
- Add auth tests covering read-only scope vs write-capable scope behavior.
- Document expected reconnect behavior for Codex and Claude.

Write smoke checklist after deploy:

- `upload_expense_attachment` with a tiny text file.
- One safe create/update/delete or archive flow in a disposable workspace.
- `start_workflow` with an explicitly scoped, idempotent request.
- Confirm no write occurs when the principal has only `mcp:access`.

### P2 - Migrate Business Workflow Runtime To V2

Goal: make `start_workflow` execute through the V2 runtime path instead of
returning classified runtime metadata.

Why this is P2: the route exists and preview responds, but end-to-end workflow
execution depends on V1 orchestration pieces. This is larger than smoke coverage
and should be handled as a migration slice with API and worker validation.

Implementation tasks:

- Inventory V1 workflow dependencies: provider preview gateways, governance,
  idempotency, worker enqueue, and workflow run readback.
- Define the V2 workflow orchestration contract and response envelope.
- Implement the smallest supported workflow first, preferably one with a safe
  idempotency key and deterministic readback.
- Add API contract tests for preview/start/get behavior.
- Add hosted MCP tests for result normalization and user-facing guidance.

Acceptance checks:

- `preview_workflow` returns a real domain preview for the selected workflow.
- `start_workflow` creates or reuses a workflow run with idempotency protection.
- `get_workflow_run` reads back created records and audit state through V2.
- Repeated `start_workflow` with the same idempotency key is safe.

### P3 - Add PDF Success Smoke Coverage

Goal: prove that hosted MCP can return a real PDF file path or download payload
from a V2 PDF route.

Why this is P3: the current production smoke reached V2 PDF routes, but the
workspace records returned `UNSUPPORTED_OBJECT_RECORD_OPERATION` because the
invoice/order renderer was not configured there. This is a fixture/workspace
coverage gap unless PDF generation is launch-critical for a specific customer.

Implementation tasks:

- Identify a workspace with a renderer-configured invoice, order, purchase order,
  payment, or slip.
- If no stable fixture exists, create a dedicated smoke workspace/object fixture.
- Run one successful small PDF download and one large-PDF chunk/read path if
  applicable.

Acceptance checks:

- PDF route returns `download_complete=true` with `content_base64`, or a direct
  `download_url` that can be fetched successfully.
- Large PDF fallback, if exercised, can read all chunks and reconstruct the file.
- 400 renderer-not-configured remains reported as a domain configuration issue,
  not as an MCP transport failure.

## Deployment Order

Use this order for future V2/MCP releases:

1. Merge and deploy `sanka-api`.
2. Smoke API health and V2 runtime endpoints.
3. Merge and deploy `sanka-mcp`.
4. Smoke hosted MCP read paths.
5. Smoke write paths only with an OAuth principal that has the required write
   scopes.
6. Run workflow/PDF success smokes when the corresponding V2 runtime or fixture
   is available.

## Reconnect Guidance

Existing Codex and Claude MCP connections do not need reconnecting for read-only
use after the current deployment. Reauthorization is needed only when the client
needs newly requested OAuth scopes, especially write-capable scopes such as
`api-access` or narrower future write scopes.
