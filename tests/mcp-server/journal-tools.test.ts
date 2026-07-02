import {
  crmCreateJournalStatementViewTool,
  crmListJournalEntriesTool,
} from '../../packages/mcp-server/src/crm-tools';
import { McpRequestContext } from '../../packages/mcp-server/src/types';

describe('journal tools', () => {
  it('list_journal_entries reads statement rows from the public journals endpoint', async () => {
    const get = jest.fn().mockResolvedValue({
      data: [{ account: 'Sales', account_value: 'sales', amount: 1000 }],
      page: 1,
      count: 1,
      total: 1,
      message: 'OK',
      view_type: 'profit_and_loss',
      columns: ['account', 'amount'],
      column_labels: { account: 'Account', amount: 'Amount' },
    });
    const reqContext = {
      client: { get },
    } as unknown as McpRequestContext;

    const result = await crmListJournalEntriesTool.handler({
      reqContext,
      args: {
        view_id: 'view-1',
        limit: 10,
        language: 'en',
      },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/journals', {
      query: {
        view_id: 'view-1',
        page: 1,
        page_size: 10,
        'Accept-Language': 'en',
      },
    });
    expect(result.structuredContent).toMatchObject({
      view_type: 'profit_and_loss',
      columns: ['account', 'amount'],
      column_labels: { account: 'Account', amount: 'Amount' },
      results: [{ account: 'Sales', account_value: 'sales', amount: 1000 }],
    });
  });

  it('create_journal_statement_view posts view settings and returns preview data', async () => {
    const post = jest.fn().mockResolvedValue({
      data: { view_id: 'view-1', view_type: 'balance_sheet' },
      statement: {
        view_type: 'balance_sheet',
        total: 2,
        data: [{ account: 'Cash', balance: 500 }],
      },
      message: 'OK',
      ctx_id: 'ctx-1',
    });
    const reqContext = {
      client: { post },
    } as unknown as McpRequestContext;

    const result = await crmCreateJournalStatementViewTool.handler({
      reqContext,
      args: {
        name: 'BS確認用',
        view_type: 'balance_sheet',
        date_range: '2026-01-01 - 2026-12-31',
        balance_sheet_display: 'two_column',
        include_preview: true,
        limit: 20,
        language: 'ja',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/journals/views', {
      body: {
        name: 'BS確認用',
        view_type: 'balance_sheet',
        balance_sheet_display: 'two_column',
        date_range: '2026-01-01 - 2026-12-31',
        include_preview: true,
        limit: 20,
      },
      query: {
        'Accept-Language': 'ja',
      },
    });
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: 'Created balance_sheet view view-1 with 2 preview rows.',
    });
    expect(result.structuredContent).toMatchObject({
      data: { view_id: 'view-1', view_type: 'balance_sheet' },
      message: 'OK',
    });
  });

  it('create_journal_statement_view unwraps v2 envelopes', async () => {
    const post = jest.fn().mockResolvedValue({
      success: true,
      data: {
        data: { view_id: 'view-1', view_type: 'profit_and_loss' },
        statement: {
          view_type: 'profit_and_loss',
          total: 1,
          data: [{ account: 'Sales', amount: 1000 }],
        },
        message: 'OK',
      },
      meta: { ctx_id: 'ctx-v2' },
    });
    const reqContext = {
      client: { post },
    } as unknown as McpRequestContext;

    const result = await crmCreateJournalStatementViewTool.handler({
      reqContext,
      args: {
        name: 'PL',
        view_type: 'profit_and_loss',
        include_preview: true,
        limit: 10,
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/journals/views', {
      body: {
        name: 'PL',
        view_type: 'profit_and_loss',
        include_preview: true,
        limit: 10,
      },
      query: {},
    });
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: 'Created profit_and_loss view view-1 with 1 preview rows.',
    });
    expect(result.structuredContent).toMatchObject({
      data: { view_id: 'view-1', view_type: 'profit_and_loss' },
      ctx_id: 'ctx-v2',
      message: 'OK',
    });
  });
});
