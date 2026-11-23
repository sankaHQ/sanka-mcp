import {
  createMyCalendarEventTool,
  createZoomMeetingTool,
  deleteMyCalendarEventTool,
  getMyCalendarContextTool,
  listMyCalendarEventsTool,
  updateMyCalendarEventTool,
} from '../../packages/mcp-server/src/account-calendar-tools';
import { getCapabilityGuidanceTool } from '../../packages/mcp-server/src/capability-guidance-tools';
import { envelope, sendThroughSDK } from './crm/helpers';

const API = 'http://localhost:5000/api/v2';
const SESSION_READ = { method: 'GET', url: `${API}/auth/session` };
const session = () => envelope({ current_workspace: { id: 'ws-1', code: '10101010' } });
const BOUND = { 'x-sanka-expected-workspace-id': 'ws-1', 'x-sanka-mcp': 'true' };

const apiError = (status: number, code: string, message: string, details: unknown = {}) =>
  new Response(JSON.stringify({ success: false, error: { code, message, details } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('account calendar and Zoom meeting tools', () => {
  afterEach(() => jest.restoreAllMocks());

  it('get_my_calendar_context reads calendar channels and Zoom readiness', async () => {
    const { requests, result } = await sendThroughSDK({
      tool: getMyCalendarContextTool,
      args: {},
      responses: [
        envelope({
          timezone: 'Asia/Tokyo',
          channels: [{ id: 'ch-1', integration_slug: 'g-calendar', display_name: 'Primary' }],
          calendars: [{ id: 'ch-1::primary', channel_id: 'ch-1', calendar_id: 'primary', writable: true }],
          zoom_meetings_available: true,
          zoom_reconnect_required: false,
        }),
      ],
    });

    expect(requests).toEqual([{ method: 'GET', url: `${API}/me/calendar/context` }]);
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      timezone: 'Asia/Tokyo',
      zoom_meetings_available: true,
      zoom_reconnect_required: false,
    });
  });

  it('list_my_calendar_events passes range and filter query parameters', async () => {
    const { requests, result } = await sendThroughSDK({
      tool: listMyCalendarEventsTool,
      args: {
        start: '2026-11-24T00:00:00+09:00',
        end: '2026-11-25T00:00:00+09:00',
        channel_ids: 'ch-1',
        include_google: true,
      },
      responses: [
        envelope({
          timezone: 'Asia/Tokyo',
          events: [{ id: 'google:ch-1::primary:evt-1', title: 'Sync', start: '2026-11-24T14:00:00+09:00' }],
        }),
      ],
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.url).toContain(`${API}/me/calendar/events?`);
    expect(requests[0]?.url).toContain('channel_ids=ch-1');
    expect(result.structuredContent).toMatchObject({ timezone: 'Asia/Tokyo' });
  });

  it('create_my_calendar_event pins workspace and forwards conference_provider=zoom', async () => {
    const { requests, result } = await sendThroughSDK({
      tool: createMyCalendarEventTool,
      args: {
        channel_id: 'ch-1',
        calendar_id: 'primary',
        title: 'Demo with Acme',
        start: '2026-11-24T14:00:00+09:00',
        end: '2026-11-24T15:00:00+09:00',
        conference_provider: 'zoom',
      },
      responses: [
        session(),
        envelope({
          calendar_event_id: 'evt-99',
          event: {
            id: 'google:ch-1::primary:evt-99',
            title: 'Demo with Acme',
            start: '2026-11-24T14:00:00+09:00',
            end: '2026-11-24T15:00:00+09:00',
            conference_url: 'https://us06web.zoom.us/j/987654321',
          },
          zoom_meeting: {
            meeting_id: '987654321',
            join_url: 'https://us06web.zoom.us/j/987654321',
            password: 'secret',
            host_email: 'rep@sanka.com',
          },
        }),
      ],
    });

    expect(requests).toEqual([
      SESSION_READ,
      {
        method: 'POST',
        url: `${API}/me/calendar/channels/ch-1/events`,
        headers: expect.objectContaining(BOUND),
        body: {
          calendar_id: 'primary',
          title: 'Demo with Acme',
          start: '2026-11-24T14:00:00+09:00',
          end: '2026-11-24T15:00:00+09:00',
          conference_provider: 'zoom',
        },
      },
    ]);
    expect(result.isError).toBeUndefined();
    expect(JSON.stringify(result.content)).toContain('https://us06web.zoom.us/j/987654321');
    expect(result.structuredContent).toMatchObject({
      calendar_event_id: 'evt-99',
      zoom_meeting: { meeting_id: '987654321' },
    });
  });

  it('update_my_calendar_event and delete_my_calendar_event pin workspace and hit channel event routes', async () => {
    const updated = await sendThroughSDK({
      tool: updateMyCalendarEventTool,
      args: {
        channel_id: 'ch-1',
        calendar_event_id: 'evt-99',
        title: 'Demo moved',
        start: '2026-11-25T14:00:00+09:00',
        end: '2026-11-25T15:00:00+09:00',
      },
      responses: [session(), envelope({ calendar_event_id: 'evt-99', event: { id: 'evt-99' } })],
    });
    expect(updated.requests[1]).toEqual({
      method: 'PATCH',
      url: `${API}/me/calendar/channels/ch-1/events/evt-99`,
      headers: expect.objectContaining(BOUND),
      body: {
        title: 'Demo moved',
        start: '2026-11-25T14:00:00+09:00',
        end: '2026-11-25T15:00:00+09:00',
      },
    });

    const deleted = await sendThroughSDK({
      tool: deleteMyCalendarEventTool,
      args: { channel_id: 'ch-1', calendar_event_id: 'evt-99', calendar_id: 'primary' },
      responses: [session(), envelope({ calendar_event_id: 'evt-99' })],
    });
    expect(deleted.requests[1]).toEqual({
      method: 'DELETE',
      url: `${API}/me/calendar/channels/ch-1/events/evt-99?calendar_id=primary`,
      headers: expect.objectContaining(BOUND),
    });
  });

  it('create_zoom_meeting pins workspace and maps ZOOM_MEETING_SCOPE_REQUIRED cleanly', async () => {
    const ok = await sendThroughSDK({
      tool: createZoomMeetingTool,
      args: {
        topic: 'Client Intro',
        start: '2026-11-24T14:00:00+09:00',
        end: '2026-11-24T15:00:00+09:00',
        timezone: 'Asia/Tokyo',
      },
      responses: [
        session(),
        envelope({
          meeting_id: '11223344',
          join_url: 'https://us06web.zoom.us/j/11223344',
          password: 'pass',
          topic: 'Client Intro',
          start_time: '2026-11-24T05:00:00Z',
          duration_minutes: 60,
          timezone: 'Asia/Tokyo',
          host_email: 'rep@sanka.com',
        }),
      ],
    });
    expect(ok.requests[1]).toEqual({
      method: 'POST',
      url: `${API}/me/meetings/zoom`,
      headers: expect.objectContaining(BOUND),
      body: {
        topic: 'Client Intro',
        start: '2026-11-24T14:00:00+09:00',
        end: '2026-11-24T15:00:00+09:00',
        timezone: 'Asia/Tokyo',
      },
    });
    expect(ok.result.structuredContent).toMatchObject({ meeting_id: '11223344' });

    const missingScope = await sendThroughSDK({
      tool: createZoomMeetingTool,
      args: {
        topic: 'Client Intro',
        start: '2026-11-24T14:00:00+09:00',
        end: '2026-11-24T15:00:00+09:00',
      },
      responses: [
        session(),
        apiError(422, 'ZOOM_MEETING_SCOPE_REQUIRED', 'Zoom lacks meeting:write:meeting:admin'),
      ],
    });
    expect(missingScope.result.isError).toBe(true);
    expect(missingScope.result.structuredContent).toMatchObject({
      code: 'ZOOM_MEETING_SCOPE_REQUIRED',
      retryable: false,
    });
    expect(JSON.stringify(missingScope.result.content)).toContain('meeting:write:meeting:admin');
  });

  it('capability guidance routes Zoom link creation and personal calendar writes to account calendar tools', async () => {
    const { result } = await sendThroughSDK({
      tool: getCapabilityGuidanceTool,
      args: { intent: 'Google Calendarに商談予定を登録してZoomリンクを発行して' },
      responses: [],
    });
    const guidance = (result.structuredContent as { guidance: Record<string, unknown> }).guidance;
    expect(guidance).toMatchObject({
      intent_family: 'account_calendar_scheduling',
      recommended_tools: expect.arrayContaining([
        'get_my_calendar_context',
        'create_my_calendar_event',
        'create_zoom_meeting',
      ]),
    });
  });
});
