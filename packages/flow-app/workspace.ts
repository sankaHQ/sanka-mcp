import type { App } from '@modelcontextprotocol/ext-apps';

type Workspace = { id: string; code: string; access: string; available: boolean; page: string };
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ?
    (value as Record<string, unknown>)
  : {};
const string = (value: unknown) => (typeof value === 'string' ? value : '');

function safePath(value: string, code: string): string | null {
  if (!/^\d+$/.test(code) || !value.startsWith('/') || value.startsWith('//') || /[\\\s]/.test(value))
    return null;
  try {
    const decoded = decodeURIComponent(value.split('?')[0] || '');
    if (/[\\\s]/.test(decoded) || decoded.split('/').some((segment) => segment === '.' || segment === '..'))
      return null;
    const url = new URL(value, 'https://app.sanka.com');
    if (
      url.origin !== 'https://app.sanka.com' ||
      !(url.pathname === `/${code}` || url.pathname.startsWith(`/${code}/`))
    )
      return null;
    const query = new URLSearchParams();
    for (const [key, value] of url.searchParams) {
      if (
        ['record', 'id', 'view', 'tab', 'workflow', 'run', 'drawer'].includes(key) &&
        /^[A-Za-z0-9_-]{1,128}$/.test(value)
      )
        query.set(key, value);
    }
    return `${url.pathname}${query.size ? `?${query}` : ''}`;
  } catch {
    return null;
  }
}

export function createWorkspaceView(
  app: App,
  language: () => 'en' | 'ja',
  status: (message: string) => void,
) {
  const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const configuration = object(JSON.parse(element('workspace-config')?.textContent || '{}'));
  const base = string(configuration['workspaceOrigin']);
  let workspace: Workspace = { id: '', code: '', access: '', available: false, page: '' };
  let iframe: HTMLIFrameElement | null = null;
  let frameOrigin = '';
  let launching = false;
  let lastChallenge = '';
  let currentPath = '';
  let visible = false;
  let openingTimer: ReturnType<typeof setTimeout> | undefined;
  const t = (en: string, ja: string) => (language() === 'ja' ? ja : en);
  const post = (message: Record<string, unknown>) => iframe?.contentWindow?.postMessage(message, frameOrigin);
  const host = () => post({ type: 'sanka.flow.host', theme: app.getHostContext()?.theme });

  function publishContext(path: string | null) {
    const url = path ? `https://app.sanka.com${path}` : null;
    void app
      .updateModelContext({
        structuredContent: {
          workspace_id: workspace.id,
          workspace_code: workspace.code,
          page: path,
          sanka_url: url,
        },
        content:
          url ?
            [
              {
                type: 'text',
                text: `The user is viewing this Sanka Flow page: ${url}. This is navigation context only; it does not authorize record changes. Use tools to read current data before acting.`,
              },
            ]
          : [],
      })
      .catch(() => undefined);
  }

  function show(showWorkspace: boolean) {
    if (visible !== showWorkspace && currentPath) publishContext(showWorkspace ? currentPath : null);
    visible = showWorkspace;
    document.body.classList.toggle('full-workspace', showWorkspace);
    element('full-workspace').hidden = !showWorkspace;
    element('workspace-content').hidden = showWorkspace || !workspace.id;
    element('workspace-switch').hidden = !showWorkspace;
  }

  function reset() {
    clearTimeout(openingTimer);
    iframe?.remove();
    iframe = null;
    frameOrigin = '';
    launching = false;
    lastChallenge = '';
    currentPath = '';
    show(false);
    publishContext(null);
  }

  function controls(busy = false) {
    element('workspace-launch').hidden = !base || !workspace.available;
    element<HTMLButtonElement>('open-workspace').disabled =
      busy || launching || !workspace.id || workspace.access !== 'full_workspace';
    element('workspace-consent').hidden = workspace.access === 'full_workspace';
    element<HTMLButtonElement>('workspace-external').disabled = !workspace.id;
  }

  function update(data: Record<string, unknown>) {
    const id = string(data['workspace_id']);
    if (id !== workspace.id) reset();
    workspace = {
      id,
      code: string(data['workspace_code']),
      access: string(data['workspace_access']),
      available: data['full_workspace_available'] === true,
      page: string(data['page']),
    };
    controls();
    const path = safePath(workspace.page, workspace.code);
    show(Boolean(iframe) && document.body.classList.contains('full-workspace'));
    if (iframe && path) {
      show(true);
      post({ type: 'sanka.flow.navigate', path });
    }
  }

  element('open-workspace').onclick = () => {
    if (workspace.access !== 'full_workspace' || !workspace.id || !base) return;
    if (iframe) {
      show(true);
      return;
    }
    const instance = crypto.randomUUID().replaceAll('-', '');
    const url = new URL(base);
    url.hostname = `${instance}.${url.hostname}`;
    frameOrigin = url.origin;
    iframe = document.createElement('iframe');
    iframe.title = 'Sanka Flow workspace';
    iframe.referrerPolicy = 'no-referrer';
    iframe.setAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-forms allow-downloads allow-popups',
    );
    iframe.src = `${frameOrigin}/chatgpt/bootstrap`;
    element('workspace-frame').replaceChildren(iframe);
    show(true);
    status(t('Opening your workspace…', 'ワークスペースを開いています…'));
    openingTimer = setTimeout(
      () =>
        status(
          t(
            'The workspace is still opening. Check the ChatGPT approval, or open it in Sanka.',
            'ワークスペースを開いています。ChatGPTの許可を確認するか、Sankaで開いてください。',
          ),
        ),
      30_000,
    );
    void app.requestDisplayMode({ mode: 'fullscreen' }).catch(() => undefined);
  };
  element('workspace-switch').onclick = () => show(false);
  element('workspace-external').onclick = () => {
    const path = safePath(currentPath || workspace.page, workspace.code) || `/${workspace.code}`;
    if (workspace.id)
      void app
        .openLink({ url: `https://app.sanka.com${path}` })
        .catch(() => status(t('Open this page from Sanka.', 'Sankaからこのページを開いてください。')));
  };
  element('workspace-retry').onclick = () => {
    reset();
    element<HTMLButtonElement>('open-workspace').click();
  };

  window.addEventListener('message', (event) => {
    if (!iframe || event.source !== iframe.contentWindow || event.origin !== frameOrigin) return;
    const message = object(event.data);
    const type = string(message['type']);
    if (type === 'sanka.flow.bootstrap') {
      const challenge = string(message['challenge']);
      if (!/^[a-f0-9]{64}$/.test(challenge) || launching || challenge === lastChallenge) return;
      lastChallenge = challenge;
      launching = true;
      controls();
      const expected = workspace.id,
        origin = frameOrigin;
      void (async () => {
        try {
          const result = await app.callServerTool({
            name: 'start_flow_workspace_session',
            arguments: {
              expected_workspace_id: expected,
              browser_origin: origin,
              browser_challenge: challenge,
            },
          });
          if (workspace.id !== expected || frameOrigin !== origin) return;
          if (result.isError) throw new Error('launch');
          const session = object(object(result._meta)['flow_workspace_session']);
          const ticket = string(session['ticket']);
          if (!/^scwt_[A-Za-z0-9_-]{43}$/.test(ticket) || session['browser_origin'] !== origin)
            throw new Error('launch');
          post({
            type: 'sanka.flow.launch',
            ticket,
            language: language(),
            path: safePath(workspace.page, workspace.code) || `/${workspace.code}`,
          });
        } catch {
          if (frameOrigin === origin) {
            clearTimeout(openingTimer);
            status(
              t(
                'The workspace could not be opened. Check the ChatGPT approval and connection, then try again.',
                'ワークスペースを開けませんでした。ChatGPTの許可と接続を確認し、再度開いてください。',
              ),
            );
          }
        } finally {
          launching = false;
          controls();
        }
      })();
      return;
    }
    if (type === 'sanka.flow.launch-error') {
      clearTimeout(openingTimer);
      status(
        t(
          'Open the workspace again. If cookies are blocked, open the page in Sanka.',
          'ワークスペースを再度開いてください。Cookieがブロックされている場合は、Sankaで開いてください。',
        ),
      );
      return;
    }
    if (message['workspace_id'] !== workspace.id || message['workspace_code'] !== workspace.code) return;
    const path = safePath(string(message['path']), workspace.code);
    if (!path) return;
    const url = `https://app.sanka.com${path}`;
    if (type === 'sanka.flow.context') {
      clearTimeout(openingTimer);
      status('');
      host();
      if (path === currentPath) return;
      currentPath = path;
      if (visible) publishContext(path);
    } else if (type === 'sanka.flow.share') {
      // The message is generated by Sanka's own share button; do not forward
      // arbitrary child-supplied prose or record contents into the conversation.
      void app
        .sendMessage({
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${t(
                'Help me with this Sanka Flow page.',
                'このSanka Flowのページについて相談したいです。',
              )} ${url}`,
            },
          ],
        })
        .then((result) => post({ type: 'sanka.flow.shared', success: !result.isError }))
        .catch(() => post({ type: 'sanka.flow.shared', success: false }));
    } else if (type === 'sanka.flow.open-external') {
      void app
        .openLink({ url })
        .catch(() => status(t('Open this page from Sanka.', 'Sankaからこのページを開いてください。')));
    }
  });
  app.addEventListener('hostcontextchanged', host);
  return { update, reset, controls };
}
