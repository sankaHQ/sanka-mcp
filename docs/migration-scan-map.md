# Record migration Scan/Map and report coverage

This change adds seven adapters for the companion sanka-api public Scan/Map
contract and four for already-existing signed review/repair services. Deploy the
reviewed API before the MCP tools; no deployment is part of these PRs.

| Journey | Tools / capability | Validation and boundary |
| --- | --- | --- |
| Programs | Existing templates, connection discovery, create/update and create_program_migration; full non-secret endpoint options | Omitted PATCH fields preserved; endpoint arrays replace; options_redacted requires owner input; no Program revision guard added |
| Scan | inspect_migration, list_migration_source_objects, scan_migration | Server-derived run channels; exact reviewed binding hash and authorized object scope; reads/polls do not scan |
| Map | get_migration_mapping, save_migration_mapping, validate_migration_mapping | Full typed field schema generated from PublicMappingField; atomic hash-check/save; invalidated old validation; sampled dry-run is write-free |
| Transfers | Existing plan/apply/pause/resume/cancel; repair_migration | Repair retries failed journal records under the same reviewed plan, not structural edits; completed repair currently costs 300 credits |
| Verification | Existing verify/read; get_migration_report; review_migration/get_migration_review/get_migration_attestation_key | Signed service review currently costs 250 credits; attestation/key retrieval is not signature verification or independent human approval |
| Code migration | Existing client artifact lifecycle | No hosted code/repository/test execution |
| Broader platform | Existing collaboration/docs/todos/diagrams retained | Research/assessment, AI mapping proposals, destination schema reconciliation, mapping templates and platform-portability orchestration are not claimed complete |

Use inspect_migration/get_migration_mapping to read the server binding and mapping
hashes. Schema field names include sourceField, targetObject, targetField, identity,
mappingKind, reference/relationship options, sourceFilter, valueMap and
unmappedValuePolicy. Preserve all intended fields; save replaces the list. Empty
fields explicitly clears it. Backend typed models validate semantic combinations.
The schema module is generated from the companion API model with local references
expanded for tool clients; it is not hand-edited generated SDK code.

After save, run validation and inspect actual checks and the new get_migration_plan.
Review the exact plan and routes before apply. Validation of a subset never authorizes
all routes. Preserve failed/skipped/not_run checks. Report reads never generate
missing evidence, and a transport SUCCESS prefix does not mean a check passed.

All tools require an explicit workspace UUID. The API authorizes workspace/run/
channel bindings; cached OAuth metadata and confirm flags are not sufficient.
Confirmation acknowledges authorization established in the conversation, not a
separate human review authority. Existing hashes and execution snapshots guard
reviewed scope. Legacy validation without new fingerprints keeps its existing
manifest checks: rescan/revalidate before relying on new review guarantees.

Scan/save/validate have no idempotency contract and disable automatic retries.
Paid review/repair require explicit action and cost authorization plus a stable
Idempotency-Key (supported by those existing APIs); uncertain outcomes require
inspection before retry, preserving the exact key and operation. No production
calls, paid actions, transfers or deployments were used for testing.

MCP uses existing authenticated generic SDK HTTP methods. The API publishes its
runtime-generated Ferry contract; no generated Node/Python SDK code is hand-edited.
The existing React internal endpoint/client contracts are unchanged. In-chat MCP
connectivity and actual provider end-to-end execution remain deferred.
