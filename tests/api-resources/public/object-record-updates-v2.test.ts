import Sanka from 'sanka-sdk';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public object-record updates on V2', () => {
  test('uses V2 PATCH for scalar location updates', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        if (String(init?.method ?? 'GET').toUpperCase() === 'POST') {
          expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
            properties: {
              external_id: 'LOC-EXT',
              warehouse: 'Tokyo',
              usage_status: 'active',
              zone: 'A',
            },
          });
        } else {
          expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
            properties: {
              warehouse: 'Tokyo',
              usage_status: 'active',
            },
          });
        }
        return envelope({
          id: 'location-1',
          record_id: '5001',
          object_type: 'warehouse',
          properties: { warehouse: 'Tokyo', usage_status: 'active' },
        });
      },
    });

    await expect(
      client.public.locations.create({
        externalId: 'LOC-EXT',
        warehouse: 'Tokyo',
        usageStatus: 'active',
        zone: 'A',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'created',
      location_id: 'location-1',
      external_id: 'LOC-EXT',
      ctx_id: 'ctx-test',
    });
    await expect(
      client.public.locations.update('location-1', {
        externalId: 'LOC-EXT',
        warehouse: 'Tokyo',
        usageStatus: 'active',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'updated',
      location_id: 'location-1',
      external_id: 'LOC-EXT',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual([
      'POST http://localhost:5000/api/v2/locations',
      'PATCH http://localhost:5000/api/v2/locations/location-1?external_id=LOC-EXT',
    ]);
  });

  test('uses V2 create and update routes for meter relation mutations', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const method = String(init?.method ?? 'GET').toUpperCase();
        calls.push(`${method} ${String(url)}`);
        if (method === 'POST') {
          expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
            properties: {
              company_external_id: 'COMPANY-EXT',
              company_id: 'company-1',
              contact_external_id: 'CONTACT-EXT',
              external_id: 'METER-EXT',
              item_external_id: 'ITEM-EXT',
              item_id: 'item-1',
              subscription_external_id: 'SUBSCRIPTION-EXT',
              usage: 42,
              usage_at: '2026-05-20T01:00:00Z',
              usage_status: 'active',
            },
          });
        } else {
          expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
            properties: {
              company_external_id: 'COMPANY-EXT',
              company_id: 'company-1',
              contact_external_id: 'CONTACT-EXT',
              external_id: 'METER-EXT',
              item_external_id: 'ITEM-EXT',
              item_id: 'item-1',
              subscription_external_id: 'SUBSCRIPTION-EXT',
              usage: 43,
              usage_at: '2026-05-21T01:00:00Z',
              usage_status: 'active',
            },
          });
        }
        return envelope({
          id: 'meter-1',
          record_id: '6001',
          object_type: 'meter',
          properties: { usage: 42, usage_status: 'active' },
        });
      },
    });

    await expect(
      client.public.meters.create({
        companyExternalId: 'COMPANY-EXT',
        companyId: 'company-1',
        contactExternalId: 'CONTACT-EXT',
        externalId: 'METER-EXT',
        itemExternalId: 'ITEM-EXT',
        itemId: 'item-1',
        subscriptionExternalId: 'SUBSCRIPTION-EXT',
        usage: 42,
        usageAt: '2026-05-20T01:00:00Z',
        usageStatus: 'active',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'created',
      meter_id: 'meter-1',
      external_id: 'METER-EXT',
      ctx_id: 'ctx-test',
    });
    await expect(
      client.public.meters.update('meter-1', {
        externalId: 'METER-EXT',
        companyExternalId: 'COMPANY-EXT',
        companyId: 'company-1',
        contactExternalId: 'CONTACT-EXT',
        itemExternalId: 'ITEM-EXT',
        itemId: 'item-1',
        subscriptionExternalId: 'SUBSCRIPTION-EXT',
        usage: 43,
        usageAt: '2026-05-21T01:00:00Z',
        usageStatus: 'active',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'updated',
      meter_id: 'meter-1',
      external_id: 'METER-EXT',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual([
      'POST http://localhost:5000/api/v2/meters',
      'PATCH http://localhost:5000/api/v2/meters/meter-1?external_id=METER-EXT',
    ]);
  });

  test('uses V2 PATCH for scalar payment updates', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
          properties: {
            company_id: 'company-1',
            currency: 'JPY',
            entry_type: 'bank_transfer',
            start_date: '2026-05-20',
            status: 'paid',
            total_price: 1200,
            total_price_without_tax: 1091,
          },
        });
        return envelope({
          id: 'payment-1',
          record_id: '3001',
          object_type: 'payment',
          properties: { status: 'paid', total_price: 1200 },
        });
      },
    });

    await expect(
      client.public.payments.update('payment-1', {
        companyId: 'company-1',
        currency: 'JPY',
        entryType: 'bank_transfer',
        external_id: 'PAY-EXT',
        startDate: '2026-05-20',
        status: 'paid',
        totalPrice: 1200,
        totalPriceWithoutTax: 1091,
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'updated',
      payment_id: 'payment-1',
      external_id: 'PAY-EXT',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual(['PATCH http://localhost:5000/api/v2/payments/payment-1?external_id=PAY-EXT']);
  });

  test('uses V2 PATCH for scalar disbursement updates', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
          properties: {
            company_id: 'company-1',
            currency: 'JPY',
            fee: 120,
            start_date: '2026-05-20',
            status: 'paid',
            tax_rate: 10,
            total_price: 1200,
            total_price_without_tax: 1091,
          },
        });
        return envelope({
          id: 'disbursement-1',
          record_id: '7001',
          object_type: 'disbursement',
          properties: { status: 'paid', total_price: 1200 },
        });
      },
    });

    await expect(
      client.public.disbursements.update('disbursement-1', {
        company_id: 'company-1',
        currency: 'JPY',
        external_id: 'DSB-EXT',
        fee: 120,
        start_date: '2026-05-20',
        status: 'paid',
        tax_rate: 10,
        total_price: 1200,
        total_price_without_tax: 1091,
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'updated',
      disbursement_id: 'disbursement-1',
      external_id: 'DSB-EXT',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual([
      'PATCH http://localhost:5000/api/v2/disbursements/disbursement-1?external_id=DSB-EXT',
    ]);
  });

  test('uses V2 PATCH for scalar expense updates', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
          properties: {
            amount: 1500,
            company_id: 'company-1',
            currency: 'JPY',
            description: 'travel',
            due_date: '2026-05-30',
            status: 'approved',
          },
        });
        return envelope({
          id: 'expense-1',
          record_id: '9001',
          object_type: 'expense',
          properties: { status: 'approved', amount: 1500 },
        });
      },
    });

    await expect(
      client.public.expenses.update('expense-1', {
        amount: 1500,
        company_id: 'company-1',
        currency: 'JPY',
        description: 'travel',
        due_date: '2026-05-30',
        external_id: 'EXP-EXT',
        status: 'approved',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'updated',
      expense_id: 'expense-1',
      external_id: 'EXP-EXT',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual(['PATCH http://localhost:5000/api/v2/expenses/expense-1?external_id=EXP-EXT']);
  });

  test('preserves uploaded expense attachments in V2 PATCH properties', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
          properties: {
            attachment_file: { files: [{ file_id: 'file-1' }] },
            company_external_id: 'vendor-ext-1',
            status: 'submitted',
          },
        });
        return envelope({
          id: 'expense-1',
          record_id: '9001',
          object_type: 'expense',
          properties: { status: 'submitted' },
        });
      },
    });

    await expect(
      client.public.expenses.update('expense-1', {
        attachment_file: { files: [{ file_id: 'file-1' }] },
        company_external_id: 'vendor-ext-1',
        external_id: 'EXP-EXT',
        status: 'submitted',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'updated',
      expense_id: 'expense-1',
      external_id: 'EXP-EXT',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual(['PATCH http://localhost:5000/api/v2/expenses/expense-1?external_id=EXP-EXT']);
  });

  test('uses V2 PATCH for scalar bill updates', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
          properties: {
            amount: 2200,
            amount_without_tax: 2000,
            company_id: 'company-1',
            currency: 'JPY',
            due_date: '2026-06-30',
            issued_date: '2026-05-30',
            notes: 'pay by transfer',
            status: 'confirmed',
            tax_rate: 10,
          },
        });
        return envelope({
          id: 'bill-1',
          record_id: '9101',
          object_type: 'bill',
          properties: { status: 'confirmed', amount: 2200 },
        });
      },
    });

    await expect(
      client.public.bills.update('bill-1', {
        amount: 2200,
        amount_without_tax: 2000,
        company_id: 'company-1',
        currency: 'JPY',
        due_date: '2026-06-30',
        external_id: 'BILL-EXT',
        issued_date: '2026-05-30',
        notes: 'pay by transfer',
        status: 'confirmed',
        tax_rate: 10,
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'updated',
      bill_id: 'bill-1',
      external_id: 'BILL-EXT',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual(['PATCH http://localhost:5000/api/v2/bills/bill-1?external_id=BILL-EXT']);
  });

  test('uses V2 PATCH for scalar estimate updates', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
          properties: {
            company_id: 'company-1',
            currency: 'JPY',
            due_date: '2026-06-30',
            estimate_date: '2026-05-30',
            notes: 'quote terms',
            status: 'sent',
            tax_inclusive: true,
            tax_option: 'unified_tax',
            tax_rate: 10,
            total_price: 3300,
            total_price_without_tax: 3000,
          },
        });
        return envelope({
          id: 'estimate-1',
          record_id: '9201',
          object_type: 'estimate',
          properties: { status: 'sent', total_price: 3300 },
        });
      },
    });

    await expect(
      client.public.estimates.update('estimate-1', {
        company_id: 'company-1',
        currency: 'JPY',
        due_date: '2026-06-30',
        external_id: 'EST-EXT',
        notes: 'quote terms',
        start_date: '2026-05-30',
        status: 'sent',
        tax_inclusive: true,
        tax_option: 'unified_tax',
        tax_rate: 10,
        total_price: 3300,
        total_price_without_tax: 3000,
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'updated',
      estimate_id: 'estimate-1',
      external_id: 'EST-EXT',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual(['PATCH http://localhost:5000/api/v2/estimates/estimate-1?external_id=EST-EXT']);
  });

  test('uses V2 PATCH for scalar invoice updates', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
          properties: {
            company_id: 'company-1',
            currency: 'JPY',
            due_date: '2026-06-30',
            invoice_date: '2026-05-30',
            notes: 'net 30',
            status: 'sent',
            tax_rate: 10,
            total_price: 4400,
            total_price_without_tax: 4000,
          },
        });
        return envelope({
          id: 'invoice-1',
          record_id: '9301',
          object_type: 'invoice',
          properties: { status: 'sent', total_price: 4400 },
        });
      },
    });

    await expect(
      client.public.invoices.update('invoice-1', {
        company_id: 'company-1',
        currency: 'JPY',
        due_date: '2026-06-30',
        external_id: 'INV-EXT',
        notes: 'net 30',
        start_date: '2026-05-30',
        status: 'sent',
        tax_rate: 10,
        total_price: 4400,
        total_price_without_tax: 4000,
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'updated',
      invoice_id: 'invoice-1',
      external_id: 'INV-EXT',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual(['PATCH http://localhost:5000/api/v2/invoices/invoice-1?external_id=INV-EXT']);
  });

  test('uses V2 PATCH for scalar purchase order updates', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
          properties: {
            company_id: 'company-1',
            currency: 'JPY',
            date: '2026-05-30',
            notes: 'restock',
            status: 'sent',
            tax_option: 'unified_tax',
            tax_rate: 10,
            total_price: 5500,
            total_price_without_tax: 5000,
          },
        });
        return envelope({
          id: 'purchase-order-1',
          record_id: '9401',
          object_type: 'purchase_order',
          properties: { status: 'sent', total_price: 5500 },
        });
      },
    });

    await expect(
      client.public.purchaseOrders.update('purchase-order-1', {
        company_id: 'company-1',
        currency: 'JPY',
        date: '2026-05-30',
        external_id: 'PO-EXT',
        notes: 'restock',
        status: 'sent',
        tax_option: 'unified_tax',
        tax_rate: 10,
        total_price: 5500,
        total_price_without_tax: 5000,
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'updated',
      purchase_order_id: 'purchase-order-1',
      external_id: 'PO-EXT',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual([
      'PATCH http://localhost:5000/api/v2/purchase-orders/purchase-order-1?external_id=PO-EXT',
    ]);
  });

  test('uses V2 PATCH for status-only subscription updates', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
          properties: {
            status: 'active',
          },
        });
        return envelope({
          id: 'subscription-1',
          record_id: '9501',
          object_type: 'subscription',
          properties: {
            contact_info: [],
            created_at: '2026-05-30T00:00:00Z',
            items: [],
            number_item: 0,
            status: 'active',
          },
        });
      },
    });

    await expect(
      client.public.subscriptions.update('subscription-1', {
        external_id: 'SUB-EXT',
        status: 'active',
      }),
    ).resolves.toEqual({
      id: 'subscription-1',
      contact_info: [],
      created_at: '2026-05-30T00:00:00Z',
      items: [],
      number_item: 0,
      status: 'active',
    });

    expect(calls).toEqual([
      'PATCH http://localhost:5000/api/v2/subscriptions/subscription-1?external_id=SUB-EXT',
    ]);
  });

  test('preserves subscription line items and discount fields in V2 create and update properties', async () => {
    const calls: string[] = [];
    const bodies: Array<unknown> = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        bodies.push(init?.body ? JSON.parse(String(init.body)) : undefined);
        return envelope({
          id: 'subscription-1',
          record_id: '9501',
          object_type: 'subscription',
          properties: {
            contact_info: [],
            created_at: '2026-05-30T00:00:00Z',
            discount: 10,
            discount_id: 'discount-1',
            discount_option: '%',
            discount_tax_option: 'pre_tax',
            items: [],
            number_item: 0,
            status: 'active',
          },
        });
      },
    });

    await client.public.subscriptions.create({
      company_id: 'company-1',
      items: [
        { item_id: 'item-1', quantity: 1, price: 500, currency: 'USD' },
        { item_id: 'item-2', quantity: 2, unit_price: 125, tax_rate: 0 },
      ],
      subscription_status: 'active',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      discount_value: 10,
      discount_number_format: '%',
      discount_tax_option: 'pre_tax',
      discount_mode: 'free_writing_discounts',
    });
    await client.public.subscriptions.update('subscription-1', {
      external_id: 'SUB-EXT',
      line_items: [{ item_name: 'Replacement plan', quantity: 1, unit_price: 800 }],
      discount_value: 10,
      discount_number_format: '%',
      discount_tax_option: 'pre_tax',
      discount_mode: 'free_writing_discounts',
    });

    expect(calls).toEqual([
      'POST http://localhost:5000/api/v2/subscriptions',
      'PATCH http://localhost:5000/api/v2/subscriptions/subscription-1?external_id=SUB-EXT',
    ]);
    expect(bodies).toEqual([
      {
        properties: {
          status: 'active',
          company_id: 'company-1',
          item_id: 'item-1',
          number_item: 1,
          start_date: '2026-05-01',
          end_date: '2026-05-31',
          line_items: [
            {
              item_id: 'item-1',
              quantity: 1,
              unit_price: 500,
              currency: 'USD',
            },
            {
              item_id: 'item-2',
              quantity: 2,
              unit_price: 125,
              tax_rate: 0,
            },
          ],
          discount_value: 10,
          discount_number_format: '%',
          discount_tax_option: 'pre_tax',
          discount_mode: 'free_writing_discounts',
        },
      },
      {
        properties: {
          number_item: 1,
          line_items: [
            {
              custom_item_name: 'Replacement plan',
              quantity: 1,
              unit_price: 800,
            },
          ],
          discount_value: 10,
          discount_number_format: '%',
          discount_tax_option: 'pre_tax',
          discount_mode: 'free_writing_discounts',
        },
      },
    ]);
  });

  test('uses V2 PATCH for scalar slip updates through revenues', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
          properties: {
            company_id: 'company-1',
            contact_id: 'contact-1',
            currency: 'JPY',
            notes: 'settled',
            revenue_mode: 'receipt',
            start_date: '2026-05-20',
            status: 'paid',
            total_price: 1200,
            total_price_without_tax: 1091,
          },
        });
        return envelope({
          id: 'slip-1',
          record_id: '8001',
          object_type: 'revenue',
          properties: { status: 'paid', total_price: 1200 },
        });
      },
    });

    await expect(
      client.public.slips.update('slip-1', {
        company_id: 'company-1',
        contact_id: 'contact-1',
        currency: 'JPY',
        external_id: 'SLIP-EXT',
        notes: 'settled',
        slip_type: 'receipt',
        start_date: '2026-05-20',
        status: 'paid',
        total_price: 1200,
        total_price_without_tax: 1091,
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'updated',
      slip_id: 'slip-1',
      external_id: 'SLIP-EXT',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual(['PATCH http://localhost:5000/api/v2/revenues/slip-1?external_id=SLIP-EXT']);
  });

  test('uses V2 PATCH when location update needs external-id lookup', async () => {
    const calls: string[] = [];
    const bodies: Array<unknown> = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'any',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        bodies.push(init?.body ? JSON.parse(String(init.body)) : undefined);
        return envelope({
          id: 'location-1',
          record_id: '5001',
          object_type: 'warehouse',
          properties: { warehouse: 'Tokyo' },
        });
      },
    });

    await expect(
      client.public.locations.update('location-1', {
        externalId: 'LOC-EXT',
        warehouse: 'Tokyo',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'updated',
      location_id: 'location-1',
      external_id: 'LOC-EXT',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual(['PATCH http://localhost:5000/api/v2/locations/location-1?external_id=LOC-EXT']);
    expect(bodies).toEqual([{ properties: { warehouse: 'Tokyo' } }]);
  });
});
