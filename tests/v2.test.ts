// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import Sanka, { V2EnvelopeError, isV2Envelope, unwrapV2Data, unwrapV2DataPromise } from 'sanka-sdk';

describe('v2 envelope helpers', () => {
  test('detects V2 envelopes', () => {
    expect(isV2Envelope({ success: true, data: { id: 'rec_1' }, meta: { ctx_id: 'ctx' } })).toBe(true);
    expect(
      isV2Envelope({
        success: false,
        error: { code: 'not_found', message: 'Missing record' },
        meta: { ctx_id: 'ctx' },
      }),
    ).toBe(true);
    expect(isV2Envelope({ data: { id: 'rec_1' } })).toBe(false);
  });

  test('unwraps success data', () => {
    expect(unwrapV2Data({ success: true, data: { id: 'rec_1' }, meta: { ctx_id: 'ctx' } })).toEqual({
      id: 'rec_1',
    });
  });

  test('throws envelope errors with code, details, and meta', () => {
    expect(() =>
      unwrapV2Data({
        success: false,
        error: { code: 'validation_error', message: 'Invalid request', details: { field: 'name' } },
        meta: { ctx_id: 'ctx' },
      }),
    ).toThrow(V2EnvelopeError);

    try {
      unwrapV2Data({
        success: false,
        error: { code: 'validation_error', message: 'Invalid request', details: { field: 'name' } },
        meta: { ctx_id: 'ctx' },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(V2EnvelopeError);
      expect((error as V2EnvelopeError).code).toEqual('validation_error');
      expect((error as V2EnvelopeError).details).toEqual({ field: 'name' });
      expect((error as V2EnvelopeError).meta).toEqual({ ctx_id: 'ctx' });
    }
  });

  test('unwraps APIPromise envelopes', async () => {
    const client = new Sanka({
      baseURL: 'http://localhost:5000/',
      apiKey: 'My API Key',
      fetch: async () =>
        new Response(JSON.stringify({ success: true, data: { id: 'rec_1' }, meta: { ctx_id: 'ctx' } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
    });

    await expect(unwrapV2DataPromise(client.v2Get<{ id: string }>('/orders/rec_1'))).resolves.toEqual({
      id: 'rec_1',
    });
  });
});
