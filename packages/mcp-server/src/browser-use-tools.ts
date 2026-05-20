import { McpTool, ToolCallResult } from './types';
import { requireAuthentication } from './tool-auth';

const SUPPORTED_BROWSER_USE_WORKFLOWS = ['demo.hubspot.company_avatar'] as const;
const SUPPORTED_BROWSER_USE_DRIVERS = [
  'agent_browser',
  'playwright',
  'browser_use_oss',
  'browser_use_cloud',
] as const;

type BrowserUseWorkflow = (typeof SUPPORTED_BROWSER_USE_WORKFLOWS)[number];
type BrowserUseDriver = (typeof SUPPORTED_BROWSER_USE_DRIVERS)[number];

type BrowserUseCompanyAvatarInput = {
  portal_id?: string;
  browser_profile_id?: string;
  companies?: Array<Record<string, unknown>>;
};

type BrowserUseWorkerPayload = {
  workflow: BrowserUseWorkflow;
  driver: BrowserUseDriver;
  dry_run: boolean;
  confirm: boolean;
  workspace_id?: string;
  reference_id?: string;
  input: Record<string, unknown>;
  context: {
    client_name?: string;
    client_version?: string;
    mcp_session_id?: string;
  };
};

const BROWSER_USE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    workflow: {
      type: 'string',
      description:
        'Registered browser workflow to run. Start with demo.hubspot.company_avatar for HubSpot demo company avatars.',
      enum: [...SUPPORTED_BROWSER_USE_WORKFLOWS],
    },
    driver: {
      type: 'string',
      description:
        'Browser execution backend. agent_browser is the preferred self-hosted driver for deterministic Sanka workflows.',
      enum: [...SUPPORTED_BROWSER_USE_DRIVERS],
      default: 'agent_browser',
    },
    dry_run: {
      type: 'boolean',
      description:
        'Validate the registered browser workflow without changing the third-party site. Defaults to true.',
      default: true,
    },
    confirm: {
      type: 'boolean',
      description:
        'Required with dry_run=false because browser workflows can upload files or mutate third-party UI state.',
      default: false,
    },
    workspace_id: {
      type: 'string',
      description:
        'Optional Sanka workspace UUID for audit context. This is metadata for the browser workflow, not a workspace switcher.',
    },
    reference_id: {
      type: 'string',
      description: 'Optional caller reference used for idempotency or trace correlation.',
    },
    timeout_ms: {
      type: 'integer',
      description: 'Maximum time to wait for the browser worker response. Defaults to 120000 ms.',
      minimum: 10000,
      maximum: 600000,
      default: 120000,
    },
    input: {
      type: 'object',
      description:
        'Workflow-specific payload. For demo.hubspot.company_avatar, pass portal_id, optional browser_profile_id, and companies with record_id or record_url plus an image source.',
      additionalProperties: true,
      properties: {
        portal_id: {
          type: 'string',
          description: 'HubSpot portal id, for example 51471618.',
        },
        browser_profile_id: {
          type: 'string',
          description:
            'Browser worker profile to use for the logged-in HubSpot session. The MCP server does not read browser cookies.',
        },
        companies: {
          type: 'array',
          description:
            'HubSpot companies to update. Each row should include record_id or record_url plus image_url, image_file_url, image_base64, or image_path.',
          items: {
            type: 'object',
            additionalProperties: true,
            properties: {
              record_id: { type: 'string' },
              record_url: { type: 'string' },
              company_id: { type: 'string' },
              name: { type: 'string' },
              image_url: { type: 'string' },
              image_file_url: { type: 'string' },
              image_base64: { type: 'string' },
              image_mime_type: { type: 'string' },
              image_path: {
                type: 'string',
                description:
                  'Path local to the browser worker host. Do not pass a client-local path to the hosted MCP server.',
              },
              filename: { type: 'string' },
            },
          },
        },
      },
    },
  },
  required: ['workflow', 'input'],
};

const BROWSER_USE_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    workflow: { type: 'string' },
    driver: { type: 'string' },
    dry_run: { type: 'boolean' },
    confirm: { type: 'boolean' },
    status: { type: 'string' },
    worker_configured: { type: 'boolean' },
    worker_run_id: { type: ['string', 'null'] as any },
    plan: {
      type: ['object', 'null'] as any,
      additionalProperties: true,
    },
    result: {
      type: ['object', 'null'] as any,
      additionalProperties: true,
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
    message: { type: 'string' },
  },
  required: [
    'workflow',
    'driver',
    'dry_run',
    'confirm',
    'status',
    'worker_configured',
    'worker_run_id',
    'warnings',
    'message',
  ],
};

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const readBoolean = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined);

const readNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const readPlainObject = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
};

const isSupportedWorkflow = (value: string): value is BrowserUseWorkflow =>
  (SUPPORTED_BROWSER_USE_WORKFLOWS as readonly string[]).includes(value);

const isSupportedDriver = (value: string): value is BrowserUseDriver =>
  (SUPPORTED_BROWSER_USE_DRIVERS as readonly string[]).includes(value);

const browserWorkerURL = (): string | undefined => readString(process.env['SANKA_BROWSER_USE_WORKER_URL']);

const browserWorkerToken = (): string | undefined =>
  readString(process.env['SANKA_BROWSER_USE_WORKER_TOKEN']);

const browserWorkerTimeout = (args: Record<string, unknown> | undefined): number => {
  const value = readNumber(args?.['timeout_ms'] ?? args?.['timeoutMs']);
  if (value === undefined) {
    return 120000;
  }
  return Math.min(600000, Math.max(10000, Math.trunc(value)));
};

const errorResult = (text: string, structuredContent?: Record<string, unknown>): ToolCallResult => ({
  content: [{ type: 'text', text }],
  isError: true,
  ...(structuredContent ? { structuredContent } : undefined),
});

const companyHasRecordTarget = (company: Record<string, unknown>): boolean =>
  Boolean(
    readString(company['record_id'] ?? company['recordId']) ||
      readString(company['record_url'] ?? company['recordUrl']),
  );

const companyHasImageSource = (company: Record<string, unknown>): boolean =>
  Boolean(
    readString(company['image_url'] ?? company['imageUrl']) ||
      readString(company['image_file_url'] ?? company['imageFileUrl']) ||
      readString(company['image_base64'] ?? company['imageBase64']) ||
      readString(company['image_path'] ?? company['imagePath']),
  );

const validateHubSpotRecordURL = (value: string): string | undefined => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'app.hubspot.com') {
      return 'HubSpot browser workflows only allow https://app.hubspot.com record URLs.';
    }
    if (!url.pathname.includes('/record/0-2/')) {
      return 'HubSpot company avatar workflow expects company record URLs containing /record/0-2/.';
    }
  } catch {
    return `Invalid HubSpot record URL: ${value}`;
  }
  return undefined;
};

const validateCompanyAvatarInput = ({
  dryRun,
  input,
}: {
  dryRun: boolean;
  input: BrowserUseCompanyAvatarInput;
}): ToolCallResult | undefined => {
  if (!readString(input.portal_id)) {
    return errorResult('"input.portal_id" is required for demo.hubspot.company_avatar.');
  }
  const companies = Array.isArray(input.companies) ? input.companies : undefined;
  if (!companies || companies.length === 0) {
    return errorResult(
      '"input.companies" must include at least one HubSpot company for demo.hubspot.company_avatar.',
    );
  }
  if (companies.length > 100) {
    return errorResult('demo.hubspot.company_avatar supports at most 100 companies per run.');
  }
  for (const [index, rawCompany] of companies.entries()) {
    const company = readPlainObject(rawCompany);
    if (!company) {
      return errorResult(`input.companies[${index}] must be an object.`);
    }
    if (!companyHasRecordTarget(company)) {
      return errorResult(`input.companies[${index}] must include record_id or record_url.`);
    }
    const recordURL = readString(company['record_url'] ?? company['recordUrl']);
    if (recordURL) {
      const urlError = validateHubSpotRecordURL(recordURL);
      if (urlError) {
        return errorResult(`input.companies[${index}]: ${urlError}`);
      }
    }
    if (!dryRun && !companyHasImageSource(company)) {
      return errorResult(
        `input.companies[${index}] must include image_url, image_file_url, image_base64, or image_path when dry_run=false.`,
      );
    }
  }
  return undefined;
};

const buildPlan = ({
  driver,
  input,
  workflow,
}: {
  driver: BrowserUseDriver;
  input: Record<string, unknown>;
  workflow: BrowserUseWorkflow;
}): Record<string, unknown> => {
  if (workflow === 'demo.hubspot.company_avatar') {
    const companyCount = Array.isArray(input['companies']) ? input['companies'].length : 0;
    return {
      route: ['browser_use', 'demo', 'hubspot', 'avatar'],
      driver,
      provider: 'hubspot',
      domain_allowlist: ['https://app.hubspot.com'],
      side_effects: ['file_upload', 'third_party_ui_mutation'],
      company_count: companyCount,
      dry_run_checks: [
        'worker configuration',
        'HubSpot profile/login availability',
        'record URL/domain allowlist',
        'image source availability',
      ],
    };
  }
  return {
    route: ['browser_use', workflow],
    driver,
  };
};

const buildSummary = ({
  dryRun,
  status,
  workflow,
  workerConfigured,
}: {
  dryRun: boolean;
  status: string;
  workflow: BrowserUseWorkflow;
  workerConfigured: boolean;
}): string => {
  if (!workerConfigured) {
    return `Prepared ${workflow} browser workflow plan, but no browser worker is configured.`;
  }
  if (dryRun) {
    return `Validated ${workflow} browser workflow with status ${status}.`;
  }
  return `Ran ${workflow} browser workflow with status ${status}.`;
};

const parseWorkerResponse = async (response: Response): Promise<Record<string, unknown>> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const parsed = await response.json();
    return readPlainObject(parsed) ?? { result: parsed };
  }
  return {
    text: await response.text(),
  };
};

const callBrowserWorker = async ({
  payload,
  timeoutMs,
  url,
}: {
  payload: BrowserUseWorkerPayload;
  timeoutMs: number;
  url: string;
}): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const token = browserWorkerToken();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sanka-Browser-Use-Workflow': payload.workflow,
        ...(payload.context.mcp_session_id ?
          { 'X-Sanka-MCP-Session-ID': payload.context.mcp_session_id }
        : undefined),
        ...(token ? { Authorization: `Bearer ${token}` } : undefined),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return {
      ok: response.ok,
      status: response.status,
      body: await parseWorkerResponse(response),
    };
  } finally {
    clearTimeout(timeout);
  }
};

export const browserUseTool: McpTool = {
  metadata: {
    resource: 'browser_use',
    operation: 'write',
    tags: ['browser-use', 'automation', 'demo'],
    httpMethod: 'post',
    httpPath: 'browser-use-worker',
    operationId: 'browser_use.run',
  },
  tool: {
    name: 'browser_use',
    title: 'Run registered browser workflow',
    description:
      'Run a governed Sanka browser automation workflow through a configured worker. Use this for API gaps such as HubSpot demo company avatars; workflows are allowlisted and dry_run=true is the default.',
    inputSchema: BROWSER_USE_INPUT_SCHEMA,
    outputSchema: BROWSER_USE_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Run registered browser workflow',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  handler: async ({ reqContext, args }): Promise<ToolCallResult> => {
    const authError = requireAuthentication({
      reqContext,
      toolTitle: 'Run registered browser workflow',
    });
    if (authError) {
      return authError;
    }

    const workflowValue = readString(args?.['workflow']);
    if (!workflowValue || !isSupportedWorkflow(workflowValue)) {
      return errorResult(
        `Unsupported browser workflow. Supported workflows: ${SUPPORTED_BROWSER_USE_WORKFLOWS.join(', ')}.`,
      );
    }

    const driverValue = readString(args?.['driver']) ?? 'agent_browser';
    if (!isSupportedDriver(driverValue)) {
      return errorResult(
        `Unsupported browser driver. Supported drivers: ${SUPPORTED_BROWSER_USE_DRIVERS.join(', ')}.`,
      );
    }

    const input = readPlainObject(args?.['input']);
    if (!input) {
      return errorResult('"input" must be an object.');
    }

    const dryRun = readBoolean(args?.['dry_run'] ?? args?.['dryRun']) ?? true;
    const confirm = readBoolean(args?.['confirm']) ?? false;
    if (!dryRun && !confirm) {
      return errorResult(
        'Set dry_run=false and confirm=true only after reviewing a dry run; browser workflows can mutate third-party UI state.',
      );
    }

    if (workflowValue === 'demo.hubspot.company_avatar') {
      const validationError = validateCompanyAvatarInput({
        dryRun,
        input,
      });
      if (validationError) {
        return validationError;
      }
    }

    const plan = buildPlan({ driver: driverValue, input, workflow: workflowValue });
    const workerURL = browserWorkerURL();
    const warnings: string[] = [];
    if (workflowValue === 'demo.hubspot.company_avatar') {
      warnings.push(
        'HubSpot CRM APIs cannot set the visible company avatar because hs_avatar_filemanager_key is read-only; this workflow uses HubSpot UI automation.',
      );
    }
    if (!workerURL) {
      warnings.push(
        'Set SANKA_BROWSER_USE_WORKER_URL to dispatch this registered workflow to a self-hosted browser worker.',
      );
      if (!dryRun) {
        return errorResult(
          'No browser worker is configured. Set SANKA_BROWSER_USE_WORKER_URL before running with dry_run=false.',
          {
            workflow: workflowValue,
            driver: driverValue,
            dry_run: dryRun,
            confirm,
            status: 'worker_not_configured',
            worker_configured: false,
            worker_run_id: null,
            plan,
            result: null,
            warnings,
            message: 'No browser worker is configured.',
          },
        );
      }
      const structuredContent = {
        workflow: workflowValue,
        driver: driverValue,
        dry_run: dryRun,
        confirm,
        status: 'planned',
        worker_configured: false,
        worker_run_id: null,
        plan,
        result: null,
        warnings,
        message: 'Browser workflow plan prepared; worker dispatch is not configured.',
      };
      return {
        content: [
          {
            type: 'text',
            text: buildSummary({
              dryRun,
              status: 'planned',
              workflow: workflowValue,
              workerConfigured: false,
            }),
          },
        ],
        structuredContent,
      };
    }

    const payload: BrowserUseWorkerPayload = {
      workflow: workflowValue,
      driver: driverValue,
      dry_run: dryRun,
      confirm,
      input,
      context: {
        ...(reqContext.mcpClientInfo?.name ? { client_name: reqContext.mcpClientInfo.name } : undefined),
        ...(reqContext.mcpClientInfo?.version ?
          { client_version: reqContext.mcpClientInfo.version }
        : undefined),
        ...(reqContext.mcpSessionId ? { mcp_session_id: reqContext.mcpSessionId } : undefined),
      },
    };
    const workspaceId = readString(args?.['workspace_id'] ?? args?.['workspaceId']);
    if (workspaceId) {
      payload.workspace_id = workspaceId;
    }
    const referenceId = readString(args?.['reference_id'] ?? args?.['referenceId']);
    if (referenceId) {
      payload.reference_id = referenceId;
    }

    let workerResult: Awaited<ReturnType<typeof callBrowserWorker>>;
    try {
      workerResult = await callBrowserWorker({
        payload,
        timeoutMs: browserWorkerTimeout(args),
        url: workerURL,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return errorResult(`Browser worker request failed: ${message}`, {
        workflow: workflowValue,
        driver: driverValue,
        dry_run: dryRun,
        confirm,
        status: 'worker_request_failed',
        worker_configured: true,
        worker_run_id: null,
        plan,
        result: null,
        warnings,
        message,
      });
    }

    const workerRunId = readString(workerResult.body['worker_run_id'] ?? workerResult.body['run_id']) ?? null;
    const status =
      readString(workerResult.body['status']) ??
      (workerResult.ok ?
        dryRun ? 'validated'
        : 'completed'
      : 'failed');
    const result = readPlainObject(workerResult.body['result']) ?? workerResult.body;
    const workerWarnings =
      Array.isArray(workerResult.body['warnings']) ?
        workerResult.body['warnings'].filter((entry): entry is string => typeof entry === 'string')
      : [];
    const allWarnings = [...warnings, ...workerWarnings];
    const structuredContent = {
      workflow: workflowValue,
      driver: driverValue,
      dry_run: dryRun,
      confirm,
      status,
      worker_configured: true,
      worker_run_id: workerRunId,
      plan,
      result,
      warnings: allWarnings,
      message:
        readString(workerResult.body['message']) ??
        buildSummary({
          dryRun,
          status,
          workflow: workflowValue,
          workerConfigured: true,
        }),
    };

    if (!workerResult.ok) {
      return errorResult(
        `Browser worker returned HTTP ${workerResult.status} for ${workflowValue}: ${structuredContent.message}`,
        structuredContent,
      );
    }

    return {
      content: [
        {
          type: 'text',
          text: buildSummary({
            dryRun,
            status,
            workflow: workflowValue,
            workerConfigured: true,
          }),
        },
      ],
      structuredContent,
    };
  },
};
