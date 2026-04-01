// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Sanka from 'sanka-sdk';

const client = new Sanka({
  apiKey: 'My API Key',
  baseURL: process.env['TEST_API_BASE_URL'] ?? 'http://127.0.0.1:4010',
});

describe('resource attendance', () => {
  // Mock server tests are disabled
  test.skip('create: only required params', async () => {
    const responsePromise = client.public.calendar.attendance.create({
      date: 'date',
      email: 'email',
      event_id: 'event_id',
      name: 'name',
      time: 'time',
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
    const response = await client.public.calendar.attendance.create({
      date: 'date',
      email: 'email',
      event_id: 'event_id',
      name: 'name',
      time: 'time',
      comment: 'comment',
      timezone: 'timezone',
    });
  });

  // Mock server tests are disabled
  test.skip('cancel', async () => {
    const responsePromise = client.public.calendar.attendance.cancel('attendance_id');
    const rawResponse = await responsePromise.asResponse();
    expect(rawResponse).toBeInstanceOf(Response);
    const response = await responsePromise;
    expect(response).not.toBeInstanceOf(Response);
    const dataAndResponse = await responsePromise.withResponse();
    expect(dataAndResponse.data).toBe(response);
    expect(dataAndResponse.response).toBe(rawResponse);
  });

  // Mock server tests are disabled
  test.skip('reschedule: only required params', async () => {
    const responsePromise = client.public.calendar.attendance.reschedule('attendance_id', {
      date: 'date',
      time: 'time',
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
  test.skip('reschedule: required and optional params', async () => {
    const response = await client.public.calendar.attendance.reschedule('attendance_id', {
      date: 'date',
      time: 'time',
      comment: 'comment',
      email: 'email',
      name: 'name',
      timezone: 'timezone',
    });
  });
});
