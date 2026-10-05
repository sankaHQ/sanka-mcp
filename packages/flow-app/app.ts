import { App, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';
import { createWorkspaceView } from './workspace';

const app = new App(
  { name: 'Sanka Flow', version: '0.4.0' },
  { availableDisplayModes: ['inline', 'fullscreen'] },
);
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ?
    (value as Record<string, unknown>)
  : {};
const text = (value: unknown) => (typeof value === 'string' ? value : '');
type ToolResult = { isError?: boolean; structuredContent?: unknown; _meta?: unknown };
let connectURL = '';
let busy = true;
let language: 'en' | 'ja' = navigator.language.startsWith('ja') ? 'ja' : 'en';
const t = (en: string, ja: string) => (language === 'ja' ? ja : en);
const workspaceView = createWorkspaceView(app, () => language, status);

function status(message: string) {
  element('notice').textContent = message;
}
function setBusy(value: boolean) {
  busy = value;
  document.querySelectorAll<HTMLButtonElement>('button').forEach((control) => {
    control.disabled = value;
  });
  workspaceView.controls(value);
}
function showConnection(data: Record<string, unknown>) {
  workspaceView.reset();
  workspaceView.update({});
  connectURL = '';
  try {
    const url = new URL(text(data['connect_url']));
    if (url.origin === 'https://app.sanka.com' && !url.username && !url.password) connectURL = url.href;
  } catch {
    /* Reconnect from the ChatGPT connection settings. */
  }
  element('connect').hidden = !connectURL;
}
function renderWorkspace(result: ToolResult) {
  const data = record(result.structuredContent);
  if (result.isError || data['error']) {
    workspaceView.reset();
    workspaceView.update({});
    const error = record(data['error']);
    const code = text(data['code']) || text(data['error']) || text(error['code']);
    const httpStatus = Number(data['status_code']);
    if (code === 'invalid_token' || httpStatus === 401) {
      showConnection(data);
      throw new Error(
        t('Reconnect Sanka in ChatGPT, then refresh.', 'ChatGPTでSankaに再接続し、再読み込みしてください。'),
      );
    }
    const message =
      code === 'WORKSPACE_CONTEXT_MISMATCH' ?
        t(
          'The workspace changed. Refresh before continuing.',
          'ワークスペースが変更されました。再読み込みしてください。',
        )
      : httpStatus === 403 || code === 'insufficient_scope' ?
        t(
          'You do not have permission for this action. Ask a workspace administrator to check your access.',
          'この操作の権限がありません。ワークスペースの管理者に確認してください。',
        )
      : t(
          'Unable to load Sanka Flow. Refresh and try again.',
          'Sanka Flowを読み込めませんでした。再読み込みしてください。',
        );
    const reference = text(data['ctx_id']) || text(record(data['meta'])['ctx_id']);
    throw new Error(reference ? `${message} (${reference})` : message);
  }
  element('workspace-name').textContent =
    text(data['workspace_name']) || t('Your workspace', 'ワークスペース');
  element('workspace-id').textContent =
    text(data['workspace_id']) ?
      `${t('Workspace', 'ワークスペース')} ${text(data['workspace_code']) || text(data['workspace_id'])}`
    : t('No workspace selected', 'ワークスペース未選択');
  element('connect').hidden = true;
  status(
    text(data['workspace_id']) ? '' : (
      t('Select a workspace when connecting Sanka.', 'Sankaへの接続時にワークスペースを選択してください。')
    ),
  );
  workspaceView.update(data, record(result._meta));
}
async function run(action: () => Promise<void>) {
  if (busy) return;
  setBusy(true);
  status(t('Loading…', '読み込み中…'));
  try {
    await action();
    status('');
  } catch (error) {
    status(
      error instanceof Error ?
        error.message
      : t('Unable to load Sanka Flow.', 'Sanka Flowを読み込めませんでした。'),
    );
  } finally {
    setBusy(false);
  }
}
function applyLanguage() {
  document.documentElement.lang = language;
  document.querySelectorAll<HTMLElement>('[data-en]').forEach((node) => {
    node.textContent = node.dataset[language] || node.dataset['en'] || '';
  });
  element('language').textContent = language === 'en' ? '日本語' : 'English';
}
element('language').onclick = () => {
  language = language === 'en' ? 'ja' : 'en';
  applyLanguage();
  workspaceView.controls();
};
element('refresh').onclick = () =>
  void run(async () =>
    renderWorkspace(await app.callServerTool({ name: 'open_flow_workspace', arguments: {} })),
  );
element('connect').onclick = () =>
  void run(async () => {
    if (connectURL) await app.openLink({ url: connectURL });
  });
function applyHost(context: ReturnType<App['getHostContext']>) {
  if (context?.theme) applyDocumentTheme(context.theme);
  if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables);
}
app.addEventListener('hostcontextchanged', applyHost);
app.addEventListener('toolresult', (result) => {
  try {
    renderWorkspace(result);
  } catch (error) {
    status(
      error instanceof Error ?
        error.message
      : t('Unable to load Sanka Flow.', 'Sanka Flowを読み込めませんでした。'),
    );
  }
});
applyLanguage();
void app
  .connect()
  .then(() => {
    applyHost(app.getHostContext());
    setBusy(false);
    workspaceView.ready();
  })
  .catch(() => {
    setBusy(true);
    status(
      t(
        'Open Sanka Flow from the plugin in ChatGPT to connect.',
        'ChatGPTのプラグインからSanka Flowを開いてください。',
      ),
    );
  });
