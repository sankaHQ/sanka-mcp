import { selectTools } from '../../packages/mcp-server/src/server';
import { talentTools } from '../../packages/mcp-server/src/talent-tools';

const oauthContext = () => ({
  authMode: 'oauth_bearer' as const,
  clientOptions: {},
  oauth: {
    authorizationServerUrl: 'https://app.sanka.com',
    resourceMetadataUrl: 'https://mcp.sanka.com/.well-known/oauth-protected-resource',
    resourceUrl: 'https://mcp.sanka.com/mcp',
    scopes: ['mcp:access'],
  },
});

const tool = (name: string) => {
  const found = talentTools.find((candidate) => candidate.tool.name === name);
  if (!found) throw new Error(`Missing talent tool: ${name}`);
  return found;
};

const record = {
  id: 'job-uuid',
  record_id: 'JOB-1',
  object_type: 'job',
  usage_status: 'active',
  properties: { name: 'Backend Engineer' },
  display_properties: {},
};

describe('talent MCP tools', () => {
  it('registers all recruiting and workforce tools in the hosted profile', () => {
    const names = selectTools(undefined, 'hosted').map((candidate) => candidate.tool.name);
    const expected = [
      ...['job_posting', 'applicant', 'interview'].flatMap((resource) => [
        `list_${resource === 'job_posting' ? 'job_postings' : `${resource}s`}`,
        `get_${resource}`,
        `create_${resource}`,
        `update_${resource}`,
        `archive_${resource}`,
        `activate_${resource}`,
      ]),
      'get_workforce_organization',
      'create_org_position',
      'update_org_position',
      'set_org_position_job',
      'set_org_position_occupant',
    ];

    expect(talentTools).toHaveLength(23);
    expect(names).toEqual(expect.arrayContaining(expected));
    expect(tool('archive_job_posting').tool.annotations?.destructiveHint).toBe(true);
    expect(tool('activate_job_posting').tool.annotations?.destructiveHint).toBe(false);
    expect(tool('set_org_position_job').tool.inputSchema.required).toContain('job_id');
    expect(tool('set_org_position_occupant').tool.inputSchema.required).toContain('employee_id');
    expect(tool('update_org_position').tool.inputSchema.required).not.toContain('job_id');
    expect(talentTools.every((candidate) => candidate.tool.securitySchemes?.[0]?.type === 'oauth2')).toBe(
      true,
    );
  });

  it('lists, creates, updates, archives, and activates recruiting records through the SDK resource', async () => {
    const list = jest.fn().mockResolvedValue({
      object_type: 'job',
      view: {},
      columns: [],
      column_labels: {},
      items: [record],
      page: 1,
      page_size: 25,
      total: 1,
      subtotals: [],
      meta: {},
    });
    const create = jest.fn().mockResolvedValue(record);
    const update = jest.fn().mockResolvedValue(record);
    const archive = jest.fn().mockResolvedValue({ ...record, usage_status: 'archived' });
    const activate = jest.fn().mockResolvedValue(record);
    const client = { public: { jobPostings: { list, create, update, archive, activate } } } as any;
    const reqContext = { client, auth: oauthContext() };

    await tool('list_job_postings').handler({
      reqContext,
      args: {
        workspace_id: 'workspace-1',
        search: 'Backend',
        filters: [{ field_id: 'standard:status', operator: 'equals', value: 'open' }],
        limit: 25,
      },
    });
    await tool('create_job_posting').handler({
      reqContext,
      args: { workspace_id: 'workspace-1', properties: { name: 'Backend Engineer' } },
    });
    await tool('update_job_posting').handler({
      reqContext,
      args: { record_ref: 'JOB-1', workspace_id: 'workspace-1', properties: { status: 'closed' } },
    });
    await tool('archive_job_posting').handler({
      reqContext,
      args: { record_ref: 'JOB-1', workspace_id: 'workspace-1' },
    });
    await tool('activate_job_posting').handler({
      reqContext,
      args: { record_ref: 'JOB-1', workspace_id: 'workspace-1' },
    });

    expect(list).toHaveBeenCalledWith({
      workspace_id: 'workspace-1',
      search: 'Backend',
      filters: JSON.stringify([{ field_id: 'standard:status', operator: 'equals', value: 'open' }]),
      limit: 25,
    });
    expect(create).toHaveBeenCalledWith({
      workspace_id: 'workspace-1',
      properties: { name: 'Backend Engineer' },
    });
    expect(update).toHaveBeenCalledWith('JOB-1', {
      workspace_id: 'workspace-1',
      properties: { status: 'closed' },
    });
    expect(archive).toHaveBeenCalledWith('JOB-1', { workspace_id: 'workspace-1' });
    expect(activate).toHaveBeenCalledWith('JOB-1', { workspace_id: 'workspace-1' });
  });

  it('gets organization data and performs version-safe position mutations', async () => {
    const position = { id: 'position-1', title: 'Backend Engineer', version: 2 };
    const retrieveOrganization = jest.fn().mockResolvedValue({
      can_manage_occupants: true,
      nodes: [position],
      unassigned_jobs: [],
      summary: { positions: 1 },
    });
    const createPosition = jest.fn().mockResolvedValue(position);
    const updatePosition = jest.fn().mockResolvedValue(position);
    const setPositionJob = jest.fn().mockResolvedValue(position);
    const setPositionOccupant = jest.fn().mockResolvedValue(position);
    const client = {
      public: {
        workforcePlanning: {
          retrieveOrganization,
          createPosition,
          updatePosition,
          setPositionJob,
          setPositionOccupant,
        },
      },
    } as any;
    const reqContext = { client, auth: oauthContext() };

    await tool('get_workforce_organization').handler({ reqContext, args: { workspace_id: 'workspace-1' } });
    await tool('create_org_position').handler({
      reqContext,
      args: { workspace_id: 'workspace-1', title: 'Backend Engineer', planning_status: 'approved' },
    });
    await tool('update_org_position').handler({
      reqContext,
      args: { workspace_id: 'workspace-1', position_id: 'position-1', expected_version: 1, team: 'Platform' },
    });
    await tool('set_org_position_job').handler({
      reqContext,
      args: {
        workspace_id: 'workspace-1',
        position_id: 'position-1',
        expected_version: 2,
        job_id: 'job-uuid',
      },
    });
    await tool('set_org_position_occupant').handler({
      reqContext,
      args: {
        workspace_id: 'workspace-1',
        position_id: 'position-1',
        expected_version: 3,
        employee_id: 'EMP-1',
        source_applicant_id: 'applicant-uuid',
      },
    });

    expect(retrieveOrganization).toHaveBeenCalledWith({ workspace_id: 'workspace-1' });
    expect(createPosition).toHaveBeenCalledWith({
      workspace_id: 'workspace-1',
      title: 'Backend Engineer',
      planning_status: 'approved',
    });
    expect(updatePosition).toHaveBeenCalledWith('position-1', {
      workspace_id: 'workspace-1',
      expected_version: 1,
      team: 'Platform',
    });
    expect(setPositionJob).toHaveBeenCalledWith('position-1', {
      workspace_id: 'workspace-1',
      expected_version: 2,
      job_id: 'job-uuid',
    });
    expect(setPositionOccupant).toHaveBeenCalledWith('position-1', {
      workspace_id: 'workspace-1',
      expected_version: 3,
      employee_id: 'EMP-1',
      source_applicant_id: 'applicant-uuid',
    });
  });

  it('fails closed without OAuth authentication', async () => {
    const list = jest.fn();
    const result = await tool('list_job_postings').handler({
      reqContext: {
        client: { public: { jobPostings: { list } } } as any,
        auth: { ...oauthContext(), authMode: 'none' },
      },
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(list).not.toHaveBeenCalled();
  });

  it('requires explicit nullable targets before changing organization links', async () => {
    const setPositionJob = jest.fn();
    const setPositionOccupant = jest.fn();
    const reqContext = {
      client: { public: { workforcePlanning: { setPositionJob, setPositionOccupant } } } as any,
      auth: oauthContext(),
    };

    const jobResult = await tool('set_org_position_job').handler({
      reqContext,
      args: { position_id: 'position-1', expected_version: 2 },
    });
    const occupantResult = await tool('set_org_position_occupant').handler({
      reqContext,
      args: { position_id: 'position-1', expected_version: 2 },
    });

    expect(jobResult.isError).toBe(true);
    expect(occupantResult.isError).toBe(true);
    expect(setPositionJob).not.toHaveBeenCalled();
    expect(setPositionOccupant).not.toHaveBeenCalled();
  });
});
