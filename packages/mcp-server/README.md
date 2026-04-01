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
export SANKA_API_KEY="your-api-key"
node ./packages/mcp-server/dist/index.js --transport=http --port=8080
```

## MCP client examples

Remote MCP config:

```json
{
  "mcpServers": {
    "sanka_api": {
      "url": "https://mcp.sanka.com/mcp",
      "headers": {
        "Authorization": "Bearer <auth value>"
      }
    }
  }
}
```

Local MCP config:

```json
{
  "mcpServers": {
    "sanka_api": {
      "command": "node",
      "args": ["/path/to/sanka-mcp/packages/mcp-server/dist/index.js"],
      "env": {
        "SANKA_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Runtime model

The package exposes two MCP tools:

- `search_docs`: local in-memory docs search built from the repo’s embedded SDK metadata
- `execute`: local code execution against the internal Sanka TypeScript client

No Stainless-hosted runtime services are required.
