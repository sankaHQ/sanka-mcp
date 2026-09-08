# Migration Programs and agent journey coverage

Audited against sanka-mcp `origin/main` at `8c26a2d` after merged PRs #223–#227,
and the maintained sanka-api Ferry routers/models/services and sanka-react
`src/lib/api/ferry/ferry.api.ts`. These are related surfaces, not interchangeable
contracts. Availability in a client still depends on the hosted MCP release.

| App journey | Existing MCP coverage | Boundary / remaining limitation |
| --- | --- | --- |
| Programs | `/api/v2/public/ferry/programs`: `list_ferry_programs`, `get_ferry_program`, docs and todo operations. `/api/v2/migrate/programs`: `list_migration_programs`, `get_migration_program`, plus template/connection discovery. | The public Ferry surface supports collaboration. The finite migration surface exposes reusable endpoint configuration. This change fills missing create/update configuration tools; it does not duplicate collaboration reads. |
| Scan | `start_migration_plan` queues source inventory inspection and dry-run planning; `get_migration` and `get_migration_plan` read progress and evidence. | inspect_migration/list_migration_source_objects/scan_migration and stored inventory reports now cover standalone record inventory; provider support remains API-owned. |
| Map | Plan inspection, reviewed route selection and existing `create_ferry_diagram`/`update_ferry_diagram` design tools. | A diagram is not an executable mapping. get_migration_mapping/save_migration_mapping/validate_migration_mapping now cover complete field edits and sampled validation using reviewed hashes. AI proposals, destination schema reconciliation and reusable mapping-template operations remain separate. |
| Transfers | `create_migration`, `create_program_migration`, apply/pause/resume/cancel, verification readers/writes; ingestion source/batch lifecycle; import/export job tools also already exist. | Record import/export jobs are not substitutes for migration plans. Connector support, quotas, source/target bindings and verification remain server-owned. |
| Code migration | Code project/migration records and scan/plan/apply/verify artifact registration. | Client-generated evidence only; no hosted repository/code/test execution. |

## Program configuration tools

- `create_migration_program`: `POST /api/v2/migrate/programs`.
- `update_migration_program`: `PATCH /api/v2/migrate/programs/{program_id}`.

The exact contract lives in sanka-api `docs/api/ferry-api.yaml`,
`app/api/v2/ferry/public_migrate_programs_router.py`,
`app/model/domain/ferry/cloud_program.py`, and
`app/service/ferry/cloud_program_service.py`. Existing authenticated SDK HTTP
methods suffice; there are no backend, OpenAPI or generated SDK changes.

Creation requires `template`, from `list_migration_program_templates`, and accepts
`name`, `description`, `sources` and `destinations`. Each endpoint carries a `type`
and optional `id`, named `connection`, `label`, `objects`, and non-secret `options`.
The API resolves connections within the pinned workspace and validates their
provider and the caller's permissions. Do not supply credentials or guess IDs.

PATCH requires `program_id` and at least one change among `name`, `description`,
`status`, `sources`, and `destinations`. Omitted fields remain unchanged. Supplied
endpoint arrays replace that entire side; preserve every intended endpoint and ID.
An explicitly authorized empty array clears it. MCP rejects null endpoint arrays
to avoid an accidental clear. Other explicit nulls are forwarded to the API.
Statuses are `draft`, `active`, `ready`, `completed`, and `archived`. Setting status
is configuration, not proof of completed or verified data movement.

## Authorized flow

1. Pin the internal workspace UUID from `list_workspaces` and reuse it on every
   migration call. Discover templates and existing named connections; inspect a
   selected program with `get_migration_program` before proposing changes.
2. Establish user authorization for the exact configuration change. Set
   `confirm: true` only as an acknowledgement of that authorization. It is not
   independent evidence of human approval or a replacement for server permissions.
3. Create or update, then read back the program. Preserve its endpoint IDs,
   connection IDs and object scope. Before replacing endpoint arrays, confirm all
   intended endpoints/options from the API, including options and options_redacted. Redacted legacy options require
   configuration-owner input before replacement; never reconstruct them as empty objects.
4. Use the existing `create_program_migration` with the returned program ID and
   both explicit endpoint IDs. This creates a run without starting planning or
   transfers. Continue with inspection/planning, review the exact plan hash and
   route scope, and obtain apply authorization before destination writes.

All calls require an explicit workspace UUID and reject a known authenticated
workspace mismatch before dispatch. POST/PATCH retries are disabled. These two
program routes have no `Idempotency-Key` or revision/hash precondition; unsupported
fields are rejected, and no safe-retry or concurrency guarantee is claimed. Read
state after an uncertain result before considering another authorized request.
An API mismatch or conflict must not trigger fallback writes. Responses preserve
the API envelope and endpoint IDs, expose program/workspace context, and point to
`get_migration_program` for readback.

Existing plan/config hash and idempotency contracts elsewhere are unchanged.
Tests use mocked transports only; no production changes or transfers are run.
The companion sanka-plugin change adds migration routing to the generic Sanka skill
and its Codex package copy. No per-tool skills or unrelated regeneration is needed.

Current Scan/Map and signed review/repair details: [Record migration completion](migration-scan-map.md).
