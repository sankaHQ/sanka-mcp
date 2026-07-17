// Hand-written Lookout tools for the guarded HubSpot landing-page batch flow.
//
// lookout_create_lp_batch drives the shipped Motion mechanic end to end:
// ensure a Motion exists, configure its graph with the guarded
// `lookout-hubspot-create-landing-page` action (approval always required),
// send the trigger signal, and return the awaiting-approval run. A workspace
// admin then approves in the Lookout console; the in-repo executor calls the
// HubSpot CMS API and lookout_get_run reports the resulting page URLs.

import { randomUUID } from 'node:crypto';

import { asErrorResult, McpTool, ToolCallResult } from './types';
import { requireAuthentication } from './tool-auth';

const LOOKOUT_BASE_PATH = '/api/v2/lookout';

const CREATE_LP_ACTION_SLUG = 'lookout-hubspot-create-landing-page';

const DEFAULT_TEMPLATE_KEY = 'next-best-action';

const DEFAULT_SIGNAL_TYPE = 'lp_batch_request';

/** Server-side hard caps mirrored here so obviously-invalid batches fail fast. */
const MAX_PAGES_PER_ACTION = 50;

const OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
};

const readString = (value: unknown): string | undefined => {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : undefined;
};

const readRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ?
    (value as Record<string, unknown>)
  : undefined;

const readObjectArray = (value: unknown): Array<Record<string, unknown>> | undefined =>
  Array.isArray(value) ?
    value.filter((entry): entry is Record<string, unknown> => Boolean(readRecord(entry)))
  : undefined;

const readArg = (args: Record<string, unknown> | undefined, key: string, aliases: string[] = []): unknown => {
  if (!args) return undefined;
  for (const candidate of [key, ...aliases]) {
    if (Object.prototype.hasOwnProperty.call(args, candidate)) {
      return args[candidate];
    }
  }
  return undefined;
};

const compactRecord = (record: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));

const unwrapV2Data = (payload: Record<string, unknown>): Record<string, unknown> => {
  if (typeof payload['success'] === 'boolean' && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return readRecord(payload['data']) ?? {};
  }
  return readRecord(payload['data']) ?? payload;
};

const lookoutResult = (structuredContent: Record<string, unknown>, summary: string): ToolCallResult => ({
  content: [
    { type: 'text', text: summary },
    {
      type: 'text',
      text: `Structured Lookout data:\n${JSON.stringify(structuredContent, null, 2)}`,
    },
  ],
  structuredContent,
});

const lookoutToolAuthError = (reqContext: Parameters<McpTool['handler']>[0]['reqContext'], title: string) =>
  requireAuthentication({ reqContext, toolTitle: title });

const PAGE_SPEC_SCHEMA = {
  type: 'object' as const,
  required: ['slug', 'html_title'],
  additionalProperties: false,
  properties: {
    slug: {
      type: 'string' as const,
      description:
        'Page slug/path. Must match the workspace slug namespace (default `lp/exp-…`) or publish will be refused.',
    },
    html_title: { type: 'string' as const, description: 'Page <title> / headline.' },
    meta_description: { type: 'string' as const },
    persona_key: {
      type: 'string' as const,
      description: 'Free-form persona identifier this page variant targets.',
    },
    modules: {
      type: 'object' as const,
      additionalProperties: true,
      description:
        'Editable module params of the master template (e.g. hero_heading, pain_bullets, cta_label).',
    },
    form: {
      type: 'object' as const,
      additionalProperties: true,
      description: 'Optional form reference (existing HubSpot form GUID via module params).',
    },
  },
};

export const lookoutCreateLpBatchTool: McpTool = {
  metadata: {
    resource: 'lookout',
    operation: 'write',
    tags: ['lookout', 'hubspot', 'landing-pages', 'motions'],
    httpMethod: 'post',
    httpPath: '/api/v2/lookout/signals',
    operationId: 'lookout.lpBatch.create',
  },
  tool: {
    name: 'lookout_create_lp_batch',
    title: 'Create Lookout HubSpot LP batch',
    description:
      'Queue a batch of HubSpot CMS landing-page drafts through a Lookout Motion. Configures the guarded lookout-hubspot-create-landing-page action (master-page allowlist, slug namespace, volume caps) and triggers it; the returned run stays awaiting_approval until a workspace admin approves it in the Lookout console, after which the managed executor clones the master page and PATCHes each draft. Pages are created as drafts only — publishing is a separate, always-approval-gated action. Check progress with lookout_get_run.',
    inputSchema: {
      type: 'object',
      required: ['master_page_id', 'campaign_id', 'pages'],
      additionalProperties: false,
      properties: {
        master_page_id: {
          type: 'string',
          description: 'HubSpot landing-page ID of the approved master template page to clone.',
        },
        campaign_id: {
          type: 'string',
          description:
            'Experiment/campaign identifier stamped on every page and signal (joins revenue attribution).',
        },
        pages: {
          type: 'array',
          minItems: 1,
          maxItems: MAX_PAGES_PER_ACTION,
          items: PAGE_SPEC_SCHEMA,
          description: `Page specs to create as drafts (max ${MAX_PAGES_PER_ACTION} per batch).`,
        },
        motion_id: {
          type: 'string',
          description:
            'Optional existing Motion to reconfigure. When omitted a Motion is created (idempotently) from template_key.',
        },
        template_key: {
          type: 'string',
          default: DEFAULT_TEMPLATE_KEY,
          description: 'Motion template used when creating the Motion. Cosmetic — the graph is replaced.',
        },
        motion_title: {
          type: 'string',
          description: 'Title for a newly created Motion. Defaults to "HubSpot LP batch".',
        },
        signal_type: {
          type: 'string',
          default: DEFAULT_SIGNAL_TYPE,
          description: 'Signal type used as the Motion dispatch key.',
        },
        channel_id: {
          type: 'string',
          description:
            'Optional HubSpot integration-channel ID override; defaults to the Lookout hubspot connector configuration.',
        },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create Lookout HubSpot LP batch',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = lookoutToolAuthError(reqContext, 'Create Lookout HubSpot LP batch');
    if (authError) return authError;

    const masterPageID = readString(readArg(args, 'master_page_id', ['masterPageId']));
    if (!masterPageID) return asErrorResult('`master_page_id` is required.');
    const campaignID = readString(readArg(args, 'campaign_id', ['campaignId']));
    if (!campaignID) return asErrorResult('`campaign_id` is required.');
    const pages = readObjectArray(readArg(args, 'pages'));
    if (!pages || pages.length === 0) return asErrorResult('`pages` must contain at least one page spec.');
    if (pages.length > MAX_PAGES_PER_ACTION) {
      return asErrorResult(`\`pages\` accepts at most ${MAX_PAGES_PER_ACTION} page specs per batch.`);
    }
    for (const page of pages) {
      if (!readString(page['slug']) || !readString(page['html_title'])) {
        return asErrorResult('Every page spec requires a non-empty `slug` and `html_title`.');
      }
    }

    const signalType = readString(readArg(args, 'signal_type', ['signalType'])) ?? DEFAULT_SIGNAL_TYPE;
    const channelID = readString(readArg(args, 'channel_id', ['channelId']));

    // 1. Ensure the Motion exists (creation is idempotent per template key).
    let motionID = readString(readArg(args, 'motion_id', ['motionId']));
    if (!motionID) {
      const created = (await reqContext.client.post(`${LOOKOUT_BASE_PATH}/motions`, {
        body: {
          template_key: readString(readArg(args, 'template_key', ['templateKey'])) ?? DEFAULT_TEMPLATE_KEY,
          title: readString(readArg(args, 'motion_title', ['motionTitle'])) ?? 'HubSpot LP batch',
        },
      })) as Record<string, unknown>;
      motionID = readString(unwrapV2Data(created)['id']);
      if (!motionID) return asErrorResult('Motion creation did not return an id.');
    }

    // 2. Configure the guarded action graph and activate the Motion.
    const graph = {
      nodes: [
        { id: 'signal-1', type: 'signal', data: { signal_type: signalType } },
        { id: 'condition-1', type: 'condition', data: { mode: 'all', conditions: [] } },
        {
          id: 'action-1',
          type: 'action',
          data: {
            action_slug: CREATE_LP_ACTION_SLUG,
            configured: true,
            approval_required: true,
            input_data: compactRecord({
              master_page_id: masterPageID,
              campaign_id: campaignID,
              pages,
              channel_id: channelID,
            }),
            safety: {
              allowed_master_page_ids: [masterPageID],
              max_pages_per_action: MAX_PAGES_PER_ACTION,
              max_live_pages_per_day: 200,
            },
          },
        },
      ],
      edges: [
        { id: 'edge-1', source: 'signal-1', target: 'condition-1' },
        { id: 'edge-2', source: 'condition-1', target: 'action-1' },
      ],
    };
    await reqContext.client.patch(`${LOOKOUT_BASE_PATH}/motions/${encodeURIComponent(motionID)}`, {
      body: { graph, signal_type: signalType, status: 'active' },
    });

    // 3. Trigger the Motion with an internal signal.
    const signalResponse = (await reqContext.client.post(`${LOOKOUT_BASE_PATH}/signals`, {
      body: {
        provider: 'product_api',
        signal_type: signalType,
        dedupe_key: `lp-batch-${randomUUID()}`,
        occurred_at: new Date().toISOString(),
        attributes: {
          campaign_id: campaignID,
          master_page_id: masterPageID,
          page_count: pages.length,
        },
      },
    })) as Record<string, unknown>;
    const signal = unwrapV2Data(signalResponse);
    const signalID = readString(signal['id']);

    // 4. Resolve the run created by the synchronous dispatch.
    const runsResponse = (await reqContext.client.get(`${LOOKOUT_BASE_PATH}/runs`, {
      query: { motion_id: motionID },
    })) as Record<string, unknown>;
    const runs = readObjectArray(unwrapV2Data(runsResponse)['items']) ?? [];
    const run = runs.find((item) => readString(item['signal_id']) === signalID) ?? runs[0];

    const structuredContent = compactRecord({
      motion_id: motionID,
      signal_id: signalID,
      signal_status: readString(signal['status']),
      run_id: run ? readString(run['id']) : undefined,
      run_status: run ? readString(run['status']) : undefined,
      approval_status: run ? readString(run['approval_status']) : undefined,
      page_count: pages.length,
      campaign_id: campaignID,
    });
    const runID = readString(structuredContent['run_id']);
    return lookoutResult(
      structuredContent,
      runID ?
        `Queued ${pages.length} landing-page draft${pages.length === 1 ? '' : 's'} as run ${runID} (${String(
          structuredContent['run_status'] ?? 'unknown',
        )}). A workspace admin must approve it in the Lookout console before anything is created in HubSpot.`
      : 'Signal sent, but no run was found — check that the Motion is active and the signal type matches.',
    );
  },
};

export const lookoutGetRunTool: McpTool = {
  metadata: {
    resource: 'lookout',
    operation: 'read',
    tags: ['lookout', 'runs', 'landing-pages'],
    httpMethod: 'get',
    httpPath: '/api/v2/lookout/runs/{run_id}',
    operationId: 'lookout.runs.retrieve',
  },
  tool: {
    name: 'lookout_get_run',
    title: 'Get Lookout run',
    description:
      'Inspect one Lookout Motion run: status, approval state, the triggering signal, configured action inputs, and — for executed HubSpot landing-page actions — the provider result including created page IDs and URLs.',
    inputSchema: {
      type: 'object',
      required: ['run_id'],
      additionalProperties: false,
      properties: {
        run_id: { type: 'string' },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get Lookout run',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = lookoutToolAuthError(reqContext, 'Get Lookout run');
    if (authError) return authError;
    const runID = readString(readArg(args, 'run_id', ['runId']));
    if (!runID) return asErrorResult('`run_id` is required.');

    const detailResponse = (await reqContext.client.get(
      `${LOOKOUT_BASE_PATH}/runs/${encodeURIComponent(runID)}`,
    )) as Record<string, unknown>;
    const detail = unwrapV2Data(detailResponse);
    const run = readRecord(detail['run']);

    // Provider actions carry the HubSpot execution result (page IDs/URLs).
    // The list endpoint has no run filter yet, so filter client-side.
    let providerActions: Array<Record<string, unknown>> = [];
    try {
      const actionsResponse = (await reqContext.client.get(`${LOOKOUT_BASE_PATH}/provider-actions`, {
        query: { limit: 100 },
      })) as Record<string, unknown>;
      providerActions = (readObjectArray(unwrapV2Data(actionsResponse)['items']) ?? []).filter(
        (item) => readString(item['run_id']) === runID,
      );
    } catch {
      // Non-fatal: run detail already answers status/approval questions.
    }

    const pageURLs = providerActions.flatMap((action) => {
      const pages = readObjectArray(readRecord(action['provider_response'])?.['pages']) ?? [];
      return pages
        .map((page) => readString(page['url']) ?? readString(page['slug']))
        .filter((value): value is string => Boolean(value));
    });

    const structuredContent = compactRecord({
      ...detail,
      provider_actions: providerActions.length > 0 ? providerActions : undefined,
      page_urls: pageURLs.length > 0 ? pageURLs : undefined,
    });
    const status = readString(run?.['status']) ?? 'unknown';
    const approval = readString(run?.['approval_status']);
    const summaryParts = [
      `Lookout run ${runID}: ${status}`,
      approval && approval !== 'not_required' ? `approval ${approval}` : undefined,
      pageURLs.length > 0 ? `${pageURLs.length} page${pageURLs.length === 1 ? '' : 's'} created` : undefined,
    ].filter(Boolean);
    return lookoutResult(structuredContent, `${summaryParts.join(', ')}.`);
  },
};
