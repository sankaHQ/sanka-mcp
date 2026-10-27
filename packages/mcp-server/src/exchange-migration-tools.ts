import { migrationTool } from './migration-tools';

const migrationId = { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]*$' };
const hash = { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' };
const confirm = { type: 'boolean', enum: [true] };

export const exchangeMigrationTools = [
  migrationTool({
    name: 'plan_exchange_migration',
    title: 'Review Google Workspace native Exchange migration',
    path: '/migrations/{migration_id}/exchange/plan',
    method: 'POST',
    description:
      'Probe native Google/Exchange readiness without provider writes and save an immutable batch plan. First create a dedicated Google Workspace→Microsoft 365 migration with source.options.mailbox_method="exchange_online" and explicit credential-backed System IDs. Requires a certificate-authenticated Microsoft System with Exchange.ManageAsApp and Exchange migration RBAC, private preprovisioned target UserMailboxes and delegated Google Gmail-settings/calendar ACL read scopes; connect credentials only in authenticated settings, never in chat. Pass the inspected binding hash, one-to-one source/target primary emails and an accepted Microsoft delivery domain. Review every returned limitation and plan_hash before start. Source delegates and calendar audiences are reviewed but not copied. The batch covers mail, primary calendars and contacts; use a separate reviewed record-copy migration for Drive. Bulk batches require an existing unlimited Sanka Pro/Enterprise entitlement; finite record credits are unsupported. Real tenant qualification is required; native import does not guarantee complete meeting or permission parity.',
    required: ['expected_binding_hash', 'mailboxes', 'target_delivery_domain', 'confirm'],
    parameters: {
      migration_id: migrationId,
      expected_binding_hash: hash,
      mailboxes: {
        type: 'array',
        minItems: 1,
        maxItems: 100,
        items: {
          type: 'object',
          properties: {
            source_email: { type: 'string', maxLength: 254 },
            target_email: { type: 'string', maxLength: 254 },
          },
          required: ['source_email', 'target_email'],
          additionalProperties: false,
        },
      },
      target_delivery_domain: { type: 'string', maxLength: 253 },
      confirm,
    },
  }),
  migrationTool({
    name: 'get_exchange_migration',
    title: 'Read native Exchange migration state',
    path: '/migrations/{migration_id}/exchange',
    description:
      'Read the durable native Exchange plan, revision, pending operation, provider observations and verification coverage for the pinned workspace/migration. This does not refresh Microsoft or modify the destination. Use control_exchange_migration action=recover for a fresh read-only observation. Ordinary record-copy status/verification is separate and must not be presented as this batch result.',
    parameters: { migration_id: migrationId },
  }),
  migrationTool({
    name: 'control_exchange_migration',
    title: 'Control reviewed native Exchange migration',
    path: '/migrations/{migration_id}/exchange/actions',
    method: 'POST',
    forwardConfirmation: true,
    destructiveHint: true,
    description:
      'Run an explicitly authorized native Exchange batch action against the exact reviewed plan_hash and current revision. start creates its scoped Gmail endpoint/batch and starts it; pause stops future processing without rolling back imported data; resume restarts a stopped batch. recover observes provider state without provider mutations, reconciles acknowledged identities and holds uncertain outcomes for manual review rather than creating duplicates. verify checks completed zero-skip Microsoft mailbox reports and declares that independent item parity is not verified. complete is a separate cutover action: it can change forwarding and requires explicit user authorization, allow_mail_routing_changes=true and confirmed source_frozen=true. Never infer cutover permission from start. Use a fresh UUID request_id per intended action and reuse the identical payload after an uncertain HTTP response; POST retries are disabled. Read pending/status before further actions. Do not hide omitted calendars/contact fields or claim production qualification from local tests.',
    required: ['action', 'request_id', 'expected_plan_hash', 'expected_revision', 'confirm'],
    parameters: {
      migration_id: migrationId,
      action: { type: 'string', enum: ['start', 'pause', 'resume', 'complete', 'verify', 'recover'] },
      request_id: {
        type: 'string',
        pattern: '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$',
      },
      expected_plan_hash: hash,
      expected_revision: { type: 'integer', minimum: 1 },
      allow_mail_routing_changes: { type: 'boolean' },
      source_frozen: { type: 'boolean' },
      confirm,
    },
  }),
];
