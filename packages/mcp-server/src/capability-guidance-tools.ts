import { McpTool, ToolCallResult } from './types';

const CAPABILITY_GUIDANCE_VERSION = '2026-06-02.workflow-platform-guidance.v1';

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

const buildGuidance = (args: Record<string, unknown> | undefined): Record<string, unknown> => {
  const intent = readString(args?.['intent']).toLowerCase();
  const provider = readString(args?.['provider']).toLowerCase();
  const objectType = readString(args?.['object_type']).toLowerCase();
  const operation = readString(args?.['operation']).toLowerCase();
  const combined = [intent, provider, objectType, operation].join(' ');

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
      'Fetch current hosted Sanka MCP capability guidance before refusing an ambiguous or newly added Sanka capability. Use this when local Skill text or visible tools may be stale.',
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
    const guidance = buildGuidance(args);
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
