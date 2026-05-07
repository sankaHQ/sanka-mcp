import { crmListExpensesTool } from '../src/crm-tools';
import { McpRequestContext } from '../src/types';

describe('expense tools', () => {
  it('uses the public API total header for list_expenses totals', async () => {
    const withResponse = jest.fn().mockResolvedValue({
      data: [{ id: 'expense-1', description: 'Taxi' }],
      response: new Response('[]', {
        headers: {
          'X-Sanka-Page': '1',
          'X-Sanka-Total': '2288',
        },
      }),
    });
    const get = jest.fn().mockReturnValue({ withResponse });
    const reqContext = {
      client: { get },
    } as unknown as McpRequestContext;

    const result = await crmListExpensesTool.handler({
      reqContext,
      args: { limit: 1 },
    });

    expect(get).toHaveBeenCalledWith('/v1/public/expenses', {
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
      results: [{ id: 'expense-1', description: 'Taxi' }],
    });
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: 'Found 2288 expenses. Examples: Taxi.',
    });
  });
});
