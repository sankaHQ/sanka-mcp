import * as crmTools from '../../../packages/mcp-server/src/crm-tools';
import {
  crmAuthStatusTool,
  crmCancelWorkspaceInvitationTool,
  crmConnectSankaTool,
  crmCurrentWorkspaceTool,
  crmGetCalendarBootstrapTool,
  crmInviteWorkspaceUserTool,
  crmListCompaniesTool,
  crmListDealsTool,
  crmListExpensesTool,
  crmListPrivateMessagesTool,
  crmListTicketsTool,
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

  it('returns Connect Sanka guidance when auth status is checked without authentication', async () => {
    const result = await crmAuthStatusTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'full',
      },
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      connected: false,
      auth_mode: 'none',
      tool_profile: 'full',
      scopes: [],
      message: 'Sanka CRM is not connected yet. Open the Connect Sanka URL, finish connecting, then retry.',
      resource_url: 'https://mcp.sanka.com/mcp',
      reconnect_mode: 'connect_sanka',
      reconnect_instructions:
        'The assistant must include required_user_facing_reply in the next visible response. Do not omit the Connect Sanka URL, hide it behind a short label, abbreviate the token, or only tell the user to reconnect. Then retry the original request.',
    });
    expect(result._meta?.['mcp/www_authenticate']).toBeUndefined();
  });

  it('returns hosted reconnect metadata when connect_sanka is called without authentication', async () => {
    const result = await crmConnectSankaTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'hosted',
      },
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      connected: false,
      auth_mode: 'none',
      tool_profile: 'hosted',
      scopes: [],
      message: 'Sanka CRM is not connected yet. Open the Connect Sanka URL, finish connecting, then retry.',
      resource_url: 'https://mcp.sanka.com/mcp',
      reconnect_mode: 'connect_sanka',
      reconnect_instructions:
        'The assistant must include required_user_facing_reply in the next visible response. Do not omit the Connect Sanka URL, hide it behind a short label, abbreviate the token, or only tell the user to reconnect. Then retry the original request.',
    });
    expect(result._meta?.['mcp/www_authenticate']).toBeUndefined();
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
    expect(result.structuredContent).toEqual({
      connected: true,
      auth_mode: 'oauth_bearer',
      tool_profile: 'hosted',
      scopes: ['mcp:access'],
      message: 'Sanka CRM is connected through this MCP session.',
      required_scopes: ['deals:read', 'expenses:write', 'incentives:read'],
      resource_url: 'https://mcp.sanka.com/mcp',
      reconnect_mode: 'connect_sanka',
      reconnect_instructions:
        'The assistant must include required_user_facing_reply in the next visible response. Do not omit the Connect Sanka URL, hide it behind a short label, abbreviate the token, or only tell the user to reconnect. Then retry the original request.',
    });
    expect(result._meta?.['mcp/www_authenticate']).toBeUndefined();
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

  it('switches the persistent MCP workspace binding when an MCP session id is available', async () => {
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
        mcpSessionId: 'mcp-session-1',
        toolProfile: 'hosted',
      },
      args: { workspace_id: 'workspace-uuid-2' },
    });

    expect(post).toHaveBeenCalledWith('/api/v2/workspaces/switch', {
      body: { target_workspace_id: 'workspace-uuid-2' },
      headers: {
        'X-Sanka-MCP-Session-ID': 'mcp-session-1',
      },
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
    expect(result.structuredContent?.['reconnect_mode']).toBe('connect_sanka');
  });

  it('uses Connect Sanka metadata when auth status is checked from hosted Codex', async () => {
    const result = await crmAuthStatusTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext(),
        mcpClientInfo: {
          name: 'Codex',
          version: '1.0.0',
        },
        toolProfile: 'hosted',
      },
      args: {},
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      connected: true,
      auth_mode: 'oauth_bearer',
      tool_profile: 'hosted',
      client_name: 'Codex',
      scopes: [],
      message: 'Sanka CRM is connected through this MCP session.',
      resource_url: 'https://mcp.sanka.com/mcp',
      reconnect_mode: 'connect_sanka',
      reconnect_instructions:
        'The assistant must include required_user_facing_reply in the next visible response. Do not omit the Connect Sanka URL, hide it behind a short label, abbreviate the token, or only tell the user to reconnect. Then retry the original request.',
    });
  });

  it('exposes Connect Sanka guidance when auth_status is checked from hosted Codex', async () => {
    const result = await crmAuthStatusTool.handler({
      reqContext: {
        client: {} as any,
        auth: {
          ...oauthContext({ authMode: 'none' }),
          oauth: {
            ...oauthContext().oauth,
            connectUrlForScopes: () => 'https://app.sanka.com/oauth/mcp/connect?token=secret-token',
          },
        },
        mcpClientInfo: {
          name: 'codex-mcp-client',
          version: '1.0.0',
        },
        toolProfile: 'hosted',
      },
      args: {
        required_scopes: ['crm:read'],
      },
    });

    expect(result.isError).toBe(true);
    const [content] = result.content;
    expect(content?.type).toBe('text');
    const text = content?.type === 'text' ? content.text : '';
    expect(text).toContain('/oauth/mcp/connect');
    expect(text).toContain('Connect Sanka');
    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        connected: false,
        auth_mode: 'none',
        tool_profile: 'hosted',
        client_name: 'codex-mcp-client',
        scopes: [],
        message: 'Sanka CRM is not connected yet. Open the Connect Sanka URL, finish connecting, then retry.',
        required_scopes: ['crm:read'],
        connect_url: 'https://app.sanka.com/oauth/mcp/connect?token=secret-token',
        connect_scopes: ['mcp:access'],
        resource_url: 'https://mcp.sanka.com/mcp',
        reconnect_mode: 'connect_sanka',
      }),
    );
    expect(result.structuredContent?.['authorization_url']).toBeUndefined();
    expect(result.structuredContent?.['resource_metadata_url']).toBeUndefined();
    expect(result._meta?.['mcp/www_authenticate']).toBeUndefined();
  });

  it('exposes Connect Sanka guidance when auth_status is checked from hosted Claude', async () => {
    const result = await crmAuthStatusTool.handler({
      reqContext: {
        client: {} as any,
        auth: {
          ...oauthContext({ authMode: 'none' }),
          oauth: {
            ...oauthContext().oauth,
            connectUrlForScopes: () => 'https://app.sanka.com/oauth/mcp/connect?token=secret-token',
          },
        },
        mcpClientInfo: {
          name: 'Claude Desktop',
          version: '1.0.0',
        },
        toolProfile: 'hosted',
      },
      args: {
        required_scopes: ['crm:read'],
      },
    });

    expect(result.isError).toBe(true);
    const [content] = result.content;
    expect(content?.type).toBe('text');
    const text = content?.type === 'text' ? content.text : '';
    expect(text).toContain('/oauth/mcp/connect');
    expect(text).toContain('Connect Sanka');
    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        connected: false,
        auth_mode: 'none',
        tool_profile: 'hosted',
        client_name: 'Claude Desktop',
        scopes: [],
        message: 'Sanka CRM is not connected yet. Open the Connect Sanka URL, finish connecting, then retry.',
        required_scopes: ['crm:read'],
        connect_url: 'https://app.sanka.com/oauth/mcp/connect?token=secret-token',
        connect_scopes: ['mcp:access'],
        resource_url: 'https://mcp.sanka.com/mcp',
        reconnect_mode: 'connect_sanka',
      }),
    );
    expect(result.structuredContent?.['authorization_url']).toBeUndefined();
    expect(result.structuredContent?.['resource_metadata_url']).toBeUndefined();
    expect(result._meta?.['mcp/www_authenticate']).toBeUndefined();
  });

  it('uses Connect Sanka metadata when connect_sanka is called from hosted Claude', async () => {
    const result = await crmConnectSankaTool.handler({
      reqContext: {
        client: {} as any,
        auth: oauthContext(),
        mcpClientInfo: {
          name: 'Claude',
          version: '1.0.0',
        },
        toolProfile: 'hosted',
      },
      args: {},
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      connected: true,
      auth_mode: 'oauth_bearer',
      tool_profile: 'hosted',
      client_name: 'Claude',
      scopes: [],
      message: 'Sanka CRM is already connected through this MCP session.',
      resource_url: 'https://mcp.sanka.com/mcp',
      reconnect_mode: 'connect_sanka',
      reconnect_instructions:
        'The assistant must include required_user_facing_reply in the next visible response. Do not omit the Connect Sanka URL, hide it behind a short label, abbreviate the token, or only tell the user to reconnect. Then retry the original request.',
    });
  });

  it('returns reauth metadata when list companies is called without authentication', async () => {
    const list = jest.fn();
    const connectUrl = 'https://app.sanka.com/oauth/mcp/connect?token=payload.signature';
    const auth = oauthContext({ authMode: 'none', scopes: [] });

    const result = await crmListCompaniesTool.handler({
      reqContext: {
        client: {
          public: {
            companies: { list },
          },
        } as any,
        auth: {
          ...auth,
          oauth: {
            ...auth.oauth,
            connectUrlForScopes: () => connectUrl,
          },
        },
        toolProfile: 'full',
      },
      args: { search: 'Acme' },
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toBeUndefined();
    expect(result.structuredContent?.['reconnect_mode']).toBe('connect_sanka');
    expect(result.structuredContent?.['connect_url']).toBe(connectUrl);
    expect(result.structuredContent?.['connect_url_markdown']).toBe(`[${connectUrl}](${connectUrl})`);
    expect(result.structuredContent?.['required_user_facing_reply']).toContain(
      `[${connectUrl}](${connectUrl})`,
    );
    expect(list).not.toHaveBeenCalled();
  });

  it('returns reauth metadata when list private messages is called without authentication', async () => {
    const list = jest.fn();

    const result = await crmListPrivateMessagesTool.handler({
      reqContext: {
        client: {
          public: {
            accountMessages: { list },
          },
        } as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'full',
      },
      args: { status: 'active' },
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toBeUndefined();
    expect(result.structuredContent?.['reconnect_mode']).toBe('connect_sanka');
    expect(list).not.toHaveBeenCalled();
  });

  it('returns reauth metadata when list deals is called without authentication', async () => {
    const list = jest.fn();

    const result = await crmListDealsTool.handler({
      reqContext: {
        client: {
          public: {
            deals: { list },
          },
        } as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'full',
      },
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toBeUndefined();
    expect(result.structuredContent?.['reconnect_mode']).toBe('connect_sanka');
    expect(list).not.toHaveBeenCalled();
  });

  it('returns reauth metadata when list tickets is called without authentication', async () => {
    const list = jest.fn();

    const result = await crmListTicketsTool.handler({
      reqContext: {
        client: {
          public: {
            tickets: { list },
          },
        } as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'full',
      },
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toBeUndefined();
    expect(result.structuredContent?.['reconnect_mode']).toBe('connect_sanka');
    expect(list).not.toHaveBeenCalled();
  });

  it('returns reauth metadata when list expenses is called without authentication', async () => {
    const list = jest.fn();

    const result = await crmListExpensesTool.handler({
      reqContext: {
        client: {
          public: {
            expenses: { list },
          },
        } as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'full',
      },
      args: {},
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toBeUndefined();
    expect(result.structuredContent?.['reconnect_mode']).toBe('connect_sanka');
    expect(list).not.toHaveBeenCalled();
  });

  it('returns reauth metadata when calendar bootstrap is called without authentication', async () => {
    const bootstrap = jest.fn();

    const result = await crmGetCalendarBootstrapTool.handler({
      reqContext: {
        client: {
          public: {
            calendar: { bootstrap },
          },
        } as any,
        auth: oauthContext({ authMode: 'none', scopes: [] }),
        toolProfile: 'full',
      },
      args: { slug: 'demo-event' },
    });

    expect(result.isError).toBe(true);
    expect(result._meta?.['mcp/www_authenticate']).toBeUndefined();
    expect(result.structuredContent?.['reconnect_mode']).toBe('connect_sanka');
    expect(bootstrap).not.toHaveBeenCalled();
  });
});
