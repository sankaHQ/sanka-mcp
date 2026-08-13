import type { Applicants, Interviews, JobPostings, PublicTalentRecordListParams } from 'sanka-sdk';
import { asErrorResult, McpTool, ToolCallResult } from './types';
import { requireAuthentication } from './tool-auth';

type RecruitingResource = JobPostings | Applicants | Interviews;
type RecruitingClientKey = 'jobPostings' | 'applicants' | 'interviews';

type RecruitingToolDefinition = {
  clientKey: RecruitingClientKey;
  plural: string;
  singular: string;
  titlePlural: string;
  titleSingular: string;
  path: string;
  operationSuffix: string;
};

const RECRUITING_DEFINITIONS: RecruitingToolDefinition[] = [
  {
    clientKey: 'jobPostings',
    plural: 'job_postings',
    singular: 'job_posting',
    titlePlural: 'job postings',
    titleSingular: 'job posting',
    path: '/api/v2/public/job-postings',
    operationSuffix: 'job_posting',
  },
  {
    clientKey: 'applicants',
    plural: 'applicants',
    singular: 'applicant',
    titlePlural: 'applicants',
    titleSingular: 'applicant',
    path: '/api/v2/public/applicants',
    operationSuffix: 'applicant',
  },
  {
    clientKey: 'interviews',
    plural: 'interviews',
    singular: 'interview',
    titlePlural: 'interviews',
    titleSingular: 'interview',
    path: '/api/v2/public/interviews',
    operationSuffix: 'interview',
  },
];

const WORKSPACE_PROPERTY = {
  workspace_id: {
    type: 'string',
    description: 'Optional workspace UUID. Omit to use the current authenticated workspace.',
  },
};

const LANGUAGE_PROPERTIES = {
  language: {
    type: 'string',
    description: 'Optional response language hint, such as en or ja.',
  },
};

const RECORD_REF_PROPERTY = {
  record_ref: {
    type: 'string',
    minLength: 1,
    description: 'Record UUID or display record id.',
  },
};

const PROPERTIES_SCHEMA = {
  type: 'object' as const,
  description: 'Object property values keyed by the public property id or standard property key.',
  additionalProperties: true,
};

const RECORD_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {},
  additionalProperties: true,
};

const RECORD_LIST_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    object_type: { type: 'string' },
    items: { type: 'array', items: RECORD_OUTPUT_SCHEMA },
    page: { type: 'integer' },
    page_size: { type: 'integer' },
    total: { type: 'integer' },
    next_cursor: { type: ['string', 'null'] as any },
  },
  required: ['object_type', 'items', 'page', 'page_size', 'total'],
  additionalProperties: true,
};

const RECORD_LIST_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...WORKSPACE_PROPERTY,
    ...LANGUAGE_PROPERTIES,
    view_id: { type: 'string', description: 'Optional saved view UUID.' },
    search: { type: 'string', description: 'Free-text record search.' },
    status: { type: 'string', description: 'Object-specific record status.' },
    usage_status: {
      type: 'string',
      enum: ['active', 'archived'],
      description: 'Lifecycle state. Defaults to active.',
    },
    filters: {
      description: 'Structured record filters or their JSON string representation.',
      anyOf: [{ type: 'array' }, { type: 'object' }, { type: 'string' }],
    },
    page: { type: 'integer', minimum: 1, description: 'Page number.' },
    limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Records per page.' },
    cursor: { type: 'string', description: 'Cursor returned by a previous request.' },
    sort: {
      type: 'string',
      description: 'Property key to sort ascending, or prefix it with - for descending.',
    },
    created_at_from: { type: 'string', description: 'ISO timestamp or YYYY-MM-DD lower bound.' },
    created_at_to: { type: 'string', description: 'ISO timestamp or YYYY-MM-DD upper bound.' },
    updated_at_from: { type: 'string', description: 'ISO timestamp or YYYY-MM-DD lower bound.' },
    updated_at_to: { type: 'string', description: 'ISO timestamp or YYYY-MM-DD upper bound.' },
  },
  additionalProperties: false,
};

const RECORD_RETRIEVE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...RECORD_REF_PROPERTY,
    ...WORKSPACE_PROPERTY,
    ...LANGUAGE_PROPERTIES,
  },
  required: ['record_ref'],
  additionalProperties: false,
};

const RECORD_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    properties: PROPERTIES_SCHEMA,
    view_id: { type: 'string' },
    form_view_id: { type: 'string' },
    cost_line_items: { type: 'array', items: {} },
    line_items: { type: 'array', items: {} },
    ...WORKSPACE_PROPERTY,
    ...LANGUAGE_PROPERTIES,
  },
  required: ['properties'],
  additionalProperties: false,
};

const RECORD_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ...RECORD_REF_PROPERTY,
    properties: PROPERTIES_SCHEMA,
    view_id: { type: 'string' },
    form_view_id: { type: 'string' },
    associations: { type: 'array', items: { type: 'object', additionalProperties: true } },
    cost_line_items: { type: 'array', items: {} },
    files: { type: 'array', items: { type: 'object', additionalProperties: true } },
    line_items: { type: 'array', items: {} },
    ...WORKSPACE_PROPERTY,
    ...LANGUAGE_PROPERTIES,
  },
  required: ['record_ref'],
  additionalProperties: false,
};

const readString = (value: unknown): string | undefined => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
};

const readInteger = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) ? value : undefined;

const readNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const readObject = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ?
    (value as Record<string, unknown>)
  : undefined;

const hasOwn = (args: Record<string, unknown> | undefined, key: string): boolean =>
  args != null && Object.prototype.hasOwnProperty.call(args, key);

const copyOwn = (args: Record<string, unknown> | undefined, keys: string[]): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  for (const key of keys) {
    if (hasOwn(args, key)) {
      body[key] = args?.[key];
    }
  }
  return body;
};

const buildContextParams = (args: Record<string, unknown> | undefined) => {
  const workspaceID = readString(args?.['workspace_id']);
  const language = readString(args?.['language']);
  return {
    ...(workspaceID ? { workspace_id: workspaceID } : undefined),
    ...(language ? { 'X-Language': language } : undefined),
  };
};

const recruitingResource = (
  reqContext: Parameters<McpTool['handler']>[0]['reqContext'],
  clientKey: RecruitingClientKey,
): RecruitingResource => reqContext.client.public[clientKey];

const recordResult = (label: string, action: string, record: Record<string, unknown>): ToolCallResult => {
  const id = readString(record['record_id']) ?? readString(record['id']) ?? 'unknown';
  return {
    content: [{ type: 'text', text: `${label} ${action}: ${id}` }],
    structuredContent: record,
  };
};

const defineRecruitingListTool = (definition: RecruitingToolDefinition): McpTool => ({
  metadata: {
    resource: definition.plural,
    operation: 'read',
    tags: ['talent', 'recruiting', definition.plural],
    httpMethod: 'get',
    httpPath: definition.path,
    operationId: `list_public_${definition.plural}`,
  },
  tool: {
    name: `list_${definition.plural}`,
    title: `List ${definition.titlePlural}`,
    description: `Search and review ${definition.titlePlural} in Sanka.`,
    inputSchema: RECORD_LIST_INPUT_SCHEMA,
    outputSchema: RECORD_LIST_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: `List ${definition.titlePlural}`,
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: `List ${definition.titlePlural}` });
    if (authError) return authError;

    const filters = args?.['filters'];
    const listParams: PublicTalentRecordListParams = buildContextParams(args);
    const viewID = readString(args?.['view_id']);
    const search = readString(args?.['search']);
    const status = readString(args?.['status']);
    const usageStatus = readString(args?.['usage_status']);
    const page = readInteger(args?.['page']);
    const limit = readInteger(args?.['limit']);
    const cursor = readString(args?.['cursor']);
    const sort = readString(args?.['sort']);
    const createdAtFrom = readString(args?.['created_at_from']);
    const createdAtTo = readString(args?.['created_at_to']);
    const updatedAtFrom = readString(args?.['updated_at_from']);
    const updatedAtTo = readString(args?.['updated_at_to']);
    if (viewID) listParams.view_id = viewID;
    if (search) listParams.search = search;
    if (status) listParams.status = status;
    if (usageStatus) listParams.usage_status = usageStatus as 'active' | 'archived';
    if (filters !== undefined)
      listParams.filters = typeof filters === 'string' ? filters : JSON.stringify(filters);
    if (page) listParams.page = page;
    if (limit) listParams.limit = limit;
    if (cursor) listParams.cursor = cursor;
    if (sort) listParams.sort = sort;
    if (createdAtFrom) listParams.created_at_from = createdAtFrom;
    if (createdAtTo) listParams.created_at_to = createdAtTo;
    if (updatedAtFrom) listParams.updated_at_from = updatedAtFrom;
    if (updatedAtTo) listParams.updated_at_to = updatedAtTo;
    const payload = await recruitingResource(reqContext, definition.clientKey).list(listParams);
    return {
      content: [{ type: 'text', text: `Found ${payload.total} ${definition.titlePlural}.` }],
      structuredContent: payload as unknown as Record<string, unknown>,
    };
  },
});

const defineRecruitingRetrieveTool = (definition: RecruitingToolDefinition): McpTool => ({
  metadata: {
    resource: definition.plural,
    operation: 'read',
    tags: ['talent', 'recruiting', definition.plural],
    httpMethod: 'get',
    httpPath: `${definition.path}/{record_ref}`,
    operationId: `get_public_${definition.operationSuffix}`,
  },
  tool: {
    name: `get_${definition.singular}`,
    title: `Get ${definition.titleSingular}`,
    description: `Load one ${definition.titleSingular} by UUID or display id.`,
    inputSchema: RECORD_RETRIEVE_INPUT_SCHEMA,
    outputSchema: RECORD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: `Get ${definition.titleSingular}`,
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: `Get ${definition.titleSingular}` });
    if (authError) return authError;
    const recordRef = readString(args?.['record_ref']);
    if (!recordRef) return asErrorResult('`record_ref` is required.');
    const record = await recruitingResource(reqContext, definition.clientKey).retrieve(
      recordRef,
      buildContextParams(args),
    );
    return recordResult(definition.titleSingular, 'loaded', record as unknown as Record<string, unknown>);
  },
});

const defineRecruitingCreateTool = (definition: RecruitingToolDefinition): McpTool => ({
  metadata: {
    resource: definition.plural,
    operation: 'write',
    tags: ['talent', 'recruiting', definition.plural],
    httpMethod: 'post',
    httpPath: definition.path,
    operationId: `create_public_${definition.operationSuffix}`,
  },
  tool: {
    name: `create_${definition.singular}`,
    title: `Create ${definition.titleSingular}`,
    description: `Create a ${definition.titleSingular} using Sanka object property keys.`,
    inputSchema: RECORD_CREATE_INPUT_SCHEMA,
    outputSchema: RECORD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: `Create ${definition.titleSingular}`,
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: `Create ${definition.titleSingular}` });
    if (authError) return authError;
    const properties = readObject(args?.['properties']);
    if (!properties || Object.keys(properties).length === 0) {
      return asErrorResult('`properties` must contain at least one property.');
    }
    const record = await recruitingResource(reqContext, definition.clientKey).create({
      ...buildContextParams(args),
      ...copyOwn(args, ['view_id', 'form_view_id', 'cost_line_items', 'line_items']),
      properties,
    });
    return recordResult(definition.titleSingular, 'created', record as unknown as Record<string, unknown>);
  },
});

const defineRecruitingUpdateTool = (definition: RecruitingToolDefinition): McpTool => ({
  metadata: {
    resource: definition.plural,
    operation: 'write',
    tags: ['talent', 'recruiting', definition.plural],
    httpMethod: 'patch',
    httpPath: `${definition.path}/{record_ref}`,
    operationId: `update_public_${definition.operationSuffix}`,
  },
  tool: {
    name: `update_${definition.singular}`,
    title: `Update ${definition.titleSingular}`,
    description: `Update a ${definition.titleSingular} using Sanka object property keys.`,
    inputSchema: RECORD_UPDATE_INPUT_SCHEMA,
    outputSchema: RECORD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: `Update ${definition.titleSingular}`,
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: `Update ${definition.titleSingular}` });
    if (authError) return authError;
    const recordRef = readString(args?.['record_ref']);
    if (!recordRef) return asErrorResult('`record_ref` is required.');
    const changes = copyOwn(args, [
      'properties',
      'view_id',
      'form_view_id',
      'associations',
      'cost_line_items',
      'files',
      'line_items',
    ]);
    if (Object.keys(changes).length === 0) return asErrorResult('At least one update field is required.');
    const record = await recruitingResource(reqContext, definition.clientKey).update(recordRef, {
      ...buildContextParams(args),
      ...changes,
    });
    return recordResult(definition.titleSingular, 'updated', record as unknown as Record<string, unknown>);
  },
});

const defineRecruitingLifecycleTool = (
  definition: RecruitingToolDefinition,
  action: 'archive' | 'activate',
): McpTool => ({
  metadata: {
    resource: definition.plural,
    operation: 'write',
    tags: ['talent', 'recruiting', definition.plural],
    httpMethod: 'post',
    httpPath: `${definition.path}/{record_ref}/${action}`,
    operationId: `${action}_public_${definition.operationSuffix}`,
  },
  tool: {
    name: `${action}_${definition.singular}`,
    title: `${action === 'archive' ? 'Archive' : 'Activate'} ${definition.titleSingular}`,
    description:
      action === 'archive' ?
        `Archive a ${definition.titleSingular} without permanently deleting it.`
      : `Reactivate an archived ${definition.titleSingular}.`,
    inputSchema: RECORD_RETRIEVE_INPUT_SCHEMA,
    outputSchema: RECORD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: `${action === 'archive' ? 'Archive' : 'Activate'} ${definition.titleSingular}`,
      readOnlyHint: false,
      destructiveHint: action === 'archive',
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const title = `${action === 'archive' ? 'Archive' : 'Activate'} ${definition.titleSingular}`;
    const authError = requireAuthentication({ reqContext, toolTitle: title });
    if (authError) return authError;
    const recordRef = readString(args?.['record_ref']);
    if (!recordRef) return asErrorResult('`record_ref` is required.');
    const resource = recruitingResource(reqContext, definition.clientKey);
    const record =
      action === 'archive' ?
        await resource.archive(recordRef, buildContextParams(args))
      : await resource.activate(recordRef, buildContextParams(args));
    return recordResult(
      definition.titleSingular,
      action === 'archive' ? 'archived' : 'activated',
      record as unknown as Record<string, unknown>,
    );
  },
});

const POSITION_FIELDS = {
  title: { type: 'string', minLength: 1, maxLength: 255 },
  parent_position_id: { type: ['string', 'null'] as any },
  department: { type: ['string', 'null'] as any, maxLength: 255 },
  team: { type: ['string', 'null'] as any, maxLength: 255 },
  level: { type: ['string', 'null'] as any, maxLength: 128 },
  location: { type: ['string', 'null'] as any, maxLength: 255 },
  employment_type: { type: ['string', 'null'] as any, maxLength: 64 },
  fte: { type: ['number', 'null'] as any, exclusiveMinimum: 0, maximum: 10 },
  target_start_date: { type: ['string', 'null'] as any, format: 'date' },
  planning_status: { type: ['string', 'null'] as any, enum: ['draft', 'approved', 'cancelled', null] },
  job_id: { type: ['string', 'null'] as any },
  employee_id: { type: ['string', 'null'] as any },
};

const ORGANIZATION_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: WORKSPACE_PROPERTY,
  additionalProperties: false,
};

const POSITION_CREATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: { ...POSITION_FIELDS, ...WORKSPACE_PROPERTY },
  required: ['title'],
  additionalProperties: false,
};

const POSITION_UPDATE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    position_id: { type: 'string', description: 'Organization position UUID.' },
    expected_version: { type: 'integer', minimum: 1 },
    ...POSITION_FIELDS,
    ...WORKSPACE_PROPERTY,
  },
  required: ['position_id', 'expected_version'],
  additionalProperties: false,
};

const POSITION_LINK_JOB_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    position_id: { type: 'string', description: 'Organization position UUID.' },
    expected_version: { type: 'integer', minimum: 1 },
    job_id: {
      type: ['string', 'null'] as any,
      description: 'Job posting UUID. Pass null to remove the current job link.',
    },
    ...WORKSPACE_PROPERTY,
  },
  required: ['position_id', 'expected_version'],
  additionalProperties: false,
};

const POSITION_SET_OCCUPANT_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    position_id: { type: 'string', description: 'Organization position UUID.' },
    expected_version: { type: 'integer', minimum: 1 },
    employee_id: {
      type: ['string', 'null'] as any,
      description: 'Employee record id. Pass null to clear the occupant.',
    },
    source_applicant_id: {
      type: ['string', 'null'] as any,
      description: 'Optional applicant UUID that resulted in this placement.',
    },
    ...WORKSPACE_PROPERTY,
  },
  required: ['position_id', 'expected_version'],
  additionalProperties: false,
};

const ORGANIZATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    can_manage_occupants: { type: 'boolean' },
    nodes: { type: 'array', items: RECORD_OUTPUT_SCHEMA },
    unassigned_jobs: { type: 'array', items: RECORD_OUTPUT_SCHEMA },
    summary: { type: 'object', additionalProperties: true },
  },
  required: ['can_manage_occupants', 'nodes', 'unassigned_jobs', 'summary'],
  additionalProperties: true,
};

const positionResult = (action: string, position: Record<string, unknown>): ToolCallResult => ({
  content: [
    {
      type: 'text',
      text: `Organization position ${action}: ${
        readString(position['title']) ?? readString(position['id']) ?? 'unknown'
      }`,
    },
  ],
  structuredContent: position,
});

export const getWorkforceOrganizationTool: McpTool = {
  metadata: {
    resource: 'org_positions',
    operation: 'read',
    tags: ['talent', 'workforce-planning', 'org-chart'],
    httpMethod: 'get',
    httpPath: '/api/v2/public/workforce-planning/organization',
    operationId: 'get_public_workforce_organization',
  },
  tool: {
    name: 'get_workforce_organization',
    title: 'Get workforce organization',
    description: 'Load the planned organization chart, staffing phases, and unassigned job postings.',
    inputSchema: ORGANIZATION_INPUT_SCHEMA,
    outputSchema: ORGANIZATION_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get workforce organization',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Get workforce organization' });
    if (authError) return authError;
    const organization = await reqContext.client.public.workforcePlanning.retrieveOrganization(
      buildContextParams(args),
    );
    return {
      content: [
        {
          type: 'text',
          text: `Loaded ${organization.nodes.length} organization positions and ${organization.unassigned_jobs.length} unassigned job postings.`,
        },
      ],
      structuredContent: organization as unknown as Record<string, unknown>,
    };
  },
};

export const createOrgPositionTool: McpTool = {
  metadata: {
    resource: 'org_positions',
    operation: 'write',
    tags: ['talent', 'workforce-planning', 'org-chart'],
    httpMethod: 'post',
    httpPath: '/api/v2/public/workforce-planning/positions',
    operationId: 'create_public_workforce_position',
  },
  tool: {
    name: 'create_org_position',
    title: 'Create organization position',
    description: 'Add a planned position to the ideal organization chart.',
    inputSchema: POSITION_CREATE_INPUT_SCHEMA,
    outputSchema: RECORD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create organization position',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Create organization position' });
    if (authError) return authError;
    const title = readString(args?.['title']);
    if (!title) return asErrorResult('`title` is required.');
    const position = await reqContext.client.public.workforcePlanning.createPosition({
      ...buildContextParams(args),
      ...copyOwn(args, Object.keys(POSITION_FIELDS)),
      title,
    });
    return positionResult('created', position as unknown as Record<string, unknown>);
  },
};

export const updateOrgPositionTool: McpTool = {
  metadata: {
    resource: 'org_positions',
    operation: 'write',
    tags: ['talent', 'workforce-planning', 'org-chart'],
    httpMethod: 'patch',
    httpPath: '/api/v2/public/workforce-planning/positions/{position_id}',
    operationId: 'update_public_workforce_position',
  },
  tool: {
    name: 'update_org_position',
    title: 'Update organization position',
    description: 'Update a planned position using optimistic version control.',
    inputSchema: POSITION_UPDATE_INPUT_SCHEMA,
    outputSchema: RECORD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update organization position',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Update organization position' });
    if (authError) return authError;
    const positionID = readString(args?.['position_id']);
    const expectedVersion = readInteger(args?.['expected_version']);
    if (!positionID) return asErrorResult('`position_id` is required.');
    if (!expectedVersion) return asErrorResult('`expected_version` is required.');
    const changes = copyOwn(args, Object.keys(POSITION_FIELDS));
    if (Object.keys(changes).length === 0) return asErrorResult('At least one position field is required.');
    const position = await reqContext.client.public.workforcePlanning.updatePosition(positionID, {
      ...buildContextParams(args),
      ...changes,
      expected_version: expectedVersion,
    });
    return positionResult('updated', position as unknown as Record<string, unknown>);
  },
};

export const setOrgPositionJobTool: McpTool = {
  metadata: {
    resource: 'org_positions',
    operation: 'write',
    tags: ['talent', 'workforce-planning', 'org-chart'],
    httpMethod: 'put',
    httpPath: '/api/v2/public/workforce-planning/positions/{position_id}/job',
    operationId: 'set_public_workforce_position_job',
  },
  tool: {
    name: 'set_org_position_job',
    title: 'Set organization position job',
    description: 'Attach a job posting to a planned position, or detach it by passing job_id null.',
    inputSchema: POSITION_LINK_JOB_INPUT_SCHEMA,
    outputSchema: RECORD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Set organization position job',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Set organization position job' });
    if (authError) return authError;
    const positionID = readString(args?.['position_id']);
    const expectedVersion = readInteger(args?.['expected_version']);
    if (!positionID) return asErrorResult('`position_id` is required.');
    if (!expectedVersion) return asErrorResult('`expected_version` is required.');
    const position = await reqContext.client.public.workforcePlanning.setPositionJob(positionID, {
      ...buildContextParams(args),
      ...(hasOwn(args, 'job_id') ? { job_id: args?.['job_id'] as string | null } : undefined),
      expected_version: expectedVersion,
    });
    return positionResult('job link updated', position as unknown as Record<string, unknown>);
  },
};

export const setOrgPositionOccupantTool: McpTool = {
  metadata: {
    resource: 'org_positions',
    operation: 'write',
    tags: ['talent', 'workforce-planning', 'org-chart'],
    httpMethod: 'put',
    httpPath: '/api/v2/public/workforce-planning/positions/{position_id}/occupant',
    operationId: 'set_public_workforce_position_occupant',
  },
  tool: {
    name: 'set_org_position_occupant',
    title: 'Set organization position occupant',
    description: 'Assign an employee to a planned position and optionally record the source applicant.',
    inputSchema: POSITION_SET_OCCUPANT_INPUT_SCHEMA,
    outputSchema: RECORD_OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Set organization position occupant',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireAuthentication({ reqContext, toolTitle: 'Set organization position occupant' });
    if (authError) return authError;
    const positionID = readString(args?.['position_id']);
    const expectedVersion = readInteger(args?.['expected_version']);
    if (!positionID) return asErrorResult('`position_id` is required.');
    if (!expectedVersion) return asErrorResult('`expected_version` is required.');
    const position = await reqContext.client.public.workforcePlanning.setPositionOccupant(positionID, {
      ...buildContextParams(args),
      ...copyOwn(args, ['employee_id', 'source_applicant_id']),
      expected_version: expectedVersion,
    });
    return positionResult('occupant updated', position as unknown as Record<string, unknown>);
  },
};

export const talentTools: McpTool[] = [
  ...RECRUITING_DEFINITIONS.flatMap((definition) => [
    defineRecruitingListTool(definition),
    defineRecruitingRetrieveTool(definition),
    defineRecruitingCreateTool(definition),
    defineRecruitingUpdateTool(definition),
    defineRecruitingLifecycleTool(definition, 'archive'),
    defineRecruitingLifecycleTool(definition, 'activate'),
  ]),
  getWorkforceOrganizationTool,
  createOrgPositionTool,
  updateOrgPositionTool,
  setOrgPositionJobTool,
  setOrgPositionOccupantTool,
];
