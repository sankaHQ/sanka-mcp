#!/usr/bin/env node
import { AgentBrowserClient } from './browser-use-worker/agent-browser';
import { buildBrowserUseWorkerConfig, createBrowserUseWorkerApp } from './browser-use-worker/server';

const readPort = (): number => {
  const value = process.env['PORT'] ?? process.env['SANKA_BROWSER_USE_WORKER_PORT'];
  if (!value) {
    return 8787;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 8787;
};

const port = readPort();
const config = buildBrowserUseWorkerConfig();
const app = createBrowserUseWorkerApp({
  config,
  driver: new AgentBrowserClient(),
});

const server = app.listen(port, () => {
  console.log(
    JSON.stringify({
      message: 'sanka_browser_use_worker_started',
      port,
      auth_required: Boolean(config.workerToken),
      workflows: ['demo.hubspot.company_avatar'],
      driver: 'agent_browser',
    }),
  );
});

const shutdown = (signal: NodeJS.Signals): void => {
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exit(1);
    }
    console.log(JSON.stringify({ message: 'sanka_browser_use_worker_stopped', signal }));
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
