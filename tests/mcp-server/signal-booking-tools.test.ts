import Sanka from 'sanka-sdk';

import {
  getSignalBookingTool,
  listSignalBookingsTool,
} from '../../packages/mcp-server/src/signal-booking-tools';

const oauthContext = {
  authMode: 'oauth_bearer' as const,
  clientOptions: {},
  oauth: {
    authorizationServerUrl: 'https://app.sanka.com',
    resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
    resourceUrl: 'https://mcp.sanka.com/mcp',
    scopes: [],
  },
};

const BOOKING_ID = '4f1c2b9a-6d3e-4a8b-9c7d-1e2f3a4b5c6d';
const row = {
  id: BOOKING_ID,
  start: '2026-11-03T17:00:00Z',
  status: 'booked',
  territory: 'us_west',
  territory_label: 'US Pacific & Mountain',
  member_id: 7,
  rep_name: 'Dana',
  lead_name: 'Dio',
  company: 'Frido',
};

const run = async (tool: typeof listSignalBookingsTool, args: Record<string, unknown>, data: unknown) => {
  const calls: Array<{ method: string; url: string }> = [];
  const client = new Sanka({
    apiKey: 'My API Key',
    apiVersion: 'v2',
    baseURL: 'http://localhost:5000/',
    fetch: async (url, init) => {
      calls.push({ method: String(init?.method ?? 'GET').toUpperCase(), url: String(url) });
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  const result = await tool.handler({
    reqContext: { client, auth: oauthContext, toolProfile: 'full' } as any,
    args,
  });
  return { calls, result };
};

describe('Signal booking MCP tools', () => {
  it('lists bookings with only the filters given and summarises each row', async () => {
    const { calls, result } = await run(
      listSignalBookingsTool,
      { territory: 'us_west', status: 'booked', member_id: 7, query: ' frido ', variant: '', limit: 20 },
      { bookings: [row], total: 3 },
    );

    expect(calls).toEqual([
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/manage/signal/booking/bookings?territory=us_west&status=booked&query=frido&member_id=7&limit=20',
      },
    ]);
    expect(result.structuredContent).toMatchObject({ bookings: [row], total: 3 });
    expect((result.content[0] as { text: string }).text).toBe(
      `1 of 3 Signal bookings:\n- 2026-11-03T17:00:00Z booked · Dio, Frido · rep Dana · US Pacific & Mountain · id ${BOOKING_ID}`,
    );
  });

  it('reads one booking by id', async () => {
    const detail = { ...row, assignment_trace: { candidates: [], reason: 'round_robin' } };
    const { calls, result } = await run(getSignalBookingTool, { booking_id: BOOKING_ID }, detail);

    expect(calls).toEqual([
      { method: 'GET', url: `http://localhost:5000/api/v2/manage/signal/booking/bookings/${BOOKING_ID}` },
    ]);
    expect(result.structuredContent).toMatchObject(detail);
  });

  it('refuses a booking id that is not a UUID without calling the API', async () => {
    const { calls, result } = await run(getSignalBookingTool, { booking_id: '../reps' }, {});

    expect(calls).toEqual([]);
    expect(result.isError).toBe(true);
  });
});
