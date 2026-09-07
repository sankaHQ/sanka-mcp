# Migration MCP inspection and planning tools

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

Creating migrations, applying a reviewed plan, lifecycle controls, starting
verification, ingestion mutations and code migration operations remain follow-up
phases. Matching plugin skills should be packaged when these tools are released.
