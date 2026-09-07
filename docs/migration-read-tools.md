# Migration MCP tools

The migration tool group exposes the existing finite migration API to AI clients.
It complements the existing Flow import/export tools and Ferry program document/todo
tools; it does not replace them.

| MCP tool                           | GET path beneath `/api/v2/migrate`                  | Optional query  |
| ---------------------------------- | --------------------------------------------------- | --------------- |
| `list_migration_connectors`        | `/connectors`                                       |                 |
| `list_migration_connections`       | `/connections`                                      | `page`, `limit` |
| `get_migration_connection`         | `/connections/{connection_id}`                      |                 |
| `list_migration_program_templates` | `/program-templates`                                |                 |
| `list_migration_programs`          | `/programs`                                         |                 |
| `get_migration_program`            | `/programs/{program_id}`                            |                 |
| `list_migrations`                  | `/migrations`                                       | `page`, `limit` |
| `get_migration`                    | `/migrations/{migration_id}`                        |                 |
| `get_migration_plan`               | `/migrations/{migration_id}/plan`                   |                 |
| `get_migration_verification`       | `/migrations/{migration_id}/verification`           |                 |
| `list_ingestion_sources`           | `/ingestion-sources`                                |                 |
| `list_ingestion_batches`           | `/ingestion-sources/{source_id}/batches`            | `limit`         |
| `get_ingestion_batch`              | `/ingestion-sources/{source_id}/batches/{batch_id}` |                 |

Every call requires an explicit internal `workspace_id` UUID. Keep that UUID and
resource IDs fixed for the migration, regardless of another session changing its
current workspace. The adapter rejects a mismatch with available authenticated
workspace metadata; the API remains authoritative for token binding, membership,
feature gates and capability permissions. Missing session metadata does not remove
the required explicit UUID or the API authorization checks.

The schema and runtime validator reject unknown arguments, missing resource IDs,
unsafe path segments and out-of-range pagination. Limit is 1–100, with API defaults
used when omitted. API envelopes, pagination, error codes, trace context and embedded
plan keys/hashes are preserved. Reading a plan or verification does not generate it.

## Contract and transport

The source contract is `sanka-api/docs/api/ferry-api.yaml`. Its documented public
edge URL is `https://api.sanka.com/v2/migrate`; the canonical backend mount is
`/api/v2/migrate`, as used by the configured hosted MCP API origin. These adapters
use the existing authenticated SDK transport, so no generated SDK resource,
API implementation or API contract change is needed for this phase.

## Start inspection and planning

`start_migration_plan` calls `POST /api/v2/migrate/migrations/{migration_id}/plan`
for an existing migration. It requires `workspace_id` and `migration_id`. Optional
body fields match `SankaMigratePlanRequest`: `sample_size` (integer, minimum 1,
API default 10) and `force` (boolean, API default false). Omitted values remain
omitted so the API owns its defaults.

The backend queues source inventory inspection followed by write-free dry-run
planning. It updates migration/job state and can consume planning quota, so the
MCP tool is marked as a write operation, not read-only or unconditionally idempotent.
It does not create/update destination records, approve a plan, or apply it.
Existing in-flight work and reusable evidence are deduplicated by the API.
`force=true` requests a fresh scan and plan and should be used only for an explicitly
requested re-plan. The API rejects planning once transfer has begun.

Use the following flow with the same pinned workspace and migration IDs:

1. Read `get_migration` to inspect the existing migration.
2. Call `start_migration_plan` when inspection/planning is requested.
3. A queued response is not completion. Poll `get_migration` for progress.
4. Read `get_migration_plan` for the reviewable plan and `plan_hash`.
   `FERRY_PLAN_NOT_READY` means no plan is ready yet; it does not trigger another scan.

Automatic SDK retries are disabled for the planning POST. After an ambiguous timeout
or service error, inspect the migration before considering another submission,
especially with `force=true`. API rate limits, state guards, error codes and trace
context are preserved.

The current public contract has no separate data-migration scan or inventory GET
endpoint. Existing migration and plan reads provide inspection progress/evidence;
no unsupported endpoint or scan alias is invented here.

## Execute and control a reviewed migration

The following stateful tools use the existing Migration API. All require an explicit
`workspace_id`, `migration_id` and `confirm: true`. Confirmation has no default:
missing, false, string or numeric values fail before any API request. The flag must
represent explicit user authorization for that specific action and scope. A request
to inspect or plan is not approval to execute.

| Tool               | POST path beneath `/api/v2/migrate` | Additional required input      | Optional input |
| ------------------ | ----------------------------------- | ------------------------------ | -------------- |
| `apply_migration`  | `/migrations/{migration_id}/apply`  | `plan_hash`, `idempotency_key` | `routes`       |
| `pause_migration`  | `/migrations/{migration_id}/pause`  |                                |                |
| `resume_migration` | `/migrations/{migration_id}/resume` | `plan_hash`                    |                |
| `cancel_migration` | `/migrations/{migration_id}/cancel` |                                |                |

Before applying, present the plan from `get_migration_plan`, the pinned workspace,
source/destination scope, selected route keys and exact `plan_hash` for review.
Only after the user authorizes that plan and scope should the caller set `confirm`
to true. The API remains authoritative for recomputing the plan hash, access,
entitlement and migration state before destination execution is submitted.

`apply_migration` requires a stable idempotency key even though the API makes that
header optional. It must contain 8–200 printable ASCII characters without spaces.
The adapter sends it only in `Idempotency-Key`, and sends only `plan_hash` plus
optional `routes` in the body. It never generates or silently replaces the key.
An omitted route selection means **all planned routes**, so omission requires
approval of that scope. An explicitly supplied route selection must contain 1–100
unique nonblank keys. Empty or null selections are rejected rather than being
interpreted as all routes. Only route keys present in the reviewed plan are valid
for execution; the API validates that binding.

Resume revalidates the reviewed hash and continues from durable checkpoints using
the previous route selection. It accepts neither replacement routes nor an
idempotency key, since that endpoint does not define one. Pause stops the active
job but preserves resumable checkpoints. Cancel stops active work and marks the
migration terminally cancelled. **Neither pause nor cancel rolls back records
already written to the destination.**

All four tools disable automatic SDK retries and are advertised as stateful,
non-idempotent operations. Apply, resume and cancel carry the destructive hint;
pause does not. After an ambiguous timeout, inspect `get_migration` before any
resubmission. A deliberate retry of the identical apply must reuse the same key,
hash and route selection. Hash or idempotency conflicts must be resolved through
review; never replace a hash/key automatically to bypass them.

Execution replies use a short status summary and preserve the API envelope in
structured content. They include the pinned workspace and migration ID, returned
migration status and plan hash, and the separately labelled `requested_plan_hash`
where applicable. Any job/run identifiers returned by the API remain in the
original payload; none are invented when the API omits them. Queued or applying
means execution is still pending, not completion or successful verification.
Errors retain API codes/status/context and do not trigger fallback writes.

## Verify and inspect the completed transfer

`verify_migration` calls `POST /api/v2/migrate/migrations/{migration_id}/verify`.
It requires the pinned workspace UUID, migration ID and `confirm: true`. The API
accepts no request body or plan hash for this operation. An optional
`idempotency_key` uses the same 8–200 character validation and is sent only as the
`Idempotency-Key` header. Automatic POST retries remain disabled. Reuse a provided
key for identical retries; inspect the report/status after an uncertain response.

The API checks that the migration has completed transfer evidence, reconciles that
evidence and persists a report atomically. It can read destination counts according
to the migration's existing verification configuration. It does not apply, repair
or roll back destination records. It is marked stateful but non-destructive.

`get_migration_verification` reads the current report without starting any job or
changing data. A 404 means no current report exists; it does not authorize automatic
verification or re-execution. Both tools preserve per-route counts/results and
individual checks. Report `status` and `ok` independently of transport success:
a successful HTTP response can contain a failed verification report. A check marked
`not_run` has not passed verification. The current API leaves `field_sampling` as
`not_run`; never describe the report as proof that every destination field matched.

[Data migration setup and ingestion tools](migration-setup-tools.md) now create
migrations and register, activate, pause and stage batch ingestion sources.
The separate [code migration tool group](code-migration-tools.md) supports
client-executed code migration artifact registration and inspection.
Matching plugin skills should be packaged when these tools are
released. No destination writes or production jobs are performed by implementation
tests, which use mocked API transports.
