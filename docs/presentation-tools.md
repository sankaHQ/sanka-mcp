# Sanka Doc presentation tools

Six hosted MCP tools build, edit and export Sanka Doc presentations: slide decks stored as Docs
(`sanka.deck/v1`), in a Sanka migration program's Docs when a call passes `program_id`, else in
Sanka Flow Docs. They call the internal sanka-api presentation routes
(`app/api/v2/documents/presentations_router.py`) through the raw SDK client and unwrap the V2
envelope themselves, so there is no SDK resource class, OpenAPI or generated-type change. The API
owns the catalog, deck, op and export validation, permissions and the `docs-presentations` feature
flag. The contract and agent loop are in the workspace spec
`docs/architecture/sanka-doc-presentations.md` (§8 and §10).

`{base}` is `/api/v2/ferry/programs/{program_id}/presentations` with `program_id`, else
`/api/v2/documents/presentations`.

| Tool                       | Method                                        | Route                                          |
| -------------------------- | --------------------------------------------- | ---------------------------------------------- |
| `get_presentation_catalog` | GET                                           | `/api/v2/presentations/catalog`                |
| `create_presentation`      | POST                                          | `{base}`                                       |
| `get_presentation`         | GET                                           | `{base}/{presentation_id}`                     |
| `update_presentation`      | PATCH (`ops`, or `title` alone), PUT (`deck`) | `{base}/{presentation_id}`                     |
| `export_presentation`      | POST                                          | `{base}/{presentation_id}/exports`             |
| `get_presentation_export`  | GET                                           | `{base}/{presentation_id}/exports/{export_id}` |

## Inputs and results

- Inputs are snake_case; request bodies use the API's camelCase (`sourceRef`, `expectedRevision`,
  `slideIds`, `includeHidden`, `includeNotes`). Slides, ops and decks pass through unchanged.
- `create_presentation` wraps `slides`, with the optional `theme` and `footer`, in a
  `sanka.deck/v1` deck with page size 16:9. Without `slides` it sends no deck and the API starts
  one title slide; `theme` or `footer` without `slides` is refused before any request. Creating
  again with the same `source_ref` returns the existing presentation.
- `update_presentation` takes `ops` (PATCH, with a new `title` appended as a `set_title` op) or
  `deck` (PUT, with `title`), never both; a `title` alone is one `set_title` op, and a call
  without any of them sends nothing. Every update carries `expected_revision`.
- Write and read results return `presentation_id`, `title`, `revision`, `product`, `program_id`,
  `slide_count`, `app_url` and the API's static `warnings`. `get_presentation` adds `updated_via`,
  `updated_at` and either `deck` (the default, with the slide and block ids that ops use) or
  `outline`. Export results return `export_id`, `status`, `progress`, `revision`, `filename`,
  `size_bytes`, `warnings`, `error_code` and `error_message`, and `app_download_url` once completed.
- `app_url` and `app_download_url` join the API's app-relative `appPath` and `downloadPath` to the
  app origin that record links use (`SANKA_V2_APP_BASE_URL`), else `https://app.sanka.com`. The
  download link works in a browser signed in to Sanka, through the app's API proxy.

## Workspace, retries and errors

- Writes (`create_presentation`, `update_presentation`, `export_presentation`) require
  `expected_workspace_id`, the `workspace_id` from `current_workspace`. Like the workflow tools, a
  write first reads the workspace the request resolves to and sends nothing when it differs. It
  reads `/api/v2/auth/session`, the route `current_workspace` uses, which resolves the workspace as
  these internal routes do; the workflow tools read `/api/v2/public/auth/session` because their
  public routes resolve the MCP session binding. The write then carries
  `X-Sanka-Expected-Workspace-ID`, and the API rejects a mismatch again with 409
  `WORKSPACE_CONTEXT_MISMATCH`. Both cases return the same result: `code` and `error`
  `WORKSPACE_CONTEXT_MISMATCH`, the expected and current workspace in `details`, and text saying
  nothing changed and not to retry in another workspace.
- The tools take no `workspace_id` argument: these routes use the connected workspace and do not
  read the `workspace_id` query that the public Docs tools forward.
- Writes are sent with `maxRetries: 0`; reads keep the SDK retries. `export_presentation` sends
  `idempotency_key` as `Idempotency-Key`: the same key returns the same export, and a new key
  starts another one.
- A 4xx answer becomes `{ok: false, status: 'error', status_code, code, message, details, ctx_id}`
  with the next step in the text. `PRESENTATION_REVISION_CONFLICT` adds `current_revision` and says
  to re-read and re-apply only the intended change; `PRESENTATION_INVALID` and
  `PRESENTATION_LIMIT_EXCEEDED` list the JSON Pointer paths; `PRESENTATION_OP_TARGET_NOT_FOUND`
  names the op or slide ids; `DOCUMENT_KIND_MISMATCH`, `IDEMPOTENCY_KEY_REUSED`, `RATE_LIMITED`,
  404 and 403 (presentations off, or no permission) have their own hints. Server and transport
  errors keep the server's generic error result.

## Guidance, validation and packaging

- `get_capability_guidance` returns the `sanka_doc_presentations` family, with the six tools and
  the agent loop, for presentation, slide, deck, PowerPoint, pptx, スライド, プレゼン and パワポ
  intents. It is checked before the migration family, so a deck about a migration routes here. The
  initialize instructions are unchanged.
- `resource: 'presentations'` is not a delegated scope, so the tools require `mcp:access`.
- `tests/mcp-server/presentation-tools.test.ts` sends each tool call through the SDK client to a
  fake fetch and checks the requests, the results and the error mapping. Route behaviour stays
  owned by sanka-api.
- The sanka-plugin generic Sanka skill discovers hosted tools. Per-tool skills and a presentations
  router skill come with the public API milestone, so no plugin regeneration is needed now.
