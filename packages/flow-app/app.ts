import { App, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';

const app = new App(
  { name: 'Sanka Flow', version: '0.2.0' },
  { availableDisplayModes: ['inline', 'fullscreen'] },
);
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ?
    (value as Record<string, unknown>)
  : {};
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const items = (value: unknown) => (Array.isArray(value) ? value : []);
type ToolResult = { isError?: boolean; structuredContent?: unknown; content?: unknown[] };
let workspaceID = '';
let contextVersion = 0;
let connectURL = '';
let busy = true;
let language: 'en' | 'ja' = navigator.language.startsWith('ja') ? 'ja' : 'en';
let review: { orderID: string; token: string } | null = null;
let submittedOrderID = '';
const t = (en: string, ja: string) => (language === 'ja' ? ja : en);
const unknown = () => t('Not available', '未確認');

function status(message: string) {
  element('notice').textContent = message;
}
function setBusy(value: boolean) {
  busy = value;
  document.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button').forEach((control) => {
    control.disabled = value;
  });
  element<HTMLButtonElement>('create').disabled = value || !review;
}
function clearResults() {
  review = null;
  submittedOrderID = '';
  for (const id of ['preview-result', 'run-result', 'invoice-result', 'confirmation', 'recovery']) {
    if (id !== 'confirmation' && id !== 'recovery') element(id).replaceChildren();
    element(id).hidden = true;
  }
}
function checkResult(result: ToolResult): Record<string, unknown> {
  const data = record(result.structuredContent);
  if (result.isError || data['error']) {
    const error = record(data['error']);
    const code = text(data['error']) || text(error['code']);
    if (code === 'WORKSPACE_CONTEXT_MISMATCH') {
      workspaceID = '';
      clearResults();
      element('workspace-content').hidden = true;
      throw new Error(
        t(
          'The workspace changed. Refresh before continuing.',
          'ワークスペースが変更されました。再読み込みしてください。',
        ),
      );
    }
    if (code === 'invalid_token' || code === 'insufficient_scope') {
      showConnection(data);
      throw new Error(
        t('Reconnect Sanka in ChatGPT, then refresh.', 'ChatGPTでSankaに再接続し、再読み込みしてください。'),
      );
    }
    throw new Error(
      text(data['message']) ||
        text(error['message']) ||
        t('Sanka could not complete this request.', 'リクエストを完了できませんでした。'),
    );
  }
  return data;
}
async function call(name: string, args: Record<string, unknown>) {
  const version = contextVersion;
  const result = await app.callServerTool({
    name,
    arguments: { expected_workspace_id: workspaceID, ...args },
  });
  if (version !== contextVersion) {
    throw new Error(
      t('Workspace context changed. Review again.', 'ワークスペースが更新されました。再確認してください。'),
    );
  }
  return checkResult(result);
}
function showConnection(data: Record<string, unknown>) {
  contextVersion++;
  workspaceID = '';
  clearResults();
  element('workspace-content').hidden = true;
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
  const data = checkResult(result);
  contextVersion++;
  clearResults();
  const nextID = text(data['workspace_id']);
  if (workspaceID !== nextID) {
    element<HTMLInputElement>('order-id').value = '';
    element<HTMLInputElement>('run-id').value = '';
  }
  workspaceID = nextID;
  element('workspace-name').textContent =
    text(data['workspace_name']) || t('Your workspace', 'ワークスペース');
  element('workspace-id').textContent =
    workspaceID ?
      `${t('Workspace', 'ワークスペース')} ${text(data['workspace_code']) || workspaceID}`
    : t('No workspace selected', 'ワークスペース未選択');
  element('workspace-content').hidden = !workspaceID;
  element('connect').hidden = true;
  status(
    workspaceID ? '' : (
      t('Select a workspace when connecting Sanka.', 'Sankaへの接続時にワークスペースを選択してください。')
    ),
  );
}
function renderResult(target: string, title: string, message: string, payload: Record<string, unknown>) {
  const container = element(target);
  const heading = document.createElement('h3');
  heading.textContent = title;
  const paragraph = document.createElement('p');
  paragraph.textContent = message;
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = t('View details', '詳細を表示');
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(payload, null, 2);
  details.append(summary, pre);
  container.replaceChildren(heading, paragraph, details);
  container.hidden = false;
  return container;
}
function fields(container: HTMLElement, values: [string, unknown][]) {
  const list = document.createElement('dl');
  for (const [label, value] of values) {
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent =
      value === null || value === undefined || value === '' ? unknown() : String(value);
    list.append(term, description);
  }
  container.insertBefore(list, container.querySelector('details'));
}
function renderPreview(data: Record<string, unknown>) {
  const preview = record(data['preview']);
  const conversion = record(preview['result']);
  const order = record(conversion['source_order']);
  const draft = record(conversion['invoice_draft']);
  const properties = record(draft['properties']);
  const ready = preview['status'] === 'previewed' && conversion['ready'] === true;
  const container = renderResult(
    'preview-result',
    ready ?
      t('Review invoice draft', '売上請求の下書きを確認')
    : t('This order needs attention', '受注の確認が必要です'),
    ready ?
      t(
        'Confirm the amount and billing details before creating.',
        '金額と請求内容を確認してから作成してください。',
      )
    : text(conversion['reason']) || t('Review the blockers below.', '以下の未解決項目を確認してください。'),
    preview,
  );
  fields(container, [
    [t('Order', '受注'), order['record_id'] || order['id']],
    [t('Customer', '取引先'), order['customer_label']],
    [t('Total', '合計'), properties['total_price'] ?? order['total_price']],
    [t('Currency', '通貨'), properties['currency'] ?? order['currency']],
    [t('Line items', '品目数'), draft['line_item_count']],
    [t('Invoice date', '売上請求日'), properties['invoice_date'] ?? properties['start_date']],
    [t('Due date', '支払期日'), properties['due_date']],
    [t('Status', 'ステータス'), properties['status']],
  ]);
  const sourceLines = items(data['source_line_items']);
  if (sourceLines.length) {
    const heading = document.createElement('h4');
    heading.textContent = t('Source order line items', '受注の品目');
    container.insertBefore(heading, container.querySelector('details'));
    for (const value of sourceLines) {
      const line = record(value);
      const paragraph = document.createElement('p');
      paragraph.textContent = `${
        text(line['custom_item_name']) || text(line['item_name']) || t('Line item', '品目')
      } · ${t('Quantity', '数量')}: ${line['quantity'] ?? unknown()} · ${t('Amount', '金額')}: ${
        line['total_price'] ?? unknown()
      }`;
      container.insertBefore(paragraph, container.querySelector('details'));
    }
  }
  const warnings = [...items(preview['warnings']), ...items(conversion['failures'])];
  if (warnings.length) {
    const list = document.createElement('ul');
    for (const warning of warnings) {
      const li = document.createElement('li');
      li.textContent = typeof warning === 'string' ? warning : JSON.stringify(warning);
      list.append(li);
    }
    container.insertBefore(list, container.querySelector('details'));
  }
  review =
    ready && text(data['order_id']) && text(data['review_token']) ?
      { orderID: text(data['order_id']), token: text(data['review_token']) }
    : null;
  element('confirmation').hidden = !review;
}
function safeRecordURL(value: unknown) {
  try {
    const url = new URL(text(value));
    return (
        ['https://app.sanka.com', 'https://flow.sanka.com'].includes(url.origin) &&
          !url.username &&
          !url.password
      ) ?
        url.href
      : '';
  } catch {
    return '';
  }
}
async function readInvoices(result: Record<string, unknown>) {
  const records = items(result['created_records'])
    .map(record)
    .filter((item) => item['object_type'] === 'invoice');
  const container = element('invoice-result');
  container.replaceChildren();
  container.hidden = false;
  for (const created of records) {
    const id = text(created['id']);
    if (!id) continue;
    const card = document.createElement('article');
    container.append(card);
    const title = document.createElement('h3');
    title.textContent = `${t('Invoice', '売上請求')} ${text(created['record_id']) || id}`;
    card.append(title);
    try {
      const invoice = await call('get_flow_invoice', { invoice_id: id });
      fields(card, [
        [t('Saved status', '保存済みステータス'), invoice['status']],
        [t('Total', '合計'), invoice['total_price']],
        [t('Currency', '通貨'), invoice['currency']],
        [
          t('Saved line items', '保存済み品目数'),
          Array.isArray(invoice['line_items']) ? invoice['line_items'].length : null,
        ],
      ]);
      const lines = items(invoice['line_items']);
      for (const value of lines) {
        const line = record(value);
        const paragraph = document.createElement('p');
        paragraph.textContent = `${
          text(line['custom_item_name']) ||
          text(line['name']) ||
          text(line['item_name']) ||
          text(line['id']) ||
          t('Line item', '品目')
        } · ${t('Quantity', '数量')}: ${line['quantity'] ?? unknown()} · ${t('Amount', '金額')}: ${
          line['total_price'] ?? unknown()
        }`;
        card.append(paragraph);
      }
      const url = safeRecordURL(invoice['app_url'] || invoice['url'] || created['app_url']);
      if (url) {
        const button = document.createElement('button');
        button.textContent = t('Open in Sanka', 'Sankaで開く');
        button.onclick = () => void app.openLink({ url });
        card.append(button);
      }
    } catch (error) {
      const paragraph = document.createElement('p');
      paragraph.textContent = `${t(
        'Created record returned; saved details are not verified yet. Use Check status to read again.',
        '作成結果にレコードが含まれていますが、保存内容は未確認です。「状態を確認」で再取得してください。',
      )} ${error instanceof Error ? error.message : ''}`;
      card.append(paragraph);
    }
  }
}
async function renderAttempt(data: Record<string, unknown>) {
  submittedOrderID = text(data['order_id']);
  review = null;
  element('confirmation').hidden = true;
  element('preview-result').hidden = true;
  element('recovery').hidden = false;
  const result = record(data['result']);
  const outcome = text(data['status']);
  renderResult(
    'run-result',
    outcome === 'resolved' ?
      `${t('Workflow', 'ワークフロー')}: ${text(result['status']) || unknown()}`
    : t('Submission recorded', '実行リクエストを記録しました'),
    outcome === 'resolved' ?
      t(
        'Saved invoice details appear below when verification succeeds.',
        '保存内容を確認できた売上請求は、以下に表示されます。',
      )
    : t(
        'The result is not confirmed. Check status or review the order in Sanka before any further billing.',
        '結果は未確認です。追加の請求操作を行う前に、状態を確認するかSankaで受注を確認してください。',
      ),
    data,
  );
  if (outcome === 'resolved') await readInvoices(result);
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
  clearResults();
};
element('refresh').onclick = () =>
  void run(async () =>
    renderWorkspace(await app.callServerTool({ name: 'open_flow_workspace', arguments: {} })),
  );
element('connect').onclick = () =>
  void run(async () => {
    if (connectURL) await app.openLink({ url: connectURL });
  });
element('order-id').addEventListener('input', clearResults);
element('preview-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const orderID = element<HTMLInputElement>('order-id').value.trim();
  if (!workspaceID || !orderID) return;
  void run(async () => {
    clearResults();
    const attempt = record((await call('get_flow_invoice_attempt', { order_id: orderID }))['data']);
    if (attempt['status'] !== 'not_started') {
      await renderAttempt(attempt);
      return;
    }
    renderPreview(record((await call('preview_flow_invoice', { order_id: orderID, language }))['data']));
  });
});
element('create').onclick = () =>
  void run(async () => {
    const current = review;
    if (!current) return;
    review = null;
    submittedOrderID = current.orderID;
    element<HTMLInputElement>('order-id').value = current.orderID;
    element('confirmation').hidden = true;
    element('recovery').hidden = false;
    // No automatic write retries. A lost response leaves the recovery action visible.
    const response = await call('start_flow_invoice', {
      order_id: current.orderID,
      review_token: current.token,
      language,
    });
    await renderAttempt(record(response['data']));
  });
element('recover').onclick = () =>
  void run(async () => {
    if (!submittedOrderID) return;
    const data = record((await call('get_flow_invoice_attempt', { order_id: submittedOrderID }))['data']);
    if (data['status'] === 'not_started') {
      clearResults();
      renderResult(
        'run-result',
        t('No submission recorded', '実行リクエスト未記録'),
        t(
          'No submission was recorded. Preview the order again.',
          '実行リクエストは記録されていません。受注を再確認してください。',
        ),
        data,
      );
    } else await renderAttempt(data);
  });
element('run-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const runID = element<HTMLInputElement>('run-id').value.trim();
  if (!workspaceID || !runID) return;
  void run(async () => {
    const data = record((await call('get_workflow_run', { run_id: runID }))['data']);
    renderResult(
      'run-result',
      `${t('Workflow', 'ワークフロー')} ${text(data['status']) || unknown()}`,
      t(
        'This is the recorded workflow status. It does not verify invoice contents.',
        '記録されたワークフローの状態です。売上請求の保存内容は個別に確認してください。',
      ),
      data,
    );
  });
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
    status(error instanceof Error ? error.message : unknown());
  }
});
applyLanguage();
void app
  .connect()
  .then(() => {
    applyHost(app.getHostContext());
    setBusy(false);
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
