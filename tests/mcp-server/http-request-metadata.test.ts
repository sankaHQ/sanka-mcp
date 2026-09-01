import { __testing } from '../../packages/mcp-server/src/http';

describe('MCP request metadata extraction', () => {
  it('extracts model metadata from tools/call params _meta', () => {
    const metadata = __testing.extractRequestModelInfo({
      headers: {},
      body: {
        method: 'tools/call',
        params: {
          name: 'list_companies',
          arguments: {},
          _meta: {
            modelName: 'claude-sonnet-4-6',
            modelProvider: 'anthropic',
          },
        },
      },
    } as never);

    expect(metadata).toEqual({
      modelName: 'claude-sonnet-4-6',
      modelProvider: 'anthropic',
    });
  });

  it('extracts nested model metadata from tools/call params _meta', () => {
    const metadata = __testing.extractRequestModelInfo({
      headers: {},
      body: {
        method: 'tools/call',
        params: {
          name: 'list_companies',
          arguments: {},
          _meta: {
            model: {
              name: 'gpt-5.5',
              provider: 'openai',
            },
          },
        },
      },
    } as never);

    expect(metadata).toEqual({
      modelName: 'gpt-5.5',
      modelProvider: 'openai',
    });
  });

  it('prefers explicit model headers over tools/call _meta', () => {
    const metadata = __testing.extractRequestModelInfo({
      headers: {
        'x-sanka-ai-model': 'gpt-5.5',
        'x-sanka-ai-provider': 'openai',
      },
      body: {
        method: 'tools/call',
        params: {
          name: 'list_companies',
          _meta: {
            modelName: 'claude-sonnet-4-6',
            modelProvider: 'anthropic',
          },
        },
      },
    } as never);

    expect(metadata).toEqual({
      modelName: 'gpt-5.5',
      modelProvider: 'openai',
    });
  });

  it('keeps both Claude Cowork and user-agent client signals', () => {
    const clientInfo = __testing.inferRequestMcpClientInfo({
      headers: {
        'x-anthropic-client': 'Cowork',
        'user-agent': 'Claude-User',
      },
    } as never);

    expect(clientInfo).toEqual({
      name: 'Claude',
      version: 'Cowork / Claude-User',
    });
  });
});
