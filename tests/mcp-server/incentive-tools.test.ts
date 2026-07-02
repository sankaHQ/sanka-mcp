import {
  crmCalculateIncentivesTool,
  crmCreateIncentivePlanTool,
  crmGenerateIncentivePaymentNoticeTool,
  crmListIncentivesTool,
} from '../../packages/mcp-server/src/crm-tools';
import { McpRequestContext } from '../../packages/mcp-server/src/types';

describe('incentive tools', () => {
  it('uses the payload pagination fields for list_incentives totals', async () => {
    const get = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'incentive-1',
          payee_company_name: 'Partner Co',
          incentive_amount: 9000,
        },
      ],
      page: 2,
      total: 31,
    });
    const reqContext = {
      client: { get },
    } as unknown as McpRequestContext;

    const result = await crmListIncentivesTool.handler({
      reqContext,
      args: { period: '2026-01', status: 'approved', page: 2, limit: 1 },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/public/incentives', {
      query: {
        limit: 1,
        page: 2,
        period: '2026-01',
        status: 'approved',
      },
    });
    expect(result.structuredContent).toMatchObject({
      count: 1,
      page: 2,
      total: 31,
      message: 'Returned 1 of 31 incentives.',
      results: [
        {
          id: 'incentive-1',
          payee_company_name: 'Partner Co',
          incentive_amount: 9000,
        },
      ],
    });
  });

  it('creates incentive plans through the public API', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        id: 'plan-1',
        name: 'Partner commission',
      },
      message: 'Created',
    });
    const reqContext = {
      client: { post },
    } as unknown as McpRequestContext;

    const result = await crmCreateIncentivePlanTool.handler({
      reqContext,
      args: {
        name: 'Partner commission',
        base_event: 'invoice_paid',
        source_status: 'paid',
        payee_type: 'company',
        payee_company_id: 'company-1',
        amount_basis: 'tax_exclusive',
        rate_type: 'percentage',
        rate_value: 30,
        effective_from: '2026-01-01',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/incentives/plans', {
      body: {
        name: 'Partner commission',
        base_event: 'invoice_paid',
        source_status: 'paid',
        payee_type: 'company',
        payee_company_id: 'company-1',
        amount_basis: 'tax_exclusive',
        rate_type: 'percentage',
        effective_from: '2026-01-01',
        rate_value: 30,
      },
      query: undefined,
    });
    expect(result.structuredContent).toMatchObject({
      data: {
        id: 'plan-1',
        name: 'Partner commission',
      },
      message: 'Created',
    });
  });

  it('defaults calculate_incentives to dry_run previews', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        summary: {
          candidate_count: 3,
          stored_count: 0,
          dry_run: true,
        },
      },
      message: 'Calculated',
    });
    const reqContext = {
      client: { post },
    } as unknown as McpRequestContext;

    const result = await crmCalculateIncentivesTool.handler({
      reqContext,
      args: { period: '2026-01', plan_id: 'plan-1' },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/incentives/calculate', {
      body: {
        period: '2026-01',
        plan_id: 'plan-1',
        dry_run: true,
      },
      query: undefined,
    });
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Previewed 3 incentive candidates.',
    });
  });

  it('generates a Japanese payment notice from incentive rows', async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            period: '2026-01',
            payee_company_id: 'company-1',
            payee_company_name: '株式会社博報堂マーケティングシステムズ',
            source_label: 'INV-15',
            base_amount: 30000,
            rate_value: 30,
            incentive_amount: 9000,
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          {
            period: '2026-02',
            payee_company_id: 'company-1',
            payee_company_name: '株式会社博報堂マーケティングシステムズ',
            source_label: 'INV-16',
            base_amount: 30000,
            rate_value: 30,
            incentive_amount: 9000,
          },
        ],
      });
    const reqContext = {
      client: { get },
    } as unknown as McpRequestContext;

    const result = await crmGenerateIncentivePaymentNoticeTool.handler({
      reqContext,
      args: {
        period_from: '2026-01',
        period_to: '2026-02',
        status: 'approved',
        payee_company_id: 'company-1',
        request_date: '2026-05-07',
      },
    });

    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenNthCalledWith(1, '/api/v2/public/incentives', {
      query: {
        period: '2026-01',
        limit: 100,
        page: 1,
        status: 'approved',
      },
    });
    expect(result.structuredContent).toMatchObject({
      count: 2,
      total_payout: 18000,
      total_base_amount: 60000,
      periods: ['2026-01', '2026-02'],
    });
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('株式会社博報堂マーケティングシステムズ'),
    });
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining('■振込予定金額（税込）： ￥18,000（30%）'),
    });
  });
});
