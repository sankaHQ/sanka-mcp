// Hand-written tools for the signed-in person's connected Google Calendar and workspace Zoom
// meeting creation (/api/v2/me/calendar/* and /api/v2/me/meetings/zoom). These routes sit outside
// the frozen public developer OpenAPI contract, so handlers call raw client paths with workspace
// pinning and zero retries on writes.

import { envelopeData, readApiFailure, sessionWorkspace } from './desk-tools';
import { readRecord, readString } from './tool-factories';
import { requireAuthentication } from './tool-auth';
import { asErrorResult, McpRequestContext, McpTool, ToolCallResult } from './types';

type ToolArgs = Record<string, unknown> | undefined;
type JsonRecord = Record<string, unknown>;

const CALENDAR_CONTEXT_PATH = '/api/v2/me/calendar/context';
const CALENDAR_EVENTS_PATH = '/api/v2/me/calendar/events';
const CALENDAR_CHANNELS_PATH = '/api/v2/me/calendar/channels';
const ZOOM_MEETINGS_PATH = '/api/v2/me/meetings/zoom';

export const ACCOUNT_CALENDAR_TOOL_NAMES = [
  'get_my_calendar_context',
  'list_my_calendar_events',
  'create_my_calendar_event',
  'update_my_calendar_event',
  'delete_my_calendar_event',
  'create_zoom_meeting',
];

const ERROR_HINTS: Record<string, string> = {
  ZOOM_NOT_CONNECTED:
    'Connect Zoom in workspace Integrations (or Sanka Desk Zoom settings) to generate Zoom meeting links.',
  ZOOM_MEETING_SCOPE_REQUIRED:
    'Reconnect Zoom with meeting-creation permission (meeting:write:meeting:admin) enabled, then try again.',
  ZOOM_HOST_NOT_FOUND: 'The signed-in user email must match a Zoom user in the connected Zoom account.',
  ZOOM_CREDENTIALS_REJECTED:
    'Zoom rejected Sanka authorization. Reconnect Zoom in workspace Integrations and try again.',
  ZOOM_RATE_LIMITED: 'Zoom rate limit reached. Wait a moment and try again.',
  ZOOM_PROVIDER_UNAVAILABLE: 'Zoom could not be reached right now. Do not blindly duplicate the request.',
  VALIDATION_ERROR: 'Check the required calendar channel, calendar ID, or ISO-8601 start/end times.',
  PROVIDER_UNAVAILABLE:
    'Google Calendar could not complete the request. Check existing events before retrying.',
  WORKSPACE_CONTEXT_MISMATCH: 'The active workspace changed. Check current_workspace before trying again.',
};

const apiErrorResult = (error: unknown, lead: string): ToolCallResult | undefined => {
  const failure = readApiFailure(error);
  if (!failure) return undefined;
  if (!ERROR_HINTS[failure.code] && (failure.status === undefined || failure.status >= 500)) {
    return undefined;
  }
  const hint = ERROR_HINTS[failure.code];
  return {
    content: [
      {
        type: 'text',
        text: `${lead} (${failure.code}): ${failure.message}${hint ? ` ${hint}` : ''}`,
      },
    ],
    isError: true,
    structuredContent: {
      ok: false,
      status: 'error',
      status_code: failure.status,
      code: failure.code,
      message: failure.message,
      details: failure.details ?? {},
      ctx_id: failure.ctxID,
      retryable: false,
    },
  };
};

const withApiErrors =
  (
    title: string,
    lead: string,
    run: (reqContext: McpRequestContext, args: ToolArgs) => Promise<ToolCallResult>,
  ) =>
  async ({
    reqContext,
    args,
  }: {
    reqContext: McpRequestContext;
    args: ToolArgs;
  }): Promise<ToolCallResult> => {
    const authError = requireAuthentication({ reqContext, toolTitle: title });
    if (authError) return authError;
    try {
      return await run(reqContext, args);
    } catch (error) {
      const mapped = apiErrorResult(error, lead);
      if (mapped) return mapped;
      throw error;
    }
  };

const defineAccountCalendarTool = (definition: {
  name: string;
  title: string;
  description: string;
  operation: 'read' | 'write';
  destructive?: boolean;
  failureLead: string;
  httpMethod: 'get' | 'post' | 'patch' | 'delete';
  httpPath: string;
  operationId: string;
  inputSchema: McpTool['tool']['inputSchema'];
  outputSchema: McpTool['tool']['outputSchema'];
  run: (reqContext: McpRequestContext, args: ToolArgs) => Promise<ToolCallResult>;
}): McpTool => ({
  metadata: {
    resource: 'calendar',
    operation: definition.operation,
    tags: ['calendar', 'zoom', 'google_calendar'],
    httpMethod: definition.httpMethod,
    httpPath: definition.httpPath,
    operationId: definition.operationId,
  },
  tool: {
    name: definition.name,
    title: definition.title,
    description: definition.description,
    inputSchema: definition.inputSchema,
    outputSchema: definition.outputSchema,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: definition.title,
      readOnlyHint: definition.operation === 'read',
      destructiveHint: definition.destructive ?? false,
      idempotentHint: definition.operation === 'read' || definition.httpMethod === 'delete',
      openWorldHint: true,
    },
  },
  handler: withApiErrors(definition.title, definition.failureLead, definition.run),
});

const requirePinnedWorkspaceHeaders = async (
  reqContext: McpRequestContext,
  lead: string,
): Promise<{ headers: Record<string, string> } | { error: ToolCallResult }> => {
  const workspace = await sessionWorkspace(reqContext);
  if (!workspace.id) {
    return {
      error: asErrorResult(
        `${lead}: No Sanka workspace is selected for this connection. Pick one with list_workspaces and switch_workspace first.`,
      ),
    };
  }
  return {
    headers: {
      'X-Sanka-MCP': 'true',
      'X-Sanka-Expected-Workspace-ID': workspace.id,
    },
  };
};

export const getMyCalendarContextTool = defineAccountCalendarTool({
  name: 'get_my_calendar_context',
  title: "Get the person's connected Google Calendar channels and Zoom availability",
  description:
    "Return the signed-in person's timezone, connected Google Calendar channels (`channel_id`), writable calendars (`calendar_id`), and whether workspace Zoom meeting creation is available (`zoom_meetings_available`, `zoom_reconnect_required`). Call this before create_my_calendar_event so you use the exact channel_id and calendar_id.",
  operation: 'read',
  failureLead: 'Could not read calendar context',
  httpMethod: 'get',
  httpPath: CALENDAR_CONTEXT_PATH,
  operationId: 'get_me_calendar_context_api_v2_me_calendar_context_get',
  inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  outputSchema: {
    type: 'object',
    additionalProperties: true,
    properties: {
      timezone: { type: ['string', 'null'] },
      channels: { type: 'array', items: { type: 'object', additionalProperties: true } },
      calendars: { type: 'array', items: { type: 'object', additionalProperties: true } },
      zoom_meetings_available: { type: 'boolean' },
      zoom_reconnect_required: { type: 'boolean' },
    },
  },
  run: async (reqContext) => {
    const data = envelopeData(await reqContext.client.get(CALENDAR_CONTEXT_PATH));
    const channels = Array.isArray(data['channels']) ? data['channels'] : [];
    const calendars = Array.isArray(data['calendars']) ? data['calendars'] : [];
    const zoomReady = data['zoom_meetings_available'] === true;
    const zoomReconnect = data['zoom_reconnect_required'] === true;
    const zoomLine =
      zoomReady ? 'Zoom meeting links: ready.'
      : zoomReconnect ? 'Zoom meeting links: reconnect Zoom with meeting:write:meeting:admin.'
      : 'Zoom meeting links: Zoom not connected.';
    const text = `Calendar context (${readString(data['timezone']) ?? 'UTC'}): ${
      channels.length
    } channel(s), ${calendars.length} calendar(s). ${zoomLine}`;
    return {
      content: [{ type: 'text', text }],
      structuredContent: data,
    };
  },
});

export const listMyCalendarEventsTool = defineAccountCalendarTool({
  name: 'list_my_calendar_events',
  title: "List events from the person's connected Google Calendar",
  description:
    "List events from the signed-in person's connected Google Calendar channels and bookings within an ISO-8601 [start, end] range. Use this to check for scheduling conflicts before creating or moving an event.",
  operation: 'read',
  failureLead: 'Could not list calendar events',
  httpMethod: 'get',
  httpPath: CALENDAR_EVENTS_PATH,
  operationId: 'list_me_calendar_events_api_v2_me_calendar_events_get',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['start', 'end'],
    properties: {
      start: {
        type: 'string',
        minLength: 1,
        description: 'Range start in ISO-8601 format (e.g. 2026-11-24T00:00:00+09:00).',
      },
      end: {
        type: 'string',
        minLength: 1,
        description: 'Range end in ISO-8601 format (must be after start).',
      },
      channel_ids: {
        type: 'string',
        description: 'Optional comma-separated calendar channel IDs to filter by.',
      },
      calendar_keys: {
        type: 'string',
        description: 'Optional comma-separated calendar option keys from get_my_calendar_context.',
      },
      include_google: {
        type: 'boolean',
        description: 'Include events from connected Google Calendar channels (default true).',
      },
    },
  },
  outputSchema: {
    type: 'object',
    additionalProperties: true,
    properties: {
      timezone: { type: ['string', 'null'] },
      events: { type: 'array', items: { type: 'object', additionalProperties: true } },
    },
  },
  run: async (reqContext, args) => {
    const start = readString(args?.['start']);
    const end = readString(args?.['end']);
    if (!start || !end) {
      return asErrorResult('`start` and `end` are required ISO-8601 timestamps.');
    }
    const query: Record<string, string | boolean> = { start, end };
    const channelIDs = readString(args?.['channel_ids']);
    const calendarKeys = readString(args?.['calendar_keys']);
    if (channelIDs) query['channel_ids'] = channelIDs;
    if (calendarKeys) query['calendar_keys'] = calendarKeys;
    if (typeof args?.['include_google'] === 'boolean') {
      query['include_google'] = args['include_google'];
    }
    const data = envelopeData(await reqContext.client.get(CALENDAR_EVENTS_PATH, { query }));
    const events = Array.isArray(data['events']) ? data['events'] : [];
    return {
      content: [
        {
          type: 'text',
          text: `${events.length} calendar event(s) between ${start} and ${end} (${
            readString(data['timezone']) ?? 'UTC'
          }).`,
        },
      ],
      structuredContent: data,
    };
  },
});

export const createMyCalendarEventTool = defineAccountCalendarTool({
  name: 'create_my_calendar_event',
  title: "Create an event on the person's connected Google Calendar",
  description:
    "Create a Busy event on the signed-in person's connected Google Calendar channel (no guest invites are sent). Set `conference_provider` to `zoom` to automatically generate a unique non-PMI Zoom meeting and attach its join URL to the calendar event, or `google_meet` for a Google Meet link. Call get_my_calendar_context first to get `channel_id` and `calendar_id`.",
  operation: 'write',
  failureLead: 'Could not create calendar event',
  httpMethod: 'post',
  httpPath: `${CALENDAR_CHANNELS_PATH}/{channel_id}/events`,
  operationId: 'create_me_calendar_event_api_v2_me_calendar_channels__channel_id__events_post',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['channel_id', 'title', 'start', 'end'],
    properties: {
      channel_id: {
        type: 'string',
        minLength: 1,
        description: 'Connected Google Calendar channel ID from get_my_calendar_context.',
      },
      title: { type: 'string', minLength: 1, description: 'Event title.' },
      start: {
        type: 'string',
        minLength: 1,
        description:
          'Start datetime in ISO-8601 format with timezone offset (e.g. 2026-11-24T14:00:00+09:00).',
      },
      end: {
        type: 'string',
        minLength: 1,
        description: 'End datetime in ISO-8601 format with timezone offset (must be after start).',
      },
      calendar_id: {
        type: 'string',
        description: 'Optional target calendar ID on the channel (defaults to primary writable calendar).',
      },
      description: { type: 'string', description: 'Optional event description / notes.' },
      location: { type: 'string', description: 'Optional event location.' },
      conference_provider: {
        type: 'string',
        enum: ['none', 'google_meet', 'zoom'],
        description:
          'Optional video conference link to generate automatically: `zoom` creates a unique non-PMI Zoom meeting and attaches it, `google_meet` creates a Google Meet link, `none` creates no video link (default).',
      },
    },
  },
  outputSchema: {
    type: 'object',
    additionalProperties: true,
    properties: {
      calendar_event_id: { type: ['string', 'null'] },
      event: { type: ['object', 'null'], additionalProperties: true },
      zoom_meeting: { type: ['object', 'null'], additionalProperties: true },
    },
  },
  run: async (reqContext, args) => {
    const channelID = readString(args?.['channel_id']);
    const title = readString(args?.['title']);
    const start = readString(args?.['start']);
    const end = readString(args?.['end']);
    if (!channelID || !title || !start || !end) {
      return asErrorResult('`channel_id`, `title`, `start`, and `end` are required.');
    }
    const pinned = await requirePinnedWorkspaceHeaders(reqContext, 'Could not create calendar event');
    if ('error' in pinned) return pinned.error;

    const body: JsonRecord = { title, start, end };
    const calendarID = readString(args?.['calendar_id']);
    const description = readString(args?.['description']);
    const location = readString(args?.['location']);
    const conferenceProvider = readString(args?.['conference_provider']);
    if (calendarID) body['calendar_id'] = calendarID;
    if (description) body['description'] = description;
    if (location) body['location'] = location;
    if (conferenceProvider) body['conference_provider'] = conferenceProvider;

    const data = envelopeData(
      await reqContext.client.post(`${CALENDAR_CHANNELS_PATH}/${encodeURIComponent(channelID)}/events`, {
        body,
        headers: pinned.headers,
        maxRetries: 0,
      }),
    );
    const zoom = readRecord(data['zoom_meeting']);
    const zoomText = zoom?.['join_url'] ? ` Zoom: ${String(zoom['join_url'])}` : '';
    const eventRecord = readRecord(data['event']);
    const confUrl = readString(eventRecord?.['conference_url']);
    const meetText = !zoomText && confUrl ? ` Conference: ${confUrl}` : '';
    return {
      content: [
        {
          type: 'text',
          text: `Created calendar event "${title}" (${start} to ${end}).${zoomText}${meetText}`,
        },
      ],
      structuredContent: data,
    };
  },
});

export const updateMyCalendarEventTool = defineAccountCalendarTool({
  name: 'update_my_calendar_event',
  title: "Update an event on the person's connected Google Calendar",
  description: "Update an existing event on the signed-in person's connected Google Calendar channel.",
  operation: 'write',
  failureLead: 'Could not update calendar event',
  httpMethod: 'patch',
  httpPath: `${CALENDAR_CHANNELS_PATH}/{channel_id}/events/{calendar_event_id}`,
  operationId:
    'update_me_calendar_event_api_v2_me_calendar_channels__channel_id__events__calendar_event_id__patch',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['channel_id', 'calendar_event_id', 'title', 'start', 'end'],
    properties: {
      channel_id: { type: 'string', minLength: 1 },
      calendar_event_id: { type: 'string', minLength: 1 },
      title: { type: 'string', minLength: 1 },
      start: { type: 'string', minLength: 1 },
      end: { type: 'string', minLength: 1 },
      calendar_id: { type: 'string' },
      description: { type: 'string' },
      location: { type: 'string' },
    },
  },
  outputSchema: {
    type: 'object',
    additionalProperties: true,
    properties: {
      calendar_event_id: { type: ['string', 'null'] },
      event: { type: ['object', 'null'], additionalProperties: true },
    },
  },
  run: async (reqContext, args) => {
    const channelID = readString(args?.['channel_id']);
    const eventID = readString(args?.['calendar_event_id']);
    const title = readString(args?.['title']);
    const start = readString(args?.['start']);
    const end = readString(args?.['end']);
    if (!channelID || !eventID || !title || !start || !end) {
      return asErrorResult('`channel_id`, `calendar_event_id`, `title`, `start`, and `end` are required.');
    }
    const pinned = await requirePinnedWorkspaceHeaders(reqContext, 'Could not update calendar event');
    if ('error' in pinned) return pinned.error;

    const body: JsonRecord = { title, start, end };
    const calendarID = readString(args?.['calendar_id']);
    const description = readString(args?.['description']);
    const location = readString(args?.['location']);
    if (calendarID) body['calendar_id'] = calendarID;
    if (description) body['description'] = description;
    if (location) body['location'] = location;

    const data = envelopeData(
      await reqContext.client.patch(
        `${CALENDAR_CHANNELS_PATH}/${encodeURIComponent(channelID)}/events/${encodeURIComponent(eventID)}`,
        {
          body,
          headers: pinned.headers,
          maxRetries: 0,
        },
      ),
    );
    return {
      content: [{ type: 'text', text: `Updated calendar event "${title}" (${eventID}).` }],
      structuredContent: data,
    };
  },
});

export const deleteMyCalendarEventTool = defineAccountCalendarTool({
  name: 'delete_my_calendar_event',
  title: "Delete an event from the person's connected Google Calendar",
  description: "Delete an event from the signed-in person's connected Google Calendar channel.",
  operation: 'write',
  destructive: true,
  failureLead: 'Could not delete calendar event',
  httpMethod: 'delete',
  httpPath: `${CALENDAR_CHANNELS_PATH}/{channel_id}/events/{calendar_event_id}`,
  operationId:
    'delete_me_calendar_event_api_v2_me_calendar_channels__channel_id__events__calendar_event_id__delete',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['channel_id', 'calendar_event_id'],
    properties: {
      channel_id: { type: 'string', minLength: 1 },
      calendar_event_id: { type: 'string', minLength: 1 },
      calendar_id: { type: 'string' },
    },
  },
  outputSchema: {
    type: 'object',
    additionalProperties: true,
    properties: {
      calendar_event_id: { type: ['string', 'null'] },
    },
  },
  run: async (reqContext, args) => {
    const channelID = readString(args?.['channel_id']);
    const eventID = readString(args?.['calendar_event_id']);
    if (!channelID || !eventID) {
      return asErrorResult('`channel_id` and `calendar_event_id` are required.');
    }
    const pinned = await requirePinnedWorkspaceHeaders(reqContext, 'Could not delete calendar event');
    if ('error' in pinned) return pinned.error;
    const calendarID = readString(args?.['calendar_id']);
    const data = envelopeData(
      await reqContext.client.delete(
        `${CALENDAR_CHANNELS_PATH}/${encodeURIComponent(channelID)}/events/${encodeURIComponent(eventID)}`,
        {
          ...(calendarID ? { query: { calendar_id: calendarID } } : {}),
          headers: pinned.headers,
          maxRetries: 0,
        },
      ),
    );
    return {
      content: [{ type: 'text', text: `Deleted calendar event ${eventID}.` }],
      structuredContent: data,
    };
  },
});

export const createZoomMeetingTool = defineAccountCalendarTool({
  name: 'create_zoom_meeting',
  title: 'Generate a unique Zoom meeting link',
  description:
    'Generate a unique scheduled Zoom meeting (never reuses Personal Meeting ID) for the signed-in person via the workspace Zoom integration. Returns the join_url, meeting_id, and passcode. To also block time on Google Calendar in one step, use create_my_calendar_event with conference_provider="zoom".',
  operation: 'write',
  failureLead: 'Could not create Zoom meeting',
  httpMethod: 'post',
  httpPath: ZOOM_MEETINGS_PATH,
  operationId: 'create_me_zoom_meeting_api_v2_me_meetings_zoom_post',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['topic', 'start', 'end'],
    properties: {
      topic: { type: 'string', minLength: 1, maxLength: 200, description: 'Meeting title / topic.' },
      start: {
        type: 'string',
        minLength: 1,
        description: 'Start datetime in ISO-8601 format with timezone offset.',
      },
      end: {
        type: 'string',
        minLength: 1,
        description: 'End datetime in ISO-8601 format with timezone offset (must be after start).',
      },
      timezone: {
        type: 'string',
        description: 'Optional IANA timezone (e.g. Asia/Tokyo). Defaults to user or workspace timezone.',
      },
      agenda: { type: 'string', maxLength: 2000, description: 'Optional meeting agenda / notes.' },
    },
  },
  outputSchema: {
    type: 'object',
    additionalProperties: true,
    properties: {
      meeting_id: { type: 'string' },
      join_url: { type: 'string' },
      password: { type: ['string', 'null'] },
      topic: { type: 'string' },
      start_time: { type: 'string' },
      duration_minutes: { type: 'integer' },
      timezone: { type: 'string' },
      host_email: { type: 'string' },
    },
  },
  run: async (reqContext, args) => {
    const topic = readString(args?.['topic']);
    const start = readString(args?.['start']);
    const end = readString(args?.['end']);
    if (!topic || !start || !end) {
      return asErrorResult('`topic`, `start`, and `end` are required.');
    }
    const pinned = await requirePinnedWorkspaceHeaders(reqContext, 'Could not create Zoom meeting');
    if ('error' in pinned) return pinned.error;

    const body: JsonRecord = { topic, start, end };
    const timezone = readString(args?.['timezone']);
    const agenda = readString(args?.['agenda']);
    if (timezone) body['timezone'] = timezone;
    if (agenda) body['agenda'] = agenda;

    const data = envelopeData(
      await reqContext.client.post(ZOOM_MEETINGS_PATH, {
        body,
        headers: pinned.headers,
        maxRetries: 0,
      }),
    );
    return {
      content: [
        {
          type: 'text',
          text: `Created Zoom meeting "${readString(data['topic']) ?? topic}": ${
            readString(data['join_url']) ?? ''
          } (ID: ${readString(data['meeting_id']) ?? ''}).`,
        },
      ],
      structuredContent: data,
    };
  },
});

export const accountCalendarTools: McpTool[] = [
  getMyCalendarContextTool,
  listMyCalendarEventsTool,
  createMyCalendarEventTool,
  updateMyCalendarEventTool,
  deleteMyCalendarEventTool,
  createZoomMeetingTool,
];
