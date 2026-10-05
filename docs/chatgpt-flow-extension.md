# Sanka Flow ChatGPT workspace and invoice assistant

The full workspace is implemented behind a disabled-by-default flag and awaits
live acceptance. The private invoice pilot has been released. The panel connects an existing Sanka account,
reviews one order, creates one invoice draft after confirmation, and reads its
saved status, currency, amount and lines. Sign in with ChatGPT remains separate.

## Endpoint and tools

`/chatgpt` uses native OAuth with protected-resource metadata at
`/.well-known/oauth-protected-resource/chatgpt`. Set
`MCP_SERVER_CHATGPT_CONNECTOR_ENABLED=true` and
`SANKA_MCP_FLOW_APP_ENABLED=1` only for a configured, approved pilot. Defaults are
issuer `https://api-v2.sanka.com/oauth/chatgpt` and resource
`https://mcp.sanka.com/chatgpt`. Override with
`MCP_SERVER_CHATGPT_CONNECTOR_ISSUER` / `MCP_SERVER_CHATGPT_CONNECTOR_RESOURCE`.
Set the existing token-exchange shared secret and optional internal authorization
server URL. The API must have matching configuration and migrations first.

The native endpoint permits `open_flow_workspace`, `search_flow_orders`, `preview_flow_invoice`,
`start_flow_invoice`, `get_flow_invoice_attempt`, `get_flow_invoice`, and
`get_workflow_run`. It exchanges/revalidates credentials on every request and
cannot switch workspaces. `/mcp` retains Connect Sanka session behavior and still
rejects direct bearer/API-key headers. Local plugin manifests stay on `/mcp`.

`open_flow_workspace` accepts an optional workspace-relative `page` and exposes
global/thread entrypoints and `ui://sanka/flow-workspace-v2`. The old resource URI
remains readable. The outer app uses the MCP Apps host bridge and receives no
application API credentials. EN/JA copy and
narrow layout are included. Other hosts can use the tools' text results.

Review reads any prior attempt before preparing a new draft. Creation requires
the canonical order ID, exact review token and `expected_workspace_id`.
Input/language/workspace changes clear confirmation. Writes have no automatic
retry. A lost response/reopen recovers the durable attempt; unknown outcomes
require inspection in Sanka. The backend limits this pilot to one attempt per
workspace/order and forces draft status. Approval, sending, payment and further
billing remain separate Sanka operations. Saved invoice readback failures remain
unverified and offer a read-only retry. Workflow status alone is not proof of a
saved invoice.

## Build and test

Use the repository's Node/pnpm toolchain. `pnpm lint` checks and bundles the app;
`pnpm test --runInBand` runs protocol/transport/request tests. Build the standalone
app with `node scripts/build-flow-app.mjs`; output is
`packages/mcp-server/src/flow-app.html` and is copied into the MCP bundle.

The companion sanka-e2e suite accepts that absolute path as
`SANKA_CHATGPT_APP_HTML` and runs `npm run test:chatgpt-extension`. It supplies a
synthetic host: browser actions and reload/recovery are tested, but all business
records are fixtures. API PostgreSQL tests own credential/attempt persistence.
The private invoice pilot has live evidence; the new full-workspace bridge still
requires a real ChatGPT host and persisted business-record acceptance.

Release API/schema first, consent UI second, MCP third, then enable the pilot
only after approved configuration. Disable native/app flags to roll back
availability; preserve API schema/history. Do not publish the feature or claim
Sign in with ChatGPT until the corresponding live acceptance passes.

References: [extensions](https://developers.openai.com/plugins/build/extensions),
[connector authentication](https://developers.openai.com/plugins/build/auth),
[Sign in with ChatGPT](https://developers.openai.com/siwc/chatgpt-plugin).

## Order search and pilot guidance

`search_flow_orders` uses the existing connection and expected workspace. It returns
20 matching orders per page for customer names, order notes and line-item text.
Choose a matching order before previewing it; multiple matches never authorize
an automatic selection or write. The panel exposes search, pagination, explicit
selection and cancellation. Changing search input, language or workspace clears
the old confirmation. Existing order-number lookup remains available.

The global/thread entrypoint uses the canonical Sanka mark with light/dark variants.
After MCP deployment, refresh the private plugin's tools and start a new chat so
the host can load the updated search tool and icon metadata.

The review token is a SHA-256 content fingerprint, not an authentication credential.
It detects changes to the reviewed order; the separate host-managed OAuth token
authenticates every request. Host write approvals remain enabled. If the host
blocks a confirmed write, stop and read the attempt state; do not reroute or retry
the mutation. A successful panel write does not prove conversational acceptance.

## Full workspace view

Set `SANKA_MCP_FLOW_WORKSPACE_ENABLED=1` only after the API and React workspace
session capability is released and configured. `CHATGPT_WORKSPACE_ORIGIN`
defaults to `https://flow-chatgpt.sanka.com`; all three services must agree.
`SANKA_MCP_FLOW_WIDGET_ORIGIN` optionally sets resource `ui.domain` to an exact
HTTPS origin. A unique widget origin is required before directory submission;
React must trust that exact origin through `CHATGPT_WORKSPACE_PARENT_ORIGINS`.
Private hosts using the default `https://web-sandbox.oaiusercontent.com` must
keep that origin in the React allowlist. No wildcard parent origin is accepted.

The installed `/mcp` Sanka entry offers **Enable full workspace**. It opens a
Sanka consent page showing the same account and workspace. After allowing access,
the user selects Refresh and the workspace opens automatically. Native `/chatgpt`
connections use their existing reconnect consent. Existing connections are never
silently upgraded.
The resource cache key is `ui://sanka/flow-workspace-v6`; previous URIs remain
readable for existing conversations.

An authorized connection opens the maintained Sanka React UI automatically and
requests fullscreen from the host, without an additional launcher click. The app
waits for the host bridge and confirmed full-workspace access before opening;
connections that still need authorization retain the consent screen. The host
controls whether fullscreen is available. The workspace fills the panel without
the wrapper's external-open header or retry footer. Those controls appear if the
workspace fails to open or takes too long; Sanka's own Open in Sanka action remains
available inside the loaded workspace. The app embeds the workspace at a random 32-hex
subdomain of the configured origin. The resource requests only that wildcard
under `ui.csp.frameDomains`; connect/resource domains remain empty for the outer
app. Wildcard DNS/TLS and trusted-edge routing to React are deployment prerequisites.
The nested Sanka page applies its own CSP and first-party authenticated proxies.

The app-only `start_flow_workspace_session` tool validates the pinned workspace,
native connector or consented installed MCP session, browser origin and challenge.
The installed entry reads fresh server authorization rather than cached OAuth
metadata and forwards its parent session ID for validation. Its consent URL is
app-only `_meta.flow_workspace_consent_url`. Disconnecting or switching the parent
connection invalidates its full-workspace sessions. Its one-time ticket appears only
in `_meta.flow_workspace_session`, never model-visible content or tool audit
arguments. It is posted to the exact waiting frame; React exchanges it and stores
the API credential in Secure, HttpOnly, Partitioned, host-only cookies. Ticket
redemption requires the browser's HttpOnly bootstrap nonce and is single-use.
No tool creates a general account session or accepts arbitrary HTTP operations.

The full view reuses Flow navigation, record tables/details/editors, workflows,
approvals and reports with existing Sanka permissions. Manual UI actions retain
their Sanka confirmations and approvals. The invoice assistant and conversation
tools retain their own preview/confirmation/recovery and host approval boundaries.
Account, billing, credentials/provider setup, migration, developer, sandbox and
security control-plane pages provide a handoff to the normal Sanka application.

Active-page context contains only the workspace identity and a sanitized path;
record contents and credentials are excluded. Share page sends a user message
only after the user's button click. `open_flow_workspace` with a valid `page`
navigates the current view. Workspace changes clear the old frame and context.
Open in Sanka remains available when embedding or partitioned cookies fail.

Submission must explain that the iframe reuses Sanka's existing authenticated
business editor on a Sanka-owned domain. OpenAI reviews `frameDomains` separately;
local protocol tests do not establish host approval or directory acceptance.
See [plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines)
and [resource metadata](https://developers.openai.com/plugins/reference).
