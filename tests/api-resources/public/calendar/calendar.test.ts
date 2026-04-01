// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Sanka from 'sanka-sdk';

const client = new Sanka({
  apiKey: 'My API Key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource calendar', () => {
  // Mock server tests are disabled
  test.skip('bootstrap', async () => {
    const responsePromise = client.public.calendar.bootstrap();
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // Mock server tests are disabled
  test.skip('bootstrap: request options and params are passed correctly', async () => {
    // ensure the request options are being passed correctly by passing an invalid HTTP method in order to cause an error
    await expect(
      client.public.calendar.bootstrap(
        {
          attendance_id: 'attendance_id',
          mode: 'mode',
          slug: 'slug',
          url: 'url',
        },
        { path: '/_stainless_unknown_path' },
      ),
    ).rejects.toThrow(Sanka.NotFoundError);
  });

  // Mock server tests are disabled
  test.skip('checkAvailability: only required params', async () => {
    const responsePromise = client.public.calendar.checkAvailability({
      event_id: 'event_id',
      start_date: 'start_date',
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
  test.skip('checkAvailability: required and optional params', async () => {
    const response = await client.public.calendar.checkAvailability({
      event_id: 'event_id',
      start_date: 'start_date',
      days: 0,
      timezone: 'timezone',
    });
  });
});
