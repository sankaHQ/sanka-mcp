# Data migration setup and ingestion tools

This group fills the setup stages before the existing migration plan, apply and
verification tools. It is registered in both hosted and full MCP profiles and
calls existing endpoints from `sanka-api/docs/api/ferry-api.yaml` through the
authenticated SDK transport at `/api/v2/migrate`. No API or generated SDK changes
are required.

## Coverage

Every call requires `workspace_id`, the pinned internal workspace UUID. Every
POST also requires explicit `confirm: true` for that operation and payload.

| Tool | Method and path, relative to `/api/v2/migrate` | Idempotency |
| --- | --- | --- |
| `create_migration` | POST `/migrations` | Optional `idempotency_key` |
| `create_program_migration` | POST `/programs/{program_id}/migrations` | Unsupported |
| `create_ingestion_source` | POST `/ingestion-sources` | Unsupported |
| `get_ingestion_source` | GET `/ingestion-sources/{source_id}` | Read only |
| `activate_ingestion_source` | POST `/ingestion-sources/{source_id}/activate` | Unsupported |
| `pause_ingestion_source` | POST `/ingestion-sources/{source_id}/pause` | Unsupported |
| `stage_ingestion_batch` | POST `/ingestion-sources/{source_id}/batches` | Required `idempotency_key` |

These operations register configuration and records, change intake state, and
create migration runs. They do not start scans/planning or apply destination
writes. Pausing an ingestion source prevents new intake; it does not cancel runs
already created and does not roll back destination data.

## Create a data migration

`create_migration` requires reviewed `source` and `target` objects, each with a
connector `type`, an optional existing workspace `connection` reference, and
optional `options`. The optional `name`, `strategy` and `verify` fields are sent
unchanged. API validation remains authoritative for supported connector pairs,
connection ownership, strategy and verification options. Read
`list_migration_connectors` and `list_migration_connections` first when needed.
Never send provider credentials in a spec; secret-bearing fields are rejected.

For an existing Program, inspect `get_migration_program` and call
`create_program_migration` with `program_id`, `source_endpoint_id` and
`destination_endpoint_id`, plus an optional `name`. MCP requires both explicit
endpoint IDs even though the API can choose endpoints implicitly. This prevents a
new run from silently binding to an unintended endpoint. It does not edit the
Program. Retain the returned `migration_id`, read `get_migration`, and only then
request the existing planning tool as a separately authorized operation.

## Register and review an ingestion source

Ingestion body fields retain the API's camelCase names. `create_ingestion_source`
requires:

- `name`, `programId` and `sourceObject`.
- A reviewed `destination`: `{type: "hubspot", connection: "existing-reference"}`
  or `{type: "sanka", object: "existing-object", identityField: "unique-field"}`.
- `identityField`, `cursorField`, `tieBreakerField` and a `fields` allowlist.
  Each field has `key`, optional `dataType` and optional `required`.

The API requires all three identity/cursor/tie-breaker fields to be declared and
required, rejects duplicates and secret-bearing fields, and checks destination
ownership. Supported types are string, integer, number, boolean, date and datetime.
An existing Sanka destination identity field must be unique.

Optional fields are `scheduleMetadata`, `writePolicy` (only `update_only`),
`maxRecords` (1–5000), `maxBytes` (1–20,000,000), and `templateRunId`. Omitted limits
use API defaults (500 records and 5,000,000 bytes). `scheduleMetadata` is metadata,
not a request to run a scheduler. A template run must belong to this workspace and
Program, match the batch source/destination, and have reviewed mapping evidence.

The source is created **paused**. Read `get_ingestion_source`, review its returned
workspace, Program, destination IDs, identity fields, schema, limits and
`configHash`. Use that exact 64-character lowercase hexadecimal hash as
`expectedConfigHash` for activation or pause. It has no `sha256:` prefix. A hash
conflict requires reading and reviewing configuration again, not replacing the
hash automatically. Activate only after the user authorizes intake for this source.

## Stage an immutable batch

Before `stage_ingestion_batch`, inspect the source and any previous batch. Supply
the pinned `source_id`, stable external `batchId`, strictly increasing `sequence`,
matching `sourceObject`, actual `records`, and the final `cursor` containing
`field`, `value`, `tieBreakerField` and `tieBreakerValue`. The request also needs
`confirm: true` and a stable `idempotency_key`.

The API validates the active source, reviewed field allowlist/types, configured
record/byte limits, unique identities, ordering, final cursor, cursor advancement,
and completion of the preceding batch before accepting a new one. It stores an
immutable batch and creates a linked migration run. Compatible reviewed mapping
evidence may be copied from the configured template or completed previous run;
this does not authorize automatic destination apply. The response's `runId` is the
run identifier to inspect with `get_migration` before the existing plan/review/apply
lifecycle. Retain internal `batch_id` separately from external `batchId`.

MCP accepts sequences through JavaScript's largest safe integer
`9007199254740991`, a narrower range than the API's int64 maximum. It rejects
non-finite numbers and unsafe integer values anywhere in a submitted payload to
avoid silent rounding. Use a lossless client for larger integer values; never
truncate, round or rewrite customer records to get a batch accepted.

## Scope, errors and retries

Every request sends the explicit UUID in the query. Authentication workspace
mismatches are rejected before dispatch, with no current-workspace fallback.
Responses that explicitly report another workspace or conflicting source/Program
binding are withheld. API authorization remains responsible for validating all
referenced resources in the workspace. Confirmation and idempotency control
fields are not sent in JSON bodies.

All POSTs use `maxRetries: 0`. Only `create_migration` and `stage_ingestion_batch`
accept an idempotency key, sent as `Idempotency-Key`; unsupported keys are rejected
on other tools. Keys must be 8–200 printable non-space ASCII characters. Reuse the
same key only for the same workspace/resource/payload. Batch identity or key reuse
with different data yields an API conflict. A timeout or server error is not
permission to generate a new key, auto-activate a paused source, or apply a run.
Inspect existing source, migration and batch state before deciding to resubmit.

Results preserve the API envelope and returned evidence, adding pinned context,
status, migration/source/batch/run IDs, config/payload hashes and a read-back tool.
Missing identifiers remain null rather than invented. Staged, ready or paused
states must not be presented as completed or verified transfer. API error codes,
HTTP status and trace information remain available; they do not trigger fallback
mutations.

## Boundaries and validation

Connection onboarding and Program create/edit/delete are outside this setup and
ingestion PR. Use existing reviewed connections and Programs. Provider credential
collection belongs to authenticated connection onboarding, not migration payloads
or an unrestricted MCP credential object. There is no arbitrary provider-secret,
SQL execution, automatic scheduling or destination-write tool in this group.

The API contract already exists and the SDK's generic authenticated request
surface covers it. The generic Sanka plugin entry point discovers the hosted
tools; no matching endpoint-specific plugin skill needs regeneration or a release.
Tool descriptions, the hosted guardrails, and `get_capability_guidance` carry the
workspace and approval rules.

Focused tests use mocked transports and cover schema/registration, workspace
mismatches, confirmation, exact body/header forwarding, real SDK retry suppression,
hash/idempotency errors, secret rejection, number precision and safe response
summaries. No production data or migration runs are created by these tests.
