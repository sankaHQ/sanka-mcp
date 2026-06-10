import Sanka from 'sanka-sdk';

const pdfBytes = Buffer.from('%PDF-v2-download');

const v2PdfResponse = (filename: string) =>
  new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });

const readBody = async (response: Response): Promise<Buffer> => {
  return Buffer.from(await response.arrayBuffer());
};

describe('public PDF downloads on V2', () => {
  test('maps SDK document download methods to V2 binary PDF responses', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const requestURL = String(url);
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${requestURL}`);
        if (requestURL.includes('/api/v2/orders/')) return v2PdfResponse('order.pdf');
        if (requestURL.includes('/api/v2/estimates/')) return v2PdfResponse('estimate.pdf');
        if (requestURL.includes('/api/v2/invoices/')) return v2PdfResponse('invoice.pdf');
        if (requestURL.includes('/api/v2/payments/')) return v2PdfResponse('payment.pdf');
        if (requestURL.includes('/api/v2/purchase-orders/')) return v2PdfResponse('purchase-order.pdf');
        if (requestURL.includes('/api/v2/revenues/')) return v2PdfResponse('slip.pdf');
        return new Response('not found', { status: 404 });
      },
    });

    const orderResponse = await client.public.orders
      .downloadPDF('order-1', { template_select: 'template-1', language: 'ja' })
      .asResponse();
    expect(orderResponse.headers.get('content-type')).toEqual('application/pdf');
    expect(orderResponse.headers.get('content-disposition')).toEqual('attachment; filename="order.pdf"');
    expect(await readBody(orderResponse)).toEqual(pdfBytes);

    await expect(
      readBody(await client.public.estimates.downloadPDF('estimate-1', { lang: 'en' })),
    ).resolves.toEqual(pdfBytes);
    await expect(readBody(await client.public.invoices.downloadPDF('invoice-1'))).resolves.toEqual(pdfBytes);
    await expect(readBody(await client.public.payments.downloadPDF('payment-1'))).resolves.toEqual(pdfBytes);
    await expect(
      readBody(await client.public.purchaseOrders.downloadPDF('purchase-order-1')),
    ).resolves.toEqual(pdfBytes);
    await expect(readBody(await client.public.slips.downloadPDF('slip-1'))).resolves.toEqual(pdfBytes);

    expect(calls).toEqual([
      'GET http://localhost:5000/api/v2/orders/order-1/pdf?template_id=template-1&language=ja',
      'GET http://localhost:5000/api/v2/estimates/estimate-1/pdf?language=en',
      'GET http://localhost:5000/api/v2/invoices/invoice-1/pdf',
      'GET http://localhost:5000/api/v2/payments/payment-1/pdf',
      'GET http://localhost:5000/api/v2/purchase-orders/purchase-order-1/pdf',
      'GET http://localhost:5000/api/v2/revenues/slip-1/pdf',
    ]);
  });

  test('passes external_id lookup through the V2 PDF route', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        return v2PdfResponse('external-order.pdf');
      },
    });

    const response = await client.public.orders.downloadPDF('order-external', {
      external_id: 'ORDER-EXT',
      template_select: 'template-1',
      lang: 'en',
    });

    expect(response.headers.get('content-type')).toEqual('application/pdf');
    expect(await readBody(response)).toEqual(pdfBytes);
    expect(calls).toEqual([
      'GET http://localhost:5000/api/v2/orders/order-external/pdf?external_id=ORDER-EXT&template_id=template-1&language=en',
    ]);
  });
});
