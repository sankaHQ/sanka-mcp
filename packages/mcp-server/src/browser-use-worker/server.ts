import crypto from 'node:crypto';
import path from 'node:path';
import express from 'express';
import { runHubSpotAvatarWorkflow } from './hubspot-avatar';
import {
  BrowserDriverClient,
  BrowserUseDriver,
  BrowserUseWorkerConfig,
  BrowserUseWorkerPayload,
  BrowserUseWorkerResponse,
  BrowserUseWorkflow,
} from './types';

type CreateBrowserUseWorkerAppOptions = {
  config?: BrowserUseWorkerConfig;
  driver: BrowserDriverClient;
};

const SUPPORTED_WORKFLOWS: BrowserUseWorkflow[] = ['demo.hubspot.company_avatar'];
const SUPPORTED_DRIVERS: BrowserUseDriver[] = ['agent_browser'];

const DEFAULT_REQUEST_TIMEOUT_MS = 120000;

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const readBooleanEnv = (value: string | undefined): boolean =>
  value === '1' || value?.toLowerCase() === 'true' || value?.toLowerCase() === 'yes';

const readIntegerEnv = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readPlainObject = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
};

const isSupportedWorkflow = (value: string): value is BrowserUseWorkflow =>
  (SUPPORTED_WORKFLOWS as readonly string[]).includes(value);

const isSupportedDriver = (value: string): value is BrowserUseDriver =>
  (SUPPORTED_DRIVERS as readonly string[]).includes(value);

const makeRunId = (): string => `brun_${crypto.randomUUID()}`;

const timingSafeEqualString = (actual: string, expected: string): boolean => {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
};

const bearerToken = (req: express.Request): string | undefined => {
  const header = req.header('authorization');
  if (!header) {
    return undefined;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim();
};

const coercePayload = (value: unknown): BrowserUseWorkerPayload | undefined => {
  const body = readPlainObject(value);
  if (!body) {
    return undefined;
  }
  const workflow = readString(body['workflow']);
  if (!workflow || !isSupportedWorkflow(workflow)) {
    return undefined;
  }
  const payload: BrowserUseWorkerPayload = {
    workflow,
  };
  const driver = readString(body['driver']);
  if (driver) {
    payload.driver = driver as BrowserUseDriver;
  }
  if (typeof body['dry_run'] === 'boolean') {
    payload.dry_run = body['dry_run'];
  }
  if (typeof body['confirm'] === 'boolean') {
    payload.confirm = body['confirm'];
  }
  const workspaceId = readString(body['workspace_id']);
  if (workspaceId) {
    payload.workspace_id = workspaceId;
  }
  const referenceId = readString(body['reference_id']);
  if (referenceId) {
    payload.reference_id = referenceId;
  }
  const input = readPlainObject(body['input']);
  if (input) {
    payload.input = input;
  }
  const context = readPlainObject(body['context']);
  if (context) {
    const clientName = readString(context['client_name']);
    const clientVersion = readString(context['client_version']);
    const mcpSessionId = readString(context['mcp_session_id']);
    payload.context = {
      ...(clientName ? { client_name: clientName } : undefined),
      ...(clientVersion ? { client_version: clientVersion } : undefined),
      ...(mcpSessionId ? { mcp_session_id: mcpSessionId } : undefined),
    };
  }
  return payload;
};

const workerResponse = ({
  confirm,
  driver,
  dryRun,
  message,
  result,
  runId,
  status,
  warnings,
  workflow,
}: {
  confirm: boolean;
  driver: BrowserUseDriver;
  dryRun: boolean;
  message: string;
  result?: Record<string, unknown>;
  runId: string;
  status: string;
  warnings?: string[];
  workflow: BrowserUseWorkflow;
}): BrowserUseWorkerResponse => ({
  status,
  worker_run_id: runId,
  workflow,
  driver,
  dry_run: dryRun,
  confirm,
  result: result ?? {},
  warnings: warnings ?? [],
  message,
});

export const buildBrowserUseWorkerConfig = (env: NodeJS.ProcessEnv = process.env): BrowserUseWorkerConfig => {
  const workerToken = readString(env['SANKA_BROWSER_USE_WORKER_TOKEN']);
  return {
    artifactDir: path.resolve(env['SANKA_BROWSER_USE_ARTIFACT_DIR'] ?? '.browser-use-artifacts'),
    headed: readBooleanEnv(env['SANKA_BROWSER_USE_HEADED']),
    profileRoot: path.resolve(env['SANKA_BROWSER_USE_PROFILE_ROOT'] ?? '.browser-use-profiles'),
    requestTimeoutMs: Math.max(
      10000,
      readIntegerEnv(env['SANKA_BROWSER_USE_REQUEST_TIMEOUT_MS'], DEFAULT_REQUEST_TIMEOUT_MS),
    ),
    ...(workerToken ? { workerToken } : undefined),
  };
};

export const runBrowserUseWorkerPayload = async ({
  config,
  driver,
  payload,
  runId = makeRunId(),
}: {
  config: BrowserUseWorkerConfig;
  driver: BrowserDriverClient;
  payload: BrowserUseWorkerPayload;
  runId?: string;
}): Promise<BrowserUseWorkerResponse> => {
  const workflow = payload.workflow;
  const driverName = payload.driver ?? 'agent_browser';
  const dryRun = payload.dry_run ?? true;
  const confirm = payload.confirm ?? false;

  if (!isSupportedDriver(driverName)) {
    return workerResponse({
      confirm,
      driver: driverName,
      dryRun,
      message: `Unsupported browser_use driver for this worker: ${driverName}.`,
      result: { supported_drivers: SUPPORTED_DRIVERS },
      runId,
      status: 'unsupported_driver',
      warnings: ['This worker currently implements agent_browser only.'],
      workflow,
    });
  }

  if (workflow === 'demo.hubspot.company_avatar') {
    return runHubSpotAvatarWorkflow({
      config,
      driver,
      payload,
      runId,
    });
  }

  return workerResponse({
    confirm,
    driver: driverName,
    dryRun,
    message: `Unsupported browser_use workflow: ${workflow}.`,
    result: { supported_workflows: SUPPORTED_WORKFLOWS },
    runId,
    status: 'unsupported_workflow',
    workflow,
  });
};

const httpStatusForWorkerResponse = (response: BrowserUseWorkerResponse): number => {
  if (response.status === 'unsupported_driver' || response.status === 'unsupported_workflow') {
    return 400;
  }
  return 200;
};

export const createBrowserUseWorkerApp = ({
  config,
  driver,
}: CreateBrowserUseWorkerAppOptions): express.Express => {
  const resolvedConfig = config ?? buildBrowserUseWorkerConfig();
  const app = express();

  app.use(express.json({ limit: '25mb' }));

  app.get('/health', (_req: express.Request, res: express.Response) => {
    res.json({
      ok: true,
      service: 'sanka-browser-use-worker',
      auth_required: Boolean(resolvedConfig.workerToken),
      workflows: SUPPORTED_WORKFLOWS,
      drivers: SUPPORTED_DRIVERS,
      headed: resolvedConfig.headed,
    });
  });

  app.post('/run', async (req: express.Request, res: express.Response) => {
    if (resolvedConfig.workerToken) {
      const token = bearerToken(req);
      if (!token || !timingSafeEqualString(token, resolvedConfig.workerToken)) {
        res.status(401).json({
          error: 'unauthorized',
          message: 'Bearer token is required for this browser_use worker.',
        });
        return;
      }
    }

    const payload = coercePayload(req.body);
    if (!payload) {
      res.status(400).json({
        error: 'invalid_payload',
        message: `Request body must include one supported workflow: ${SUPPORTED_WORKFLOWS.join(', ')}.`,
      });
      return;
    }

    try {
      const response = await runBrowserUseWorkerPayload({
        config: resolvedConfig,
        driver,
        payload,
      });
      res.status(httpStatusForWorkerResponse(response)).json(response);
    } catch (error) {
      const runId = makeRunId();
      res.status(500).json(
        workerResponse({
          confirm: payload.confirm ?? false,
          driver: payload.driver ?? 'agent_browser',
          dryRun: payload.dry_run ?? true,
          message: error instanceof Error ? error.message : String(error),
          runId,
          status: 'worker_exception',
          workflow: payload.workflow,
        }),
      );
    }
  });

  return app;
};
