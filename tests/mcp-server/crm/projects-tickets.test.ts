import {
  crmCreateProjectTool,
  crmCreateTaskTool,
  crmCreateTicketTool,
  crmDeleteProjectTool,
  crmDeleteTaskTool,
  crmDeleteTicketTool,
  crmGetProjectTool,
  crmGetTaskTool,
  crmGetTicketTool,
  crmListProjectsTool,
  crmListTasksTool,
  crmListTicketPipelinesTool,
  crmListTicketsTool,
  crmUpdateProjectTool,
  crmUpdateTaskTool,
  crmUpdateTicketStatusTool,
  crmUpdateTicketTool,
} from '../../../packages/mcp-server/src/crm-tools';
import { describeV2Requests, oauthContext, type V2RequestCase } from './helpers';

const v2Requests: V2RequestCase[] = [
  {
    name: 'lists projects when authentication is present',
    tool: crmListProjectsTool,
    args: {
      search: 'Customer',
      default: false,
      page: 2,
      limit: 20,
      workspace_id: 'workspace-1',
      language: 'en',
    },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/public/projects?workspace_id=workspace-1&default=false&limit=20&page=2&search=Customer',
        headers: { 'accept-language': 'en', 'x-language': 'en' },
      },
    ],
  },
  {
    name: 'gets one project when authentication is present',
    tool: crmGetProjectTool,
    args: {
      project_id: 'project-1',
      workspace_id: 'workspace-1',
      language: 'en',
    },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/public/projects/project-1?workspace_id=workspace-1',
        headers: { 'accept-language': 'en', 'x-language': 'en' },
      },
    ],
  },
  {
    name: 'creates a project',
    tool: crmCreateProjectTool,
    args: {
      title: 'Customer Onboarding',
      description: 'Coordinate the customer rollout.',
      default: false,
      statuses: [{ name: 'Todo', internal_value: 'todo', order: 1 }],
      language: 'en',
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/public/projects',
        body: {
          title: 'Customer Onboarding',
          description: 'Coordinate the customer rollout.',
          default: false,
          statuses: [{ name: 'Todo', internal_value: 'todo', order: 1 }],
        },
        headers: { 'accept-language': 'en', 'x-language': 'en' },
      },
    ],
  },
  {
    name: 'updates a project with statuses',
    tool: crmUpdateProjectTool,
    args: {
      project_id: 'project-1',
      title: 'Customer Success',
      description: 'Updated rollout overview.',
      statuses: [{ id: 'status-1', name: 'Done', internal_value: 'done', order: 2 }],
      language: 'ja',
    },
    expectedRequests: [
      {
        method: 'PUT',
        url: 'http://localhost:5000/api/v2/public/projects/project-1',
        body: {
          title: 'Customer Success',
          description: 'Updated rollout overview.',
          statuses: [{ id: 'status-1', name: 'Done', internal_value: 'done', order: 2 }],
        },
        headers: { 'accept-language': 'ja', 'x-language': 'ja' },
      },
    ],
  },
  {
    name: 'updates only the project description and preserves an empty value for clearing',
    tool: crmUpdateProjectTool,
    args: {
      project_id: 'project-1',
      description: '  ',
    },
    expectedRequests: [
      {
        method: 'PUT',
        url: 'http://localhost:5000/api/v2/public/projects/project-1',
        body: { description: '' },
      },
    ],
  },
  {
    name: 'deletes a project with linked-task handling options',
    tool: crmDeleteProjectTool,
    args: {
      project_id: 'project-1',
      replacement_project_id: 'project-2',
      clear_task_project: false,
      language: 'en',
    },
    expectedRequests: [
      {
        method: 'DELETE',
        url: 'http://localhost:5000/api/v2/public/projects/project-1?replacement_project_id=project-2&clear_task_project=false',
        headers: { 'accept-language': 'en', 'x-language': 'en' },
      },
    ],
  },
  {
    name: 'lists tasks when authentication is present',
    tool: crmListTasksTool,
    args: {
      search: 'Acme',
      usage_status: 'active',
      project_id: 'project-1',
      page: 2,
      limit: 20,
      workspace_id: 'workspace-1',
      language: 'en',
    },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/tasks?page=2&search=Acme&usage_status=active&project_id=project-1&limit=20',
        headers: { 'accept-language': 'en' },
      },
    ],
  },
  {
    name: 'gets one task when authentication is present',
    tool: crmGetTaskTool,
    args: {
      task_id: 'task-1',
      external_id: 'TASK-1',
      workspace_id: 'workspace-1',
      language: 'en',
    },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/tasks/task-1',
        headers: { 'accept-language': 'en' },
      },
    ],
  },
  {
    name: 'creates a task',
    tool: crmCreateTaskTool,
    args: {
      external_id: 'TASK-1',
      title: 'Follow up with Acme',
      description: 'Send the latest customer update',
      assignees: ['user-1'],
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/tasks',
        body: {
          properties: {
            external_id: 'TASK-1',
            title: 'Follow up with Acme',
            description: 'Send the latest customer update',
            assignees: ['user-1'],
          },
        },
      },
    ],
  },
  {
    name: 'updates a task with separate lookup and body external ids',
    tool: crmUpdateTaskTool,
    args: {
      task_id: 'task-1',
      lookup_external_id: 'TASK-1',
      external_id: 'TASK-2',
      description: 'Append the latest customer note',
      projects: ['project-1'],
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/tasks/task-1',
        body: {
          properties: {
            description: 'Append the latest customer note',
            projects: ['project-1'],
            external_id: 'TASK-2',
          },
        },
      },
    ],
  },
  {
    name: 'deletes a task',
    tool: crmDeleteTaskTool,
    args: {
      task_id: 'task-1',
      external_id: 'TASK-1',
    },
    expectedRequests: [{ method: 'DELETE', url: 'http://localhost:5000/api/v2/tasks/task-1' }],
  },
  {
    name: 'gets one ticket when authentication is present',
    tool: crmGetTicketTool,
    args: { ticket_id: 'ticket-1', external_id: 'TICK-1', workspace_id: 'workspace-1' },
    expectedRequests: [
      { method: 'GET', url: 'http://localhost:5000/api/v2/tickets/ticket-1?external_id=TICK-1' },
    ],
  },
  {
    name: 'creates a ticket',
    tool: crmCreateTicketTool,
    args: {
      external_id: 'TICK-1',
      title: 'Broken integration',
      priority: 'high',
      deal_ids: ['deal-1'],
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/tickets',
        body: {
          properties: {
            external_id: 'TICK-1',
            priority: 'high',
            title: 'Broken integration',
            deal_ids: ['deal-1'],
          },
        },
      },
    ],
  },
  {
    name: 'updates a ticket with separate lookup and body external ids',
    tool: crmUpdateTicketTool,
    args: {
      ticket_id: 'ticket-1',
      lookup_external_id: 'TICK-1',
      external_id: 'TICK-2',
      status: 'archived',
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/tickets/ticket-1?external_id=TICK-1',
        body: { properties: { external_id: 'TICK-2', status: 'archived' } },
      },
    ],
  },
  {
    name: 'deletes a ticket',
    tool: crmDeleteTicketTool,
    args: {
      ticket_id: 'ticket-1',
      external_id: 'TICK-1',
    },
    expectedRequests: [
      { method: 'DELETE', url: 'http://localhost:5000/api/v2/tickets/ticket-1?external_id=TICK-1' },
    ],
  },
  {
    name: 'updates only the ticket status or stage',
    tool: crmUpdateTicketStatusTool,
    args: {
      ticket_id: 'ticket-1',
      lookup_external_id: 'TICK-1',
      stage_key: 'resolved',
      status: 'archived',
      language: 'ja',
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/tickets/ticket-1/status?external_id=TICK-1&stage_key=resolved&status=archived',
        headers: { 'accept-language': 'ja' },
      },
    ],
  },
];

describe('CRM project, task, and ticket tools', () => {
  it('lists tickets with a local result limit', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id: 'ticket-1',
        ticket_id: 401,
        title: 'Broken integration',
        stage_key: 'triage',
        status: 'active',
      },
      {
        id: 'ticket-2',
        ticket_id: 402,
        title: 'Upgrade billing plan',
        stage_key: 'investigating',
        status: 'active',
      },
      {
        id: 'ticket-3',
        ticket_id: 403,
        title: 'Webhook failure',
        stage_key: 'resolved',
        status: 'archived',
      },
    ]);

    const result = await crmListTicketsTool.handler({
      reqContext: {
        client: {
          public: {
            tickets: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { limit: 2, workspace_id: 'workspace-1' },
    });

    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'workspace-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 2,
      page: 1,
      total: 3,
      message: 'Returned 2 of 3 tickets.',
      permission: undefined,
      results: [
        {
          id: 'ticket-1',
          ticket_id: 401,
          title: 'Broken integration',
          stage_key: 'triage',
          status: 'active',
        },
        {
          id: 'ticket-2',
          ticket_id: 402,
          title: 'Upgrade billing plan',
          stage_key: 'investigating',
          status: 'active',
        },
      ],
    });
  });

  it('lists ticket pipelines when authentication is present', async () => {
    const listPipelines = jest.fn().mockResolvedValue([
      {
        id: 'pipeline-1',
        name: 'Support',
        internal_name: 'support',
        is_default: true,
        order: 1,
        stages: [
          { id: 'stage-1', name: 'Triage', internal_value: 'triage', order: 1 },
          { id: 'stage-2', name: 'Resolved', internal_value: 'resolved', order: 2 },
        ],
      },
    ]);

    const result = await crmListTicketPipelinesTool.handler({
      reqContext: {
        client: {
          public: {
            tickets: { listPipelines },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: { workspace_id: 'workspace-1' },
    });

    expect(listPipelines).toHaveBeenCalledWith({ workspace_id: 'workspace-1' }, undefined);
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 1,
      message: 'Returned 1 ticket pipelines.',
      permission: undefined,
      results: [
        {
          id: 'pipeline-1',
          name: 'Support',
          internal_name: 'support',
          is_default: true,
          order: 1,
          stages: [
            { id: 'stage-1', name: 'Triage', internal_value: 'triage', order: 1 },
            { id: 'stage-2', name: 'Resolved', internal_value: 'resolved', order: 2 },
          ],
        },
      ],
    });
    const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
    expect(text).toContain('Found 1 ticket pipelines. Examples: Support.');
    expect(text).toContain('ticket pipelines model context:');
    expect(text).toContain('"internal_name": "support"');
  });

  describeV2Requests(v2Requests);
});
