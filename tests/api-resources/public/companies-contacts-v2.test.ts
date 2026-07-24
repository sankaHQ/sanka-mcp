import Sanka from 'sanka-sdk';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public company and contact resources on V2', () => {
  test('uses V2 company read list and delete routes', async () => {
    const calls: string[] = [];
    const companyRecord = {
      id: 'company-1',
      record_id: '111',
      object_type: 'company',
      properties: {
        name: 'Sanka Inc.',
        email: 'hello@example.com',
        created_at: '2026-05-11T00:00:00Z',
        updated_at: '2026-05-12T00:00:00Z',
      },
    };
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const requestURL = String(url);
        const method = String(init?.method ?? 'GET').toUpperCase();
        calls.push(`${method} ${requestURL}`);
        if (method === 'DELETE') {
          return envelope({ id: 'company-1', record_id: '111', status: 'archived' });
        }
        if (requestURL.endsWith('/api/v2/companies?search=Sanka&limit=10')) {
          return envelope({ items: [companyRecord], page: 1, page_size: 10, total: 1 });
        }
        return envelope(companyRecord);
      },
    });

    await expect(
      client.public.companies.retrieve('company-1', { external_id: 'COMPANY-111' }),
    ).resolves.toMatchObject({
      id: 'company-1',
      company_id: 111,
      name: 'Sanka Inc.',
    });
    await expect(client.public.companies.list({ limit: 10, search: 'Sanka' })).resolves.toMatchObject({
      count: 1,
      total: 1,
      data: [expect.objectContaining({ id: 'company-1', company_id: 111, name: 'Sanka Inc.' })],
    });
    await expect(
      client.public.companies.delete('company-1', { external_id: 'COMPANY-111' }),
    ).resolves.toEqual({
      ok: true,
      status: 'deleted',
      company_id: 'company-1',
      external_id: 'COMPANY-111',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual([
      'GET http://localhost:5000/api/v2/companies/company-1?external_id=COMPANY-111',
      'GET http://localhost:5000/api/v2/companies?search=Sanka&limit=10',
      'DELETE http://localhost:5000/api/v2/companies/company-1?external_id=COMPANY-111',
    ]);
  });

  test('treats explicit local company and contact scope as V2 list routing', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const requestURL = String(url);
        const method = String(init?.method ?? 'GET').toUpperCase();
        calls.push(`${method} ${requestURL}`);
        if (requestURL.includes('/api/v2/contacts')) {
          return envelope({
            items: [
              {
                id: 'contact-1',
                record_id: '222',
                object_type: 'contact',
                properties: { name: 'Ada' },
              },
            ],
            page: 1,
            page_size: 5,
            total: 1,
          });
        }
        return envelope({
          items: [
            {
              id: 'company-1',
              record_id: '111',
              object_type: 'company',
              properties: { name: 'Sanka Inc.' },
            },
          ],
          page: 1,
          page_size: 5,
          total: 1,
        });
      },
    });

    await expect(
      client.public.companies.list({ scope: 'sanka', limit: 5, view: 'company-view' }),
    ).resolves.toMatchObject({
      count: 1,
      total: 1,
      data: [expect.objectContaining({ id: 'company-1', company_id: 111 })],
    });
    await expect(
      client.public.contacts.list({ scope: 'sanka', limit: 5, view: 'contact-view' }),
    ).resolves.toMatchObject({
      count: 1,
      total: 1,
      data: [expect.objectContaining({ id: 'contact-1', contact_id: 222 })],
    });

    expect(calls).toEqual([
      'GET http://localhost:5000/api/v2/companies?limit=5&view_id=company-view',
      'GET http://localhost:5000/api/v2/contacts?limit=5&view_id=contact-view',
    ]);
  });

  test('uses V2 contact read list and delete routes', async () => {
    const calls: string[] = [];
    const contactRecord = {
      id: 'contact-1',
      record_id: '222',
      object_type: 'contact',
      properties: {
        name: 'Ada',
        last_name: 'Lovelace',
        full_name: 'Ada Lovelace',
        email: 'ada@example.com',
        created_at: '2026-05-11T00:00:00Z',
        updated_at: '2026-05-12T00:00:00Z',
      },
    };
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const requestURL = String(url);
        const method = String(init?.method ?? 'GET').toUpperCase();
        calls.push(`${method} ${requestURL}`);
        if (method === 'DELETE') {
          return envelope({ id: 'contact-1', record_id: '222', status: 'archived' });
        }
        if (requestURL.endsWith('/api/v2/contacts?search=Ada&limit=10')) {
          return envelope({ items: [contactRecord], page: 1, page_size: 10, total: 1 });
        }
        return envelope(contactRecord);
      },
    });

    await expect(
      client.public.contacts.retrieve('contact-1', { external_id: 'CONTACT-222' }),
    ).resolves.toMatchObject({
      id: 'contact-1',
      contact_id: 222,
      full_name: 'Ada Lovelace',
    });
    await expect(client.public.contacts.list({ limit: 10, search: 'Ada' })).resolves.toMatchObject({
      count: 1,
      total: 1,
      data: [expect.objectContaining({ id: 'contact-1', contact_id: 222, full_name: 'Ada Lovelace' })],
    });
    await expect(client.public.contacts.delete('contact-1', { external_id: 'CONTACT-222' })).resolves.toEqual(
      {
        ok: true,
        status: 'deleted',
        contact_id: 'contact-1',
        external_id: 'CONTACT-222',
        ctx_id: 'ctx-test',
      },
    );

    expect(calls).toEqual([
      'GET http://localhost:5000/api/v2/contacts/contact-1?external_id=CONTACT-222',
      'GET http://localhost:5000/api/v2/contacts?search=Ada&limit=10',
      'DELETE http://localhost:5000/api/v2/contacts/contact-1?external_id=CONTACT-222',
    ]);
  });

  test('rejects retired integration company and contact listing without making a request', () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        return envelope({ items: [], page: 1, page_size: 5, total: 0 });
      },
    });

    expect(() =>
      client.public.companies.list({ scope: 'integration', provider: 'hubspot', limit: 5 }),
    ).toThrow('retired with Public API V1');
    expect(() =>
      client.public.contacts.list({ scope: 'integration', provider: 'hubspot', limit: 5 }),
    ).toThrow('retired with Public API V1');

    expect(calls).toEqual([]);
  });

  test('uses V2 create routes for default local company and contact creates', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const requestURL = String(url);
        const method = String(init?.method ?? 'GET').toUpperCase();
        calls.push(`${method} ${requestURL}`);
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        if (requestURL.endsWith('/api/v2/companies')) {
          expect(body).toEqual({
            properties: {
              name: 'Sanka Inc.',
              email: 'hello@example.com',
            },
          });
          return envelope({
            id: 'company-1',
            record_id: '111',
            object_type: 'company',
            properties: { name: 'Sanka Inc.' },
          });
        }
        expect(body).toEqual({
          properties: {
            name: 'Ada',
            last_name: 'Lovelace',
            email: 'ada@example.com',
          },
        });
        return envelope({
          id: 'contact-1',
          record_id: '222',
          object_type: 'contact',
          properties: { name: 'Ada', last_name: 'Lovelace' },
        });
      },
    });

    await expect(
      client.public.companies.create({
        target: 'sanka',
        name: 'Sanka Inc.',
        email: 'hello@example.com',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'created',
      company_id: 'company-1',
      external_id: null,
      ctx_id: 'ctx-test',
    });
    await expect(
      client.public.contacts.create({
        target: 'sanka',
        name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'created',
      contact_id: 'contact-1',
      external_id: null,
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual([
      'POST http://localhost:5000/api/v2/companies',
      'POST http://localhost:5000/api/v2/contacts',
    ]);
  });

  test('keeps remote mutation controls out of local company properties', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        calls.push(`${String(init?.method ?? 'GET').toUpperCase()} ${String(url)}`);
        expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
          properties: {
            address: '東京都千代田区テスト1-1-1（架空）',
            allowed_in_store: false,
            billing_cycle: 'end',
            custom_fields: {
              do_not_fulfill: true,
              internal_test: true,
              synthetic: true,
            },
            external_id: 'cargo-internal-fake-supplier-20260724-v1',
            name: '【内部テスト】Sanka QA Supplies株式会社',
            payment_cycle: 'nmonth_end',
            status: 'active',
          },
        });
        return envelope({
          id: 'company-1',
          record_id: '111',
          object_type: 'company',
          properties: { name: '【内部テスト】Sanka QA Supplies株式会社' },
        });
      },
    });

    await expect(
      client.public.companies.create({
        target: 'sanka',
        operation: 'upsert',
        external_id: 'cargo-internal-fake-supplier-20260724-v1',
        name: '【内部テスト】Sanka QA Supplies株式会社',
        address: '東京都千代田区テスト1-1-1（架空）',
        status: 'active',
        billing_cycle: 'end',
        payment_cycle: 'nmonth_end',
        allowed_in_store: false,
        custom_fields: {
          synthetic: true,
          internal_test: true,
          do_not_fulfill: true,
        },
      }),
    ).resolves.toMatchObject({
      company_id: 'company-1',
      external_id: 'cargo-internal-fake-supplier-20260724-v1',
      status: 'created',
    });

    expect(calls).toEqual(['POST http://localhost:5000/api/v2/companies']);
  });

  test('uses V2 PATCH for scalar company and contact updates', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const requestURL = String(url);
        const method = String(init?.method ?? 'GET').toUpperCase();
        calls.push(`${method} ${requestURL}`);
        if (requestURL.includes('/api/v2/companies/')) {
          expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
            properties: {
              name: 'Sanka Inc.',
              phone_number: '+1-555-0100',
              url: 'https://sanka.example',
            },
          });
          return envelope({
            id: 'company-1',
            record_id: '111',
            object_type: 'company',
            properties: { name: 'Sanka Inc.' },
          });
        }
        expect(init?.body ? JSON.parse(String(init.body)) : undefined).toEqual({
          properties: {
            company: 'Sanka Inc.',
            email: 'ada@example.com',
            last_name: 'Lovelace',
            name: 'Ada',
          },
        });
        return envelope({
          id: 'contact-1',
          record_id: '222',
          object_type: 'contact',
          properties: { name: 'Ada', last_name: 'Lovelace' },
        });
      },
    });

    await expect(
      client.public.companies.update('company-1', {
        target: 'sanka',
        name: 'Sanka Inc.',
        phone_number: '+1-555-0100',
        url: 'https://sanka.example',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'updated',
      company_id: 'company-1',
      external_id: null,
      ctx_id: 'ctx-test',
    });
    await expect(
      client.public.contacts.update('contact-1', {
        target: 'sanka',
        company: 'Sanka Inc.',
        email: 'ada@example.com',
        last_name: 'Lovelace',
        name: 'Ada',
      }),
    ).resolves.toEqual({
      ok: true,
      status: 'updated',
      contact_id: 'contact-1',
      external_id: null,
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual([
      'PATCH http://localhost:5000/api/v2/companies/company-1',
      'PATCH http://localhost:5000/api/v2/contacts/contact-1',
    ]);
  });

  test('uses V2 company price-table routes and unwraps envelopes', async () => {
    const calls: string[] = [];
    const bodies: Array<unknown> = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const requestURL = String(url);
        const method = String(init?.method ?? 'GET').toUpperCase();
        calls.push(`${method} ${requestURL}`);
        bodies.push(init?.body ? JSON.parse(String(init.body)) : undefined);
        if (method === 'GET') {
          return envelope({
            field_id: 'field-1',
            mode: 'company',
            company_price_precentage: 80,
            company_price_percentage: 80,
            items: [
              {
                item_id: 'item-1',
                item_record_id: 1001,
                item_name: 'Starter',
                currency: 'JPY',
                default_price: 1000,
                discount_price: 800,
                discount_rate: 80,
                has_override: false,
              },
            ],
            pagination: {
              page: 1,
              page_size: 30,
              total_count: 1,
              total_pages: 1,
              has_next: false,
              has_previous: false,
            },
            message: 'OK',
            ctx_id: 'server-ctx',
          });
        }
        return envelope({
          data: {
            field_id: 'field-1',
            item_id: 'item-1',
            price_percentage: 80,
            updated_count: 3,
          },
          message: 'OK',
          ctx_id: 'server-ctx',
        });
      },
    });

    await expect(
      client.public.companies.getPriceTable('company-1', {
        field_ref: 'price',
        q: 'starter',
        page: 1,
        page_size: 30,
      }),
    ).resolves.toMatchObject({
      field_id: 'field-1',
      items: [expect.objectContaining({ item_id: 'item-1', discount_price: 800 })],
    });
    await expect(
      client.public.companies.updatePriceTableCompany('company-1', {
        field_ref: 'price',
        mode: 'company',
        price_percentage: 80,
      }),
    ).resolves.toMatchObject({ data: { field_id: 'field-1', price_percentage: 80 } });
    await expect(
      client.public.companies.updatePriceTableItem('company-1', 'item-1', {
        field_ref: 'price',
        price_percentage: 75,
      }),
    ).resolves.toMatchObject({ data: { item_id: 'item-1', price_percentage: 80 } });
    await expect(
      client.public.companies.applyPriceTableItems('company-1', {
        field_ref: 'price',
        mode: 'item',
        price_percentage: 70,
        exclude_item_ids: ['item-2'],
      }),
    ).resolves.toMatchObject({ data: { updated_count: 3 } });

    expect(calls).toEqual([
      'GET http://localhost:5000/api/v2/companies/company-1/price-table?field_ref=price&q=starter&page=1&page_size=30',
      'PATCH http://localhost:5000/api/v2/companies/company-1/price-table/company',
      'PATCH http://localhost:5000/api/v2/companies/company-1/price-table/items/item-1',
      'POST http://localhost:5000/api/v2/companies/company-1/price-table/items/apply-all',
    ]);
    expect(bodies).toEqual([
      undefined,
      { field_ref: 'price', mode: 'company', price_percentage: 80 },
      { field_ref: 'price', price_percentage: 75 },
      { field_ref: 'price', mode: 'item', price_percentage: 70, exclude_item_ids: ['item-2'] },
    ]);
  });
});
