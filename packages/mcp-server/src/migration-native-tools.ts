import { migrationTool } from './migration-tools';

const id = { type: 'string', minLength: 1, maxLength: 1024 };
const hash = { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' };
const evidence = { type: 'string', minLength: 1, maxLength: 2000 };
const uuid = {
  type: 'string',
  pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
};
const workload = {
  type: 'string',
  enum: ['groups', 'mailboxes', 'calendars', 'contacts', 'onedrive', 'sharepoint', 'teams', 'chats'],
};
const common = {
  migration_id: id,
  expected_binding_hash: hash,
  idempotency_key: { type: 'string', minLength: 8, maxLength: 200 },
};

export const migrationNativeTools = [
  migrationTool({
    name: 'get_migration_native_applications',
    title: 'Inspect source SharePoint applications',
    path: '/migrations/{migration_id}/native-applications',
    description:
      'Read package candidates from a source catalog site in this run’s immutable SharePoint snapshot. Returns package filenames, immutable app/product IDs, versions and declared permissions; no package bodies or destination writes. Review the exact package and application execution impact before adding applications to native review.',
    parameters: {
      migration_id: id,
      source_catalog_site_id: id,
      catalog_scope: { type: 'string', enum: ['tenant', 'sitecollection'] },
    },
    required: ['source_catalog_site_id'],
  }),
  migrationTool({
    name: 'get_migration_native_review',
    title: 'Inspect native Microsoft migration review',
    path: '/migrations/{migration_id}/native-review',
    description:
      'Read Microsoft-to-Microsoft resource and identity candidates, pinned review hashes, private preparation status and durable operation receipts. Review every workload and destination identity before preparing. An uncertain operation is not safe to recreate.',
    parameters: { migration_id: id },
  }),
  migrationTool({
    name: 'save_migration_native_review',
    title: 'Review native Microsoft migration scope',
    path: '/migrations/{migration_id}/native-review',
    method: 'PUT',
    idempotencyHeader: true,
    description:
      'Save an explicit revision-bound native Microsoft scope. Copying retains source data. Online Archive requires mailbox_scope=online_archive and the online_archive_graph_beta_preview limitation acknowledgement; it is a default-off local preview and requires an existing empty destination archive. Primary and archive may be separate resources for the same user. include_hidden_archive_folders requires hidden_archive_content acknowledgement; original Recoverable Items state remains blocked. include_classic_webparts requires classic_webpart_native_passthrough acknowledgement and accepts only shared static Content Editor properties unchanged across versions; serializer-dependent content remains blocked. Existing destination document libraries must be empty and preserve version retention/schema and inherited access. Record exclusions with reasons; unsupported fidelity is blocked. Use only identities returned by the pinned native review. This does not write destination content.',
    parameters: {
      ...common,
      expected_revision: { type: 'integer', minimum: 0 },
      resources: {
        type: 'array',
        minItems: 1,
        maxItems: 1000,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            workload,
            source_id: id,
            destination_id: id,
            destination_site_id: id,
            libraries: { type: 'object', maxProperties: 1000, additionalProperties: id },
            meeting_chat_mode: { type: 'string', enum: ['group_copy'] },
            mailbox_scope: { type: 'string', enum: ['primary', 'online_archive'] },
            include_hidden_archive_folders: { type: 'boolean' },
            include_classic_webparts: { type: 'boolean' },
            include_site_pages: { type: 'boolean' },
            applications: {
              type: 'array',
              maxItems: 100,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  source_catalog_site_id: id,
                  source_catalog_scope: { type: 'string', enum: ['tenant', 'sitecollection'] },
                  source_app_id: uuid,
                  expected_product_id: uuid,
                  expected_version: { type: 'string', pattern: '^[0-9]+([.][0-9]+){3}$' },
                  expected_package_etag: { type: 'string', minLength: 1, maxLength: 512 },
                  package_name: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9_.-]{0,180}[.]sppkg$' },
                  evidence,
                },
                required: [
                  'source_catalog_site_id',
                  'source_app_id',
                  'expected_product_id',
                  'expected_version',
                  'expected_package_etag',
                  'package_name',
                  'evidence',
                ],
              },
            },
            owner_source_id: uuid,
            evidence,
          },
          required: ['workload', 'source_id', 'evidence'],
        },
      },
      users: {
        type: 'array',
        minItems: 1,
        maxItems: 10000,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: { source_id: uuid, destination_id: uuid, evidence },
          required: ['source_id', 'destination_id', 'evidence'],
        },
      },
      source_frozen: { type: 'boolean', const: true },
      preserve_versions: { type: 'boolean', const: true },
      preserve_permissions: { type: 'boolean', const: true },
      acknowledged_limitations: { type: 'array', maxItems: 100, items: { type: 'string' } },
      excluded_items: { type: 'object', maxProperties: 100000, additionalProperties: evidence },
    },
    required: [
      'expected_binding_hash',
      'expected_revision',
      'resources',
      'users',
      'source_frozen',
      'preserve_versions',
      'preserve_permissions',
      'acknowledged_limitations',
      'idempotency_key',
    ],
  }),
  migrationTool({
    name: 'prepare_migration_native_content',
    title: 'Prepare private native Microsoft content',
    path: '/migrations/{migration_id}/native-prepare',
    method: 'POST',
    idempotencyHeader: true,
    description:
      'Explicitly read and privately stage the reviewed source bodies, opaque Exchange streams, historical file versions and permissions. Poll get_migration_native_review for preparation completion. This queues preparation; it does not apply destination content. After preparation, validate the mapping, read the canonical plan and use the existing confirmed apply tool.',
    parameters: {
      ...common,
      expected_revision: { type: 'integer', minimum: 1 },
      expected_review_hash: hash,
      confirm_source_content_read: { type: 'boolean', const: true },
    },
    required: [
      'expected_binding_hash',
      'expected_revision',
      'expected_review_hash',
      'confirm_source_content_read',
      'idempotency_key',
    ],
  }),
  migrationTool({
    name: 'recover_migration_native_operation',
    title: 'Reconcile an uncertain Microsoft operation',
    path: '/migrations/{migration_id}/native-recovery',
    method: 'POST',
    bodyConfirm: true,
    idempotencyHeader: true,
    destructive: true,
    description:
      'After pausing and draining the original executor, adopt a known provider receipt, or use action=resume_staging only for a SharePoint package whose job submission was never dispatched. Omit destination_id for resume_staging. Supply the exact operation revision and independently identified destination ID. The API reads back correspondence before adoption. This never repeats the create/import request. Opaque Exchange items without an acknowledged correspondence receipt cannot be adopted based only on ID or class.',
    parameters: {
      ...common,
      operation_id: id,
      expected_operation_revision: { type: 'string', minLength: 1, maxLength: 100 },
      action: { type: 'string', enum: ['adopt', 'resume_staging'], default: 'adopt' },
      destination_id: { type: 'string', minLength: 1, maxLength: 2048 },
      evidence,
      confirm: { type: 'boolean', const: true },
    },
    required: [
      'expected_binding_hash',
      'operation_id',
      'expected_operation_revision',
      'evidence',
      'confirm',
      'idempotency_key',
    ],
  }),
];
