// Hand-written meeting tools for GET /api/v2/activities/meeting-link. The endpoint sits
// outside the public developer OpenAPI contract, so the handler calls it with a raw client
// path and lives apart from Stainless-generated code so it survives regeneration.
import { asErrorResult, McpTool, ToolCallResult } from './types';
import { requireAuthentication } from './tool-auth';

const MEETING_LINK_PATH = '/api/v2/activities/meeting-link';

const readString = (value: unknown): string | undefined => {
  const normalized = String(value ?? '').trim();
  return normalized || undefined;
};

const readObject = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ?
    (value as Record<string, unknown>)
  : undefined;

const meetingText = (meeting: Record<string, unknown>): string => {
  const participants = (Array.isArray(meeting['participants']) ? meeting['participants'] : [])
    .map(readObject)
    .map((person) => readString(person?.['name']) ?? readString(person?.['email']))
    .filter(Boolean);
  const topics = (Array.isArray(meeting['topics']) ? meeting['topics'] : []).map(readString).filter(Boolean);
  const records = (Array.isArray(meeting['links']) ? meeting['links'] : [])
    .map(readObject)
    .map((link) => {
      const title = readString(readObject(link?.['display'])?.['title']);
      return title ? `${readString(link?.['object_type']) ?? 'record'} "${title}"` : undefined;
    })
    .filter(Boolean);
  const transcript = readString(meeting['transcript']);
  return [
    `Meeting: ${readString(meeting['title']) ?? '(untitled)'} (${
      readString(meeting['occurred_at']) ?? 'date unknown'
    })`,
    participants.length ? `Participants: ${participants.join(', ')}` : undefined,
    records.length ? `Linked Sanka records: ${records.join(', ')}` : undefined,
    topics.length ? `Topics: ${topics.join(' / ')}` : undefined,
    readString(meeting['summary']) ? `Notes:\n${readString(meeting['summary'])}` : undefined,
    transcript ?
      `Transcript${meeting['transcript_truncated'] ? ' (truncated)' : ''}:\n${transcript}`
    : 'No transcript is available for this meeting yet.',
  ]
    .filter(Boolean)
    .join('\n\n');
};

export const getMeetingTool: McpTool = {
  metadata: {
    resource: 'activities',
    operation: 'read',
    tags: ['crm', 'activities', 'meetings'],
    httpMethod: 'get',
    httpPath: MEETING_LINK_PATH,
    operationId: 'activities.meetingLink',
  },
  tool: {
    name: 'get_meeting',
    title: 'Read a meeting from its link',
    description:
      "Read a recorded meeting from its link (tl;dv: https://tldv.io/app/meetings/<id>): title, date, participants, notes, topics, related Sanka records and transcript. Uses the meeting Sanka captured as an activity, or reads it from the workspace's connected tl;dv account when the user organized or was invited to it. Nothing is saved. Use it before making an estimate, deal, task or summary from a meeting; never pass a meeting link to preview_workflow or start_workflow.",
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The meeting link the user shared, e.g. https://tldv.io/app/meetings/<id>.',
        },
      },
      required: ['url'],
    },
    outputSchema: {
      type: 'object' as const,
      properties: {
        data: { type: 'object' },
        message: { type: 'string' },
      },
    },
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Read a meeting from its link',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }): Promise<ToolCallResult> => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Read a meeting from its link' });
    if (authError) return authError;
    const url = readString(args?.['url']);
    if (!url) {
      return asErrorResult('`url` is required.');
    }
    const response = (await reqContext.client.get(MEETING_LINK_PATH, { query: { url } })) as Record<
      string,
      unknown
    >;
    const meeting = readObject(response['data']) ?? {};
    return {
      content: [{ type: 'text', text: meetingText(meeting) }],
      structuredContent: { data: meeting, message: 'Read the meeting from its link.' },
    };
  },
};
