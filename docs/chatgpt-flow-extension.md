# Sanka Flow ChatGPT connector pilot

Unreleased and disabled by default. The panel connects an existing Sanka account,
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

The native endpoint permits only `open_flow_workspace`, `preview_flow_invoice`,
`start_flow_invoice`, `get_flow_invoice_attempt`, `get_flow_invoice`, and
`get_workflow_run`. It exchanges/revalidates credentials on every request and
cannot switch workspaces. `/mcp` retains Connect Sanka session behavior and still
rejects direct bearer/API-key headers. Local plugin manifests stay on `/mcp`.

`open_flow_workspace` accepts `{}` and exposes global/thread entrypoints and
`ui://sanka/flow-workspace`. The static app uses the MCP Apps host bridge, has no
external network dependencies, and receives no raw credentials. EN/JA copy and
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
Live ChatGPT installation, consent and saved business records remain unverified.

Release API/schema first, consent UI second, MCP third, then enable the pilot
only after approved configuration. Disable native/app flags to roll back
availability; preserve API schema/history. Do not publish the feature or claim
Sign in with ChatGPT until the corresponding live acceptance passes.

References: [extensions](https://developers.openai.com/plugins/build/extensions),
[connector authentication](https://developers.openai.com/plugins/build/auth),
[Sign in with ChatGPT](https://developers.openai.com/siwc/chatgpt-plugin).
