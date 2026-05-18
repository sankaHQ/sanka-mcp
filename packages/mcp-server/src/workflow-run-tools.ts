import { asErrorResult, McpTool, ToolCallResult } from './types';
import { requireAuthentication } from './tool-auth';

const SOURCE_RECORD_SCHEMA = {
  type: 'object' as const,
  properties: {
    source_system: {
      type: 'string',
      enum: ['sanka', 'hubspot', 'salesforce'],
      description:
        'Source system for the record reference. Use sanka for Sanka records, hubspot for HubSpot deal ids or URLs, and salesforce for Salesforce Opportunity ids or URLs.',
    },
    object_type: {
      type: 'string',
      enum: ['deal', 'opportunity', 'invoice'],
      default: 'deal',
      description:
        'Business object type. Use deal for Sanka/HubSpot deal workflows, opportunity for Salesforce quote-readiness checks, and invoice for Sanka invoice export workflows.',
    },
    record_id: {
      type: 'string',
      description: 'Sanka record UUID or numeric deal id. For hubspot, this may be the HubSpot deal id.',
    },
    external_id: {
      type: 'string',
      description: 'External platform record id, such as a HubSpot deal id or Salesforce Opportunity id.',
    },
    portal_id: {
      type: 'string',
      description:
        'External portal/account id. For HubSpot deal URLs this is parsed from the URL when omitted.',
    },
    channel_id: {
      type: 'string',
      description:
        'Optional Sanka integration channel id when the workspace has multiple HubSpot or Salesforce connections.',
    },
    url: {
      type: 'string',
      description:
        'External source URL. HubSpot deal URLs are accepted for deal_to_estimate, deal_to_invoice, and deal_to_order_handoff. HubSpot deals are searched/read directly for sales_incentive_commission. Salesforce Opportunity URLs are accepted for quote_readiness preview. invoice_export uses Sanka invoice ids, record ids, filters, or workflow run ids instead of external URLs.',
    },
  },
};

const WORKFLOW_TYPE_SCHEMA = {
  type: 'string',
  enum: [
    'deal_to_estimate',
    'deal_to_invoice',
    'deal_to_order_handoff',
    'invoice_export',
    'quote_readiness',
    'revenue_control_summary',
    'sales_incentive_commission',
  ],
  description:
    'Workflow type to preview or run. Use deal_to_estimate for estimate draft workflows, deal_to_invoice for invoice draft workflows from HubSpot deals, deal_to_order_handoff for HubSpot closed-won deal to Sanka order draft / fulfillment handoff workflows, invoice_export for syncing selected Sanka invoice drafts to freee invoice drafts, quote_readiness for read-only Salesforce Opportunity quote readiness checks, revenue_control_summary for read-only HubSpot/Sanka revenue-control buckets, and sales_incentive_commission for draft/read-only commission reports by rep and deal.',
};

const WORKFLOW_RUN_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    data: { type: 'object' },
    message: { type: 'string' },
    ctx_id: { type: 'string' },
  },
};

const RESOLVE_RECORD_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    query: {
      type: 'string',
      description: 'Company, deal, or external record text to resolve.',
    },
    object_type: {
      type: 'string',
      enum: ['deal', 'opportunity'],
      default: 'deal',
      description:
        'Business object type to resolve. Use opportunity when resolving Salesforce Opportunity references.',
    },
    source_system: {
      type: 'string',
      enum: ['sanka', 'hubspot', 'salesforce'],
      description: 'Optional source filter. Omit when the user prompt is ambiguous.',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 20,
      default: 5,
      description: 'Maximum number of candidates to return.',
    },
  },
  required: ['query'],
};

const PREVIEW_WORKFLOW_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    workflow_type: WORKFLOW_TYPE_SCHEMA,
    source_record: SOURCE_RECORD_SCHEMA,
    options: {
      type: 'object',
      description:
        'Optional workflow-specific controls. For HubSpot deal_to_invoice, supports channel_id, search filters, close date filters, billing_status, fulfillment_status, and allow_multiple_invoices for previewing duplicate override behavior. For HubSpot deal_to_order_handoff, pass channel_id when needed, include_inventory_check/include_lead_time_check, requested_delivery_date or delivery address details, handoff_target or ops_owner, and allow_duplicate_order only when the user explicitly approves another order. For invoice_export to freee, provide an explicit sync_scope such as created_in_workflow_run, selected_invoice_ids, selected_record_ids, filtered_unsynced_invoices, or all_eligible_unsynced. For revenue_control_summary, pass date range, channel_id, owner/customer filters, include_records, include_freee_status/include_stripe_status, aging_as_of, and limit_per_bucket. For sales_incentive_commission, pass period or date range, channel_id, CRM owner/rep/customer filters, compensation_rule_id or plan_id, include_records/include_excluded, include_payment_status/include_margin/include_refunds, min_gross_margin_percent, and limits. Ambiguous freee sync requests return needs_confirmation and do not mutate.',
      properties: {
        channel_id: { type: 'string' },
        source_system: { type: 'string', enum: ['hubspot', 'sanka', 'salesforce'] },
        target_system: { type: 'string', enum: ['freee', 'sanka'] },
        include_inventory_check: { type: 'boolean' },
        include_lead_time_check: { type: 'boolean' },
        requested_delivery_date: { type: 'string' },
        delivery_date: { type: 'string' },
        shipping_address: { type: 'string' },
        shipping_city: { type: 'string' },
        shipping_state: { type: 'string' },
        shipping_country: { type: 'string' },
        shipping_postal_code: { type: 'string' },
        handoff_target: { type: 'string' },
        ops_owner: { type: 'string' },
        allow_duplicate_order: { type: 'boolean' },
        include_hubspot_writeback: { type: 'boolean' },
        default_lead_time_days: { type: 'integer', minimum: 0 },
        lead_time_days_by_product_id: { type: 'object' },
        lead_time_days_by_item_id: { type: 'object' },
        sync_scope: {
          type: 'string',
          enum: [
            'created_in_workflow_run',
            'created_in_current_workflow_run',
            'selected_invoice_ids',
            'selected_record_ids',
            'filtered_unsynced_invoices',
            'all_eligible_unsynced',
            'preview_only',
          ],
          description:
            'Explicit freee sync scope. Do not use all_eligible_unsynced unless the user explicitly confirms broad sync.',
        },
        workflow_run_id: { type: 'string' },
        workflow_run_ids: {
          type: 'array',
          items: { type: 'string' },
        },
        invoice_ids: {
          type: 'array',
          items: { type: 'string' },
        },
        record_ids: {
          type: 'array',
          items: { type: 'string' },
        },
        close_date_from: { type: 'string' },
        close_date_to: { type: 'string' },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        date_range_start: { type: 'string' },
        date_range_end: { type: 'string' },
        date_range: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' },
            start_date: { type: 'string' },
            end_date: { type: 'string' },
          },
        },
        billing_status: { type: 'string' },
        fulfillment_status: { type: 'string' },
        completion_status: { type: 'string' },
        invoice_status: { type: 'string' },
        closed_won_stages: {
          type: 'array',
          items: { type: 'string' },
        },
        closed_won_stage_ids: {
          type: 'array',
          items: { type: 'string' },
        },
        deal_stage_filters: {
          type: 'array',
          items: { type: 'string' },
        },
        owner_ids: {
          type: 'array',
          items: { type: 'string' },
        },
        customer_ids: {
          type: 'array',
          items: { type: 'string' },
        },
        period: {
          type: 'string',
          description:
            'Commission/revenue period. For sales_incentive_commission use current_month, last_month, or YYYY-MM.',
        },
        crm_owner_id: { type: 'string' },
        crm_owner_ids: {
          type: 'array',
          items: { type: 'string' },
        },
        rep_id: { type: 'string' },
        rep_ids: {
          type: 'array',
          items: { type: 'string' },
        },
        team: { type: 'string' },
        team_id: { type: 'string' },
        team_ids: {
          type: 'array',
          items: { type: 'string' },
        },
        compensation_rule_id: { type: 'string' },
        plan_id: { type: 'string' },
        include_records: { type: 'boolean' },
        include_excluded: { type: 'boolean' },
        include_links: { type: 'boolean' },
        include_freee_status: { type: 'boolean' },
        include_stripe_status: { type: 'boolean' },
        include_payment_status: { type: 'boolean' },
        include_margin: { type: 'boolean' },
        include_refunds: { type: 'boolean' },
        aging_as_of: { type: 'string' },
        limit_per_bucket: { type: 'integer', minimum: 1, maximum: 100 },
        limit_per_rep: { type: 'integer', minimum: 1, maximum: 500 },
        hubspot_limit: { type: 'integer', minimum: 1, maximum: 100 },
        min_gross_margin_percent: { type: 'number' },
        currency_handling: { type: 'string', enum: ['grouped_by_currency'] },
        allow_multiple_invoices: { type: 'boolean' },
        allow_resync: { type: 'boolean' },
        allow_multiple_freee_drafts: { type: 'boolean' },
        confirm_all: { type: 'boolean' },
        freee_channel_id: { type: 'string' },
        freee_company_id: { type: 'string' },
        freee_args: {
          type: 'object',
          description:
            'Allow-listed freee export arguments such as payment_type, issue_date, payment_date, subject, invoice_note, or supported line-item mapping keys. Unknown keys are rejected by the API.',
        },
        filters: {
          oneOf: [
            {
              type: 'array',
              items: { type: 'object' },
            },
            {
              type: 'object',
            },
          ],
        },
      },
    },
  },
  required: ['workflow_type', 'source_record'],
};

const START_WORKFLOW_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    workflow_type: WORKFLOW_TYPE_SCHEMA,
    source_record: SOURCE_RECORD_SCHEMA,
    options: {
      type: 'object',
      description:
        'Optional workflow-specific controls. For HubSpot deal_to_invoice, pass channel_id when needed and set allow_multiple_invoices only when the user explicitly asks to create another invoice for the same deal. For HubSpot deal_to_order_handoff, start only after preview or explicit user confirmation; pass channel_id when needed, include_inventory_check/include_lead_time_check, requested_delivery_date or delivery address details, handoff_target or ops_owner, include_hubspot_writeback, and allow_duplicate_order only when the user explicitly approved another order. For invoice_export to freee, start only after explicit scope/confirmation; pass sync_scope, invoice_ids or workflow_run_id, freee_channel_id, idempotency_key, and confirm_all only when the user explicitly approved all eligible unsynced invoices. Do not start quote_readiness, revenue_control_summary, or sales_incentive_commission; they are read-only and must use preview_workflow.',
      properties: {
        channel_id: { type: 'string' },
        target_system: { type: 'string', enum: ['freee', 'sanka'] },
        sync_scope: {
          type: 'string',
          enum: [
            'created_in_workflow_run',
            'created_in_current_workflow_run',
            'selected_invoice_ids',
            'selected_record_ids',
            'filtered_unsynced_invoices',
            'all_eligible_unsynced',
          ],
        },
        workflow_run_id: { type: 'string' },
        workflow_run_ids: {
          type: 'array',
          items: { type: 'string' },
        },
        invoice_ids: {
          type: 'array',
          items: { type: 'string' },
        },
        record_ids: {
          type: 'array',
          items: { type: 'string' },
        },
        allow_multiple_invoices: { type: 'boolean' },
        allow_duplicate_order: { type: 'boolean' },
        include_inventory_check: { type: 'boolean' },
        include_lead_time_check: { type: 'boolean' },
        requested_delivery_date: { type: 'string' },
        delivery_date: { type: 'string' },
        shipping_address: { type: 'string' },
        shipping_city: { type: 'string' },
        shipping_state: { type: 'string' },
        shipping_country: { type: 'string' },
        shipping_postal_code: { type: 'string' },
        handoff_target: { type: 'string' },
        ops_owner: { type: 'string' },
        include_hubspot_writeback: { type: 'boolean' },
        default_lead_time_days: { type: 'integer', minimum: 0 },
        lead_time_days_by_product_id: { type: 'object' },
        lead_time_days_by_item_id: { type: 'object' },
        allow_resync: { type: 'boolean' },
        allow_multiple_freee_drafts: { type: 'boolean' },
        confirm_all: { type: 'boolean' },
        freee_channel_id: { type: 'string' },
        freee_company_id: { type: 'string' },
        freee_args: {
          type: 'object',
          description:
            'Allow-listed freee export arguments. Unknown keys are rejected by the API and arbitrary freee payloads are not accepted.',
        },
        filters: {
          type: 'object',
        },
      },
    },
    idempotency_key: {
      type: 'string',
      description: 'Optional key for safely retrying the same workflow start request.',
    },
  },
  required: ['workflow_type', 'source_record'],
};

const GET_WORKFLOW_RUN_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    run_id: {
      type: 'string',
      description: 'Workflow run id returned by start_workflow.',
    },
  },
  required: ['run_id'],
};

const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
};

const readNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
};

const readObject = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
};

const isSalesforceQuoteReadinessPreview = (workflowType: string): boolean =>
  workflowType === 'quote_readiness';

const workflowResult = (payload: Record<string, unknown>, fallbackSummary: string): ToolCallResult => {
  const data = readObject(payload['data']);
  const message = readString(payload['message']);
  const text = message ? `${fallbackSummary}: ${message}` : fallbackSummary;
  return {
    content: [{ type: 'text', text }],
    structuredContent: {
      ...payload,
      ...(data ? { data } : undefined),
    },
  };
};

const postWorkflowRunEndpoint = async ({
  reqContext,
  path,
  body,
  summary,
}: {
  reqContext: Parameters<McpTool['handler']>[0]['reqContext'];
  path: string;
  body: Record<string, unknown>;
  summary: string;
}): Promise<ToolCallResult> => {
  const authError = requireAuthentication({
    reqContext,
    toolTitle: summary,
  });
  if (authError) {
    return authError;
  }

  const response = (await reqContext.client.post(path, { body })) as Record<string, unknown>;
  return workflowResult(response, summary);
};

export const resolveRecordTool: McpTool = {
  metadata: {
    resource: 'workflow-runs',
    operation: 'read',
    tags: ['crm', 'workflow-runs', 'deals', 'estimates', 'invoices', 'salesforce'],
    httpMethod: 'post',
    httpPath: '/v1/public/workflow-runs/resolve-record',
    operationId: 'public.workflowRuns.resolveRecord',
  },
  tool: {
    name: 'resolve_record',
    title: 'Resolve record',
    description:
      'Resolve an ambiguous user phrase such as a company, deal, or Salesforce Opportunity reference into candidate records before previewing or starting a workflow.',
    inputSchema: RESOLVE_RECORD_INPUT_SCHEMA,
    outputSchema: WORKFLOW_RUN_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Resolve record',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const query = readString(args?.['query']);
    if (!query) {
      return asErrorResult('`query` is required.');
    }
    return postWorkflowRunEndpoint({
      reqContext,
      path: '/v1/public/workflow-runs/resolve-record',
      body: {
        query,
        object_type: readString(args?.['object_type']) ?? 'deal',
        source_system: readString(args?.['source_system']),
        limit: readNumber(args?.['limit']),
      },
      summary: 'Resolved record candidates',
    });
  },
};

export const previewWorkflowTool: McpTool = {
  metadata: {
    resource: 'workflow-runs',
    operation: 'read',
    tags: ['crm', 'workflow-runs', 'deals', 'estimates', 'invoices', 'orders', 'salesforce', 'incentives'],
    httpMethod: 'post',
    httpPath: '/v1/public/workflow-runs/preview',
    operationId: 'public.workflowRuns.preview',
  },
  tool: {
    name: 'preview_workflow',
    title: 'Preview workflow',
    description:
      'Dry-run a supported business workflow. For deal_to_estimate, previews the Sanka estimate draft and approval state. For deal_to_invoice, previews the Sanka invoice draft, customer resolution, line items, duplicate check, and approval state from a HubSpot deal. For deal_to_order_handoff, previews a closed-won HubSpot Deal to Sanka order draft / fulfillment handoff with customer/contact resolution, line items, inventory availability, lead-time and delivery timing, duplicate warnings, and HubSpot writeback plan. For invoice_export, previews syncing explicitly scoped Sanka invoice drafts to freee invoice drafts and returns needs_confirmation for ambiguous or broad sync requests without writing records. For quote_readiness, checks whether a Salesforce Opportunity has enough clean data to quote and returns blockers, warnings, fixes, source links, and the generic Sanka platform-mapping reuse/create plan. For revenue_control_summary, summarizes read-only HubSpot closed-won revenue into won, quote_drafted, approval_pending, unbilled, invoiced, unpaid, and blocked buckets with totals and next actions. For sales_incentive_commission, calculates a draft/read-only commission report by rep and deal from HubSpot closed-won deals reconciled with Sanka invoices/orders, payment status, refunds/credits, margin, ownership splits, and Sanka incentive rules. Does not write records.',
    inputSchema: PREVIEW_WORKFLOW_INPUT_SCHEMA,
    outputSchema: WORKFLOW_RUN_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Preview workflow',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const sourceRecord = readObject(args?.['source_record']);
    const workflowType = readString(args?.['workflow_type']);
    if (!workflowType) {
      return asErrorResult('`workflow_type` is required.');
    }
    if (!sourceRecord) {
      return asErrorResult('`source_record` is required.');
    }
    if (isSalesforceQuoteReadinessPreview(workflowType)) {
      const options = readObject(args?.['options']) ?? {};
      const body: Record<string, unknown> = {
        source_record: sourceRecord,
      };
      const channelId = readString(options['channel_id']);
      const language = readString(options['language']);
      if (channelId) {
        body['channel_id'] = channelId;
      }
      if (language) {
        body['language'] = language;
      }
      return postWorkflowRunEndpoint({
        reqContext,
        path: '/v1/public/cpq/quote-readiness/salesforce/preview',
        body,
        summary: 'Previewed Salesforce quote readiness',
      });
    }
    return postWorkflowRunEndpoint({
      reqContext,
      path: '/v1/public/workflow-runs/preview',
      body: {
        workflow_type: workflowType,
        source_record: sourceRecord,
        options: readObject(args?.['options']) ?? {},
      },
      summary: 'Previewed workflow',
    });
  },
};

export const startWorkflowTool: McpTool = {
  metadata: {
    resource: 'workflow-runs',
    operation: 'write',
    tags: ['crm', 'workflow-runs', 'deals', 'estimates', 'invoices', 'orders', 'salesforce'],
    httpMethod: 'post',
    httpPath: '/v1/public/workflow-runs/start',
    operationId: 'public.workflowRuns.start',
  },
  tool: {
    name: 'start_workflow',
    title: 'Start workflow',
    description:
      'Start a supported business workflow. For deal_to_estimate, creates a Sanka estimate draft from the deal, applies existing estimate approval rules, creates pending approval requests when required, and stops there until approval. For deal_to_invoice, creates a Sanka invoice draft from a HubSpot deal with duplicate protection, customer resolution, and platform mapping. For deal_to_order_handoff, creates a Sanka order draft and optional fulfillment handoff task from an eligible closed-won HubSpot Deal only after explicit start/confirmation; it reruns duplicate/idempotency checks and writes HubSpot order/fulfillment status only after Sanka creation succeeds. For invoice_export, syncs only explicitly scoped Sanka invoice drafts to freee invoice drafts after duplicate/idempotency checks; do not use it for an ambiguous sync-all request. Do not use start_workflow for quote_readiness, revenue_control_summary, or sales_incentive_commission; they are read-only preview workflows.',
    inputSchema: START_WORKFLOW_INPUT_SCHEMA,
    outputSchema: WORKFLOW_RUN_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Start workflow',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const sourceRecord = readObject(args?.['source_record']);
    const workflowType = readString(args?.['workflow_type']);
    if (!workflowType) {
      return asErrorResult('`workflow_type` is required.');
    }
    if (!sourceRecord) {
      return asErrorResult('`source_record` is required.');
    }
    return postWorkflowRunEndpoint({
      reqContext,
      path: '/v1/public/workflow-runs/start',
      body: {
        workflow_type: workflowType,
        source_record: sourceRecord,
        options: readObject(args?.['options']) ?? {},
        idempotency_key: readString(args?.['idempotency_key']),
      },
      summary: 'Started workflow',
    });
  },
};

export const getWorkflowRunTool: McpTool = {
  metadata: {
    resource: 'workflow-runs',
    operation: 'read',
    tags: ['crm', 'workflow-runs'],
    httpMethod: 'get',
    httpPath: '/v1/public/workflow-runs/{run_id}',
    operationId: 'public.workflowRuns.retrieve',
  },
  tool: {
    name: 'get_workflow_run',
    title: 'Get workflow run',
    description:
      'Load a workflow run created by start_workflow, including created records, pending or completed approval history, and audit events.',
    inputSchema: GET_WORKFLOW_RUN_INPUT_SCHEMA,
    outputSchema: WORKFLOW_RUN_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get workflow run',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Get workflow run',
    });
    if (authError) {
      return authError;
    }
    const runID = readString(args?.['run_id']);
    if (!runID) {
      return asErrorResult('`run_id` is required.');
    }
    const response = (await reqContext.client.get(
      `/v1/public/workflow-runs/${encodeURIComponent(runID)}`,
    )) as Record<string, unknown>;
    return workflowResult(response, 'Loaded workflow run');
  },
};
