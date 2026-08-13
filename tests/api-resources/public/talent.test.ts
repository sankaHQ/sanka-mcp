import Sanka from 'sanka-sdk';

const record = {
  id: 'job-uuid',
  record_id: 'JOB-1',
  object_type: 'job',
  status: 'open',
  usage_status: 'active',
  properties: { name: 'Backend Engineer' },
  display_properties: {},
};

const position = {
  id: 'position-1',
  display_id: 1,
  title: 'Backend Engineer',
  fte: 1,
  planning_status: 'approved',
  staffing_phase: 'recruiting',
  version: 2,
};

const response = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta: { ctx_id: 'ctx-talent' } }), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('public talent resources', () => {
  test('uses the public recruiting and workforce planning contracts', async () => {
    const calls: Array<{ body?: unknown; method: string; url: string }> = [];
    const client = new Sanka({
      apiKey: 'My API Key',
      apiVersion: 'v2',
      baseURL: 'http://localhost:5000/',
      fetch: async (url, init) => {
        const method = String(init?.method ?? 'GET').toUpperCase();
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        const href = String(url);
        calls.push({ method, url: href, body });
        if (href.includes('/organization')) {
          return response({
            can_manage_occupants: true,
            nodes: [position],
            unassigned_jobs: [],
            summary: { positions: 1, recruiting: 1 },
          });
        }
        if (href.includes('/workforce-planning/positions')) return response(position);
        if (method === 'GET' && !href.includes('/JOB-1')) {
          return response({
            object_type:
              href.includes('/applicants') ? 'applicant'
              : href.includes('/interviews') ? 'interview'
              : 'job',
            view: {},
            columns: ['standard:name'],
            column_labels: { 'standard:name': 'Name' },
            items: [record],
            page: 1,
            page_size: 25,
            total: 1,
            next_cursor: null,
            subtotals: [],
            meta: {},
          });
        }
        return response(record);
      },
    });

    await expect(
      client.public.jobPostings.list({
        workspace_id: 'workspace-1',
        search: 'Backend',
        usage_status: 'active',
        limit: 25,
      }),
    ).resolves.toMatchObject({ items: [record], total: 1 });
    await expect(client.public.applicants.list()).resolves.toMatchObject({ object_type: 'applicant' });
    await expect(client.public.interviews.list()).resolves.toMatchObject({ object_type: 'interview' });
    await expect(client.public.jobPostings.retrieve('JOB-1')).resolves.toEqual(record);
    await expect(
      client.public.jobPostings.create({
        workspace_id: 'workspace-1',
        properties: { name: 'Backend Engineer' },
      }),
    ).resolves.toEqual(record);
    await expect(
      client.public.jobPostings.update('JOB-1', {
        workspace_id: 'workspace-1',
        properties: { status: 'closed' },
      }),
    ).resolves.toEqual(record);
    await expect(client.public.jobPostings.archive('JOB-1')).resolves.toEqual(record);
    await expect(client.public.jobPostings.activate('JOB-1')).resolves.toEqual(record);

    await expect(
      client.public.workforcePlanning.retrieveOrganization({ workspace_id: 'workspace-1' }),
    ).resolves.toMatchObject({ nodes: [position] });
    await expect(
      client.public.workforcePlanning.createPosition({
        workspace_id: 'workspace-1',
        title: 'Backend Engineer',
        planning_status: 'approved',
      }),
    ).resolves.toEqual(position);
    await expect(
      client.public.workforcePlanning.updatePosition('position-1', {
        workspace_id: 'workspace-1',
        expected_version: 1,
        team: 'Platform',
      }),
    ).resolves.toEqual(position);
    await expect(
      client.public.workforcePlanning.setPositionJob('position-1', {
        workspace_id: 'workspace-1',
        expected_version: 2,
        job_id: 'job-uuid',
      }),
    ).resolves.toEqual(position);
    await expect(
      client.public.workforcePlanning.setPositionOccupant('position-1', {
        workspace_id: 'workspace-1',
        expected_version: 3,
        employee_id: 'EMP-1',
        source_applicant_id: 'applicant-uuid',
      }),
    ).resolves.toEqual(position);

    expect(calls).toEqual(
      expect.arrayContaining([
        {
          method: 'GET',
          url: 'http://localhost:5000/api/v2/public/job-postings?workspace_id=workspace-1&search=Backend&usage_status=active&limit=25',
          body: undefined,
        },
        {
          method: 'POST',
          url: 'http://localhost:5000/api/v2/public/job-postings?workspace_id=workspace-1',
          body: { properties: { name: 'Backend Engineer' } },
        },
        {
          method: 'PATCH',
          url: 'http://localhost:5000/api/v2/public/job-postings/JOB-1?workspace_id=workspace-1',
          body: { properties: { status: 'closed' } },
        },
        {
          method: 'POST',
          url: 'http://localhost:5000/api/v2/public/job-postings/JOB-1/archive',
          body: undefined,
        },
        {
          method: 'GET',
          url: 'http://localhost:5000/api/v2/public/workforce-planning/organization?workspace_id=workspace-1',
          body: undefined,
        },
        {
          method: 'PUT',
          url: 'http://localhost:5000/api/v2/public/workforce-planning/positions/position-1/job?workspace_id=workspace-1',
          body: { expected_version: 2, job_id: 'job-uuid' },
        },
      ]),
    );
  });
});
