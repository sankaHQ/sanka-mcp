import Sanka from 'sanka-sdk';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public payment allocations on V2', () => {
  test('uses V2 list and update routes and unwraps their envelopes', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const requestURL = String(url);
        const method = String(init?.method ?? 'GET').toUpperCase();
        calls.push(`${method} ${requestURL}`);
        if (method === 'PUT') {
          expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
            allocations: [{ invoice_id: 'invoice-1', amount: 100 }],
          });
          return envelope({
            message: 'Allocations updated.',
            allocations: [{ invoice_id: 'invoice-1', amount: 100 }],
          });
        }
        return envelope({ message: 'Allocations returned.', allocations: [] });
      },
    });

    await expect(
      client.public.payments.listAllocations('payment-1', {
        external_id: 'PAY-1',
        'Accept-Language': 'ja',
      }),
    ).resolves.toEqual({ message: 'Allocations returned.', allocations: [] });
    await expect(
      client.public.payments.updateAllocations('payment-1', {
        external_id: 'PAY-1',
        allocations: [{ invoice_id: 'invoice-1', amount: 100 }],
      }),
    ).resolves.toEqual({
      message: 'Allocations updated.',
      allocations: [{ invoice_id: 'invoice-1', amount: 100 }],
    });

    expect(calls).toEqual([
      'GET http://localhost:5000/api/v2/payments/payment-1/allocations?external_id=PAY-1',
      'PUT http://localhost:5000/api/v2/payments/payment-1/allocations?external_id=PAY-1',
    ]);
  });
});
