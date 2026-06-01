import { crmListExpensesTool } from '../src/crm-tools';
import { McpRequestContext } from '../src/types';

describe('expense tools', () => {
  it('uses the public API total header for list_expenses totals', async () => {
    const withResponse = jest.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              id: 'expense-1',
              record_id: '1001',
              properties: { description: 'Taxi' },
            },
          ],
          page: 1,
          page_size: 1,
          total: 2288,
        },
        meta: { pagination: { page: 1, page_size: 1, total: 2288 } },
      },
      response: new Response('{}'),
    });
    const v2Get = jest.fn().mockReturnValue({ withResponse });
    const reqContext = {
      client: { v2Get },
    } as unknown as McpRequestContext;

    const result = await crmListExpensesTool.handler({
      reqContext,
      args: { limit: 1 },
    });

    expect(v2Get).toHaveBeenCalledWith('/expenses', {
      query: {
        limit: 1,
        page: 1,
      },
    });
    expect(result.structuredContent).toMatchObject({
      count: 1,
      page: 1,
      total: 2288,
      message: 'Returned 1 of 2288 expenses.',
      results: [{ id: 'expense-1', id_pm: 1001, description: 'Taxi' }],
    });
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: 'Found 2288 expenses. Examples: Taxi.',
    });
  });
});
