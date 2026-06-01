import Sanka, { toFile } from 'sanka-sdk';

const fileUploadData = {
  ok: true,
  file_id: 'file-1',
  id: 'file-1',
  filename: 'proof.pdf',
  url: 'https://files.example.test/uploads/san-file-store/file-1.pdf',
  relative_path: 'san-file-store/file-1.pdf',
};

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public object upload attachment resources on V2', () => {
  test('uses V2 file upload aliases and unwraps V2 envelopes', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        if (String(url).includes('/api/v2/')) {
          calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        }
        return envelope(fileUploadData);
      },
    });
    const file = await toFile(Buffer.from('pdf-bytes'), 'proof.pdf');

    await expect(client.public.orders.uploadAttachment({ file })).resolves.toEqual(fileUploadData);
    await expect(client.public.estimates.uploadAttachment({ file })).resolves.toEqual(fileUploadData);
    await expect(client.public.invoices.uploadAttachment({ file })).resolves.toEqual(fileUploadData);
    await expect(client.public.expenses.uploadAttachment({ file })).resolves.toEqual(fileUploadData);
    await expect(client.public.purchaseOrders.uploadAttachment({ file })).resolves.toEqual(fileUploadData);
    await expect(client.public.bills.uploadAttachment({ file })).resolves.toEqual(fileUploadData);

    expect(calls).toEqual([
      'POST http://localhost:5000/api/v2/orders/files',
      'POST http://localhost:5000/api/v2/estimates/files',
      'POST http://localhost:5000/api/v2/invoices/files',
      'POST http://localhost:5000/api/v2/expenses/files',
      'POST http://localhost:5000/api/v2/purchase-orders/files',
      'POST http://localhost:5000/api/v2/bills/files',
    ]);
  });
});
