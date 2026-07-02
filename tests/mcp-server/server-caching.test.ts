import { initMcpServer, selectPreparedTools } from '../../packages/mcp-server/src/server';
import {
  getSharedLocalDocsSearch,
  LocalDocsSearch,
  resetSharedLocalDocsSearchForTests,
} from '../../packages/mcp-server/src/local-docs-search';
import { configureLogger } from '../../packages/mcp-server/src/logger';

describe('request-invariant server construction caching', () => {
  beforeAll(() => {
    configureLogger({ level: 'error', pretty: false });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reuses one LocalDocsSearch build per docs configuration, including concurrent requests', async () => {
    resetSharedLocalDocsSearchForTests();
    const createSpy = jest.spyOn(LocalDocsSearch, 'create');
    try {
      const [first, second] = await Promise.all([getSharedLocalDocsSearch(), getSharedLocalDocsSearch()]);
      expect(second).toBe(first);
      expect(createSpy).toHaveBeenCalledTimes(1);

      const third = await getSharedLocalDocsSearch();
      expect(third).toBe(first);
      expect(createSpy).toHaveBeenCalledTimes(1);
    } finally {
      resetSharedLocalDocsSearchForTests();
    }
  });

  it('retries the LocalDocsSearch build after a failed attempt', async () => {
    resetSharedLocalDocsSearchForTests();
    const createSpy = jest
      .spyOn(LocalDocsSearch, 'create')
      .mockRejectedValueOnce(new Error('index build failed'));
    try {
      await expect(getSharedLocalDocsSearch()).rejects.toThrow('index build failed');

      const recovered = await getSharedLocalDocsSearch();
      expect(recovered).toBeInstanceOf(LocalDocsSearch);
      expect(createSpy).toHaveBeenCalledTimes(2);
    } finally {
      resetSharedLocalDocsSearchForTests();
    }
  });

  it('memoizes prepared tool selection per profile and code-permission options', () => {
    const blockedOrders = { codeBlockedMethods: ['public\\.orders\\.create'] };

    const first = selectPreparedTools(blockedOrders, 'full');
    const second = selectPreparedTools({ codeBlockedMethods: ['public\\.orders\\.create'] }, 'full');
    expect(second).toBe(first);

    const differentPermissions = selectPreparedTools(
      { codeBlockedMethods: ['public\\.companies\\.create'] },
      'full',
    );
    expect(differentPermissions).not.toBe(first);
    expect(differentPermissions.map((tool) => tool.tool.name)).toEqual(first.map((tool) => tool.tool.name));
  });

  it('keeps code-permission overrides effective on the code tool per configuration', async () => {
    const blockingTools = selectPreparedTools({ codeBlockedMethods: ['public\\.orders\\.create'] }, 'full');
    const executeTool = blockingTools.find((tool) => tool.tool.name === 'execute');
    expect(executeTool).toBeDefined();

    const result = await executeTool!.handler({
      reqContext: {} as never,
      args: { code: 'async function run(client) { return client.public.orders.create({}); }' },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('public.orders.create');
  });

  it('shares one hosted tool selection regardless of code-permission overrides', () => {
    const hostedDefault = selectPreparedTools(undefined, 'hosted');
    const hostedWithPermissions = selectPreparedTools(
      { codeAllowHttpGets: true, codeBlockedMethods: ['public\\.orders\\.create'] },
      'hosted',
    );

    // The hosted profile never includes the code tool, so client permission
    // overrides must not fragment (or change) the cached hosted selection.
    expect(hostedWithPermissions).toBe(hostedDefault);
    expect(hostedDefault.some((tool) => tool.tool.name === 'execute')).toBe(false);
    expect(hostedDefault.some((tool) => tool.tool.name === 'search_docs')).toBe(false);
    expect(hostedDefault.some((tool) => tool.tool.name === 'list_companies')).toBe(true);
  });

  it('returns the registered tools from initMcpServer so callers can reuse the selection', async () => {
    const fakeServer = {
      setRequestHandler: jest.fn(),
      sendLoggingMessage: jest.fn().mockResolvedValue(undefined),
    };

    const { tools } = await initMcpServer({
      server: fakeServer as never,
      toolProfile: 'hosted',
    });

    expect(tools).toBe(selectPreparedTools(undefined, 'hosted'));
    expect(fakeServer.setRequestHandler).toHaveBeenCalled();
  });
});
