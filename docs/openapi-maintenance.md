# OpenAPI Maintenance

This repository no longer depends on Stainless for regeneration.

## Goal

Keep the hosted MCP service current with the Sanka OpenAPI contract while avoiding another paid hosted-generator dependency.

## Recommended approach

Use an open-source generator only for the TypeScript client surface, then keep the MCP-specific server wiring hand-maintained.

Recommended stack:

1. `openapi-typescript` for schema/types generation.
2. `openapi-fetch` or a thin custom fetch client for request execution.
3. Small hand-written resource wrappers where the MCP server benefits from stable method names.

Why this is the least risky path here:

- This repo is a Node service, not a frontend app.
- The MCP layer already expects stable resource/method names.
- Replacing everything with a fully different generated runtime would create more churn than value.

## About Orval

`orval` is a valid open-source option, especially if you want generated clients from OpenAPI. It now supports multiple output styles including native fetch and MCP-oriented generation, and it is strongest when you want broader generated client layers across app surfaces.

For this repository specifically:

- `orval` can work.
- It is not my first choice for the next incremental step.
- I would start with `openapi-typescript` plus a thin runtime because it gives tighter control and lower migration risk for a server-side MCP codebase.

## Practical migration plan

1. Export the authoritative OpenAPI JSON from the main Sanka app.
2. Generate types into a dedicated folder such as `src/generated/`.
   Current starter command: `pnpm generate:openapi-types`
   Default source path: `../sanka-sdks/openapi.json`
3. Introduce or refine a thin HTTP client wrapper around Sanka auth, base URL, retries, and error handling.
4. Migrate resource wrappers incrementally, starting with the methods most used by MCP tools.
5. Keep MCP transport, docs search, and execution behavior hand-maintained in `packages/mcp-server/`.

## search_docs method index

`packages/mcp-server/src/generated/sdk-method-docs.ts` is built from the TypeScript client, not from
OpenAPI. After adding, removing or re-routing a method in `src/resources`, run:

```sh
pnpm generate:sdk-method-docs
```

The generator reads each method's signature with the TypeScript compiler and calls the method
against a fake `fetch` to record the HTTP method and path it sends. Nothing goes over the network.
`tests/mcp-server/sdk-method-docs.test.ts` fails when the committed index differs from a fresh run.
It also fails when `packages/mcp-server/src/methods.ts`, the code tool's hand-maintained method
registry, misses a client method or lists a different HTTP method or path; the failure prints the
entry to add.

## Update policy

- Small API changes: patch the TypeScript client manually.
- Larger schema churn: regenerate types, then fix the affected wrappers intentionally.
- Do not regenerate the entire repository blindly.

The generated type snapshot tracks sanka-api's generated public contract,
`docs/api/sanka-public-api.yaml`; the Flow refresh and the Deal pipeline write
refresh were both generated from it with
`pnpm generate:openapi-types ../sanka-api/docs/api/sanka-public-api.yaml`.
The shared SDK input (`../sanka-sdks/openapi.json`) receives only reviewed
operations and carries SDK-only routes, so regenerating from it rewrites
unrelated members. After a refresh, check that the diff adds only the intended
operations and schemas. The Goals refresh kept only the goal paths, operations
and schemas (with the `SearchFilterExpression` and `FieldReference` they
reference); other public schemas the contract had gained since were left out,
so the next refresh will show them as additions.
The presentations refresh was generated the same way (openapi-typescript 7.13)
and kept only the `/v2/public/presentations/catalog`,
`/v2/public/documents/presentations…` and
`/v2/public/ferry/programs/{program_id}/presentations…` paths, their operations
and the schemas they reference. Large generated insertions confuse git's default
diff heuristic; review them with `git diff --minimal` (or `--histogram`), which
shows a refresh like this one as additions only.
