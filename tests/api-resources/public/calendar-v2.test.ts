import Sanka from 'sanka-sdk';

const bootstrapData = {
  status: 'ready',
  mode: 'book',
  message: 'ok',
  event: { id: 'event-1', title: 'Intro' },
  workspace: { id: 'workspace-1', name: 'Main' },
};

const availabilityData = {
  message: 'ok',
  timezone: '0;UTC;0',
  days: [{ date: '2026-05-31', day_index: 0, weekday: 'Sun', slots: ['09:00'] }],
};

const mutationData = {
  ok: true,
  status: 'saved',
  message: 'saved',
  attendance: { id: 'attendance-1', event_id: 'event-1' },
  meet_link: 'https://meet.example.com/abc',
};

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-calendar' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public calendar resources on V2', () => {
  test('uses V2 public calendar paths', async () => {
    const calls: string[] = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url) => {
        const requestURL = String(url);
        calls.push(requestURL);
        if (requestURL.includes('/availability')) {
          return envelope(availabilityData);
        }
        if (requestURL.includes('/attendance')) {
          return envelope(mutationData);
        }
        return envelope(bootstrapData);
      },
    });

    await expect(client.public.calendar.bootstrap({ slug: 'main', url: 'intro' })).resolves.toMatchObject({
      ...bootstrapData,
      ctx_id: 'ctx-calendar',
    });
    await expect(
      client.public.calendar.checkAvailability({
        event_id: 'event-1',
        start_date: '2026-05-31',
      }),
    ).resolves.toMatchObject({ ...availabilityData, ctx_id: 'ctx-calendar' });
    await expect(
      client.public.calendar.attendance.create({
        event_id: 'event-1',
        name: 'Ada',
        email: 'ada@example.com',
        date: '2026-05-31',
        time: '09:00',
      }),
    ).resolves.toMatchObject({ ...mutationData, ctx_id: 'ctx-calendar' });
    await expect(client.public.calendar.attendance.cancel('attendance-1')).resolves.toMatchObject({
      ...mutationData,
      ctx_id: 'ctx-calendar',
    });
    await expect(
      client.public.calendar.attendance.reschedule('attendance-1', {
        date: '2026-06-01',
        time: '10:00',
      }),
    ).resolves.toMatchObject({ ...mutationData, ctx_id: 'ctx-calendar' });

    expect(calls).toEqual([
      'http://localhost:5000/api/v2/public/calendar/bootstrap?slug=main&url=intro',
      'http://localhost:5000/api/v2/public/calendar/availability?event_id=event-1&start_date=2026-05-31',
      'http://localhost:5000/api/v2/public/calendar/attendance',
      'http://localhost:5000/api/v2/public/calendar/attendance/attendance-1/cancel',
      'http://localhost:5000/api/v2/public/calendar/attendance/attendance-1/reschedule',
    ]);
  });
});
