import { parseCLIOptions } from '../../packages/mcp-server/src/options';

// Mock process.argv
const mockArgv = (args: string[]) => {
  const originalArgv = process.argv;
  process.argv = ['node', 'test.js', ...args];
  return () => {
    process.argv = originalArgv;
  };
};

const mockEnv = (key: string, value: string | undefined) => {
  const originalValue = process.env[key];

  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }

  return () => {
    if (originalValue === undefined) {
      delete process.env[key];
      return;
    }

    process.env[key] = originalValue;
  };
};

describe('parseCLIOptions', () => {
  it('default parsing should be stdio', () => {
    const cleanup = mockArgv([]);

    const result = parseCLIOptions();

    expect(result.transport).toBe('stdio');

    cleanup();
  });

  it('using http transport with a port', () => {
    const cleanup = mockArgv(['--transport=http', '--port=2222']);

    const result = parseCLIOptions();

    expect(result.transport).toBe('http');
    expect(result.port).toBe(2222);
    cleanup();
  });

  it('reads the internal session exchange server from env', () => {
    const cleanupArgv = mockArgv([]);
    const cleanupEnv = mockEnv(
      'MCP_SERVER_INTERNAL_AUTHORIZATION_SERVER_URL',
      'https://api.internal.example.com',
    );

    const result = parseCLIOptions();

    expect(result.internalAuthorizationServerUrl).toBe('https://api.internal.example.com');

    cleanupEnv();
    cleanupArgv();
  });
});
