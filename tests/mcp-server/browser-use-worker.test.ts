import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {
  createBrowserUseWorkerApp,
  runBrowserUseWorkerPayload,
} from '../../packages/mcp-server/src/browser-use-worker/server';
import {
  BrowserCommandResult,
  BrowserDriverClient,
  BrowserUseWorkerConfig,
  BrowserUseWorkerPayload,
} from '../../packages/mcp-server/src/browser-use-worker/types';

const commandResult = (overrides?: Partial<BrowserCommandResult>): BrowserCommandResult => ({
  exitCode: 0,
  stdout: '',
  stderr: '',
  durationMs: 1,
  ...overrides,
});

class FakeBrowserDriver implements BrowserDriverClient {
  currentURL = 'https://app.hubspot.com/contacts/51471618/record/0-2/54986820785';
  openExitCode = 0;
  title = 'HubSpot company';
  evalOutputs: string[] = [
    JSON.stringify({
      fileInputs: [{ selector: 'input[type="file"]', tag: 'input', accept: 'image/*' }],
      avatarCandidates: [],
    }),
    JSON.stringify({
      clicked: true,
      target: { tag: 'button', text: '確認' },
    }),
  ];
  uploads: Array<{ selector: string; filePath: string }> = [];
  openedURLs: string[] = [];
  closedSessions: string[] = [];

  async version(): Promise<string> {
    return 'agent-browser 0.9.1';
  }

  async closeSession(session: string): Promise<BrowserCommandResult> {
    this.closedSessions.push(session);
    return commandResult();
  }

  async open(input: {
    session: string;
    profilePath: string;
    url: string;
    headed: boolean;
    timeoutMs: number;
  }): Promise<BrowserCommandResult> {
    this.openedURLs.push(input.url);
    return commandResult({
      exitCode: this.openExitCode,
      stderr: this.openExitCode === 0 ? '' : 'open timed out',
    });
  }

  async getURL(): Promise<BrowserCommandResult> {
    return commandResult({ stdout: this.currentURL });
  }

  async getTitle(): Promise<BrowserCommandResult> {
    return commandResult({ stdout: this.title });
  }

  async snapshot(): Promise<BrowserCommandResult> {
    return commandResult({ stdout: '[]' });
  }

  async evaluate(): Promise<BrowserCommandResult> {
    return commandResult({ stdout: this.evalOutputs.shift() ?? this.evalOutputs[0] ?? '{}' });
  }

  async click(): Promise<BrowserCommandResult> {
    return commandResult();
  }

  async upload(input: {
    session: string;
    profilePath: string;
    selector: string;
    filePath: string;
    timeoutMs: number;
  }): Promise<BrowserCommandResult> {
    this.uploads.push({ selector: input.selector, filePath: input.filePath });
    return commandResult();
  }

  async screenshot(input: {
    session: string;
    profilePath: string;
    outputPath: string;
    timeoutMs: number;
  }): Promise<BrowserCommandResult> {
    await fs.mkdir(path.dirname(input.outputPath), { recursive: true });
    await fs.writeFile(input.outputPath, 'fake screenshot');
    return commandResult();
  }
}

type ListenApp = {
  listen(port: number, callback: () => void): http.Server;
};

const tempRoots: string[] = [];

const testConfig = async (overrides?: Partial<BrowserUseWorkerConfig>): Promise<BrowserUseWorkerConfig> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sanka-browser-use-worker-'));
  tempRoots.push(root);
  return {
    artifactDir: path.join(root, 'artifacts'),
    headed: false,
    profileRoot: path.join(root, 'profiles'),
    requestTimeoutMs: 30000,
    ...overrides,
  };
};

const hubSpotAvatarPayload = (overrides?: Partial<BrowserUseWorkerPayload>): BrowserUseWorkerPayload => ({
  workflow: 'demo.hubspot.company_avatar',
  driver: 'agent_browser',
  dry_run: true,
  confirm: false,
  input: {
    portal_id: '51471618',
    browser_profile_id: 'hubspot-demo',
    companies: [
      {
        record_id: '54986820785',
        record_url: 'https://app.hubspot.com/contacts/51471618/record/0-2/54986820785',
        name: '天神ネイルワークス',
        image_base64: Buffer.from('fake png').toString('base64'),
        image_mime_type: 'image/png',
      },
    ],
  },
  ...overrides,
});

const listen = async (app: ListenApp): Promise<{ baseUrl: string; server: http.Server }> => {
  const server = await new Promise<http.Server>((resolve) => {
    const startedServer = app.listen(0, () => resolve(startedServer));
  });
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
  };
};

const closeServer = async (server: http.Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('browser_use worker', () => {
  it('serves health metadata for the registered browser workflow', async () => {
    const config = await testConfig();
    const { baseUrl, server } = await listen(
      createBrowserUseWorkerApp({ config, driver: new FakeBrowserDriver() }),
    );

    try {
      const response = await fetch(`${baseUrl}/health`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        ok: true,
        service: 'sanka-browser-use-worker',
        auth_required: false,
        workflows: ['demo.hubspot.company_avatar'],
        drivers: ['agent_browser'],
        headed: false,
      });
    } finally {
      await closeServer(server);
    }
  });

  it('requires the configured bearer token for run requests', async () => {
    const config = await testConfig({ workerToken: 'worker-secret' });
    const { baseUrl, server } = await listen(
      createBrowserUseWorkerApp({ config, driver: new FakeBrowserDriver() }),
    );

    try {
      const response = await fetch(`${baseUrl}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hubSpotAvatarPayload()),
      });
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        error: 'unauthorized',
      });
    } finally {
      await closeServer(server);
    }
  });

  it('accepts authorized run requests over HTTP', async () => {
    const config = await testConfig({ workerToken: 'worker-secret' });
    const driver = new FakeBrowserDriver();
    const { baseUrl, server } = await listen(createBrowserUseWorkerApp({ config, driver }));

    try {
      const response = await fetch(`${baseUrl}/run`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer worker-secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(hubSpotAvatarPayload()),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        status: 'validated',
        workflow: 'demo.hubspot.company_avatar',
        driver: 'agent_browser',
        dry_run: true,
        confirm: false,
      });
      expect(driver.openedURLs).toEqual(['https://app.hubspot.com/contacts/51471618/record/0-2/54986820785']);
    } finally {
      await closeServer(server);
    }
  });

  it('validates HubSpot avatar targets during dry runs without uploading', async () => {
    const config = await testConfig();
    const driver = new FakeBrowserDriver();
    const response = await runBrowserUseWorkerPayload({
      config,
      driver,
      payload: hubSpotAvatarPayload(),
      runId: 'run-dry',
    });

    expect(response.status).toBe('validated');
    expect(response.result).toMatchObject({
      portal_id: '51471618',
      browser_profile_id: 'hubspot-demo',
      agent_browser_version: 'agent-browser 0.9.1',
      company_count: 1,
      updated_count: 0,
      failed_count: 0,
    });
    expect((response.result['records'] as Array<Record<string, unknown>>)[0]).toMatchObject({
      status: 'validated',
      record_id: '54986820785',
      name: '天神ネイルワークス',
    });
    expect(driver.uploads).toEqual([]);
    expect(driver.closedSessions).toEqual(['hubspot-avatar-run-dry']);
  });

  it('uploads the image source when a confirmed mutation run finds a file input', async () => {
    const config = await testConfig();
    const driver = new FakeBrowserDriver();
    const response = await runBrowserUseWorkerPayload({
      config,
      driver,
      payload: hubSpotAvatarPayload({ dry_run: false, confirm: true }),
      runId: 'run-confirmed',
    });

    expect(response.status).toBe('completed');
    expect(response.result).toMatchObject({
      updated_count: 1,
      failed_count: 0,
    });
    expect(driver.uploads).toHaveLength(1);
    expect(driver.uploads[0]).toMatchObject({
      selector: 'input[type="file"]',
    });
    await expect(fs.access(driver.uploads[0]?.filePath ?? '')).resolves.toBeUndefined();
  });

  it('clicks the HubSpot upload menu item when the avatar dropdown opens before the file input', async () => {
    const config = await testConfig();
    const driver = new FakeBrowserDriver();
    driver.evalOutputs = [
      JSON.stringify({
        fileInputs: [],
        avatarCandidates: [{ selector: '[data-test-id="avatar-upload-dropdown"]', tag: 'button' }],
      }),
      JSON.stringify({
        clicked: true,
        target: { tag: 'button', text: '' },
      }),
      JSON.stringify({
        fileInputs: [],
        avatarCandidates: [{ tag: 'button', text: '画像をアップロード' }],
      }),
      JSON.stringify({
        clicked: true,
        target: { tag: 'button', text: '画像をアップロード' },
      }),
      JSON.stringify({
        fileInputs: [{ selector: '[data-test-id="uiFileInput-input"]', tag: 'input', accept: 'image/*' }],
        avatarCandidates: [],
      }),
      JSON.stringify({
        clicked: true,
        target: { tag: 'button', text: '確認' },
      }),
    ];

    const response = await runBrowserUseWorkerPayload({
      config,
      driver,
      payload: hubSpotAvatarPayload({ dry_run: false, confirm: true }),
      runId: 'run-menu-fallback',
    });

    expect(response.status).toBe('completed');
    expect(driver.uploads).toHaveLength(1);
    expect(driver.uploads[0]).toMatchObject({
      selector: '[data-test-id="uiFileInput-input"]',
    });
  });

  it('returns login_required without attempting uploads when the HubSpot profile is not authenticated', async () => {
    const config = await testConfig();
    const driver = new FakeBrowserDriver();
    driver.currentURL = 'https://app.hubspot.com/login';

    const response = await runBrowserUseWorkerPayload({
      config,
      driver,
      payload: hubSpotAvatarPayload({ dry_run: false, confirm: true }),
      runId: 'run-login',
    });

    expect(response.status).toBe('login_required');
    expect((response.result['records'] as Array<Record<string, unknown>>)[0]).toMatchObject({
      status: 'login_required',
    });
    expect(driver.uploads).toEqual([]);
  });

  it('does not continue after an open failure if the browser stayed on a different HubSpot company', async () => {
    const config = await testConfig();
    const driver = new FakeBrowserDriver();
    driver.openExitCode = 1;
    driver.currentURL = 'https://app.hubspot.com/contacts/51471618/record/0-2/previous-company';

    const response = await runBrowserUseWorkerPayload({
      config,
      driver,
      payload: hubSpotAvatarPayload({ dry_run: false, confirm: true }),
      runId: 'run-wrong-record',
    });

    expect(response.status).toBe('failed');
    expect((response.result['records'] as Array<Record<string, unknown>>)[0]).toMatchObject({
      status: 'open_failed',
      current_url: 'https://app.hubspot.com/contacts/51471618/record/0-2/previous-company',
    });
    expect(driver.uploads).toEqual([]);
  });

  it('rejects unsupported drivers before invoking the workflow', async () => {
    const config = await testConfig();
    const response = await runBrowserUseWorkerPayload({
      config,
      driver: new FakeBrowserDriver(),
      payload: hubSpotAvatarPayload({ driver: 'playwright' }),
      runId: 'run-driver',
    });

    expect(response.status).toBe('unsupported_driver');
    expect(response.result).toEqual({ supported_drivers: ['agent_browser'] });
  });
});
