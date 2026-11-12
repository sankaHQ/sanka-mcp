import * as crmTools from '../../../packages/mcp-server/src/crm-tools';
import {
  crmAuthStatusTool,
  crmCancelWorkspaceInvitationTool,
  crmConnectSankaTool,
  crmCurrentWorkspaceTool,
  crmInviteWorkspaceUserTool,
  crmListWorkspaceInvitationsTool,
  crmListWorkspacesTool,
  crmSwitchWorkspaceTool,
} from '../../../packages/mcp-server/src/crm-tools';
import type { McpTool } from '../../../packages/mcp-server/src/types';
import { firstTextContent, oauthContext } from './helpers';

describe('CRM auth and workspace tools', () => {
  it('advertises auth schemes on CRM tools', () => {
    const noAuthToolNames = ['auth_status', 'connect_sanka'];
    const crmToolSchemes = Object.values(crmTools)
      .filter((value): value is McpTool => typeof value === 'object' && value !== null && 'handler' in value)
      .map((mcpTool) => [mcpTool.tool.name, mcpTool.tool.securitySchemes]);

    expect(crmToolSchemes.length).toBeGreaterThan(250);
    for (const [name, securitySchemes] of crmToolSchemes) {
      const expected = noAuthToolNames.includes(name as string) ? [{ type: 'noauth' }] : [{ type: 'oauth2' }];
      expect([name, securitySchemes]).toEqual([name, expected]);
    }
  });

  it('treats MCP access as sufficient for Sanka feature scopes', async () => {
    const result = await crmAuthStatusTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext({
          authMode: 'oauth_bearer',
          scopes: ['mcp:access'],
        }),
        toolProfile: 'hosted',
      },
      args: {
        required_scopes: ['expenses:write', 'deals:read', 'incentives:read'],
      },
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      connected: true,
      required_scopes: ['deals:read', 'expenses:write', 'incentives:read'],
    });
    expect(result.structuredContent?.['missing_scopes']).toBeUndefined();
  });

  it('includes the authenticated workspace when auth_status has OAuth workspace metadata', async () => {
    const result = await crmAuthStatusTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext({
          workspace: {
            id: 'workspace-uuid-1',
            code: '48803074',
            name: 'Production Workspace',
          },
        }),
        toolProfile: 'hosted',
      },
      args: {},
    });

    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        connected: true,
        workspace_id: 'workspace-uuid-1',
        workspace_code: '48803074',
        workspace_name: 'Production Workspace',
      }),
    );
  });

  it('returns the current Sanka workspace from the same auth session endpoint as list_workspaces', async () => {
    const get = jest.fn().mockResolvedValue({
      data: {
        auth_mode: 'oauth_app',
        current_workspace: {
          id: 'workspace-uuid-1',
          code: '48803074',
          name: 'Production Workspace',
        },
      },
      meta: { ctx_id: 'ctx-1' },
      success: true,
    });

    const result = await crmCurrentWorkspaceTool.handler({
      reqContext: {
        client: { get } as any,
        auth: oauthContext(),
        toolProfile: 'hosted',
      },
      args: {},
    });

    expect(get).toHaveBeenCalledWith('/api/v2/auth/session', undefined);
    expect(result.structuredContent).toEqual({
      connected: true,
      auth_mode: 'oauth_app',
      workspace_id: 'workspace-uuid-1',
      workspace_code: '48803074',
      workspace_name: 'Production Workspace',
      message: 'Current Sanka workspace is Production Workspace.',
    });
  });

  it('names the signed-in member by the id owner filters compare, not the user id', async () => {
    const get = jest.fn().mockResolvedValue({
      data: {
        auth_mode: 'oauth_app',
        user: { id: 7, username: 'haruka', email: 'haruka@example.com', name: 'Haruka' },
        current_workspace: { id: 'workspace-uuid-1', workspace_user_id: '2546' },
      },
      success: true,
    });

    const result = await crmCurrentWorkspaceTool.handler({
      reqContext: { client: { get } as any, auth: oauthContext(), toolProfile: 'hosted' },
      args: {},
    });

    expect(result.structuredContent).toEqual(
      expect.objectContaining({ member_id: '2546', member_name: 'Haruka' }),
    );
  });

  it('lists available workspaces for the current OAuth session', async () => {
    const get = jest.fn().mockResolvedValue({
      data: {
        current_workspace: {
          id: 'workspace-uuid-1',
          code: '39467777',
          name: 'Workspace A',
        },
        workspaces: [
          { id: 'workspace-uuid-1', name: 'Workspace A', code: '39467777' },
          { id: 'workspace-uuid-2', name: 'Workspace B', code: '48803074' },
        ],
      },
      meta: { ctx_id: 'ctx-1' },
      success: true,
    });

    const result = await crmListWorkspacesTool.handler({
      reqContext: {
        client: { get } as any,
        auth: oauthContext(),
        toolProfile: 'hosted',
      },
      args: {},
    });

    expect(get).toHaveBeenCalledWith('/api/v2/auth/session', undefined);
    expect(result.structuredContent).toEqual({
      current_workspace_id: 'workspace-uuid-1',
      current_workspace_code: '39467777',
      current_workspace_name: 'Workspace A',
      available_workspaces: [
        { id: 'workspace-uuid-1', name: 'Workspace A', workspace_code: '39467777', selected: true },
        { id: 'workspace-uuid-2', name: 'Workspace B', workspace_code: '48803074', selected: false },
      ],
      message: 'Returned 2 available Sanka workspaces.',
    });
    expect((result.content[0] as any).text).toContain('workspace-uuid-1');
    expect((result.content[0] as any).text).toContain('Workspace B');
  });

  it('switches the workspace of the OAuth connection', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        workspace: { id: 'workspace-uuid-2', name: 'Workspace B', code: '48803074' },
        workspace_id: 'workspace-uuid-2',
        workspace_code: '48803074',
      },
      meta: { ctx_id: 'ctx-switch' },
      success: true,
    });
    const get = jest.fn().mockResolvedValue({
      data: {
        current_workspace: { id: 'workspace-uuid-2', name: 'Workspace B', code: '48803074' },
        workspaces: [
          { id: 'workspace-uuid-1', name: 'Workspace A', code: '39467777' },
          { id: 'workspace-uuid-2', name: 'Workspace B', code: '48803074' },
        ],
      },
      meta: { ctx_id: 'ctx-session' },
      success: true,
    });

    const auth = oauthContext({
      workspace: {
        id: 'workspace-uuid-1',
        code: '39467777',
        name: 'Workspace A',
      },
    });
    const result = await crmSwitchWorkspaceTool.handler({
      reqContext: {
        client: { get, post } as any,
        auth,
        toolProfile: 'hosted',
      },
      args: { workspace_id: 'workspace-uuid-2' },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/workspaces/switch', {
      body: { target_workspace_id: 'workspace-uuid-2' },
    });
    expect(get).toHaveBeenCalledWith('/api/v2/auth/session', undefined);
    expect(result.structuredContent).toEqual({
      current_workspace_id: 'workspace-uuid-2',
      current_workspace_code: '48803074',
      current_workspace_name: 'Workspace B',
      available_workspaces: [
        { id: 'workspace-uuid-1', name: 'Workspace A', workspace_code: '39467777', selected: false },
        { id: 'workspace-uuid-2', name: 'Workspace B', workspace_code: '48803074', selected: true },
      ],
      message: 'Switched Sanka workspace to Workspace B.',
    });
    expect(auth.oauth).toMatchObject({
      workspace_id: 'workspace-uuid-2',
      workspace_code: '48803074',
      workspace_name: 'Workspace B',
    });
  });

  it('requires confirmation before inviting a workspace user', async () => {
    const create = jest.fn();

    const result = await crmInviteWorkspaceUserTool.handler({
      reqContext: {
        client: { public: { workspaceUsers: { invitations: { create } } } } as any,
        auth: oauthContext(),
        toolProfile: 'hosted',
      },
      args: { email: 'dev@sanka.com', role: 'partner' },
    });

    expect(create).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(firstTextContent(result)).toContain('`confirm=true` is required');
  });

  it('requires an explicit expected workspace before inviting a workspace user', async () => {
    const get = jest.fn();
    const create = jest.fn();

    const result = await crmInviteWorkspaceUserTool.handler({
      reqContext: {
        client: { get, public: { workspaceUsers: { invitations: { create } } } } as any,
        auth: oauthContext(),
        toolProfile: 'hosted',
      },
      args: {
        email: 'dev@sanka.com',
        role: 'partner',
        confirm: true,
      },
    });

    expect(get).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(firstTextContent(result)).toContain('`expected_workspace_id` is required');
  });

  it('blocks a workspace invitation when the write-time workspace preflight does not match', async () => {
    const get = jest.fn().mockResolvedValue({
      data: {
        current_workspace: {
          id: 'workspace-uuid-2',
          code: '39467777',
          name: 'Wrong Workspace',
        },
      },
      success: true,
    });
    const create = jest.fn();

    const result = await crmInviteWorkspaceUserTool.handler({
      reqContext: {
        client: { get, public: { workspaceUsers: { invitations: { create } } } } as any,
        auth: oauthContext(),
        toolProfile: 'hosted',
      },
      args: {
        email: 'dev@sanka.com',
        role: 'partner',
        expected_workspace_id: 'workspace-uuid-1',
        confirm: true,
      },
    });

    expect(get).toHaveBeenCalledWith('/api/v2/auth/session', undefined);
    expect(create).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(firstTextContent(result)).toContain('Workspace precondition failed');
    expect(firstTextContent(result)).toContain('Wrong Workspace');
  });

  it('invites a workspace user through the typed SDK resource with a write-time workspace precondition', async () => {
    const get = jest.fn().mockResolvedValue({
      data: {
        current_workspace: {
          id: 'workspace-uuid-1',
          code: '92006272',
          name: 'JVTA',
        },
      },
      success: true,
    });
    const create = jest.fn().mockResolvedValue({
      invitation_id: '638',
      email: 'dev@sanka.com',
      role: 'partner',
      status: 'invited',
      invited_count: 1,
      invited: ['dev@sanka.com'],
      skipped_existing: 0,
      skipped_invited: 0,
      skipped_protected: 0,
      permission_set_id: null,
      email_delivery: 'sent',
    });

    const result = await crmInviteWorkspaceUserTool.handler({
      reqContext: {
        client: { get, public: { workspaceUsers: { invitations: { create } } } } as any,
        auth: oauthContext(),
        toolProfile: 'hosted',
      },
      args: {
        email: 'dev@sanka.com',
        role: 'partner',
        language: 'ja',
        simplified_invite: true,
        expected_workspace_id: 'workspace-uuid-1',
        confirm: true,
      },
    });

    expect(create).toHaveBeenCalledWith(
      {
        email: 'dev@sanka.com',
        role: 'partner',
        simplified_invite: true,
        language: 'ja',
      },
      {
        headers: {
          'X-Sanka-Expected-Workspace-ID': 'workspace-uuid-1',
        },
      },
    );
    expect(result.structuredContent).toMatchObject({
      invitation_id: '638',
      email: 'dev@sanka.com',
      status: 'invited',
      workspace_id: 'workspace-uuid-1',
      workspace_code: '92006272',
      workspace_name: 'JVTA',
    });
  });

  it('lists workspace invitations through the typed SDK resource', async () => {
    const list = jest.fn().mockResolvedValue({
      invitations: [{ id: 638, email: 'dev@sanka.com', role: 'partner', status: 'pending' }],
      total: 1,
      page: 2,
      page_size: 25,
      has_next_page: false,
      can_edit: true,
      message: 'OK',
    });

    const result = await crmListWorkspaceInvitationsTool.handler({
      reqContext: {
        client: { public: { workspaceUsers: { invitations: { list } } } } as any,
        auth: oauthContext(),
        toolProfile: 'hosted',
      },
      args: { search: 'dev', page: 2, page_size: 25 },
    });

    expect(list).toHaveBeenCalledWith({ q: 'dev', page: 2, page_size: 25 });
    expect(result.structuredContent).toMatchObject({
      count: 1,
      page: 2,
      total: 1,
      results: [{ id: 638, email: 'dev@sanka.com', status: 'pending' }],
    });
  });

  it('requires confirmation and a matching workspace before canceling an invitation', async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          current_workspace: {
            id: 'workspace-uuid-2',
            code: '39467777',
            name: 'Wrong Workspace',
          },
        },
        success: true,
      })
      .mockResolvedValueOnce({
        data: {
          current_workspace: {
            id: 'workspace-uuid-1',
            code: '92006272',
            name: 'JVTA',
          },
        },
        success: true,
      });
    const cancel = jest.fn().mockResolvedValue({ message: 'OK' });
    const reqContext = {
      client: { get, public: { workspaceUsers: { invitations: { cancel } } } } as any,
      auth: oauthContext(),
      toolProfile: 'hosted' as const,
    };

    const blocked = await crmCancelWorkspaceInvitationTool.handler({
      reqContext,
      args: { invitation_id: 638 },
    });
    expect(cancel).not.toHaveBeenCalled();
    expect(blocked.isError).toBe(true);

    const mismatched = await crmCancelWorkspaceInvitationTool.handler({
      reqContext,
      args: {
        invitation_id: 638,
        expected_workspace_id: 'workspace-uuid-1',
        confirm: true,
      },
    });
    expect(cancel).not.toHaveBeenCalled();
    expect(mismatched.isError).toBe(true);
    expect(firstTextContent(mismatched)).toContain('Workspace precondition failed');

    const result = await crmCancelWorkspaceInvitationTool.handler({
      reqContext,
      args: {
        invitation_id: 638,
        expected_workspace_id: 'workspace-uuid-1',
        confirm: true,
      },
    });
    expect(cancel).toHaveBeenCalledWith(638, {
      headers: {
        'X-Sanka-Expected-Workspace-ID': 'workspace-uuid-1',
      },
    });
    expect(result.structuredContent).toEqual({
      invitation_id: '638',
      status: 'canceled',
      workspace_id: 'workspace-uuid-1',
      workspace_code: '92006272',
      workspace_name: 'JVTA',
      message: 'OK',
    });
  });

  it('returns reconnect metadata when auth status is missing an unknown required scope', async () => {
    const result = await crmAuthStatusTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext({
          authMode: 'oauth_bearer',
          scopes: ['mcp:access'],
        }),
        toolProfile: 'hosted',
      },
      args: {
        required_scopes: ['external:read'],
      },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        connected: true,
        auth_mode: 'oauth_bearer',
        tool_profile: 'hosted',
        scopes: ['mcp:access'],
        required_scopes: ['external:read'],
        missing_scopes: ['external:read'],
      }),
    );
    expect(result._meta?.['mcp/www_authenticate']).toBeUndefined();
    expect(result.structuredContent?.['reconnect_mode']).toBe('oauth');
  });

  it.each([crmAuthStatusTool, crmConnectSankaTool])(
    'reports the connection and the AI client from $tool.name',
    async (tool) => {
      const result = await tool.handler({
        reqContext: {
          client: {} as any,
          auth: oauthContext(),
          mcpClientInfo: { name: 'Codex', version: '1.0.0' },
          toolProfile: 'hosted',
        },
        args: {},
      });

      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toMatchObject({
        connected: true,
        client_name: 'Codex',
        reconnect_mode: 'oauth',
      });
    },
  );
});
