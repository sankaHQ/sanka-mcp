# Persisted migration results

Read `get_migration_journey` before retrieving evidence for an existing migration.
The API supplies stage state, result versions, scope limits, blockers, prerequisites
and valid links; MCP forwards these without maintaining its own journey state.
Free assessment/research remains separate from the record migration workflow.

`get_migration_result` reads GET `/api/v2/migrate/migrations/{migration_id}/results/{stage}`
with an explicit pinned `workspace_id`. Stages are `plan`, `inventory`, `map`,
`validate`, `transfer`, `verification`, and `cutover`.

Use the API-returned RFC6901 `path`, `offset`, and `limit` (at most 100) to retrieve
relevant evidence. Pin `expected_result_version` from the first page on subsequent
reads. A stale-version conflict requires reading current state and reviewing changed
evidence, never silently swapping the reviewed plan hash. Small rows are inline, while oversized entry values are
references; `value: null` does not imply that their evidence is missing. Follow their
returned paths. Preserve `total` and `next_offset`; a page is not the whole report.
Long strings can be read through paginated text leaves. `FERRY_RESULT_STALE` is a
409 conflict. Absent/stale plans return `FERRY_PLAN_NOT_READY`; unavailable reports
return `FERRY_RESULT_UNAVAILABLE` (409), or an existing report reader may return 404.
Missing evidence is not an empty successful result.

The full `get_migration_plan` and stage report tools remain available. Retrieve all
safety evidence required for the user's selected transfer scope before authorization,
even when that costs more tokens. Reads never scan, plan, approve or execute a stage.
Transfer complete does not mean verification passed; preserve unknown and unperformed
checks. After uncertain writes, read state before resubmitting, using the same original
idempotency key and payload where supported.

Migration GET/non-execution responses retain both JSON text and structured content for
client compatibility. JSON text is now compact rather than indented; there is no evidence
clipping in MCP. Wire-byte savings from whitespace are not measured agent-token savings:
clients may expose one or both content representations. End-to-end payload reduction
comes from API-scoped results and artifact reuse, not deleting the text fallback.

## Static serialization baseline

Run `node scripts/measure-migration-payload.mjs [payload.json]`. With its synthetic
10-route × 100-property fixture, compact JSON reduces text from 136,625 to 71,362
UTF-8 bytes and the complete MCP envelope from 223,430 to 153,038 bytes. Both
representations preserve identical evidence; call count stays one. This is not an
agent run or tokenizer measurement and does not establish end-to-end token savings.
