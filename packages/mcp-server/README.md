# Sanka MCP Server Package

This package is the MCP application that powers the hosted Sanka endpoint.

It is maintained inside the standalone `sanka-mcp` repository:

- Repo: `https://github.com/sankaHQ/sanka-mcp`
- Hosted endpoint: `https://mcp.sanka.com/mcp`

## Building

```sh
git clone git@github.com:sankaHQ/sanka-mcp.git
cd sanka-mcp
./scripts/bootstrap
./scripts/build
```

## Running locally

```sh
export MCP_SERVER_AUTHORIZATION_SERVER_URL="http://app.localhost:8000"
export MCP_SERVER_OAUTH_CLIENT_ID="your-public-oauth-client-id"
export SANKA_BASE_URL="http://api.localhost:8000"
node ./packages/mcp-server/dist/index.js --transport=http --port=8080
```

`MCP_SERVER_OAUTH_CLIENT_ID` is optional. When set, the MCP server includes
that `client_id` in its advertised OAuth authorization server metadata.

Before running locally, create the OAuth app/client in Sanka and register the
local redirect URI on that client:

- first-party: `/manage/oauth`
- third-party: `/:wsid/developers/oauth`

## MCP client examples

Remote MCP config using Sanka OAuth:

```json
{
  "mcpServers": {
    "sakura": {
      "url": "https://mcp.sanka.com/mcp"
    }
  }
}
```

The MCP server advertises Sanka's OAuth authorization server and protected resource metadata. OAuth-capable clients should authenticate against Sanka directly instead of expecting MCP-specific `/oauth/*` endpoints.

Manual bearer-token config:

```json
{
  "mcpServers": {
    "sakura": {
      "url": "https://mcp.sanka.com/mcp",
      "headers": {
        "Authorization": "Bearer soat_your_sanka_oauth_access_token"
      }
    }
  }
}
```

Local stdio config with an already-issued Sanka token:

```json
{
  "mcpServers": {
    "sakura": {
      "command": "node",
      "args": ["/path/to/sanka-mcp/packages/mcp-server/dist/index.js"],
      "env": {
        "SANKA_API_KEY": "soat_your_sanka_oauth_access_token"
      }
    }
  }
}
```

`SANKA_API_KEY` in local stdio mode should contain an already-issued
`soat_...` Sanka OAuth access token. Developer API tokens are not supported by
the MCP server.

## Runtime model

The hosted endpoint on `/mcp` exposes the packaged AI-client tool surface:

- `auth_status`: read-only CRM auth readiness check
- `list_workspace_messages`: read shared workspace/integration inbox threads from connected channels; prefer this for Sanka-connected Gmail, `/conversation`, Contact Conversation, shared inbox, group inbox, and workspace inbox
- `sync_workspace_messages`: pull latest shared workspace/integration inbox threads into Sanka; prefer this for connected Gmail integration inbox requests
- `get_workspace_message_thread`: load one shared workspace/integration inbox thread and its history/body
- `reply_workspace_message_thread`: send only after explicit user authorization with `confirm_send=true`; if multiple distinct personal/workspace sender addresses are connected, pass `expected_sender_email` only after the user confirms the resolved sender; returns the actual shared sender email
- `list_private_messages`: read-only private/personal account-level inbox review for the authenticated user only
- `sync_private_messages`: pull latest private/personal account-level inbox threads into Sanka only
- `get_private_message_thread`: load one private/personal account-level inbox thread and its history
- `reply_private_message_thread`: send only after explicit user authorization with `confirm_send=true`; if multiple distinct personal/workspace sender addresses are connected, pass `expected_sender_email` only after the user confirms the resolved sender; returns the actual personal sender email
- `archive_private_message_thread`: archive a private/personal account-level inbox thread
- `list_companies`: read-only company search
- `get_company`: load a single company
- `create_company`: create or upsert a company by external reference
- `update_company`: update a company
- `delete_company`: delete a company
- `list_contacts`: read-only contact search
- `get_contact`: load a single contact
- `create_contact`: create or upsert a contact by external reference
- `update_contact`: update a contact
- `delete_contact`: delete a contact
- `list_deals`: read-only deal search
- `get_deal`: load a single deal
- `create_deal`: create or upsert a deal by external reference
- `update_deal`: update a deal
- `delete_deal`: delete a deal
- `list_deal_pipelines`: inspect deal pipelines and stages
- `list_contract_templates`: review uploaded Contract templates
- `download_contract_template`: download a Contract template source file or signing PDF
- `upload_contract_template`: upload a PDF/DOC/DOCX Contract template
- `upload_contract_pdf`: create a Contract draft from uploaded PDF bytes
- `replace_contract_pdf`: replace the PDF of an existing draft Contract and reset document-derived signature fields
- `create_contract_from_template`: create a Contract draft from an uploaded template
- `get_contract_workflow_state`: load Contract signer/field/timeline readiness state
- `update_contract_metadata`: update Contract draft name or description
- `save_contract_signers`: save Contract signer rows
- `save_contract_recipients`: authoritatively replace draft signer and non-signing CC recipient lists
- `save_contract_place_fields`: save Contract signature field placements
- `send_contract_request`: send or resend a Contract signature request
- `schedule_contract_request`: schedule a Contract signature request
- `preview_buy_request`: preview a natural-language or structured product purchase request
- `create_buy_request`: create a draft Sanka Buy request
- `list_buy_requests`: list Sanka Buy requests
- `get_buy_request`: load one Sanka Buy request
- `update_buy_request`: update draft Sanka Buy fields
- `cancel_buy_request`: cancel a Sanka Buy request after explicit confirmation
- `source_buy_request`: start Shopify Global Catalog sourcing, link an existing procurement RFQ with `constraints.procurement_request_id`, or create a new RFQ for `constraints.vendor_company_ids`
- `sync_buy_rfq`: reconcile linked-RFQ vendor proposals into draft offer snapshots and read invitation state
- `list_buy_sourcing_runs`: list sourcing runs for a Buy request
- `get_buy_sourcing_run`: load one Buy sourcing run
- `select_buy_offer`: select one offer snapshot per Buy request line
- `preview_buy_approval`: preview approval requirements for selected Buy offers
- `submit_buy_request`: submit selected Buy offers after explicit confirmation
- `create_buy_purchase_order`: create Company/Purchase Order handoff records after confirmation
- `get_buy_merchant_purchase`: inspect linked Company, Purchase Order, checkout, order, and Bill state
- `prepare_buy_checkout`: prepare a manual checkout URL after confirmation
- `confirm_buy_order`: record a user-confirmed external merchant order id
- `create_buy_bill`: create or reuse a Bill and optionally attach uploaded evidence file ids
- `preview_buy_accounting`: preview accounting export readiness without posting Journal entries
- `list_watchtower_findings`: list WatchTower waste findings with status/type filters
- `update_watchtower_finding`: confirm, dismiss, or reopen a WatchTower waste finding
- `create_buy_request_from_finding`: turn one WatchTower finding into a draft Sanka Buy request
- `get_watchtower_summary`: load the WatchTower spend summary with category and top-vendor breakdowns
- `list_orders`: read-only order search
- `get_order`: load a single order
- `create_order`: create an order
- `update_order`: update an order
- `delete_order`: delete an order
- `list_estimates`: read-only estimate review
- `get_estimate`: load a single estimate
- `create_estimate`: create an estimate
- `update_estimate`: update an estimate
- `delete_estimate`: delete an estimate
- `list_invoices`: read-only invoice review
- `get_invoice`: load a single invoice
- `download_invoice_pdf`: download an invoice PDF
- `send_invoice_email`: send or schedule an invoice PDF email
- `create_invoice`: create an invoice
- `update_invoice`: update an invoice
- `delete_invoice`: delete an invoice
- `list_tickets`: read-only ticket search
- `get_ticket`: load a single ticket
- `create_ticket`: create a ticket
- `update_ticket`: update a ticket
- `delete_ticket`: delete a ticket
- `list_ticket_pipelines`: inspect ticket pipelines and stages
- `update_ticket_status`: update only a ticket stage or status
- `list_expenses`: read-only expense review
- `get_expense`: load a single expense
- `upload_expense_attachment`: upload a receipt or invoice and return a file id
- `create_expense`: create an expense
- `update_expense`: update an expense
- `delete_expense`: delete an expense
- `list_properties`: inspect object property definitions
- `get_property`: load a single property definition
- `create_property`: create a custom property
- `update_property`: update a custom property
- `delete_property`: delete a custom property
- `get_calendar_bootstrap`: load calendar booking context
- `check_calendar_availability`: inspect available booking slots
- `create_calendar_attendance`: book a calendar attendance
- `cancel_calendar_attendance`: cancel a calendar attendance
- `reschedule_calendar_attendance`: reschedule a calendar attendance
- `browser_use`: run a governed, allowlisted browser workflow through a configured worker

Local stdio development keeps the broader `full` profile available, including:

- `search_docs`: local in-memory docs search built from the repo’s embedded SDK metadata
- `execute`: local code execution against the internal Sanka TypeScript client

## Browser worker

`browser_use` does not run browser automation inside the MCP request process. Configure a separate worker and point the MCP server to it:

```sh
export SANKA_BROWSER_USE_WORKER_TOKEN="shared-secret"
pnpm --dir packages/mcp-server browser-use-worker
```

In the MCP server process:

```sh
export SANKA_BROWSER_USE_WORKER_URL="http://127.0.0.1:8787/run"
export SANKA_BROWSER_USE_WORKER_TOKEN="shared-secret"
```

Worker-side settings:

- `SANKA_BROWSER_USE_WORKER_TOKEN`: optional bearer token for `/run`
- `SANKA_BROWSER_USE_PROFILE_ROOT`: persistent browser profile directory
- `SANKA_BROWSER_USE_ARTIFACT_DIR`: screenshots and downloaded/uploaded files
- `SANKA_BROWSER_USE_HEADED`: set to `true` for local login recovery
- `AGENT_BROWSER_BIN`: path to the `agent-browser` executable

The worker currently implements `demo.hubspot.company_avatar` with the `agent_browser` driver.

No Stainless-hosted runtime services are required.
