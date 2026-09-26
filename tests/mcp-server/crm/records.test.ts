import {
  crmAggregateRecordsTool,
  crmArchiveCustomObjectRecordTool,
  crmCreateAssociationTool,
  crmCreateCustomObjectRecordTool,
  crmDeleteAssociationTool,
  crmListAssociationsTool,
  crmMergeRecordsTool,
  crmPreviewRecordMergeTool,
  crmQueryRecordsTool,
  crmUpdateCustomObjectRecordTool,
} from '../../../packages/mcp-server/src/crm-tools';
import {
  describeV2Requests,
  firstTextContent,
  oauthContext,
  sendThroughSDK,
  type V2RequestCase,
} from './helpers';

const v2Requests: V2RequestCase[] = [
  {
    name: 'creates an association with a label',
    tool: crmCreateAssociationTool,
    args: {
      source_object: 'companies',
      source_id: 'company-1',
      target_object: 'contacts',
      target_id: 'contact-1',
      label_id: 'label-1',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/public/associations',
        body: {
          source_ref: { object_type: 'companies', record_id: 'company-1' },
          target_ref: { object_type: 'contacts', record_id: 'contact-1' },
          definition_id: 'label-1',
        },
      },
    ],
  },
  {
    name: 'deletes an association by source and target refs in the given workspace',
    tool: crmDeleteAssociationTool,
    args: {
      source_object: 'companies',
      source_id: 'company-1',
      target_object: 'contacts',
      target_id: 'contact-1',
      label_id: 'label-1',
      workspace_id: 'workspace-1',
    },
    expectedRequests: [
      {
        method: 'DELETE',
        url: 'http://localhost:5000/api/v2/public/associations?workspace_id=workspace-1',
        body: {
          source_ref: { object_type: 'companies', record_id: 'company-1' },
          target_ref: { object_type: 'contacts', record_id: 'contact-1' },
          definition_id: 'label-1',
        },
      },
    ],
  },
  {
    name: 'deletes an association by id under its source record',
    tool: crmDeleteAssociationTool,
    args: { association_id: 'association-1', source_object: 'companies', source_id: 'company-1' },
    expectedRequests: [
      {
        method: 'DELETE',
        url: 'http://localhost:5000/api/v2/records/companies/company-1/associations/association-1',
      },
    ],
  },
  {
    name: 'deletes an association by id under its target custom object record',
    tool: crmDeleteAssociationTool,
    args: {
      association_id: 'association-1',
      target_object: 'custom_objects',
      target_id: 'record-1',
      target_custom_object_id: 'custom-object-1',
    },
    expectedRequests: [
      {
        method: 'DELETE',
        url: 'http://localhost:5000/api/v2/records/custom_objects/record-1/associations/association-1?custom_object_id=custom-object-1',
      },
    ],
  },
];

describe('CRM record query, merge, and association tools', () => {
  it('passes dedupe candidate arguments through query_records', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'companies',
      scope: 'sanka',
      count: 1,
      total: 1,
      page: 1,
      limit: 5,
      metrics: { candidate_count: 1, scanned_count: 20 },
      data: [{ match_key: 'name:acme', count: 2, record_ids: ['company-1', 'company-2'] }],
      message: 'OK',
    });

    const result = await crmQueryRecordsTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_type: 'companies',
        mode: 'dedupe_candidates',
        match_fields: ['name'],
        min_count: 2,
        scan_limit: 20,
        limit: 5,
        select: ['id', 'name', 'external_id'],
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/records/query', {
      body: {
        object_type: 'companies',
        mode: 'dedupe_candidates',
        match_fields: ['name'],
        page: 1,
        limit: 5,
        min_count: 2,
        scan_limit: 20,
        select: ['id', 'name', 'external_id'],
      },
    });
    expect(result.content[0]).toEqual(
      expect.objectContaining({
        text: expect.stringContaining('query_records found 1 duplicate candidate groups for companies.'),
      }),
    );
    expect((result.content[0] as any).text).toContain('company-1');
  });

  it('passes merge plan arguments through preview_record_merge', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'company',
      status: 'dry_run',
      merge_plan: {
        primary_record: { id: 'company-1', label: 'ADVATEC' },
        duplicate_records: [{ id: 'company-2', label: '株式会社ADVATEC' }],
        archive_merged_records: true,
        required_confirmation: true,
      },
      field_plan: [{ field: 'email', selected_value: 'hello@example.com', will_change: true }],
      related_record_plan: { reverse_relation_rows: 1 },
      message: 'Record merge preview generated',
    });

    const result = await crmPreviewRecordMergeTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_type: 'companies',
        canonical_record_id: 'company-1',
        duplicate_record_ids: ['company-2'],
        field_resolution: {
          email: { source_record_id: 'company-2' },
        },
        confirm: true,
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/records/merge/preview', {
      body: {
        object_type: 'companies',
        primary_record_id: 'company-1',
        duplicate_record_ids: ['company-2'],
        field_resolution: {
          email: { source_record_id: 'company-2' },
        },
        dry_run: true,
      },
    });
    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        status: 'dry_run',
        merge_plan: expect.objectContaining({
          primary_record: expect.objectContaining({ id: 'company-1' }),
        }),
      }),
    );
    expect((result.content[0] as any).text).toContain(
      'preview_record_merge planned 1 company duplicate record merge into company-1.',
    );
  });

  it('requires confirmation before merge_records calls the API', async () => {
    const post = jest.fn();

    const result = await crmMergeRecordsTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_type: 'companies',
        primary_record_id: 'company-1',
        duplicate_record_ids: ['company-2'],
      },
    });

    expect(post).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect((result.content[0] as any).text).toContain('`confirm=true` is required');
  });

  it('passes confirmed merge arguments through merge_records', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'company',
      status: 'merged',
      merge_plan: {
        primary_record: { id: 'company-1', label: 'ADVATEC' },
        duplicate_records: [{ id: 'company-2', label: '株式会社ADVATEC' }],
        archive_merged_records: true,
      },
      field_plan: [{ field: 'email', selected_value: 'hello@example.com', will_change: true }],
      related_record_plan: { reverse_relation_rows: 1 },
      result: {
        stats: { records_merged: 1, reverse_relations_relinked: 1 },
        archived_record_ids: ['company-2'],
      },
      audit: { app_log_id: 10, action: 'merge' },
      message: 'Record merge applied',
    });

    const result = await crmMergeRecordsTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_type: 'companies',
        primary_record_id: 'company-1',
        duplicate_record_ids: ['company-2'],
        archive_merged_records: true,
        confirm: true,
        reason: 'approved by user',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/records/merge/apply', {
      body: {
        object_type: 'companies',
        primary_record_id: 'company-1',
        duplicate_record_ids: ['company-2'],
        archive_merged_records: true,
        confirm: true,
        reason: 'approved by user',
      },
    });
    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        status: 'merged',
        result: expect.objectContaining({
          archived_record_ids: ['company-2'],
        }),
      }),
    );
    expect((result.content[0] as any).text).toContain(
      'merge_records merged 1 company duplicate record merge into company-1.',
    );
  });

  it('passes Sanka custom object row arguments through query_records', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'custom_objects',
      scope: 'sanka',
      external_object_type: 'activity',
      custom_object: { id: 'custom-object-1', name: 'Activity', slug: 'activity' },
      count: 1,
      total: 1,
      page: 1,
      limit: 10,
      data: [{ id: 'row-1', row_id: 5, fields: { Subject: 'Kickoff meeting' } }],
      message: 'OK',
    });

    const result = await crmQueryRecordsTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_type: 'custom_objects',
        custom_object_slug: 'activity',
        select: ['id', 'row_id', 'Subject', 'fields'],
        filters: [{ field: 'Subject', operator: 'contains', value: 'Kickoff' }],
        limit: 10,
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/records/query', {
      body: {
        object_type: 'custom_objects',
        external_object_type: 'activity',
        select: ['id', 'row_id', 'Subject', 'fields'],
        filters: [{ field: 'Subject', operator: 'contains', value: 'Kickoff' }],
        page: 1,
        limit: 10,
      },
    });
    expect(result.content[0]).toEqual(
      expect.objectContaining({
        text: expect.stringContaining('query_records returned 1 of 1 custom_objects records.'),
      }),
    );
    expect((result.content[0] as any).text).toContain('Kickoff meeting');
    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        results: [{ id: 'row-1', row_id: 5, fields: { Subject: 'Kickoff meeting' } }],
      }),
    );
  });

  it('routes provider-only record queries through the V2 integration route', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'deals',
      provider: 'hubspot',
      count: 1,
      total: 1,
      page: 1,
      limit: 10,
      data: [{ id: 'deal-1', name: 'Renewal' }],
      message: 'OK',
    });

    const result = await crmQueryRecordsTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_type: 'deals',
        provider: 'hubspot',
        select: ['id', 'name'],
        limit: 10,
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/records/query', {
      body: {
        object_type: 'deals',
        provider: 'hubspot',
        select: ['id', 'name'],
        page: 1,
        limit: 10,
      },
    });
    expect(result.structuredContent).toMatchObject({
      provider: 'hubspot',
      results: [{ id: 'deal-1', name: 'Renewal' }],
    });
  });

  it('passes Sanka custom object row arguments through aggregate_records', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'custom_objects',
      scope: 'sanka',
      external_object_type: 'activity',
      custom_object: { id: 'custom-object-1', name: 'Activity', slug: 'activity' },
      metrics: { count: 2 },
      groups: [{ Status: 'Open', count: 2 }],
      message: 'OK',
    });

    const result = await crmAggregateRecordsTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_type: 'custom_objects',
        custom_object: 'activity',
        group_by: ['Status'],
        limit: 10,
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/records/aggregate', {
      body: {
        object_type: 'custom_objects',
        external_object_type: 'activity',
        metrics: ['count'],
        group_by: ['Status'],
        limit: 10,
      },
    });
    expect(result.content[0]).toEqual(
      expect.objectContaining({
        text: 'aggregate_records count for custom_objects: 2',
      }),
    );
    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        groups: [{ Status: 'Open', count: 2 }],
      }),
    );
  });

  it('passes create_custom_object_record arguments through public records API', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        id: 'row-1',
        row_id: 5,
        status: 'active',
      },
      message: 'OK',
    });

    const result = await crmCreateCustomObjectRecordTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        custom_object_slug: 'activity',
        Subject: 'Kickoff meeting',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/records/custom-objects/records', {
      body: {
        external_object_type: 'activity',
        data: { Subject: 'Kickoff meeting' },
      },
    });
    expect(result.content[0]).toEqual(
      expect.objectContaining({
        text: 'create_custom_object_record created custom object record row-1.',
      }),
    );
    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ id: 'row-1', status: 'active' }),
      }),
    );
  });

  it('passes update_custom_object_record arguments through public records API', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        id: 'row-1',
        row_id: 5,
        status: 'active',
      },
      message: 'OK',
    });

    const result = await crmUpdateCustomObjectRecordTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        record_id: 'row-1',
        data: { subject: 'Customer kickoff updated' },
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/records/custom-objects/records/row-1', {
      body: {
        data: { subject: 'Customer kickoff updated' },
      },
    });
    expect(result.content[0]).toEqual(
      expect.objectContaining({
        text: 'update_custom_object_record updated custom object record row-1.',
      }),
    );
  });

  it('passes archive_custom_object_record arguments through public records API', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        id: 'row-1',
        row_id: 5,
        status: 'archived',
      },
      message: 'OK',
    });

    const result = await crmArchiveCustomObjectRecordTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        record_id: 'row-1',
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/records/custom-objects/records/row-1/archive', {
      body: {},
    });
    expect(result.content[0]).toEqual(
      expect.objectContaining({
        text: 'archive_custom_object_record archived custom object record row-1.',
      }),
    );
  });

  it('passes dedupe candidate arguments through aggregate_records', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'companies',
      scope: 'integration',
      provider: 'hubspot',
      metrics: { candidate_count: 1, scanned_count: 50 },
      groups: [{ match_key: 'name:acme', count: 2, external_ids: ['hs-1', 'hs-2'] }],
      message: 'OK',
    });

    const result = await crmAggregateRecordsTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_type: 'companies',
        scope: 'integration',
        provider: 'hubspot',
        mode: 'dedupe_candidates',
        match_fields: ['name'],
        scan_limit: 50,
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/public/records/aggregate', {
      body: {
        object_type: 'companies',
        scope: 'integration',
        provider: 'hubspot',
        metrics: ['count'],
        mode: 'dedupe_candidates',
        match_fields: ['name'],
        limit: 25,
        scan_limit: 50,
      },
    });
    expect(result.content[0]).toEqual(
      expect.objectContaining({
        text: 'aggregate_records found 1 duplicate candidate groups for companies.',
      }),
    );
  });

  // An association edge as the V2 API returns it.
  const associationEdge = (id: string) => ({
    id,
    workspace_id: 'workspace-1',
    definition_id: 'label-1',
    source_ref: { object_type: 'company', record_id: 'company-1', custom_object_id: null },
    target_ref: { object_type: 'contact', record_id: 'contact-1', custom_object_id: null },
    direction: 'target',
    label: 'Primary contact',
    display_label: 'Acme',
    created_at: '2026-09-20T00:00:00Z',
    meta: {},
  });

  it('lists the associations of a target record in the given workspace, filtered by label', async () => {
    const { requests, result } = await sendThroughSDK({
      tool: crmListAssociationsTool,
      args: {
        target_object: 'contacts',
        target_id: 'contact-1',
        label: 'Primary contact',
        workspace_id: 'workspace-1',
        limit: 1,
      },
      response: {
        record_ref: { object_type: 'contact', record_id: 'contact-1', custom_object_id: null },
        items: [associationEdge('association-1'), associationEdge('association-2')],
        page: 1,
        page_size: 100,
        total: 2,
        meta: {},
      },
    });

    expect(requests).toEqual([
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/public/associations?source_object_type=contacts&source_record_id=contact-1&q=Primary%20contact&workspace_id=workspace-1',
      },
    ]);
    expect(result.structuredContent).toMatchObject({
      count: 1,
      total: 2,
      has_next: true,
      results: [
        {
          id: 'association-1',
          source: { object_type: 'company', id: 'company-1' },
          target: { object_type: 'contact', id: 'contact-1' },
          label: { id: 'label-1', label: 'Primary contact' },
        },
      ],
    });
  });

  it('reports the id of the association create_association created', async () => {
    const { result } = await sendThroughSDK({
      tool: crmCreateAssociationTool,
      args: {
        source_object: 'companies',
        source_id: 'company-1',
        target_object: 'contacts',
        target_id: 'contact-1',
        label_id: 'label-1',
      },
      response: {
        edge: associationEdge('association-1'),
        edges: [],
        edge_ids: [],
        created: true,
        deleted: false,
      },
    });

    expect(firstTextContent(result)).toContain('association-1');
    expect(result.structuredContent).toMatchObject({ association: { id: 'association-1' }, created: true });
  });

  it('rejects query_records filter entries that are missing a string field', async () => {
    const post = jest.fn();

    const result = await crmQueryRecordsTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_type: 'companies',
        filters: [{ operator: 'equals', value: 'Tokyo' }],
      },
    });

    expect(post).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(firstTextContent(result)).toContain('filters[0] is missing a non-empty string `field`');
    expect(firstTextContent(result)).toContain('the query was not executed');
  });

  it('rejects query_records filters that are not an array', async () => {
    const post = jest.fn();

    const result = await crmQueryRecordsTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_type: 'companies',
        filters: 'address is empty',
      },
    });

    expect(post).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(firstTextContent(result)).toContain('`filters` must be an array');
  });

  it('rejects aggregate_records filter entries that are not objects', async () => {
    const post = jest.fn();

    const result = await crmAggregateRecordsTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_type: 'companies',
        filters: ['address'],
      },
    });

    expect(post).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(firstTextContent(result)).toContain('filters[0] must be an object');
  });

  it('clamps query_records limit to the schema maximum', async () => {
    const post = jest.fn().mockResolvedValue({
      object_type: 'companies',
      count: 0,
      total: 0,
      page: 1,
      limit: 100,
      data: [],
      message: 'OK',
    });

    await crmQueryRecordsTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_type: 'companies',
        limit: 500,
      },
    });

    expect(post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.objectContaining({ limit: 100 }),
      }),
    );
  });

  it.each([
    ['neither an association id nor both records', {}],
    ['an association id without a record it links', { association_id: 'association-1' }],
  ])('rejects delete_association with %s before sending a request', async (_case, args) => {
    const { requests, result } = await sendThroughSDK({ tool: crmDeleteAssociationTool, args });

    expect(result.isError).toBe(true);
    expect(requests).toEqual([]);
  });

  describeV2Requests(v2Requests);
});
