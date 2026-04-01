// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Sanka from 'sanka-sdk';

const client = new Sanka({
  apiKey: 'My API Key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource reports', () => {
  // Mock server tests are disabled
  test.skip('create: only required params', async () => {
    const responsePromise = client.public.reports.create({
      reportMetadata: {
        name: 'name',
        reportType: { type: 'type' },
      },
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
  test.skip('create: required and optional params', async () => {
    const response = await client.public.reports.create({
      reportMetadata: {
        name: 'name',
        reportType: { type: 'type' },
        description: 'description',
        detailColumns: ['string'],
        groupingsAcross: ['string'],
        groupingsDown: ['string'],
        reportFilters: {
          filters: [
            {
              filter_operator: 'filter_operator',
              filter_select: 'filter_select',
              filter_input: [{ value: {} }],
              filter_source: 'filter_source',
              filter_type: 'filter_type',
            },
          ],
        },
        reportFormat: 'reportFormat',
      },
      createDefaultPanel: true,
      panels: [
        {
          breakdown: 'breakdown',
          dataSource: 'dataSource',
          dataSources: ['string'],
          dataSourceType: 'dataSourceType',
          description: 'description',
          filter: { foo: 'bar' },
          heightPx: 0,
          metaData: { foo: 'bar' },
          metrics: [
            {
              metric: 'metric',
              dataSource: 'dataSource',
              displayResult: 'displayResult',
              filter: { foo: 'bar' },
              metaData: { foo: 'bar' },
              metricType: 'metricType',
              name: 'name',
              order: 0,
              rawSql: 'rawSql',
              role: 'role',
              sort: 'sort',
            },
          ],
          name: 'name',
          order: 0,
          panelType: 'panelType',
          ratio: 0,
          typeObjects: ['string'],
          widthUnits: 0,
        },
      ],
    });
  });

  // Mock server tests are disabled
  test.skip('retrieve', async () => {
    const responsePromise = client.public.reports.retrieve('report_id');
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
      client.public.reports.retrieve(
        'report_id',
        { workspace_id: 'workspace_id' },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Sanka.NotFoundError);
  });

  // Mock server tests are disabled
  test.skip('update', async () => {
    const responsePromise = client.public.reports.update('report_id', {});
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // Mock server tests are disabled
  test.skip('list', async () => {
    const responsePromise = client.public.reports.list();
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
      client.public.reports.list({ workspace_id: 'workspace_id' }, { path: '/_stainless_unknown_path' }),
    ).rejects.toThrow(Sanka.NotFoundError);
  });

  // Mock server tests are disabled
  test.skip('delete', async () => {
    const responsePromise = client.public.reports.delete('report_id');
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
      client.public.reports.delete(
        'report_id',
        { workspace_id: 'workspace_id' },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Sanka.NotFoundError);
  });
});
