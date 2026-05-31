import Sanka from 'sanka-sdk';

type ResourceClient = {
  retrieve(id: string, params?: { external_id?: string }): Promise<Record<string, unknown>>;
  list(): Promise<Array<Record<string, unknown>>>;
  delete(id: string, params?: { external_id?: string }): Promise<Record<string, unknown>>;
};

type ResourceCase = {
  clientKey: string;
  path: string;
  id: string;
  objectType: string;
  recordID: string;
  formattedKey?: string;
  deleteIDKey: string;
  properties?: Record<string, unknown>;
};

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-test' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

const cases: ResourceCase[] = [
  {
    clientKey: 'subscriptions',
    path: 'subscriptions',
    id: 'subscription-1',
    objectType: 'subscription',
    recordID: '2001',
    deleteIDKey: 'subscription_id',
    properties: {
      contact_info: [],
      items: [],
      number_item: 0,
      subscription_status: 'active',
    },
  },
  {
    clientKey: 'payments',
    path: 'payments',
    id: 'payment-1',
    objectType: 'payment',
    recordID: '3001',
    formattedKey: 'id_rcp',
    deleteIDKey: 'payment_id',
  },
  {
    clientKey: 'inventories',
    path: 'inventories',
    id: 'inventory-1',
    objectType: 'inventory',
    recordID: '4001',
    formattedKey: 'inventory_id',
    deleteIDKey: 'inventory_id',
    properties: { name: 'Warehouse stock' },
  },
  {
    clientKey: 'locations',
    path: 'locations',
    id: 'location-1',
    objectType: 'location',
    recordID: '5001',
    formattedKey: 'id_iw',
    deleteIDKey: 'location_id',
    properties: { warehouse: 'Tokyo' },
  },
  {
    clientKey: 'meters',
    path: 'meters',
    id: 'meter-1',
    objectType: 'meter',
    recordID: '6001',
    formattedKey: 'meter_id',
    deleteIDKey: 'meter_id',
    properties: { usage: 12 },
  },
  {
    clientKey: 'disbursements',
    path: 'disbursements',
    id: 'disbursement-1',
    objectType: 'disbursement',
    recordID: '7001',
    formattedKey: 'id_dsb',
    deleteIDKey: 'disbursement_id',
  },
  {
    clientKey: 'slips',
    path: 'revenues',
    id: 'slip-1',
    objectType: 'revenue',
    recordID: '8001',
    formattedKey: 'id_slip',
    deleteIDKey: 'slip_id',
  },
];

describe('public object-record resources on V2', () => {
  test.each(cases)('$clientKey uses V2 read list and delete routes', async (resourceCase) => {
    const calls: string[] = [];
    const record = {
      id: resourceCase.id,
      record_id: resourceCase.recordID,
      object_type: resourceCase.objectType,
      properties: {
        created_at: '2026-05-11',
        updated_at: '2026-05-12',
        status: 'active',
        ...resourceCase.properties,
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
          return envelope({
            id: resourceCase.id,
            record_id: resourceCase.recordID,
            usage_status: 'archived',
          });
        }
        if (requestURL.endsWith(`/api/v2/${resourceCase.path}`)) {
          return envelope({ items: [record], page: 1, page_size: 50, total: 1 });
        }
        return envelope(record);
      },
    });

    const resource = (client.public as unknown as Record<string, ResourceClient>)[resourceCase.clientKey];
    if (!resource) throw new Error(`Missing public resource client ${resourceCase.clientKey}`);
    const expectedFormatted =
      resourceCase.formattedKey ? { [resourceCase.formattedKey]: Number(resourceCase.recordID) } : {};

    await expect(resource.retrieve(resourceCase.id, { external_id: 'EXT-1' })).resolves.toMatchObject({
      id: resourceCase.id,
      ...expectedFormatted,
    });
    await expect(resource.list()).resolves.toEqual([
      expect.objectContaining({ id: resourceCase.id, ...expectedFormatted }),
    ]);
    await expect(resource.delete(resourceCase.id, { external_id: 'EXT-1' })).resolves.toEqual({
      ok: true,
      status: 'deleted',
      [resourceCase.deleteIDKey]: resourceCase.id,
      external_id: 'EXT-1',
      ctx_id: 'ctx-test',
    });

    expect(calls).toEqual([
      `GET http://localhost:5000/api/v2/${resourceCase.path}/${resourceCase.id}?external_id=EXT-1`,
      `GET http://localhost:5000/api/v2/${resourceCase.path}`,
      `DELETE http://localhost:5000/api/v2/${resourceCase.path}/${resourceCase.id}?external_id=EXT-1`,
    ]);
  });
});
