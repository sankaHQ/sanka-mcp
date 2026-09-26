import {
  crmApplyAppBlueprintTool,
  crmApproveRecordApprovalTool,
  crmCreateApprovalRequestTool,
  crmCreatePermissionSetTool,
  crmCreatePropertyTool,
  crmDeleteDeliveryRuleTool,
  crmDeletePropertyTool,
  crmDeleteReportTool,
  crmDeleteViewTool,
  crmGetDeliveryRuleOptionsTool,
  crmGetPermissionSetEditorTool,
  crmGetPropertyTool,
  crmGetReportTool,
  crmGetViewColumnsTool,
  crmGetViewTool,
  crmListAppBlueprintTemplatesTool,
  crmListApprovalRulesTool,
  crmListObjectSchemasTool,
  crmListPermissionSetsTool,
  crmListPropertiesTool,
  crmListRecordApprovalsTool,
  crmMutateObjectSchemaTool,
  crmPreviewAppBlueprintTool,
  crmRejectRecordApprovalTool,
  crmUpdatePermissionSetTool,
  crmUpdatePropertyTool,
  crmUpdateViewTool,
  crmUpsertApprovalRuleTool,
} from '../../../packages/mcp-server/src/crm-tools';
import { describeV2Requests, firstTextContent, oauthContext, type V2RequestCase } from './helpers';

const v2Requests: V2RequestCase[] = [
  {
    name: 'upserts approval rules with object and block targets',
    tool: crmUpsertApprovalRuleTool,
    args: {
      object: 'invoices',
      name: 'Block invoice download',
      conditions: { all: [{ field: 'status', op: '==', value: 'sent' }] },
      block_targets: ['document_download'],
      approver_user_ids: ['7'],
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/approval-rules',
        body: {
          object: 'invoices',
          name: 'Block invoice download',
          conditions: { all: [{ field: 'status', op: '==', value: 'sent' }] },
          block_targets: ['document_download'],
          approver_user_ids: ['7'],
        },
      },
    ],
  },
  {
    name: 'creates an ad hoc record approval request through the public approval request API',
    tool: crmCreateApprovalRequestTool,
    args: {
      object: 'estimates',
      record_id: 'estimate-1',
      approver_user_ids: ['456'],
      title: 'Manual estimate approval',
      description: 'Please approve this estimate.',
      block_targets: ['status_transition'],
      requested_action: 'approve_estimate',
      idempotency_key: 'approval-estimate-1',
      workspace_id: 'workspace-1',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/approval-requests?workspace_id=workspace-1',
        body: {
          object: 'estimates',
          record_id: 'estimate-1',
          title: 'Manual estimate approval',
          description: 'Please approve this estimate.',
          requested_action: 'approve_estimate',
          idempotency_key: 'approval-estimate-1',
          approver_user_ids: ['456'],
          block_targets: ['status_transition'],
        },
      },
    ],
  },
  {
    name: 'approves a record approval by history id',
    tool: crmApproveRecordApprovalTool,
    args: {
      history_id: 'history-1',
      workspace_id: 'workspace-1',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/approval-requests/history-1/approve?workspace_id=workspace-1',
      },
    ],
  },
  {
    name: 'rejects a record approval by history id',
    tool: crmRejectRecordApprovalTool,
    args: {
      history_id: 'history-2',
    },
    expectedRequests: [
      { method: 'POST', url: 'http://localhost:5000/api/v2/approval-requests/history-2/reject' },
    ],
  },
  {
    name: 'loads delivery rule options',
    tool: crmGetDeliveryRuleOptionsTool,
    args: {
      object: 'invoices',
      action: 'send',
    },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/delivery-rules/options?object=invoices&action=send',
      },
    ],
  },
  {
    name: 'deletes a delivery rule',
    tool: crmDeleteDeliveryRuleTool,
    args: {
      object: 'invoices',
      rule_id: 'rule-1',
    },
    expectedRequests: [
      { method: 'DELETE', url: 'http://localhost:5000/api/v2/delivery-rules/rule-1?object=invoices' },
    ],
  },
  {
    name: 'gets one property when authentication is present',
    tool: crmGetPropertyTool,
    args: { object_name: 'orders', property_ref: 'prop-1', workspace_id: 'workspace-1', language: 'en' },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/properties/orders/prop-1?workspace_id=workspace-1',
        headers: { 'accept-language': 'en' },
      },
    ],
  },
  {
    name: 'creates a property',
    tool: crmCreatePropertyTool,
    args: {
      object_name: 'orders',
      name: 'Priority',
      internal_name: 'priority',
      type: 'text',
      tag_values: [],
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/properties/orders',
        body: { internal_name: 'priority', name: 'Priority', type: 'text', tag_values: [] },
      },
    ],
  },
  {
    name: 'lists custom object properties by slug',
    tool: crmListPropertiesTool,
    args: {
      object_name: 'custom_objects',
      custom_object: 'mgs_owned_machine',
      limit: 10,
    },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/properties/custom_objects?custom_object_slug=mgs_owned_machine',
      },
    ],
  },
  {
    name: 'creates a custom object property by slug',
    tool: crmCreatePropertyTool,
    args: {
      object_name: 'custom_objects',
      custom_object_slug: 'mgs_owned_machine',
      name: 'Next Service Date',
      internal_name: 'next_service_date',
      type: 'date',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/properties/custom_objects',
        body: {
          internal_name: 'next_service_date',
          name: 'Next Service Date',
          type: 'date',
          custom_object_slug: 'mgs_owned_machine',
        },
      },
    ],
  },
  {
    name: 'creates an integration property with V2 mutation routing',
    tool: crmCreatePropertyTool,
    args: {
      object_name: 'deals',
      target: 'integration',
      provider: 'salesforce',
      external_object_type: 'Opportunity',
      external_id: 'CodexSmokeField__c',
      dry_run: true,
      name: 'Codex Smoke Field',
      type: 'text',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/properties/deals',
        body: {
          external_id: 'CodexSmokeField__c',
          external_object_type: 'Opportunity',
          name: 'Codex Smoke Field',
          provider: 'salesforce',
          target: 'integration',
          type: 'text',
          dry_run: true,
        },
      },
    ],
  },
  {
    name: 'forwards a HubSpot calculation formula for integration property creation',
    tool: crmCreatePropertyTool,
    args: {
      object_name: 'contacts',
      provider: 'hubspot',
      channel_id: 'channel-1',
      external_object_type: 'contacts',
      external_id: 'ctis_student_display_name_calc',
      name: 'Student display name',
      type: 'text',
      calculation_formula:
        'concatenate([properties.ctis_form_student_last_name], " ", [properties.ctis_form_student_first_name])',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/properties/contacts',
        body: {
          calculation_formula:
            'concatenate([properties.ctis_form_student_last_name], " ", [properties.ctis_form_student_first_name])',
          channel_id: 'channel-1',
          external_id: 'ctis_student_display_name_calc',
          external_object_type: 'contacts',
          name: 'Student display name',
          provider: 'hubspot',
          type: 'text',
          target: 'integration',
        },
      },
    ],
  },
  {
    name: 'treats property mutation scope=integration as target=integration',
    tool: crmCreatePropertyTool,
    args: {
      object_name: 'contacts',
      scope: 'integration',
      provider: 'hubspot',
      external_id: 'test_property',
      group_name: 'contactinformation',
      dry_run: true,
      name: 'Test property',
      type: 'text',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/properties/contacts',
        body: {
          external_id: 'test_property',
          group_name: 'contactinformation',
          name: 'Test property',
          provider: 'hubspot',
          scope: 'integration',
          type: 'text',
          dry_run: true,
          target: 'integration',
        },
      },
    ],
  },
  {
    name: 'routes provider-only property creation to the integration target',
    tool: crmCreatePropertyTool,
    args: {
      object_name: 'contacts',
      provider: 'hubspot',
      channel_id: 'channel-1',
      external_object_type: 'contacts',
      external_id: 'test',
      name: 'Test',
      type: 'text',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/properties/contacts',
        body: {
          channel_id: 'channel-1',
          external_id: 'test',
          external_object_type: 'contacts',
          name: 'Test',
          provider: 'hubspot',
          type: 'text',
          target: 'integration',
        },
      },
    ],
  },
  {
    name: 'routes integration property listing through the V2 public SDK',
    tool: crmListPropertiesTool,
    args: {
      object_name: 'contacts',
      scope: 'integration',
      provider: 'hubspot',
      limit: 10,
    },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/properties/contacts?scope=integration&provider=hubspot',
      },
    ],
  },
  {
    name: 'updates a property',
    tool: crmUpdatePropertyTool,
    args: {
      object_name: 'custom_objects',
      property_ref: 'prop-1',
      custom_object_id: 'custom-object-1',
      required_field: true,
      choice_values: ['high', 'low'],
    },
    expectedRequests: [
      {
        method: 'PUT',
        url: 'http://localhost:5000/api/v2/properties/custom_objects/prop-1',
        body: { required_field: true, custom_object_id: 'custom-object-1', choice_values: ['high', 'low'] },
      },
    ],
  },
  {
    name: 'deletes a property',
    tool: crmDeletePropertyTool,
    args: {
      object_name: 'custom_objects',
      property_ref: 'prop-1',
      custom_object_slug: 'mgs_owned_machine',
    },
    expectedRequests: [
      {
        method: 'DELETE',
        url: 'http://localhost:5000/api/v2/properties/custom_objects/prop-1?custom_object_slug=mgs_owned_machine',
      },
    ],
  },
  {
    name: 'deletes an integration property with confirmation routing',
    tool: crmDeletePropertyTool,
    args: {
      object_name: 'deals',
      property_ref: 'codex_smoke_field',
      target: 'integration',
      provider: 'hubspot',
      confirm: true,
    },
    expectedRequests: [
      {
        method: 'DELETE',
        url: 'http://localhost:5000/api/v2/properties/deals/codex_smoke_field?target=integration&provider=hubspot&confirm=true',
      },
    ],
  },
  {
    name: 'lists routed object schemas from integration scope',
    tool: crmListObjectSchemasTool,
    args: {
      scope: 'integration',
      provider: 'hubspot',
      channel_id: 'channel-1',
      search: 'asset',
      limit: 5,
    },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/object-schemas?scope=integration&provider=hubspot&channel_id=channel-1&search=asset',
      },
    ],
  },
  {
    name: 'mutates Salesforce object schema through Metadata API dry-run routing',
    tool: crmMutateObjectSchemaTool,
    args: {
      operation: 'create',
      target: 'integration',
      provider: 'salesforce',
      external_object_type: 'Asset__c',
      name: 'Asset',
      plural_label: 'Assets',
      primary_display_property: 'Asset Name',
      dry_run: true,
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/object-schemas',
        body: {
          external_object_type: 'Asset__c',
          name: 'Asset',
          operation: 'create',
          plural_label: 'Assets',
          primary_display_property: 'Asset Name',
          provider: 'salesforce',
          target: 'integration',
          dry_run: true,
        },
      },
    ],
  },
  {
    name: 'forwards app blueprint DSL and template overlays to preview',
    tool: crmPreviewAppBlueprintTool,
    args: {
      template_slug: 'erp',
      language: 'ja',
      overlay: {
        source: 'template_overlay',
        custom_objects: [{ name: '車両管理', slug: 'vehicles' }],
        modules: [{ slug: 'automotive-sales', name: '車両販売管理', object_ids: ['deal'] }],
      },
      blueprintDsl: {
        source: 'ai_generated',
        modules: [{ slug: 'generated-ops', name: '生成業務', object_ids: ['task'] }],
        artifacts: [{ slug: 'generated-guide', type: 'guide', title: '生成ガイド', body: '# 生成ガイド' }],
      },
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/app-builder/blueprints/preview',
        body: {
          template_slug: 'erp',
          language: 'ja',
          blueprint_dsl: {
            source: 'ai_generated',
            modules: [{ slug: 'generated-ops', name: '生成業務', object_ids: ['task'] }],
            artifacts: [
              { slug: 'generated-guide', type: 'guide', title: '生成ガイド', body: '# 生成ガイド' },
            ],
          },
          overlay: {
            source: 'template_overlay',
            custom_objects: [{ name: '車両管理', slug: 'vehicles' }],
            modules: [{ slug: 'automotive-sales', name: '車両販売管理', object_ids: ['deal'] }],
          },
        },
      },
    ],
  },
  {
    name: 'lists permission sets',
    tool: crmListPermissionSetsTool,
    args: { search: 'CRM', limit: 10 },
    expectedRequests: [
      { method: 'GET', url: 'http://localhost:5000/api/v2/permission-sets?page=1&limit=10&q=CRM' },
    ],
  },
  {
    name: 'loads the permission-set editor',
    tool: crmGetPermissionSetEditorTool,
    args: {},
    expectedRequests: [{ method: 'GET', url: 'http://localhost:5000/api/v2/permission-sets/editor' }],
  },
  {
    name: 'creates a permission set',
    tool: crmCreatePermissionSetTool,
    args: {
      name: 'CRM Viewer',
      description: 'Read-only CRM access',
      permissions: { company: 'read' },
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/permission-sets',
        body: { name: 'CRM Viewer', description: 'Read-only CRM access', permissions: { company: 'read' } },
      },
    ],
  },
  {
    name: 'updates a permission set',
    tool: crmUpdatePermissionSetTool,
    args: {
      permission_set_id: 'permission-set-2',
      name: 'CRM Viewer',
      permission: { company: 'read' },
    },
    expectedRequests: [
      {
        method: 'PUT',
        url: 'http://localhost:5000/api/v2/permission-sets/permission-set-2',
        body: { name: 'CRM Viewer', permissions: { company: 'read' } },
      },
    ],
  },
];

describe('CRM settings, governance, and saved view tools', () => {
  it('gets, updates, deletes, and resolves columns for a saved view', async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce({ view: { id: 'view-1', label: 'Open orders' } })
      .mockResolvedValueOnce({ columns: [{ id: 'status', label: 'Status' }] });
    const patch = jest.fn().mockResolvedValue({ data: { id: 'view-1', label: 'Priority orders' } });
    const del = jest.fn().mockResolvedValue({ status: 'deleted', view_id: 'view-1' });
    const reqContext = {
      client: { get, patch, delete: del } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    const getResult = await crmGetViewTool.handler({
      reqContext,
      args: { view_id: 'view-1', workspace_id: 'workspace-1', language: 'ja' },
    });
    expect(get).toHaveBeenNthCalledWith(1, '/api/v2/views/view-1', {
      query: { workspace_id: 'workspace-1', 'Accept-Language': 'ja' },
    });
    expect(firstTextContent(getResult)).toBe('Loaded saved view Open orders.');
    expect(getResult.structuredContent).toEqual({
      view: { id: 'view-1', label: 'Open orders' },
    });

    const columnsResult = await crmGetViewColumnsTool.handler({
      reqContext,
      args: { view_id: 'view-1', workspace_id: 'workspace-1' },
    });
    expect(get).toHaveBeenNthCalledWith(2, '/api/v2/views/view-1/columns', {
      query: { workspace_id: 'workspace-1' },
    });
    expect(firstTextContent(columnsResult)).toBe('Loaded 1 columns for saved view view-1.');
    expect(columnsResult.structuredContent).toEqual({
      columns: [{ id: 'status', label: 'Status' }],
    });

    const updateResult = await crmUpdateViewTool.handler({
      reqContext,
      args: {
        view_id: 'view-1',
        object: 'orders',
        name: 'Priority orders',
        view_type: 'list',
        columns: ['status', 'company'],
        is_private: true,
        workspace_id: 'workspace-1',
        language: 'en',
      },
    });
    expect(patch).toHaveBeenCalledWith('/api/v2/views/view-1', {
      body: {
        object: 'orders',
        object_type: 'orders',
        name: 'Priority orders',
        title: 'Priority orders',
        view_type: 'list',
        mode: 'table',
        columns: ['status', 'company'],
        column_field_ids: ['status', 'company'],
        is_private: true,
        visibility: 'private',
      },
      query: { workspace_id: 'workspace-1', 'Accept-Language': 'en' },
    });
    expect(firstTextContent(updateResult)).toBe('Updated saved view view-1.');
    expect(updateResult.structuredContent).toEqual({
      data: { id: 'view-1', label: 'Priority orders' },
    });

    const deleteResult = await crmDeleteViewTool.handler({
      reqContext,
      args: { view_id: 'view-1', object: 'orders', workspace_id: 'workspace-1' },
    });
    expect(del).toHaveBeenCalledWith('/api/v2/views/view-1', {
      body: { object: 'orders', object_type: 'orders' },
      query: { workspace_id: 'workspace-1' },
    });
    expect(firstTextContent(deleteResult)).toBe('Deleted saved view view-1.');
    expect(deleteResult.structuredContent).toEqual({ status: 'deleted', view_id: 'view-1' });
  });

  it('gets and deletes a report through the public SDK client', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      report_id: 'report-1',
      name: 'Revenue dashboard',
      report_type: 'invoices',
    });
    const del = jest.fn().mockResolvedValue({
      ok: true,
      status: 'deleted',
      report_id: 'report-1',
    });
    const reqContext = {
      client: { public: { reports: { retrieve, delete: del } } } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    const getResult = await crmGetReportTool.handler({
      reqContext,
      args: { report_id: 'report-1', workspace_id: 'workspace-1' },
    });
    expect(retrieve).toHaveBeenCalledWith('report-1', { workspace_id: 'workspace-1' }, undefined);
    expect(firstTextContent(getResult)).toBe('Loaded report Revenue dashboard.');
    expect(getResult.structuredContent).toEqual({
      report_id: 'report-1',
      name: 'Revenue dashboard',
      report_type: 'invoices',
    });

    const deleteResult = await crmDeleteReportTool.handler({
      reqContext,
      args: { report_id: 'report-1', workspace_id: 'workspace-1' },
    });
    expect(del).toHaveBeenCalledWith('report-1', { workspace_id: 'workspace-1' }, undefined);
    expect(firstTextContent(deleteResult)).toBe('Deleted report report-1.');
    expect(deleteResult.structuredContent).toEqual({
      ok: true,
      status: 'deleted',
      report_id: 'report-1',
    });
  });

  it('lists properties with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id: 'prop-1',
        name: 'Priority',
        internal_name: 'priority',
        object: 'orders',
        is_custom: true,
        immutable: false,
      },
      {
        id: 'prop-2',
        name: 'Region',
        internal_name: 'region',
        object: 'orders',
        is_custom: true,
        immutable: false,
      },
      {
        id: 'prop-3',
        name: 'Channel',
        internal_name: 'channel',
        object: 'orders',
        is_custom: true,
        immutable: false,
      },
    ]);

    const result = await crmListPropertiesTool.handler({
      reqContext: {
        client: {
          public: {
            properties: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_name: 'orders',
        custom_only: true,
        limit: 2,
        workspace_id: 'workspace-1',
        language: 'en',
      },
    });

    expect(list).toHaveBeenCalledWith(
      'orders',
      {
        custom_only: true,
        workspace_id: 'workspace-1',
        'Accept-Language': 'en',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 3,
      message: 'Returned 2 of 3 properties.',
      permission: undefined,
      results: [
        {
          id: 'prop-1',
          name: 'Priority',
          internal_name: 'priority',
          object: 'orders',
          is_custom: true,
          immutable: false,
        },
        {
          id: 'prop-2',
          name: 'Region',
          internal_name: 'region',
          object: 'orders',
          is_custom: true,
          immutable: false,
        },
      ],
    });
    const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
    expect(text).toContain('Found 3 properties. Examples: Priority, Region.');
    expect(text).toContain('properties model context:');
    expect(text).toContain('"internal_name": "priority"');
  });

  it('lists integration properties with provider routing', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id: 'hs/lifecycle_stage',
        name: 'Lifecycle stage',
        internal_name: 'lifecycle_stage',
        object: 'companies',
        scope: 'integration',
        provider: 'hubspot',
        is_custom: false,
        immutable: false,
      },
    ]);

    const result = await crmListPropertiesTool.handler({
      reqContext: {
        client: {
          public: {
            properties: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_name: 'companies',
        scope: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        external_object_type: 'companies',
        search: 'lifecycle',
        limit: 2,
      },
    });

    expect(list).toHaveBeenCalledWith(
      'companies',
      {
        scope: 'integration',
        provider: 'hubspot',
        channel_id: 'channel-1',
        external_object_type: 'companies',
        search: 'lifecycle',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 1,
      message: 'Returned 1 of 1 properties.',
      permission: undefined,
      results: [
        {
          id: 'hs/lifecycle_stage',
          name: 'Lifecycle stage',
          internal_name: 'lifecycle_stage',
          object: 'companies',
          scope: 'integration',
          provider: 'hubspot',
          is_custom: false,
          immutable: false,
        },
      ],
    });
    const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
    expect(text).toContain('Found 1 properties. Examples: Lifecycle stage.');
    expect(text).toContain('properties model context:');
    expect(text).toContain('"provider": "hubspot"');
  });

  it('lists approval rules through the public rule settings API', async () => {
    const get = jest.fn().mockResolvedValue({
      success: true,
      data: {
        settingType: 'invoices',
        rules: [
          {
            id: 'rule-1',
            name: 'Block invoice download',
            blockTargets: ['document_download'],
            summary: 'status == sent',
          },
        ],
        message: 'OK',
      },
    });

    const result = await crmListApprovalRulesTool.handler({
      reqContext: {
        client: { get } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object: 'invoices',
        workspace_id: 'workspace-1',
        language: 'ja',
      },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/approval-rules', {
      query: {
        object: 'invoices',
        workspace_id: 'workspace-1',
        language: 'ja',
      },
    });
    expect(result.structuredContent).toMatchObject({
      count: 1,
      results: [{ id: 'rule-1', name: 'Block invoice download' }],
    });
  });

  it('lists record approval requests for a record', async () => {
    const get = jest.fn().mockResolvedValue({
      approvalRequests: [
        {
          requestId: 'request-1',
          historyId: 'history-1',
          title: 'Manual estimate approval',
          source: 'manual',
          status: 'pending',
        },
      ],
      rules: [],
      hasBlockingPending: false,
      message: 'OK',
    });

    const result = await crmListRecordApprovalsTool.handler({
      reqContext: {
        client: { get } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object: 'estimate',
        record_id: 'estimate-1',
        workspace_id: 'workspace-1',
      },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/approval-requests', {
      query: {
        object: 'estimate',
        workspace_id: 'workspace-1',
        record_id: 'estimate-1',
      },
    });
    expect(result.structuredContent).toMatchObject({
      count: 1,
      results: [
        {
          historyId: 'history-1',
          source: 'manual',
          status: 'pending',
        },
      ],
    });
  });

  it('rejects provider with explicit Sanka property creation', async () => {
    const create = jest.fn();

    const result = await crmCreatePropertyTool.handler({
      reqContext: {
        client: {
          public: {
            properties: { create },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        object_name: 'contacts',
        target: 'sanka',
        provider: 'hubspot',
        name: 'Test',
        type: 'text',
      },
    });

    expect(create).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      isError: true,
      content: [
        {
          type: 'text',
          text: expect.stringContaining('provider'),
        },
      ],
    });
  });

  it('routes app blueprint template and preview calls through V2 app-builder endpoints', async () => {
    const get = jest.fn().mockResolvedValue({
      success: true,
      data: {
        templates: [{ slug: 'crm', title: 'CRM' }],
        message: 'OK',
      },
      meta: { ctx_id: 'ctx-templates' },
    });
    const post = jest.fn().mockResolvedValue({
      success: true,
      data: {
        plan: {
          template_slug: 'crm',
          title: 'CRM',
          modules: [{ slug: 'crm', name: 'CRM', object_ids: ['company', 'contact', 'deal'] }],
          permission_sets: [{ name: 'CRM Admin', permissions: { company: 'write' } }],
          artifacts: [{ type: 'guide', title: 'CRM Guide', body: '# CRM' }],
        },
        applied: false,
        dry_run: true,
        mutation_results: [],
        message: 'Previewed app blueprint.',
      },
      meta: { ctx_id: 'ctx-preview' },
    });
    const reqContext = {
      client: { get, post } as any,
      auth: oauthContext(),
      toolProfile: 'full' as const,
    };

    const listResult = await crmListAppBlueprintTemplatesTool.handler({ reqContext, args: {} });
    expect(get).toHaveBeenCalledWith('/api/v2/app-builder/templates');
    expect(listResult.structuredContent).toMatchObject({
      templates: [{ slug: 'crm', title: 'CRM' }],
      ctx_id: 'ctx-templates',
    });

    const previewResult = await crmPreviewAppBlueprintTool.handler({
      reqContext,
      args: { prompt: 'sankaでCRMを構築して' },
    });
    expect(post).toHaveBeenCalledWith('/api/v2/app-builder/blueprints/preview', {
      body: { prompt: 'sankaでCRMを構築して' },
    });
    expect(firstTextContent(previewResult)).toContain('CRM blueprint previewed');
    expect(previewResult.structuredContent).toMatchObject({
      applied: false,
      dry_run: true,
      ctx_id: 'ctx-preview',
    });
  });

  it('requires explicit confirmation before applying an app blueprint', async () => {
    const post = jest.fn();

    const blocked = await crmApplyAppBlueprintTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { template_slug: 'erp' },
    });

    expect(blocked.isError).toBe(true);
    expect(firstTextContent(blocked)).toContain('confirm=true');
    expect(post).not.toHaveBeenCalled();
  });

  it('applies app blueprints with confirmation and forwards mutation options', async () => {
    const post = jest.fn().mockResolvedValue({
      success: true,
      data: {
        plan: {
          template_slug: 'erp',
          title: 'ERP',
          modules: [{ slug: 'erp-finance', name: 'Finance', object_ids: ['invoice'] }],
          permission_sets: [{ name: 'ERP Admin', permissions: { invoice: 'write' } }],
          artifacts: [{ type: 'er_diagram', title: 'ERP ERD', body: 'erDiagram' }],
        },
        applied: true,
        dry_run: false,
        mutation_results: [
          { operation: 'module_upsert', status: 'updated' },
          {
            manual_id: 'manual-1',
            operation: 'guide_artifact_promote',
            slug: 'erp-erd',
            status: 'created',
          },
        ],
        message: 'Applied app blueprint.',
      },
      meta: { ctx_id: 'ctx-apply' },
    });

    const result = await crmApplyAppBlueprintTool.handler({
      reqContext: {
        client: { post } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        template_slug: 'erp',
        language: 'ja',
        confirm: true,
        create_editable_guides: true,
        allow_generated_blueprint_apply: true,
        idempotency_key: 'key-1',
        update_existing_permission_sets: true,
      },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/app-builder/blueprints/apply', {
      body: {
        template_slug: 'erp',
        language: 'ja',
        confirm: true,
        create_editable_guides: true,
        allow_generated_blueprint_apply: true,
        idempotency_key: 'key-1',
        update_existing_permission_sets: true,
      },
    });
    expect(firstTextContent(result)).toContain('ERP blueprint applied');
    expect(result.structuredContent).toMatchObject({
      applied: true,
      dry_run: false,
      ctx_id: 'ctx-apply',
    });
  });

  describeV2Requests(v2Requests);
});
