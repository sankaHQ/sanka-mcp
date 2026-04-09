// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Sanka from 'sanka-sdk';

const client = new Sanka({
  apiKey: 'My API Key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource orders', () => {
  // Mock server tests are disabled
  test.skip('create: only required params', async () => {
    const responsePromise = client.public.orders.create({ order: { externalId: 'externalId', items: [{}] } });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // Mock server tests are disabled
  test.skip('create: required and optional params', async () => {
    const response = await client.public.orders.create({
      order: {
        externalId: 'externalId',
        items: [
          {
            item_id: 'item_id',
            itemExternalId: 'itemExternalId',
            price: 0,
            quantity: 0,
            tax: 0,
            tax_rate: 0,
          },
        ],
        companyExternalId: 'companyExternalId',
        companyId: 'companyId',
        deliveryStatus: 'deliveryStatus',
        orderAt: 'orderAt',
      },
      createMissingItems: true,
      triggerWorkflows: true,
    });
  });

  // Mock server tests are disabled
  test.skip('retrieve', async () => {
    const responsePromise = client.public.orders.retrieve('order_id');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // Mock server tests are disabled
  test.skip('retrieve: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.public.orders.retrieve(
        'order_id',
        { external_id: 'external_id' },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Sanka.NotFoundError);
  });

  // Mock server tests are disabled
  test.skip('update: only required params', async () => {
    const responsePromise = client.public.orders.update('order_id', {
      order: { externalId: 'externalId', items: [{}] },
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // Mock server tests are disabled
  test.skip('update: required and optional params', async () => {
    const response = await client.public.orders.update('order_id', {
      order: {
        externalId: 'externalId',
        items: [
          {
            item_id: 'item_id',
            itemExternalId: 'itemExternalId',
            price: 0,
            quantity: 0,
            tax: 0,
            tax_rate: 0,
          },
        ],
        companyExternalId: 'companyExternalId',
        companyId: 'companyId',
        deliveryStatus: 'deliveryStatus',
        orderAt: 'orderAt',
      },
      createMissingItems: true,
      triggerWorkflows: true,
    });
  });

  // Mock server tests are disabled
  test.skip('list', async () => {
    const responsePromise = client.public.orders.list();
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // Mock server tests are disabled
  test.skip('list: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.public.orders.list(
        {
          limit: 0,
          page: 0,
          reference_id: 'reference_id',
          search: 'search',
          sort: 'sort',
          view: 'view',
          'Accept-Language': 'Accept-Language',
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Sanka.NotFoundError);
  });

  // Mock server tests are disabled
  test.skip('delete', async () => {
    const responsePromise = client.public.orders.delete('order_id');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // Mock server tests are disabled
  test.skip('delete: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.public.orders.delete(
        'order_id',
        { external_id: 'external_id' },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Sanka.NotFoundError);
  });

  // Mock server tests are disabled
  test.skip('downloadPDF', async () => {
    const responsePromise = client.public.orders.downloadPDF('order_id');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // Mock server tests are disabled
  test.skip('downloadPDF: request options and params are passed correctly', async () => {
    await expect(
      client.public.orders.downloadPDF(
        'order_id',
        {
          external_id: 'external_id',
          template_select: 'template_select',
          lang: 'lang',
          language: 'language',
          'Accept-Language': 'Accept-Language',
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Sanka.NotFoundError);
  });

  // Mock server tests are disabled
  test.skip('bulkCreate: only required params', async () => {
    const responsePromise = client.public.orders.bulkCreate({
      orders: [{ externalId: 'externalId', items: [{}] }],
    });
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // Mock server tests are disabled
  test.skip('bulkCreate: required and optional params', async () => {
    const response = await client.public.orders.bulkCreate({
      orders: [
        {
          externalId: 'externalId',
          items: [
            {
              item_id: 'item_id',
              itemExternalId: 'itemExternalId',
              price: 0,
              quantity: 0,
              tax: 0,
              tax_rate: 0,
            },
          ],
          companyExternalId: 'companyExternalId',
          companyId: 'companyId',
          deliveryStatus: 'deliveryStatus',
          orderAt: 'orderAt',
        },
      ],
      createMissingItems: true,
      triggerWorkflows: true,
    });
  });
});
