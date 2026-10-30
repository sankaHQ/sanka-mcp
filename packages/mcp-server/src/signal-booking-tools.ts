// Hand-written read-only tools for the Sanka Signal Booking manage API
// (sanka-api docs/specs/signal-booking/README.md). The routes are Sanka Admin only and sit
// outside the public developer OpenAPI contract, so the handlers call raw client paths and
// live apart from Stainless-generated code so they survive regeneration.
import { readRecord, readString } from './tool-factories';
import { requireAuthentication } from './tool-auth';
import { asErrorResult, McpTool, ToolCallResult } from './types';

const BOOKINGS_PATH = '/api/v2/manage/signal/booking/bookings';

const TERRITORIES = ['us_west', 'us_east', 'anz', 'my_sg', 'kr', 'jp'] as const;
const STATUSES = ['booked', 'cancelled', 'completed', 'no_show'] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
  properties: {
    message: { type: 'string' },
  },
};

const ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const readInteger = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) ? value : undefined;

const bookingLine = (row: Record<string, unknown>): string => {
  const who = [readString(row['lead_name']), readString(row['company'])].filter(Boolean).join(', ');
  return [
    `- ${readString(row['start']) ?? '?'} ${readString(row['status']) ?? ''}`.trim(),
    who || readString(row['lead_email']) || 'unknown lead',
    `rep ${readString(row['rep_name']) ?? row['member_id'] ?? '?'}`,
    readString(row['territory_label']) ?? readString(row['territory']),
    `id ${readString(row['id']) ?? '?'}`,
  ]
    .filter(Boolean)
    .join(' · ');
};

const result = (data: Record<string, unknown>, summary: string): ToolCallResult => ({
  content: [
    { type: 'text', text: summary },
    { type: 'text', text: `Signal booking data:\n${JSON.stringify(data, null, 2)}` },
  ],
  structuredContent: { ...data, message: summary },
});

export const listSignalBookingsTool: McpTool = {
  metadata: {
    resource: 'signal_booking',
    operation: 'read',
    tags: ['signal', 'booking', 'meetings', 'outreach'],
    httpMethod: 'get',
    httpPath: BOOKINGS_PATH,
    operationId: 'manage.signal.booking.bookings.list',
  },
  tool: {
    name: 'list_signal_bookings',
    title: 'List Sanka Signal bookings',
    description:
      'Sanka Admins only. List meetings that Sanka Signal outreach leads booked on sanka.com/book links, newest meeting first: time, status, Meet and calendar sync status, territory, assigned rep, lead, company, variant and sequence. Filter by rep, territory, status, variant or a text query. Read-only; changes are made in /manage/signal/booking.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        member_id: {
          type: 'integer',
          minimum: 1,
          description: 'Only bookings assigned to this rep (member id).',
        },
        territory: {
          type: 'string',
          enum: [...TERRITORIES],
          description: 'Only bookings in this Signal territory.',
        },
        status: { type: 'string', enum: [...STATUSES], description: 'Only bookings with this status.' },
        variant: {
          type: 'string',
          maxLength: 60,
          description: 'Only bookings from this outreach variant key.',
        },
        query: {
          type: 'string',
          maxLength: 200,
          description: 'Search lead name, email, company or rep.',
        },
        offset: { type: 'integer', minimum: 0, maximum: 100000, description: 'Rows to skip (default 0).' },
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Rows to return (default 50).' },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: { title: 'List Sanka Signal bookings', ...ANNOTATIONS },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'List Sanka Signal bookings' });
    if (authError) return authError;

    const query: Record<string, string | number> = {};
    for (const key of ['territory', 'status', 'variant', 'query'] as const) {
      const value = readString(args?.[key]);
      if (value) query[key] = value;
    }
    for (const key of ['member_id', 'offset', 'limit'] as const) {
      const value = readInteger(args?.[key]);
      if (value !== undefined) query[key] = value;
    }

    const response = (await reqContext.client.get(BOOKINGS_PATH, { query })) as Record<string, unknown>;
    const data = readRecord(response['data']) ?? {};
    const rows = (Array.isArray(data['bookings']) ? data['bookings'] : [])
      .map(readRecord)
      .filter((row): row is Record<string, unknown> => Boolean(row));
    const total = readInteger(data['total']) ?? rows.length;
    const summary =
      rows.length ?
        [`${rows.length} of ${total} Signal bookings:`, ...rows.map(bookingLine)].join('\n')
      : 'No Signal bookings match these filters.';
    return result(data, summary);
  },
};

export const getSignalBookingTool: McpTool = {
  metadata: {
    resource: 'signal_booking',
    operation: 'read',
    tags: ['signal', 'booking', 'meetings', 'outreach'],
    httpMethod: 'get',
    httpPath: `${BOOKINGS_PATH}/{booking_id}`,
    operationId: 'manage.signal.booking.bookings.get',
  },
  tool: {
    name: 'get_signal_booking',
    title: 'Get a Sanka Signal booking',
    description:
      'Sanka Admins only. Read one Sanka Signal booking: lead, company, time and time zones, notes and guests, Meet and calendar sync status, why the lead was routed to its territory, the round-robin assignment trace, the timeline of events and the reps it could be reassigned to. Read-only.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['booking_id'],
      properties: {
        booking_id: {
          type: 'string',
          format: 'uuid',
          description: 'Booking id from list_signal_bookings.',
        },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: { title: 'Get a Sanka Signal booking', ...ANNOTATIONS },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Get a Sanka Signal booking' });
    if (authError) return authError;

    const bookingId = readString(args?.['booking_id']);
    if (!bookingId || !UUID_PATTERN.test(bookingId)) {
      return asErrorResult('`booking_id` must be a booking UUID from list_signal_bookings.');
    }
    const response = (await reqContext.client.get(
      `${BOOKINGS_PATH}/${encodeURIComponent(bookingId)}`,
    )) as Record<string, unknown>;
    const data = readRecord(response['data']) ?? {};
    return result(data, `Signal booking ${bookingId}:\n${bookingLine(data)}`);
  },
};
