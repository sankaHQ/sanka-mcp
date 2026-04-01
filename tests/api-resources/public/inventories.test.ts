// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Sanka from 'sanka-sdk';

const client = new Sanka({
  apiKey: 'My API Key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource inventories', () => {
  // Mock server tests are disabled
  test.skip('create: only required params', async () => {
    const responsePromise = client.public.inventories.create({ externalId: 'externalId' });
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
    const response = await client.public.inventories.create({
      externalId: 'externalId',
      currency: 'currency',
      date: 'date',
      initialValue: 0,
      inventoryStatus: 'inventoryStatus',
      itemExternalId: 'itemExternalId',
      itemId: 'itemId',
      name: 'name',
      status: 'status',
      unitPrice: 0,
      warehouseId: 'warehouseId',
    });
  });

  // Mock server tests are disabled
  test.skip('retrieve', async () => {
    const responsePromise = client.public.inventories.retrieve('inventory_id');
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
      client.public.inventories.retrieve(
        'inventory_id',
        { external_id: 'external_id', 'Accept-Language': 'Accept-Language' },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Sanka.NotFoundError);
  });

  // Mock server tests are disabled
  test.skip('update: only required params', async () => {
    const responsePromise = client.public.inventories.update('inventory_id', { externalId: 'externalId' });
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
    const response = await client.public.inventories.update('inventory_id', {
      externalId: 'externalId',
      currency: 'currency',
      date: 'date',
      initialValue: 0,
      inventoryStatus: 'inventoryStatus',
      itemExternalId: 'itemExternalId',
      itemId: 'itemId',
      name: 'name',
      status: 'status',
      unitPrice: 0,
      warehouseId: 'warehouseId',
    });
  });

  // Mock server tests are disabled
  test.skip('list', async () => {
    const responsePromise = client.public.inventories.list();
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
      client.public.inventories.list(
        {
          lang: 'lang',
          language: 'language',
          workspace_id: 'workspace_id',
          'Accept-Language': 'Accept-Language',
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Sanka.NotFoundError);
  });

  // Mock server tests are disabled
  test.skip('delete', async () => {
    const responsePromise = client.public.inventories.delete('inventory_id');
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
      client.public.inventories.delete(
        'inventory_id',
        { external_id: 'external_id' },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Sanka.NotFoundError);
  });
});
