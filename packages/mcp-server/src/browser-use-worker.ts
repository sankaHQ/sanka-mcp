#!/usr/bin/env node
import { AgentBrowserClient } from './browser-use-worker/agent-browser';
import { buildBrowserUseWorkerConfig, createBrowserUseWorkerApp } from './browser-use-worker/server';
import { configureLogger, getLogger } from './logger';

const readPort = (): number => {
  const value = process.env['PORT'] ?? process.env['SANKA_BROWSER_USE_WORKER_PORT'];
  if (!value) {
    return 8787;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 8787;
};

const port = readPort();
configureLogger({
  level: 'info',
  serviceName: 'sanka-browser-use-worker',
});
const config = buildBrowserUseWorkerConfig();
const app = createBrowserUseWorkerApp({
  config,
  driver: new AgentBrowserClient(),
});
const logger = getLogger();

const server = app.listen(port, () => {
  logger.info(
    {
      event: 'worker.started',
      port,
      auth_required: Boolean(config.workerToken),
      workflows: ['demo.hubspot.company_avatar'],
      driver: 'agent_browser',
    },
    'Sanka browser-use worker started',
  );
});

const shutdown = (signal: NodeJS.Signals): void => {
  server.close((error) => {
    if (error) {
      logger.error({ event: 'worker.stop_failed', error }, 'Failed to stop Sanka browser-use worker');
      process.exit(1);
    }
    logger.info({ event: 'worker.stopped', signal }, 'Sanka browser-use worker stopped');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
