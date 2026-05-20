import { execFile } from 'node:child_process';
import { BrowserCommandResult, BrowserDriverClient } from './types';

type AgentBrowserClientOptions = {
  bin?: string;
};

const trimOutput = (value: string): string => value.trim();

export class AgentBrowserClient implements BrowserDriverClient {
  private readonly bin: string;

  constructor(options?: AgentBrowserClientOptions) {
    this.bin = options?.bin ?? process.env['AGENT_BROWSER_BIN'] ?? 'agent-browser';
  }

  version(): Promise<string> {
    return this.run(['--version'], 10000).then((result) => trimOutput(result.stdout || result.stderr));
  }

  closeSession(session: string): Promise<BrowserCommandResult> {
    return this.run(['--session', session, 'close'], 15000);
  }

  open(input: {
    session: string;
    profilePath: string;
    url: string;
    headed: boolean;
    timeoutMs: number;
  }): Promise<BrowserCommandResult> {
    return this.run(
      [
        '--session',
        input.session,
        '--profile',
        input.profilePath,
        ...(input.headed ? ['--headed'] : []),
        'open',
        input.url,
      ],
      input.timeoutMs,
    );
  }

  getURL(input: { session: string; profilePath: string; timeoutMs: number }): Promise<BrowserCommandResult> {
    return this.sessionRun(input, ['get', 'url']);
  }

  getTitle(input: {
    session: string;
    profilePath: string;
    timeoutMs: number;
  }): Promise<BrowserCommandResult> {
    return this.sessionRun(input, ['get', 'title']);
  }

  snapshot(input: {
    session: string;
    profilePath: string;
    timeoutMs: number;
  }): Promise<BrowserCommandResult> {
    return this.sessionRun(input, ['snapshot', '-i', '--json']);
  }

  evaluate(input: {
    session: string;
    profilePath: string;
    script: string;
    timeoutMs: number;
  }): Promise<BrowserCommandResult> {
    return this.sessionRun(input, ['eval', input.script]);
  }

  click(input: {
    session: string;
    profilePath: string;
    selector: string;
    timeoutMs: number;
  }): Promise<BrowserCommandResult> {
    return this.sessionRun(input, ['click', input.selector]);
  }

  upload(input: {
    session: string;
    profilePath: string;
    selector: string;
    filePath: string;
    timeoutMs: number;
  }): Promise<BrowserCommandResult> {
    return this.sessionRun(input, ['upload', input.selector, input.filePath]);
  }

  screenshot(input: {
    session: string;
    profilePath: string;
    outputPath: string;
    timeoutMs: number;
  }): Promise<BrowserCommandResult> {
    return this.sessionRun(input, ['screenshot', input.outputPath]);
  }

  private sessionRun(
    input: { session: string; profilePath: string; timeoutMs: number },
    command: string[],
  ): Promise<BrowserCommandResult> {
    return this.run(
      ['--session', input.session, '--profile', input.profilePath, ...command],
      input.timeoutMs,
    );
  }

  private run(args: string[], timeoutMs: number): Promise<BrowserCommandResult> {
    const startedAt = Date.now();
    return new Promise((resolve, reject) => {
      const child = execFile(
        this.bin,
        args,
        {
          timeout: timeoutMs,
          maxBuffer: 1024 * 1024 * 5,
        },
        (error, stdout, stderr) => {
          const result = {
            exitCode:
              typeof (error as NodeJS.ErrnoException | null)?.code === 'number' ?
                Number((error as NodeJS.ErrnoException).code)
              : error ? 1
              : 0,
            stdout: String(stdout ?? ''),
            stderr: String(stderr ?? ''),
            durationMs: Date.now() - startedAt,
          };
          if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
            reject(new Error(`agent-browser executable not found: ${this.bin}`));
            return;
          }
          resolve(result);
        },
      );
      child.stdin?.end();
    });
  }
}
