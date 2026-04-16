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
export SANKA_BASE_URL="http://api.localhost:8000"
node ./packages/mcp-server/dist/index.js --transport=http --port=8080
```

Before running locally, create the OAuth app/client in Sanka and register the
local redirect URI on that client:

- first-party: `/manage/oauth`
- third-party: `/:wsid/developers/oauth`

## MCP client examples

Remote MCP config using Sanka OAuth:

```json
{
  "mcpServers": {
    "sanka_api": {
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
    "sanka_api": {
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
    "sanka_api": {
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
- `list_private_messages`: read-only private inbox review for the authenticated user
- `sync_private_messages`: pull the latest private inbox threads into Sanka
- `get_private_message_thread`: load one private inbox thread and its history
- `reply_private_message_thread`: send a reply on a private inbox thread
- `archive_private_message_thread`: archive a private inbox thread
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

Local stdio development keeps the broader `full` profile available, including:

- `search_docs`: local in-memory docs search built from the repo’s embedded SDK metadata
- `execute`: local code execution against the internal Sanka TypeScript client

No Stainless-hosted runtime services are required.
