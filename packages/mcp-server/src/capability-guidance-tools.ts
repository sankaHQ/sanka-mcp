import { SHARED_WORKFLOW_GUIDANCE } from './instructions';
import { McpTool, ToolCallResult } from './types';

const CAPABILITY_GUIDANCE_VERSION = '2026-09-09.workflow-guidance.v1';

const WORKFLOW_HINT_MIN_LENGTH = 4;

const WORKFLOW_HINT_STOPWORDS = new Set([
  'about',
  'after',
  'before',
  'from',
  'into',
  'only',
  'sanka',
  'than',
  'that',
  'them',
  'then',
  'these',
  'this',
  'those',
  'user',
  'want',
  'wants',
  'when',
  'with',
  'would',
]);

const GUIDANCE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    intent: {
      type: 'string',
      description:
        'Natural-language summary of the user request, especially before refusing a Sanka capability.',
    },
    provider: {
      type: 'string',
      description: 'Optional platform hint such as hubspot, salesforce, sanka, freee, or moneyforward.',
    },
    object_type: {
      type: 'string',
      description: 'Optional object hint such as deal, opportunity, invoice, order, or workflow.',
    },
    operation: {
      type: 'string',
      description: 'Optional operation hint such as create, update, run, preview, sync, or summarize.',
    },
  },
};

const readString = (value: unknown): string => String(value ?? '').trim();

const includesAny = (value: string, terms: string[]): boolean => terms.some((term) => value.includes(term));

/**
 * Selects the workflow rules that mention any of the request hints. The rules used to be embedded
 * in the initialize instructions of every session; they are now served here on demand so that
 * clients that copy instructions into every tool definition stay small. When no hint matches, the
 * full rule set is returned so callers never lose guidance.
 */
export const selectWorkflowGuidance = (
  args: Record<string, unknown> | undefined,
): { workflow_guidance: string[]; workflow_guidance_scope: 'matched' | 'all' } => {
  const hints = new Set<string>();
  for (const key of ['provider', 'object_type', 'operation']) {
    const value = readString(args?.[key]).toLowerCase();
    if (value) {
      hints.add(value);
    }
  }
  for (const word of readString(args?.['intent'])
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)) {
    if (word.length >= WORKFLOW_HINT_MIN_LENGTH && !WORKFLOW_HINT_STOPWORDS.has(word)) {
      hints.add(word);
    }
  }
  const matched =
    hints.size === 0 ?
      []
    : SHARED_WORKFLOW_GUIDANCE.filter((line) => {
        const normalized = line.toLowerCase();
        return [...hints].some((hint) => normalized.includes(hint));
      });
  return matched.length > 0 ?
      { workflow_guidance: matched, workflow_guidance_scope: 'matched' }
    : { workflow_guidance: [...SHARED_WORKFLOW_GUIDANCE], workflow_guidance_scope: 'all' };
};

const buildGuidance = (args: Record<string, unknown> | undefined): Record<string, unknown> => {
  const intent = readString(args?.['intent']).toLowerCase();
  const provider = readString(args?.['provider']).toLowerCase();
  const objectType = readString(args?.['object_type']).toLowerCase();
  const operation = readString(args?.['operation']).toLowerCase();
  const combined = [intent, provider, objectType, operation].join(' ');
  if (/\bmigrat(?:e|es|ing|ion|ions)\b/.test(combined)) {
    const codeMigration = includesAny(combined, ['code migration', 'drf', 'django', 'fastapi', 'repository']);
    return {
      capability_version: CAPABILITY_GUIDANCE_VERSION,
      intent_family: codeMigration ? 'code_migration_evidence' : 'data_migration',
      supported: true,
      recommended_tools:
        codeMigration ?
          [
            'list_code_projects',
            'get_code_migration',
            'get_code_migration_plan',
            'get_code_migration_verification',
          ]
        : [
            'list_migration_program_templates',
            'list_migration_connections',
            'list_migration_programs',
            'get_migration_program',
            'create_migration_program',
            'update_migration_program',
            'create_program_migration',
            'get_migration',
            'get_migration_plan',
          ],
      route:
        codeMigration ?
          'Code migration tools register genuine client-produced DRF-to-FastAPI artifacts. They do not run code, scans, tests, repository rewrites or deployments. Only submit artifacts from a separately authorized client run.'
        : 'Use migration Programs for reusable endpoint configuration, then create_program_migration with both reviewed endpoint IDs. Retrieve get_migration_journey first for the compact four-stage status, bounded blockers and next action; fetch full reports only when needed. start_migration_plan queues inspection/planning; read the plan before any authorized apply. Blocked plans remain reviewable: inspect ready/risk_level, document warnings, route issues and destination safety details. FERRY_DESTINATION_IDENTITY_REQUIRED identifies a missing mapped destination identity field, while quarantine_properties_missing identifies missing destination quarantine properties; resolve the reported mapping or destination configuration and re-plan before considering apply. Existing Ferry program docs/todos and diagrams serve collaboration/design; a diagram is not an executable mapping. Use inspect_migration/list_migration_source_objects/scan_migration for inventory, get_migration_mapping/save_migration_mapping for hash-checked field edits, validate_migration_mapping for write-free sample validation, and get_migration_report for stage evidence. These extend the record migration journey; broader assessment/research features remain separate. Connector availability remains server-owned.',
      mutation_policy:
        'Pin the internal workspace UUID on every call. Establish user authorization from the conversation; confirm=true is an acknowledgement, not proof of approval. Preserve exact reviewed plan/config hashes and tool-specific idempotency rules. Program POST/PATCH and code-artifact writes have no idempotency contract. Never replay an uncertain state change automatically; inspect state first. Supplied Program endpoint arrays replace that side, and read Program options and options_redacted before replacement; never discard redacted configuration. Queued status or Program completed metadata is not verified transfer evidence; inspect each verification check.',
      fallback_when_missing:
        'If a recommended tool is unavailable, refresh/reconnect the Sanka MCP/plugin. Do not invent an endpoint or substitute local scripts for hosted Sanka operations.',
    };
  }
  const appBuilderProductTerms = [
    'app builder',
    'blueprint',
    'erp',
    'crm',
    'module',
    'side menu',
    'permission set',
    'governance',
    'モジュール',
    'サイドメニュー',
    '権限',
    'ガバナンス',
  ];
  const appBuilderBuildTerms = [
    'build',
    'configure',
    'setup',
    'set up',
    'implement',
    'schema',
    '構築',
    '設定',
    'セットアップ',
    '実装',
    'スキーマ',
  ];

  if (
    includesAny(combined, ['app builder', 'blueprint']) ||
    (includesAny(combined, appBuilderProductTerms) && includesAny(combined, appBuilderBuildTerms))
  ) {
    return {
      capability_version: CAPABILITY_GUIDANCE_VERSION,
      intent_family: 'sanka_app_builder',
      supported: true,
      recommended_tools: ['list_app_blueprint_templates', 'preview_app_blueprint', 'apply_app_blueprint'],
      route:
        'Use app blueprint tools. Exact template intents should use a built-in template such as CRM, ERP, expense management, inventory management, procurement management, billing and collections, HR management, IT asset management, project management, or support desk. Partial matches should use the closest template plus overlay for adjusted module labels, custom objects, permission sets, and Mermaid artifacts. Completely unknown requests should send ai_generated blueprint_dsl to preview only. Pass language="ja" for Japanese requests and preserve the same language on apply. Call apply only after explicit user approval with confirm=true. Pass create_editable_guides=true when generated guides should be visible and editable from the Sanka guide drawer/admin UI.',
      mutation_policy:
        'apply_app_blueprint performs real Sanka mutations: side-menu modules, missing custom object schemas, permission sets, and persisted guide/Mermaid artifacts. It can promote those artifacts to editable manuals with create_editable_guides=true. Call apply only after explicit user approval with confirm=true. For ai_generated blueprints, also require a valid preview validator result and allow_generated_blueprint_apply=true. It does not assign users or delete records.',
      fallback_when_missing:
        'If app blueprint tools are not visible in this client session, say the Sanka Skill or MCP tool catalog may be stale and ask the user to update/reconnect the Sanka plugin or start a fresh session.',
    };
  }

  if (
    includesAny(combined, [
      'sanka-connected gmail',
      'connected gmail',
      'gmail integration',
      'integration inbox',
      'public message',
      'workspace message',
      'shared inbox',
      'group inbox',
      'workspace inbox',
      'contact conversation',
      '/conversation',
      '連携されてるgmail',
      '連携 gmail',
      '共有受信箱',
      'ワークスペース受信箱',
    ])
  ) {
    return {
      capability_version: CAPABILITY_GUIDANCE_VERSION,
      intent_family: 'workspace_integration_inbox_messages',
      supported: true,
      recommended_tools: [
        'sync_workspace_messages',
        'list_workspace_messages',
        'update_workspace_message_draft',
        'get_workspace_message_thread',
        'reply_workspace_message_thread',
      ],
      route:
        'Use workspace message tools for Sanka-connected Gmail, integration inbox, /conversation, Contact Conversation, shared inbox, group inbox, and workspace inbox. Use update_workspace_message_draft to edit a reviewed draft in place without sending or duplicating it. Use reply_workspace_message_thread only after the user explicitly asks to send the exact reply and pass confirm_send=true. If multiple distinct senders exist across private and workspace inboxes, ask the user to confirm the resolved sender and then pass expected_sender_email; with one sender, omit it. Never auto-retry SENDER_CONFIRMATION_REQUIRED. Report the returned sender_email. Drafting or writing is not send authorization. Do not use private message tools unless the user explicitly asks for their private/personal account-level inbox.',
      fallback_when_missing:
        'If workspace message tools are not visible in this client session, say the Sanka Skill or MCP tool catalog may be stale and ask the user to update/reconnect the Sanka plugin or start a fresh session.',
    };
  }

  if (
    includesAny(combined, ['hubspot', 'salesforce']) &&
    includesAny(combined, ['workflow', 'automation', '自動化', 'ワークフロー'])
  ) {
    const normalizedProvider = includesAny(combined, ['salesforce']) ? 'salesforce' : 'hubspot';
    const supported =
      normalizedProvider === 'hubspot' ?
        {
          supported: true,
          recommended_tools: ['create_workflow', 'update_workflow'],
          route:
            'Use the shared workflow endpoint with provider=hubspot. Do not look for a provider-specific create_hubspot_workflow tool.',
          dry_run_policy:
            'Run create_workflow/update_workflow with dry_run=true first. Set confirm=true only after explicit user approval.',
        }
      : {
          supported: false,
          recommended_tools: [],
          route:
            'Salesforce native automation creation is not currently exposed through Sanka MCP. Use Salesforce quote_readiness previews only for supported read-only CPQ checks.',
          dry_run_policy: null,
        };
    return {
      capability_version: CAPABILITY_GUIDANCE_VERSION,
      intent_family: `${normalizedProvider}_native_workflow_automation`,
      ...supported,
      fallback_when_missing:
        'If the recommended tool is not visible in this client session, do not answer that Sanka cannot do it from preview_workflow/start_workflow alone. Tell the user the Sanka Skill or MCP tool catalog may be stale and ask them to update/reconnect the Sanka plugin or start a fresh session.',
      stale_skill_guardrail:
        'Do not use preview_workflow/start_workflow as evidence that provider-native workflow automation is unavailable.',
    };
  }

  if (
    includesAny(combined, ['cargo']) &&
    includesAny(combined, [
      'catalog',
      'supplier',
      'research',
      'category',
      'カタログ',
      '仕入れ先',
      '調査',
      'カテゴリー',
    ])
  ) {
    return {
      capability_version: CAPABILITY_GUIDANCE_VERSION,
      intent_family: 'cargo_global_catalog',
      supported: true,
      recommended_tools: ['get_cargo_catalog', 'import_cargo_catalog'],
      route:
        'Use get_cargo_catalog for the global research, supplier, intake, and publication queue. Use import_cargo_catalog for idempotent research bundles. Do not create tenant Company records for global Cargo supplier research.',
      mutation_policy:
        'import_cargo_catalog may create or update research rows and draft or ready-for-review snapshots. It never publishes an LP. Publication remains an explicit admin action in /manage/cargo.',
      fallback_when_missing:
        'If these tools are not visible, update or reconnect the Sanka MCP/plugin before falling back to direct API access. Never give an agent direct database credentials.',
    };
  }

  return {
    capability_version: CAPABILITY_GUIDANCE_VERSION,
    intent_family: 'general_sanka_capability',
    supported: null,
    recommended_tools: [],
    route:
      'Use the dedicated Sanka MCP tool that matches the live operation. If no dedicated tool is visible, avoid guessing from older skill text and ask the user to update/reconnect the Sanka plugin or MCP session.',
    fallback_when_missing:
      'Before refusing, check the current hosted tool catalog or this guidance tool. Stale local skills can lag behind hosted MCP capabilities.',
  };
};

export const getCapabilityGuidanceTool: McpTool = {
  metadata: {
    resource: 'capability_guidance',
    operation: 'read',
    tags: ['guidance', 'capabilities', 'workflows'],
    operationId: 'mcp.capability_guidance.get',
  },
  tool: {
    name: 'get_capability_guidance',
    title: 'Get capability guidance',
    description:
      'Fetch current hosted Sanka MCP capability guidance plus the workflow rules for a request area. Call it before ambiguous or multi-step Sanka work and before refusing an ambiguous or newly added Sanka capability; the server instructions no longer embed these workflow rules.',
    inputSchema: GUIDANCE_INPUT_SCHEMA,
    outputSchema: {
      type: 'object',
      properties: {
        guidance: { type: 'object' },
      },
    },
    securitySchemes: [{ type: 'noauth' }],
    annotations: {
      title: 'Get capability guidance',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ args }): Promise<ToolCallResult> => {
    const guidance = { ...buildGuidance(args), ...selectWorkflowGuidance(args) };
    return {
      content: [
        {
          type: 'text',
          text: `Current Sanka capability guidance:\n${JSON.stringify(guidance, null, 2)}`,
        },
      ],
      structuredContent: { guidance },
    };
  },
};
