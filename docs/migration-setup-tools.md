# Data migration setup and ingestion tools

This group fills the setup stages before the existing migration plan, apply and
verification tools. It is registered in both hosted and full MCP profiles and
calls existing endpoints from `sanka-api/docs/api/ferry-api.yaml` through the
authenticated SDK transport at `/api/v2/migrate`. No API or generated SDK changes
are required.

## Coverage

Every call requires `workspace_id`, the pinned internal workspace UUID. Every
POST also requires explicit `confirm: true` for that operation and payload.

| Tool                        | Method and path, relative to `/api/v2/migrate` | Idempotency                |
| --------------------------- | ---------------------------------------------- | -------------------------- |
| `create_migration`          | POST `/migrations`                             | Optional `idempotency_key` |
| `create_program_migration`  | POST `/programs/{program_id}/migrations`       | Unsupported                |
| `create_ingestion_source`   | POST `/ingestion-sources`                      | Unsupported                |
| `get_ingestion_source`      | GET `/ingestion-sources/{source_id}`           | Read only                  |
| `activate_ingestion_source` | POST `/ingestion-sources/{source_id}/activate` | Unsupported                |
| `pause_ingestion_source`    | POST `/ingestion-sources/{source_id}/pause`    | Unsupported                |
| `stage_ingestion_batch`     | POST `/ingestion-sources/{source_id}/batches`  | Required `idempotency_key` |

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

## Google Workspace to Microsoft 365

Codex and Claude use the same reviewed migration tools. Connect source and destination
Systems in the authenticated Sanka UI first; service-account JSON and application
secrets must never appear in a prompt or migration spec. `list_migration_connections`
and `get_migration_connection` discover the existing credential-backed Systems.
The OAuth-only create-connection tool cannot onboard these credential types.

Use explicit workspace and System IDs, or read an existing Program and select its
source/destination endpoint IDs. Inspect all workloads and mapping, run full Safety
Check, review the returned plan hash, and obtain the user's confirmation before apply.
A pair's availability does not qualify a real tenant: this pair remains design partner.

For the native Google path, a cold copy requires the user to confirm the source freeze
window before setting `source.options.source_frozen: true`. Resume is not delta sync.
Do not set the option on the user's behalf without that confirmation. Native meetings
need a separately reviewed import method; `target.options.calendar_mode: appointments`
only copies appointments with participant metadata and sends no invitations. Explain
that difference and obtain approval before selecting it. Unsupported recurrence or
sharing audiences block the Safety Check. Never bypass those failures by dropping fields.

Use a bounded pilot in isolated test tenants, inspect mailbox/attachment content and
file permissions, then review completion evidence. A count-only verified result is not
proof of content parity or permission equivalence. Production migration and DNS cutover
require separate customer authorization; cancel/pause does not roll back written data.

Native credential onboarding verifies the delegated Google customer/domain and read
scopes; legacy unverified Systems require reconnect. Native source content references
expire seven days after the run's UTC creation day; start a new reviewed run after
expiry. Use the private content mappings produced by a fresh scan. Retention runs
in the Jobs deployment, so API and Jobs must be released together.

Fresh native scans include owned primary/secondary/empty calendars and their user
access, plus event privacy, availability and supported reminders. Keep the calendar
reference/access route. Internal nested groups flatten effective membership without
promoting nested owners; keep complete user/member/owner routes. Native contacts
require `source_details`; original extended values are preserved in Outlook notes,
not necessarily native fields. Drive transfers require drive/permission routes and
private content references. Large Google-native documents use resumable download
operations. Quota/pending responses require waiting; never drop failed fields.

`verify_migration` now performs fresh source, identity, record/content and observable
access reconciliation for the supported native copy, without destination writes.
Changed content, aliases, provisioning, audiences or review scope blocks it and
invalidates older evidence. `review_migration` signs the exact coverage and scope;
retain those limits when presenting the outcome and verify its signature separately.

Live meetings/RSVPs, series exceptions, contact photos, Forms/Sites, file history,
limited-access folders, external/unresolved principals, manager/domain audience
semantics and live delta/cutover still require another reviewed method. A successful
copy verification does not certify those features or hidden tenant administration.
Local tests establish handler/API behavior, not real tenant qualification.

### Native Exchange batches for Google mail, calendars and contacts

Use `plan_exchange_migration`, `get_exchange_migration` and
`control_exchange_migration` for the provider-managed Exchange path. These use
the new public `/migrations/{id}/exchange` subresource through the SDK's existing
authenticated generic HTTP methods; no generated SDK resource is hand-edited.
Codex and Claude discover the same hosted tools through the existing plugin.
The backend feature defaults off. This path does not change the embedded demo.

First connect a customer-bound Google System with delegated migration and Gmail
settings/calendar ACL read scopes, and a certificate-authenticated Microsoft
System with Exchange migration RBAC. Target mailboxes must be preprovisioned,
licensed, private UserMailboxes; even default calendar availability grants are
refused. Credentials belong in authenticated settings. Bulk execution requires
an existing unlimited Sanka Pro/Enterprise entitlement; finite credits are not
supported. Use a separate reviewed record-copy migration for Drive.

Example prompt for preparing the review:

```text
In workspace <internal UUID>, use Google System <source ID> and Microsoft System
<target ID>. Create a dedicated Google Workspace→Microsoft 365 migration with
source.options.mailbox_method=exchange_online, inspect its binding, then plan the
Exchange batch for <source primary email> → <target primary email>, using accepted
delivery domain <domain>. Show its source permissions, limitations, plan hash and
revision. Prepare the review only; do not start or complete the batch.
```

After explicit authorization, `control_exchange_migration` takes `action=start`,
the exact `expected_plan_hash`, current `expected_revision`, a fresh UUID
`request_id` and `confirm=true`. It creates a scoped endpoint/batch with automatic
completion, rules, delegates and provisioning disabled. `get_exchange_migration`
reads the saved state; `action=recover` refreshes provider reports without provider
writes. Read the current revision after every action/failure. Reuse the identical
request ID/payload after a lost HTTP response; never blindly create a new batch.
Uncertain endpoint/batch creation requires administrator reconciliation because
Microsoft reports do not independently expose the submitted source CSV.

`pause` stops processing without undoing data; `resume` rechecks scope/access.
Ordinary record apply/verify cannot operate this batch. A plan, started batch or
synced status is not a completed/verified migration.

Completion is a separate user decision:

```text
Read the reviewed Exchange batch <migration ID> in workspace <internal UUID>.
Show the latest per-mailbox synchronization/skipped-item reports and explain the
forwarding changes and remaining omissions. Do not complete it until I explicitly
authorize cutover and confirm the source freeze.
```

Only after that authorization pass `action=complete`,
`allow_mail_routing_changes=true` and `source_frozen=true` with the current hash,
revision and a fresh request ID. Every mailbox must have clean Synced reports.
`action=verify` subsequently checks completed zero-skip Microsoft reports without
provider writes. Its result explicitly states that independent content parity and
source-CSV readback are not verified. Source delegates/calendar audiences are
reviewed but not copied; shared calendars, some contact fields, rules and full
meeting/RSVP fidelity are not guaranteed. Local tests do not replace a sandbox
tenant pilot. Production execution and DNS changes need separate authorization.
