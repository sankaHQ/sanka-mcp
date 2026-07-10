import { selectTools } from '../../packages/mcp-server/src/server';
import {
  createBuyRequestFromFindingTool,
  getWatchtowerSummaryTool,
  listWatchtowerFindingsTool,
  updateWatchtowerFindingTool,
} from '../../packages/mcp-server/src/watchtower-tools';

const oauthContext = (overrides?: { authMode?: 'none' | 'oauth_bearer'; scopes?: string[] }) => ({
  authMode: overrides?.authMode ?? 'oauth_bearer',
  clientOptions: {},
  oauth: {
    authorizationServerUrl: 'https://app.sanka.com',
    resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
    resourceUrl: 'https://mcp.sanka.com/mcp',
    scopes: overrides?.scopes ?? ['mcp:access'],
  },
});

const finding = (overrides: Record<string, unknown> = {}) => ({
  id: 'finding-1',
  workspace_id: 'workspace-1',
  finding_type: 'price_creep',
  dedupe_key: 'price_creep:openai:2026-06',
  status: 'new',
  severity: 'medium',
  title: 'OpenAI spend crept up 32%',
  vendor_name: 'OpenAI',
  period_month: '2026-06',
  buy_request_id: null,
  ...overrides,
});

describe('WatchTower MCP tools', () => {
  it('registers WatchTower tools in the hosted profile', () => {
    const toolNames = selectTools(undefined, 'hosted').map((tool) => tool.tool.name);

    expect(toolNames).toEqual(
      expect.arrayContaining([
        'list_watchtower_findings',
        'update_watchtower_finding',
        'create_buy_request_from_finding',
        'get_watchtower_summary',
      ]),
    );
  });

  it('advertises the V2 WatchTower endpoints in tool metadata', () => {
    expect(listWatchtowerFindingsTool.metadata.httpPath).toBe('/api/v2/watchtower/findings');
    expect(listWatchtowerFindingsTool.metadata.httpMethod).toBe('get');
    expect(updateWatchtowerFindingTool.metadata.httpPath).toBe('/api/v2/watchtower/findings/{finding_id}');
    expect(updateWatchtowerFindingTool.metadata.httpMethod).toBe('patch');
    expect(createBuyRequestFromFindingTool.metadata.httpPath).toBe(
      '/api/v2/watchtower/findings/{finding_id}/buy-request',
    );
    expect(createBuyRequestFromFindingTool.metadata.httpMethod).toBe('post');
    expect(getWatchtowerSummaryTool.metadata.httpPath).toBe('/api/v2/watchtower/summary');
    expect(getWatchtowerSummaryTool.metadata.httpMethod).toBe('get');
  });

  it('lists findings with status and finding_type filters', async () => {
    const get = jest.fn().mockResolvedValue({
      success: true,
      data: {
        findings: [finding(), finding({ id: 'finding-2', finding_type: 'renewal_calendar' })],
        status: 'new',
        finding_type: null,
      },
      meta: { ctx_id: 'ctx-findings' },
    });

    const result = await listWatchtowerFindingsTool.handler({
      reqContext: {
        client: { get } as any,
        auth: oauthContext(),
      },
      args: {
        status: 'new',
      },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/watchtower/findings', {
      query: { status: 'new' },
    });
    expect(result.structuredContent).toMatchObject({
      findings: [expect.objectContaining({ id: 'finding-1' }), expect.objectContaining({ id: 'finding-2' })],
      ctx_id: 'ctx-findings',
    });
    expect(result.content?.[0]).toMatchObject({
      type: 'text',
      text: 'Returned 2 WatchTower findings.',
    });
  });

  it('forwards the finding_type filter', async () => {
    const get = jest.fn().mockResolvedValue({
      success: true,
      data: { findings: [], status: null, finding_type: 'duplicate_vendors' },
      meta: { ctx_id: 'ctx-empty' },
    });

    await listWatchtowerFindingsTool.handler({
      reqContext: {
        client: { get } as any,
        auth: oauthContext(),
      },
      args: {
        finding_type: 'duplicate_vendors',
      },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/watchtower/findings', {
      query: { finding_type: 'duplicate_vendors' },
    });
  });

  it('updates a finding status through PATCH', async () => {
    const patch = jest.fn().mockResolvedValue({
      success: true,
      data: finding({ status: 'confirmed' }),
      meta: { ctx_id: 'ctx-update' },
    });

    const result = await updateWatchtowerFindingTool.handler({
      reqContext: {
        client: { patch } as any,
        auth: oauthContext(),
      },
      args: {
        finding_id: 'finding-1',
        status: 'confirmed',
      },
    });

    expect(patch).toHaveBeenCalledWith('/api/v2/watchtower/findings/finding-1', {
      body: { status: 'confirmed' },
    });
    expect(result.structuredContent).toMatchObject({
      id: 'finding-1',
      status: 'confirmed',
      ctx_id: 'ctx-update',
    });
  });

  it('rejects non-writable finding statuses before calling V2', async () => {
    const patch = jest.fn();

    const resolved = await updateWatchtowerFindingTool.handler({
      reqContext: {
        client: { patch } as any,
        auth: oauthContext(),
      },
      args: {
        finding_id: 'finding-1',
        status: 'resolved',
      },
    });
    const missing = await updateWatchtowerFindingTool.handler({
      reqContext: {
        client: { patch } as any,
        auth: oauthContext(),
      },
      args: {
        finding_id: 'finding-1',
      },
    });

    expect(resolved.isError).toBe(true);
    expect(missing.isError).toBe(true);
    expect(patch).not.toHaveBeenCalled();
  });

  it('creates a Buy request from a finding through the hinge endpoint', async () => {
    const post = jest.fn().mockResolvedValue({
      success: true,
      data: {
        finding: finding({ status: 'confirmed', buy_request_id: 'buy-1' }),
        buy_request_id: 'buy-1',
        created: true,
      },
      meta: { ctx_id: 'ctx-hinge' },
    });

    const result = await createBuyRequestFromFindingTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: { finding_id: 'finding-1' },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/watchtower/findings/finding-1/buy-request', {
      body: {},
    });
    expect(result.structuredContent).toMatchObject({
      buy_request_id: 'buy-1',
      created: true,
      ctx_id: 'ctx-hinge',
    });
    expect(result.content?.[0]).toMatchObject({
      type: 'text',
      text: 'Created Sanka Buy request buy-1 from WatchTower finding.',
    });
  });

  it('reports a reused Buy request link on repeat hinge calls', async () => {
    const post = jest.fn().mockResolvedValue({
      success: true,
      data: {
        finding: finding({ status: 'confirmed', buy_request_id: 'buy-1' }),
        buy_request_id: 'buy-1',
        created: false,
      },
      meta: { ctx_id: 'ctx-hinge-repeat' },
    });

    const result = await createBuyRequestFromFindingTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: { finding_id: 'finding-1' },
    });

    expect(result.structuredContent).toMatchObject({ buy_request_id: 'buy-1', created: false });
    expect(result.content?.[0]).toMatchObject({
      type: 'text',
      text: 'Reused Sanka Buy request buy-1 from WatchTower finding.',
    });
  });

  it('requires finding_id for finding-scoped tools', async () => {
    const post = jest.fn();
    const patch = jest.fn();

    const hinge = await createBuyRequestFromFindingTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
      },
      args: {},
    });
    const update = await updateWatchtowerFindingTool.handler({
      reqContext: {
        client: { patch } as any,
        auth: oauthContext(),
      },
      args: { status: 'confirmed' },
    });

    expect(hinge.isError).toBe(true);
    expect(update.isError).toBe(true);
    expect(post).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it('loads the spend summary with month, months, and currency filters', async () => {
    const get = jest.fn().mockResolvedValue({
      success: true,
      data: {
        month: '2026-06',
        currency: 'USD',
        current_month_total: '1240.55',
        previous_month_total: '980.10',
        month_over_month_delta: '260.45',
        sources: [],
        trend: [],
        categories: [{ category: 'ai', currency: 'USD', total_cost: '900.00', record_count: 12 }],
        top_vendors: [{ vendor: 'OpenAI', currency: 'USD', total_cost: '620.00', record_count: 6 }],
      },
      meta: { ctx_id: 'ctx-summary' },
    });

    const result = await getWatchtowerSummaryTool.handler({
      reqContext: {
        client: { get } as any,
        auth: oauthContext(),
      },
      args: {
        month: '2026-06',
        months: 3,
        currency: 'USD',
      },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/watchtower/summary', {
      query: { month: '2026-06', months: 3, currency: 'USD' },
    });
    expect(result.structuredContent).toMatchObject({
      month: '2026-06',
      categories: [expect.objectContaining({ category: 'ai' })],
      top_vendors: [expect.objectContaining({ vendor: 'OpenAI' })],
      ctx_id: 'ctx-summary',
    });
  });

  it('returns an OAuth challenge before calling protected WatchTower tools without auth', async () => {
    const get = jest.fn();

    const result = await listWatchtowerFindingsTool.handler({
      reqContext: {
        client: { get } as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'hosted',
      },
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toEqual([
      expect.stringContaining('error="invalid_token"'),
    ]);
    expect(get).not.toHaveBeenCalled();
  });
});
