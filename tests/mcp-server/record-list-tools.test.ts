import {
  addListMembersTool,
  createNoteTool,
  LIST_MEMBERS_PER_CALL,
  listNotesTool,
  listRecordListsTool,
  NOTE_RECORDS_PER_CALL,
  removeListMembersTool,
} from '../../packages/mcp-server/src/record-list-tools';
import { envelope, sendThroughSDK } from './crm/helpers';

const API = 'http://localhost:5000/api/v2';
const LIST = '539c8347-bcaa-4be4-aa68-d463a03880e7';
const ids = (count: number) => Array.from({ length: count }, (_, index) => `rec-${index}`);

describe('record list and note tools', () => {
  // The bug (rep request 2026-11-10): only company lists could be found, so a contact list id
  // was never known and the `lists` filter got a name instead.
  it('list_record_lists reads the lists of the object asked for, with their member counts', async () => {
    const { requests, result } = await sendThroughSDK({
      tool: listRecordListsTool,
      args: { object_type: 'contacts', mine: true, search: 'Own leads' },
      responses: [
        envelope({
          items: [
            {
              id: LIST,
              name: 'Own leads – Rep',
              object_type: 'contact',
              list_type: 'static',
              visibility: 'workspace',
              owner: { id: 7, name: 'Rep' },
              member_count: 301,
              permissions: { edit: true, edit_members: true, archive: true },
            },
          ],
          total: 1,
        }),
      ],
    });

    expect(requests.map((request) => request.url)).toEqual([
      `${API}/lists?object_type=contact&page=1&page_size=100&owner=me&q=Own%20leads`,
    ]);
    expect(result.structuredContent).toEqual({
      items: [
        {
          id: LIST,
          name: 'Own leads – Rep',
          object_type: 'contact',
          list_type: 'static',
          visibility: 'workspace',
          owner: 'Rep',
          member_count: 301,
          can_edit_members: true,
        },
      ],
      total: 1,
      page: 1,
      has_next: false,
    });
  });

  // The bug: an add or remove that goes to the wrong route, sends duplicates, or reports counts
  // the API did not return.
  it.each([
    [
      addListMembersTool,
      `${API}/lists/${LIST}/members`,
      { added: 33, already_members: 1, member_count: 301 },
    ],
    [removeListMembersTool, `${API}/lists/${LIST}/members/remove`, { removed: 34, member_count: 267 }],
  ])('%#: membership changes send the ids once, as a selection', async (tool, url, counts) => {
    const { requests, result } = await sendThroughSDK({
      tool,
      args: { list_id: LIST, record_ids: ['c-1', 'c-2', 'c-1'] },
      responses: [envelope({ list_id: LIST, not_found: 0, ...counts })],
    });

    expect(requests).toEqual([{ method: 'POST', url, body: { selection: { ids: ['c-1', 'c-2'] } } }]);
    expect(result.structuredContent).toMatchObject(counts);
  });

  // The guards: one call is one reviewable change, and a note is on at most the API's link limit.
  it.each([
    [addListMembersTool, { list_id: LIST, record_ids: ids(LIST_MEMBERS_PER_CALL + 1) }],
    [removeListMembersTool, { list_id: LIST, record_ids: ids(LIST_MEMBERS_PER_CALL + 1) }],
    [createNoteTool, { object_type: 'contact', record_ids: ids(NOTE_RECORDS_PER_CALL + 1), body: 'x' }],
  ])('%#: refuses an oversized call without sending anything', async (tool, args) => {
    const { requests, result } = await sendThroughSDK({ tool, args });

    expect(requests).toEqual([]);
    expect(result.isError).toBe(true);
  });

  // The bug: a note that lands on fewer records than asked, or as another activity type.
  it('create_note writes one note linked to every record', async () => {
    const { requests, result } = await sendThroughSDK({
      tool: createNoteTool,
      args: {
        object_type: 'contacts',
        record_id: 'c-1',
        record_ids: ['c-2'],
        title: 'Source',
        body: 'Found on x.com',
      },
      responses: [envelope({ id: 'n-1', activity_type: 'note', body: 'Found on x.com', links: [{}, {}] })],
    });

    expect(requests).toEqual([
      {
        method: 'POST',
        url: `${API}/activities`,
        body: {
          activity_type: 'note',
          title: 'Source',
          body: 'Found on x.com',
          links: [
            { object_type: 'contact', record_id: 'c-1' },
            { object_type: 'contact', record_id: 'c-2' },
          ],
        },
      },
    ]);
    expect(result.structuredContent).toMatchObject({ note: { id: 'n-1', linked_records: 2 } });
  });

  it('list_notes reads only the notes on the record', async () => {
    const { requests } = await sendThroughSDK({
      tool: listNotesTool,
      args: { object_type: 'company', record_id: 'co-1' },
    });

    expect(requests.map((request) => request.url)).toEqual([
      `${API}/activities?object_type=company&record_id=co-1&type=note&page=1&page_size=50`,
    ]);
  });
});
