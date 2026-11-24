import {
  DESK_ACTION_TOOL_NAMES,
  DESK_TOOL_NAMES,
  DESK_WORKFLOW_TOOL_NAMES,
  DeskAvailability,
  readDeskAvailability,
} from './desk-tools';
import { SHARED_WORKFLOW_GUIDANCE } from './instructions';
import { ACCOUNT_CALENDAR_TOOL_NAMES } from './account-calendar-tools';
import { READ_ACTION_TOOL_NAMES } from './read-action-tools';
import { McpTool, ToolCallResult } from './types';

const CAPABILITY_GUIDANCE_VERSION = '2026-11-24.desk-google-actions.v1';

// "presentation scheduled" is a HubSpot deal stage, not a deck.
const PRESENTATION_INTENT = /\b(?:presentations?(?! ?scheduled)|slides?|decks?|power ?points?|pptx)\b/;
const PRESENTATION_INTENT_JA = ['スライド', 'プレゼン', 'パワーポイント', 'パワポ'];
const MIGRATION_INTENT = /\bmigrat(?:e|es|ing|ion|ions)\b/;

// IT requests an employee sends to their company's IT service desk (Sanka Desk).
const DESK_SERVICE_TERMS = [
  'sanka desk',
  'service desk',
  'help desk',
  'helpdesk',
  'desk_',
  'it_request',
  'ヘルプデスク',
  'サービスデスク',
  '情シス',
  '情報システム',
];
// "IT" in the user's own casing followed by who handles it; a lowercase "it support" is a pronoun.
const IT_SERVICE_INTENT =
  /\bIT[ -]?(?:[Hh]elp|[Ss]upport|[Rr]equest|[Tt]icket|[Tt]eam|[Dd]esk|[Aa]dmin|[Dd]epartment|部門|担当|サポート|チーム)/;
const DESK_REQUEST_TERMS = [
  'log in',
  'login',
  'log-in',
  'sign in',
  'sign-in',
  'signin',
  'locked out',
  'password',
  'two-factor',
  '2fa',
  'mfa',
  'access to',
  'need access',
  'request access',
  'access request',
  'grant access',
  'lost access',
  "can't access",
  'cannot access',
  'access right',
  'my account',
  'user account',
  'account locked',
  'account is locked',
  'license',
  'licence',
  'new hire',
  'joiner',
  'leaver',
  'app setting',
  'ログイン',
  'サインイン',
  'パスワード',
  '二段階認証',
  'アクセス権',
  'アクセスでき',
  '権限',
  'アカウント',
  'ライセンス',
  'アプリの設定',
];
// Automations, permission sets and asset records are admin work, not requests to the IT desk; so
// is building an app (isAppBuilderIntent).
const DESK_EXCLUDED_TERMS = [
  'workflow',
  'automation',
  'automate',
  'permission set',
  'asset',
  'ワークフロー',
  '自動化',
  '権限セット',
  '資産',
];
const TICKET_TERMS = ['ticket', 'チケット'];

// Gmail settings and Google Calendar changes Desk makes as the company's Google admin (Actions an
// admin opts in to): an auto-reply, a signature, mailbox delegation or forwarding; sharing someone's
// calendar, a meeting room, handing meetings to a successor, an interview at the first time every
// interviewer is free. Creating or moving the person's own events keeps the calendar tools, and
// reading their calendar or mail stays a read Action.
const DESK_GOOGLE_ACTION_TERMS = [
  'auto-reply',
  'auto reply',
  'autoreply',
  'out of office',
  'out-of-office',
  'vacation responder',
  'email signature',
  'e-mail signature',
  'mail signature',
  'gmail signature',
  'mailbox delegation',
  'mail delegation',
  'delegate my mailbox',
  'delegate access to my mailbox',
  'email forwarding',
  'mail forwarding',
  'stop forwarding',
  'share my calendar',
  'share his calendar',
  'share her calendar',
  'share their calendar',
  'share the calendar',
  'sharing my calendar',
  'calendar sharing',
  'access to my calendar',
  'access to the calendar',
  'access to their calendar',
  'meeting room',
  'conference room',
  'calendar resource',
  'hand over my meetings',
  'hand over meetings',
  'hand over their meetings',
  'handover of meetings',
  'meeting handover',
  'transfer my meetings',
  'transfer meetings',
  'meetings to my successor',
  'meetings to their successor',
  'interviewers',
  '自動返信',
  '不在通知',
  'メール署名',
  'メールの署名',
  'メール転送',
  '転送を止',
  'メールボックスの委任',
  'メールの委任',
  'カレンダーを共有',
  'カレンダーの共有',
  'カレンダー共有',
  '会議室',
  '予定を引き継',
  '会議を引き継',
  '面接官',
  '面接の日程を調整',
  '面接の日程調整',
];

// A change to a person's account or access in a company system: a Desk Action, such as
// hubspot_account_setup. A system, a change and an account word; CRM records stay with their tools.
const DESK_ACTION_SYSTEM_TERMS = [
  'hubspot',
  'salesforce',
  'google',
  'okta',
  'microsoft',
  'office 365',
  'm365',
  'entra',
  'azure ad',
  'slack',
  'zoom',
  'sanka flow',
];
const DESK_ACTION_CHANGE_TERMS = [
  'set up',
  'setup',
  'create',
  'add',
  'invite',
  'provision',
  'give',
  'grant',
  'assign',
  'remove',
  'revoke',
  'deactivate',
  'disable',
  'suspend',
  'offboard',
  'onboard',
  '作成',
  '追加',
  '発行',
  '付与',
  '招待',
  '削除',
  '停止',
  '無効',
  '割り当て',
  'セットアップ',
];
const DESK_ACTION_ACCOUNT_TERMS = [
  'account',
  'user',
  'access',
  'licen',
  'seat',
  'member',
  'new hire',
  'joiner',
  'leaver',
  'アカウント',
  'ユーザー',
  'アクセス',
  'ライセンス',
  'メンバー',
  '入社',
  '退職',
];
const DESK_ACTION_EXCLUDED_TERMS = [
  'contact',
  'deal',
  'opportunit',
  'lead',
  'record',
  'pipeline',
  'propert',
  'invoice',
  'order',
  'sync',
  'import',
  'export',
  '取引先',
  '商談',
  'レコード',
];

// Starting one of the company's Desk Workflows: a Desk word, a workflow and a start word. Building
// or changing one stays on the Desk console; other workflows keep their own tools.
const DESK_WORD = /\bdesk\b/;
const WORKFLOW_TERMS = ['workflow', 'ワークフロー'];
const WORKFLOW_RUN_INTENT = /\b(?:run|start|trigger|kick ?off|launch)\b/;
const WORKFLOW_RUN_TERMS_JA = ['実行', '起動', '走らせ', '開始'];

const isDeskWorkflowRunIntent = (raw: string, combined: string): boolean =>
  includesAny(combined, WORKFLOW_TERMS) &&
  (DESK_WORD.test(combined) || includesAny(combined, DESK_SERVICE_TERMS) || IT_SERVICE_INTENT.test(raw)) &&
  (WORKFLOW_RUN_INTENT.test(combined) || includesAny(combined, WORKFLOW_RUN_TERMS_JA));

// Building with the app builder: a product term plus a build term.
const APP_BUILDER_PRODUCT_TERMS = [
  'app builder',
  'blueprint',
  'erp',
  'crm',
  'module',
  'side menu',
  'permission set',
  'governance',
  'モジュール',
  'サイドメニュー',
  '権限',
  'ガバナンス',
];
const APP_BUILDER_BUILD_TERMS = [
  'build',
  'configure',
  'setup',
  'set up',
  'implement',
  'schema',
  '構築',
  '設定',
  'セットアップ',
  '実装',
  'スキーマ',
];

// Google Workspace and Microsoft 365 account steps for IT onboarding and offboarding.
const DIRECTORY_STEP_TERMS = [
  'offboarding',
  'off-boarding',
  'deprovision',
  'user provisioning',
  'identity provisioning',
  'directory account',
  'directory-account',
  'directory-groups',
  'directory-licenses',
  'identity_directory',
  'オフボーディング',
];
const DIRECTORY_PROVIDER_TERMS = [
  'google workspace',
  'g suite',
  'microsoft 365',
  'office 365',
  'm365',
  'entra id',
  'azure ad',
];
const DIRECTORY_ACCOUNT_TERMS = [
  'account',
  'licen',
  'group',
  'provision',
  'suspend',
  'onboarding',
  'アカウント',
  'ライセンス',
  'グループ',
  '入社',
  '退職',
  '退社',
];
// Alone, onboarding can mean a customer or a new Sanka workspace, and 退職 can mean payroll.
const EMPLOYEE_LIFECYCLE_TERMS = ['onboarding', 'オンボーディング', '入社', '退職', '退社'];
const EMPLOYEE_ACCOUNT_TERMS = ['employee', 'staff', 'it onboarding', 'アカウント'];

// Finding people for companies a person already has, or filling in a company's main line: Flow
// Actions. Only with a word for what to search, so "add a contact to Acme" stays create_contact.
const FLOW_ACTION_SEARCH_TERMS = [
  'enrich',
  'find',
  'look up',
  'lookup',
  'search for',
  'source',
  'discover',
  'エンリッチ',
  '探',
  '調べ',
  '見つけ',
];
const FLOW_ACTION_PEOPLE_TERMS = [
  'contact',
  'people',
  'person',
  'email',
  'e-mail',
  'decision maker',
  'decision-maker',
  '連絡先',
  '担当者',
  'キーパーソン',
  '決裁者',
  'メール',
];
const FLOW_ACTION_DETAIL_TERMS = [
  'phone',
  'address',
  'company details',
  'main line',
  '電話',
  '住所',
  '企業情報',
];
const FLOW_ACTION_TARGET_TERMS = [
  'compan',
  'lead',
  'account',
  'prospect',
  'list',
  '企業',
  '会社',
  'リード',
  'リスト',
  '取引先',
];
// A named provider, or building an automation, is that tool's work.
const FLOW_ACTION_EXCLUDED_TERMS = [
  'hubspot',
  'salesforce',
  'workflow',
  'automation',
  'automate',
  'ワークフロー',
  '自動化',
];

// A search or total in the person's own HubSpot or Salesforce is a read Action: a provider, a CRM
// object and a search or total word. Changes, automations, syncs, billing and pipeline-snapshot
// questions keep their own tools, and Sanka's own records keep query_records and aggregate_records.
const READ_ACTION_PROVIDER_TERMS = ['hubspot', 'salesforce', 'ハブスポット', 'セールスフォース'];
const READ_ACTION_OBJECT_TERMS = [
  'deal',
  'opportunit',
  'pipeline',
  'contact',
  'compan',
  'account',
  'lead',
  '商談',
  '取引',
  'コンタクト',
  '会社',
  'リード',
  'パイプライン',
];
const READ_ACTION_READ_TERMS = [
  'search',
  'find',
  'list',
  'show',
  'how many',
  'how much',
  'count',
  'total',
  'sum',
  'average',
  'by stage',
  'by owner',
  'by month',
  'per stage',
  'per owner',
  'per month',
  'breakdown',
  '検索',
  '一覧',
  '件数',
  '何件',
  '合計',
  '平均',
  '集計',
  'いくら',
];
const READ_ACTION_EXCLUDED_TERMS = [
  'workflow',
  'automation',
  'automate',
  'create',
  'update',
  'delete',
  'remove',
  'merge',
  'dedupe',
  'duplicate',
  'sync',
  'import',
  'export',
  'migrat',
  'propert',
  'schema',
  'line item',
  'snapshot',
  'movement',
  'shrink',
  'estimate',
  'quote',
  'invoice',
  'billed',
  'unpaid',
  'revenue',
  'order',
  'subscription',
  'set up',
  'setup',
  'invite',
  'licen',
  'login',
  'log in',
  'sign in',
  'password',
  'access',
  'ワークフロー',
  '自動化',
  '作成',
  '更新',
  '削除',
  '同期',
  'インポート',
  'エクスポート',
  '移行',
  '見積',
  '請求',
  '受注',
];

// The shared inbox of the workspace's Gmail connection: workspace message tools, not read Actions.
const WORKSPACE_MESSAGE_TERMS = [
  'sanka-connected gmail',
  'connected gmail',
  'gmail integration',
  'integration inbox',
  'public message',
  'workspace message',
  'shared inbox',
  'group inbox',
  'workspace inbox',
  'contact conversation',
  '/conversation',
  '連携されてるgmail',
  '連携 gmail',
  '共有受信箱',
  'ワークスペース受信箱',
];

// The person's own Google Calendar and Gmail, read live as their own Google login, are read
// Actions too: a question about their meetings or a search of their mail. Sanka's public booking
// calendar (bookings, availability, attendance), Signal bookings, recorded meetings, the private
// and workspace inboxes, and anything that changes the calendar or mail keep their own tools.
const OWN_CALENDAR_TERMS = [
  'my calendar',
  'my meetings',
  'my schedule',
  'google calendar',
  'meeting load',
  'focus time',
  'focus block',
  'hours of meetings',
  'hours in meetings',
  'meetings this week',
  'meetings last week',
  'meetings next week',
  'meetings with',
  'カレンダー',
  '会議',
  'ミーティング',
  '打ち合わせ',
  '予定',
];
const OWN_CALENDAR_READ_TERMS = [
  'how many',
  'how much',
  'hours',
  'search',
  'find',
  'list',
  'show',
  'when',
  'which',
  'what',
  'focus',
  'load',
  'busy',
  '何時間',
  '時間',
  '何件',
  '検索',
  '探',
  '一覧',
  '集中',
  'いつ',
];
// Another provider named: its own routes (and its own read Actions, when it has them).
const OTHER_PROVIDER_TERMS = ['hubspot', 'salesforce', 'outlook', 'microsoft', 'office 365', 'm365'];
const OWN_CALENDAR_EXCLUDED_TERMS = [
  ...OTHER_PROVIDER_TERMS,
  'book',
  'reschedul',
  'cancel',
  'availab',
  'available slot',
  'attendance',
  'signal',
  'tldv',
  'tl;dv',
  'recording',
  'transcript',
  'create',
  'add ',
  'invite',
  'schedule a',
  'set up',
  'access',
  'share',
  'sync',
  'migrat',
  'workflow',
  '予約',
  '作成',
  '追加',
  '議事録',
  '録画',
  '移行',
];
const OWN_GMAIL_TERMS = ['gmail', 'my email', 'my mail', 'my inbox', 'g メール', 'gメール', '自分のメール'];
const OWN_GMAIL_READ_TERMS = [
  'search',
  'find',
  'look for',
  'look up',
  'list',
  'show',
  'how many',
  'from:',
  'subject:',
  'newer_than',
  'emails from',
  'mails from',
  '検索',
  '探',
  '一覧',
  '何件',
];
const OWN_GMAIL_EXCLUDED_TERMS = [
  ...WORKSPACE_MESSAGE_TERMS,
  ...OTHER_PROVIDER_TERMS,
  'private',
  'personal inbox',
  'account-level',
  'reply',
  'send',
  'draft',
  'forward',
  'archive',
  'delete',
  'label it',
  'sync',
  'migrat',
  'workflow',
  'access',
  'log in',
  'login',
  'password',
  '返信',
  '送信',
  '下書き',
  '同期',
  '移行',
  '個人受信箱',
];

const WORKFLOW_HINT_MIN_LENGTH = 4;

const WORKFLOW_HINT_STOPWORDS = new Set([
  'about',
  'after',
  'before',
  'from',
  'into',
  'only',
  'sanka',
  'than',
  'that',
  'them',
  'then',
  'these',
  'this',
  'those',
  'user',
  'want',
  'wants',
  'when',
  'with',
  'would',
]);

const GUIDANCE_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    intent: {
      type: 'string',
      description:
        'Natural-language summary of the user request, especially before refusing a Sanka capability.',
    },
    provider: {
      type: 'string',
      description: 'Optional platform hint such as hubspot, salesforce, sanka, freee, or moneyforward.',
    },
    object_type: {
      type: 'string',
      description: 'Optional object hint such as deal, opportunity, invoice, order, or workflow.',
    },
    operation: {
      type: 'string',
      description: 'Optional operation hint such as create, update, run, preview, sync, or summarize.',
    },
  },
};

const readString = (value: unknown): string => String(value ?? '').trim();

const includesAny = (value: string, terms: string[]): boolean => terms.some((term) => value.includes(term));

const isDirectoryAccountIntent = (value: string): boolean =>
  includesAny(value, DIRECTORY_STEP_TERMS) ||
  (includesAny(value, DIRECTORY_PROVIDER_TERMS) && includesAny(value, DIRECTORY_ACCOUNT_TERMS)) ||
  (includesAny(value, EMPLOYEE_LIFECYCLE_TERMS) && includesAny(value, EMPLOYEE_ACCOUNT_TERMS));

const isDeskActionIntent = (value: string): boolean =>
  (includesAny(value, DESK_ACTION_SYSTEM_TERMS) &&
    includesAny(value, DESK_ACTION_CHANGE_TERMS) &&
    includesAny(value, DESK_ACTION_ACCOUNT_TERMS) &&
    !includesAny(value, DESK_ACTION_EXCLUDED_TERMS)) ||
  isDeskGoogleActionIntent(value);

const isDeskGoogleActionIntent = (value: string): boolean =>
  includesAny(value, DESK_GOOGLE_ACTION_TERMS) ||
  (includesAny(value, ['share ', 'sharing', 'unshare']) && value.includes('calendar')) ||
  (value.includes('カレンダー') && value.includes('共有'));

const isPresentationIntent = (value: string): boolean =>
  PRESENTATION_INTENT.test(value) || includesAny(value, PRESENTATION_INTENT_JA);

const isAppBuilderIntent = (value: string): boolean =>
  includesAny(value, ['app builder', 'blueprint']) ||
  (includesAny(value, APP_BUILDER_PRODUCT_TERMS) && includesAny(value, APP_BUILDER_BUILD_TERMS));

const isFlowActionIntent = (value: string): boolean =>
  !includesAny(value, FLOW_ACTION_EXCLUDED_TERMS) &&
  includesAny(value, FLOW_ACTION_TARGET_TERMS) &&
  ((includesAny(value, FLOW_ACTION_SEARCH_TERMS) && includesAny(value, FLOW_ACTION_PEOPLE_TERMS)) ||
    (includesAny(value, [...FLOW_ACTION_SEARCH_TERMS, 'fill', '埋め']) &&
      includesAny(value, FLOW_ACTION_DETAIL_TERMS)));

const isReadActionIntent = (value: string): boolean =>
  includesAny(value, READ_ACTION_PROVIDER_TERMS) &&
  includesAny(value, READ_ACTION_OBJECT_TERMS) &&
  includesAny(value, READ_ACTION_READ_TERMS) &&
  !includesAny(value, READ_ACTION_EXCLUDED_TERMS);

const isOwnCalendarReadIntent = (value: string): boolean =>
  includesAny(value, OWN_CALENDAR_TERMS) &&
  includesAny(value, OWN_CALENDAR_READ_TERMS) &&
  !includesAny(value, OWN_CALENDAR_EXCLUDED_TERMS);

const isOwnGmailReadIntent = (value: string): boolean =>
  includesAny(value, OWN_GMAIL_TERMS) &&
  includesAny(value, OWN_GMAIL_READ_TERMS) &&
  !includesAny(value, OWN_GMAIL_EXCLUDED_TERMS);

const isGoogleReadActionIntent = (value: string): boolean =>
  isOwnCalendarReadIntent(value) || isOwnGmailReadIntent(value);

// The request text: `raw` keeps the user's casing, `combined` is every hint lowercased.
const requestHints = (args: Record<string, unknown> | undefined): { raw: string; combined: string } => {
  const raw = ['intent', 'provider', 'object_type', 'operation']
    .map((key) => readString(args?.[key]))
    .join(' ');
  return { raw, combined: raw.toLowerCase() };
};

// A request for the company IT desk. Without an IT or Desk mention, a ticket is a Flow ticket
// record, and Flow ticket CRUD keeps its own tools.
const isDeskRequestIntent = (args: Record<string, unknown> | undefined): boolean => {
  const { raw, combined } = requestHints(args);
  if (isDeskWorkflowRunIntent(raw, combined)) return true;
  if (
    isPresentationIntent(combined) ||
    MIGRATION_INTENT.test(combined) ||
    isAppBuilderIntent(combined) ||
    isFlowActionIntent(combined) ||
    isReadActionIntent(combined) ||
    isGoogleReadActionIntent(combined) ||
    includesAny(combined, DESK_EXCLUDED_TERMS)
  ) {
    return false;
  }
  if (includesAny(combined, DESK_SERVICE_TERMS) || IT_SERVICE_INTENT.test(raw)) return true;
  return (
    !includesAny(combined, TICKET_TERMS) &&
    (includesAny(combined, DESK_REQUEST_TERMS) ||
      isDirectoryAccountIntent(combined) ||
      isDeskActionIntent(combined))
  );
};

const flowActionGuidance = (): Record<string, unknown> => ({
  capability_version: CAPABILITY_GUIDANCE_VERSION,
  intent_family: 'sanka_flow_actions',
  supported: true,
  recommended_tools: [
    'list_company_lists',
    'query_records',
    'preview_flow_action',
    'run_flow_action',
    'get_flow_action_run',
  ],
  route:
    'Finding or enriching people, contacts or work e-mails for companies on the person\'s list, or filling company phone numbers and addresses, is a Flow Action. A rep\'s "leads" usually means companies on their list. Find the list with list_company_lists, or the companies with query_records, then call preview_flow_action (ai_contact_search for people, find_company_details for phone and address). Tell the person the company count and that each company uses Sanka credit, and call run_flow_action only after they say yes. Read it with get_flow_action_run. Do not use deals or HubSpot tools unless the person named HubSpot, and do not file a Desk ticket: Desk ticket routing is not the path for this. To read contacts already in Sanka, use list_contacts.',
  mutation_policy:
    'ai_contact_search creates no contacts: the person picks people in Action history, so give them action_history_url. It looks up no phone numbers. find_company_details writes empty fields only, without review. Refusals for the ceiling, the daily limit or a workspace without the Action are final for now: tell the person, and never split a selection or repeat calls to get around them.',
  fallback_when_missing:
    'If these tools are not visible in this client session, say the Sanka MCP tool catalog or plugin may be stale and ask the user to reconnect the Sanka plugin or start a fresh session.',
});

const readActionGuidance = (): Record<string, unknown> => ({
  capability_version: CAPABILITY_GUIDANCE_VERSION,
  intent_family: 'crm_read_actions',
  supported: true,
  recommended_tools: [...READ_ACTION_TOOL_NAMES],
  route:
    "Searches, counts and totals in the person's own HubSpot or Salesforce (deals, opportunities, contacts, companies, accounts, leads; totals by stage, owner or month) are read Actions. Call list_read_actions, pick the Action for that CRM and kind (search or aggregate), then call run_read_action with inputs matching its input_schema. Results are what the person's own CRM login can see, so a rep, a manager and an executive get different rows: say so when it matters. Give the method (filters, records scanned) with any number, and never present a total as complete when the result marks it incomplete (method.complete false). Sanka's own records keep query_records and aggregate_records.",
  billing_policy:
    "Each completed run costs the Action's listed Sanka Credits, an empty result too; listing Actions and reading runs are free, and refusals and failures cost nothing. Tell the person the price the first time in a conversation. Leave client_key out for a new question (asking again later reads the CRM again); reuse a client_key only to retry a call whose answer you did not get, which returns the first run without charging again.",
  mutation_policy:
    "These tools change nothing in the CRM. On READ_ACTION_CONNECT_REQUIRED tell the person to connect their own login (or, for Gmail, give read access) under Personal integrations and give connect_url. On READ_ACTION_CREDITS_REQUIRED say the Sanka Credits ran out and a workspace admin can add them. On READ_ACTION_TOO_BROAD ask the person to narrow the filter; never estimate. On READ_ACTION_DAILY_LIMIT say it lifts the next day. Never loop or split a question to get around a limit. On FEATURE_DISABLED read Actions are off in this workspace: for HubSpot or Salesforce use query_records or aggregate_records with scope=integration and say the data comes from the workspace's connection, not the person's own login; there is no fallback for the person's own calendar or Gmail.",
  fallback_when_missing:
    'If these tools are not visible in this client session, say the Sanka MCP tool catalog or plugin may be stale and ask the user to reconnect the Sanka plugin or start a fresh session.',
});

const ACCOUNT_CALENDAR_WRITE_TERMS = [
  'create',
  'add ',
  'block',
  'hold ',
  'update',
  'move ',
  'delete',
  'remove',
  '作成',
  '追加',
  '登録',
  '確保',
  '変更',
  '削除',
];
const ZOOM_MEETING_TERMS = ['zoom', 'ズーム'];
const ZOOM_MEETING_CREATE_TERMS = [
  'create',
  'generate',
  'make',
  'new ',
  'link',
  'url',
  'meeting',
  '発行',
  '作成',
  'リンク',
  '会議',
];
const ACCOUNT_CALENDAR_EXCLUDED_TERMS = [
  ...OTHER_PROVIDER_TERMS,
  'book',
  'booking page',
  'attendance',
  'signal',
  'recording',
  'transcript',
  'migrat',
  'workflow',
  'license',
  'role',
  'phone',
  'account',
  '録画',
  '議事録',
  '移行',
  'ライセンス',
  'アカウント',
];
const isAccountCalendarSchedulingIntent = (value: string): boolean => {
  if (includesAny(value, ACCOUNT_CALENDAR_EXCLUDED_TERMS)) return false;
  const isZoomCreate =
    includesAny(value, ZOOM_MEETING_TERMS) && includesAny(value, ZOOM_MEETING_CREATE_TERMS);
  const isCalendarWrite =
    includesAny(value, OWN_CALENDAR_TERMS) && includesAny(value, ACCOUNT_CALENDAR_WRITE_TERMS);
  return isZoomCreate || isCalendarWrite;
};

const accountCalendarSchedulingGuidance = (): Record<string, unknown> => ({
  capability_version: CAPABILITY_GUIDANCE_VERSION,
  intent_family: 'account_calendar_scheduling',
  supported: true,
  recommended_tools: [...ACCOUNT_CALENDAR_TOOL_NAMES],
  route:
    "For creating, updating, or deleting events on the person's own connected Google Calendar, or generating a unique Zoom meeting link (non-PMI), call get_my_calendar_context first to get the channel_id, calendar_id, timezone, and zoom_meetings_available flag. Check conflicts with list_my_calendar_events, then call create_my_calendar_event (with conference_provider='zoom' or 'google_meet' when a video link is needed), update_my_calendar_event, or delete_my_calendar_event. For a standalone Zoom meeting link without a calendar event, call create_zoom_meeting.",
  mutation_policy:
    'Calendar and Zoom writes pin the active workspace and never auto-retry. create_my_calendar_event blocks Busy time without sending guest invites; if Zoom creation fails with ZOOM_NOT_CONNECTED or ZOOM_MEETING_SCOPE_REQUIRED, report that error rather than reusing a Personal Meeting ID or substituting Google Meet.',
  fallback_when_missing:
    'If these tools are not visible in this client session, say the Sanka MCP tool catalog or plugin may be stale and ask the user to reconnect the Sanka plugin or start a fresh session.',
});

const googleReadActionGuidance = (): Record<string, unknown> => ({
  capability_version: CAPABILITY_GUIDANCE_VERSION,
  intent_family: 'google_read_actions',
  supported: true,
  recommended_tools: [...READ_ACTION_TOOL_NAMES],
  route:
    "Questions about the person's own Google Calendar and searches of their own Gmail are read Actions, read live as their own Google login from Personal integrations. Call list_read_actions, then run_read_action: google_calendar:events.search for their events between two dates (at most 31 days; text such as a company name or e-mail domain matches titles, attendees and organizers), google_calendar:events.meeting_load for hours in meetings per day and week and free focus blocks (at most 92 days; pass their time zone and working hours when known, and give the result's formula with the numbers), and gmail:messages.search with a Gmail search such as `from:acme.com newer_than:7d` for up to 25 messages' sender, recipients, subject, date and snippet, never bodies or attachments. Dates are in the calendar's time zone unless timezone is given. Sanka's public booking calendar keeps the calendar booking tools, and Sanka's synced inboxes keep the private and workspace message tools.",
  billing_policy:
    "Each completed run costs the Action's listed Sanka Credits, an empty result too; listing Actions and reading runs are free, and refusals and failures cost nothing. Tell the person the price the first time in a conversation.",
  mutation_policy:
    'These tools change nothing in Google. On READ_ACTION_CONNECT_REQUIRED tell the person to connect their own Google Calendar or Gmail under Personal integrations and give connect_url; for Gmail with details.reason read_access_required, they must give Sanka read access to Gmail there (a Gmail connection only sends by default). On READ_ACTION_TOO_BROAD ask for a shorter range. Never loop or split a question to get around a limit.',
  fallback_when_missing:
    'If these tools are not visible in this client session, say the Sanka MCP tool catalog or plugin may be stale and ask the user to reconnect the Sanka plugin or start a fresh session.',
});

const deskGuidance = (): Record<string, unknown> => ({
  capability_version: CAPABILITY_GUIDANCE_VERSION,
  intent_family: 'sanka_desk_it_requests',
  supported: true,
  sanka_desk: 'enabled',
  recommended_tools: [...DESK_TOOL_NAMES],
  route:
    "This workspace takes IT requests through Sanka Desk, the company's IT service desk. When the user wants their IT team to handle something (access, an account, a login problem, a joiner or leaver, an app setting or an IT question), file it in the user's words with desk_create_ticket, with subject_email when it is about someone else, such as a new hire. Desk may answer, ask questions or need approvals. Read progress with desk_get_ticket_status and the user's requests with desk_list_my_tickets; the user answers, confirms or reopens on the Desk page (console_url) or where the request came from. A change to an account or access in a company system may be a Desk Action: check desk_list_actions first, preview it with desk_preview_action and file it with desk_run_action only after the person says yes.",
  mutation_policy:
    "desk_create_ticket files only the connected user's own request in the current workspace; retry it with the same client_key. No tool approves, rejects, answers or closes a Desk request. Never use create_ticket, update_ticket or update_ticket_status for Desk requests: those stay for Flow ticket records.",
  fallback_when_missing:
    'If the desk_* tools are not visible in this client session, say the Sanka MCP tool catalog or plugin may be stale and ask the user to reconnect the Sanka plugin or start a fresh session.',
});

// A change an Action can make goes through the Actions first; an ordinary request is the fallback.
const deskActionGuidance = (): Record<string, unknown> => ({
  capability_version: CAPABILITY_GUIDANCE_VERSION,
  intent_family: 'sanka_desk_actions',
  supported: true,
  sanka_desk: 'enabled',
  recommended_tools: [...DESK_ACTION_TOOL_NAMES],
  route: `This workspace runs IT changes through Sanka Desk Actions, the same Actions Sanka Bot and Desk Workflows run (such as hubspot_account_setup, and where the company's admin turned them on, Gmail settings and Google Calendar changes: calendar_sharing, calendar_resource, meeting_handover, interview_schedule). Find the Action with desk_list_actions, then call desk_preview_action with its inputs. Show the person the preview (changes, risk, approvers, Sanka Credits) and ask "Create this ticket?"; call desk_run_action with the plan_hash and confirmed: true only after their yes. Follow it with desk_get_ticket_status. When no Action fits, or the person may not use it, file an ordinary IT request with desk_create_ticket instead.`,
  mutation_policy:
    "Never file without the person's yes to the preview. No tool decides an approval: when the Action needs one, give the approval page (approval_url) so an approver decides in Sanka. Actions are billed in Sanka Credits like Sanka Bot: when the preview says credits_short, or a run is cancelled with DESK_CREDITS_REQUIRED, tell the person the credits ran out and that a workspace admin can add them (credits_url). On not_allowed, DESK_ACTION_NOT_ALLOWED or DESK_ACTION_SURFACE_OFF, say why, do not retry, and offer desk_create_ticket. On DESK_PLAN_CHANGED, preview again and ask again.",
  fallback_when_missing:
    'If the desk_* tools are not visible in this client session, say the Sanka MCP tool catalog or plugin may be stale and ask the user to reconnect the Sanka plugin or start a fresh session.',
});

// Starting a published Desk Workflow: run only, with the person as its Action ticket's requester.
const deskWorkflowGuidance = (): Record<string, unknown> => ({
  capability_version: CAPABILITY_GUIDANCE_VERSION,
  intent_family: 'sanka_desk_workflows',
  supported: true,
  sanka_desk: 'enabled',
  recommended_tools: [...DESK_WORKFLOW_TOOL_NAMES],
  route:
    'A workspace admin starts a published Sanka Desk Workflow that runs a Desk Action. Find it with desk_list_workflows, call desk_preview_workflow, show the person the preview (whether it opens its Action ticket, the changes, risk, approvers, Sanka Credits) and ask "Run this workflow?"; call desk_run_workflow with the plan_hash and confirmed: true only after their yes. The person becomes the requester of the Action ticket: find it with desk_list_my_tickets and follow it with desk_get_ticket_status.',
  mutation_policy:
    "Never start a run without the person's yes to the preview, and never change a workflow: building or editing one stays on the Desk console. No tool decides an approval: give the approval page (approval_url). On not_allowed or DESK_ACTION_SURFACE_OFF say why, do not retry, and offer desk_create_ticket; on DESK_PLAN_CHANGED preview again and ask again; on nothing_to_run or DESK_WORKFLOW_NOTHING_TO_RUN tell the person why nothing would open. Members get DESK_ADMIN_REQUIRED: offer desk_list_actions or desk_create_ticket.",
  fallback_when_missing:
    'If the desk_* tools are not visible in this client session, say the Sanka MCP tool catalog or plugin may be stale and ask the user to reconnect the Sanka plugin or start a fresh session.',
});

// Added to the guidance of an IT request where Desk is off or could not be checked, which is
// otherwise unchanged.
const DESK_NOTES: Record<Exclude<DeskAvailability, 'enabled'>, Record<string, string>> = {
  not_enabled: {
    sanka_desk: 'not_enabled',
    sanka_desk_note:
      'Sanka Desk is not enabled for this workspace, so the desk_* tools cannot take this request. Handle it without Desk; the Flow ticket tools stay for Flow ticket records.',
  },
  unknown: {
    sanka_desk: 'unknown',
    sanka_desk_note:
      'Whether Sanka Desk is enabled for this workspace could not be checked. If desk_list_my_tickets answers, IT requests go to the desk_* tools; DESK_NOT_ENABLED means they do not. Never file them with the Flow ticket tools.',
  },
};

/**
 * Selects the workflow rules that mention any of the request hints. The rules used to be embedded
 * in the initialize instructions of every session; they are now served here on demand so that
 * clients that copy instructions into every tool definition stay small. When no hint matches, the
 * full rule set is returned so callers never lose guidance.
 */
export const selectWorkflowGuidance = (
  args: Record<string, unknown> | undefined,
): { workflow_guidance: string[]; workflow_guidance_scope: 'matched' | 'all' } => {
  const hints = new Set<string>();
  for (const key of ['provider', 'object_type', 'operation']) {
    const value = readString(args?.[key]).toLowerCase();
    if (value) {
      hints.add(value);
    }
  }
  for (const word of readString(args?.['intent'])
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)) {
    if (word.length >= WORKFLOW_HINT_MIN_LENGTH && !WORKFLOW_HINT_STOPWORDS.has(word)) {
      hints.add(word);
    }
  }
  const matched =
    hints.size === 0 ?
      []
    : SHARED_WORKFLOW_GUIDANCE.filter((line) => {
        const normalized = line.toLowerCase();
        return [...hints].some((hint) => normalized.includes(hint));
      });
  return matched.length > 0 ?
      { workflow_guidance: matched, workflow_guidance_scope: 'matched' }
    : { workflow_guidance: [...SHARED_WORKFLOW_GUIDANCE], workflow_guidance_scope: 'all' };
};

const buildGuidance = (
  args: Record<string, unknown> | undefined,
  desk?: DeskAvailability,
): Record<string, unknown> => {
  const { raw, combined } = requestHints(args);
  // Before the migration branch: a deck about a migration is still a deck.
  if (isPresentationIntent(combined)) {
    return {
      capability_version: CAPABILITY_GUIDANCE_VERSION,
      intent_family: 'sanka_doc_presentations',
      supported: true,
      recommended_tools: [
        'get_presentation_catalog',
        'list_presentations',
        'create_presentation',
        'get_presentation',
        'update_presentation',
        'preview_presentation',
        'start_presentation_image_upload',
        'import_presentation_image',
        'list_ferry_diagrams',
        'export_ferry_diagram_image',
        'import_presentation_diagram_image',
        'export_presentation',
        'get_presentation_export',
        'download_presentation_export',
      ],
      route: [
        '1. Call get_presentation_catalog once per session.',
        '2. Outline first: one message per slide, a title that states the point, at most 6 bullets of at most 80 characters (40 in Japanese). Keep supplied facts, names and numbers exact and never invent figures; write Japanese decks in です・ます.',
        '3. Choose blocks by content shape (table for lookup, cards for parallel items, steps for a process, timeline for dates, stats for numbers), with at most one accent emphasis per slide. Use page_size a4-landscape for printed proposals and 16:9 for screens.',
        "4. Layouts place blocks by default. Use a free slide (positioning: free, a frame per block) only when the user asks for exact placement, overlapping elements (text over a photo), shapes and arrows, or a given design, and only when get_presentation_catalog says free placement is available. On a free slide keep boxes in the catalog's freeform safe area, align them to its 12-column grid, leave at least 16 px between boxes, prefer sizing auto for text, keep theme text sizes unless asked and rotate only when asked. Convert an existing slide with the set_slide_positioning op: without frames the server keeps every block where it is drawn, and on RENDER_UNAVAILABLE pass the frames yourself. Preview every free slide and fix SLIDE_OVERFLOW, FRAMES_OVERLAP and FRAME_OFF_STAGE before exporting.",
        "5. create_presentation with slides, markdown or source_doc_id (program_id for a migration program's Docs, omitted for Sanka Flow Docs), then preview_presentation in batches of six. Fix every SLIDE_OVERFLOW by shortening, splitting or changing the layout, and preview the changed slides again.",
        "6. Images go in after the deck exists: upload the file with start_presentation_image_upload, append_presentation_image_upload_chunk and finish_presentation_image_upload, or import a public https URL with import_presentation_image, then put the asset_id with alt text in an image block or accent with update_presentation. For a flow, swimlane or architecture, draw a Sanka diagram (create_ferry_diagram) and show it with a sankaDiagram block {diagramId, alt}: it always shows the diagram's latest revision. export_ferry_diagram_image renders a diagram to PNG; import_presentation_diagram_image stores that image in a deck for an ordinary image block.",
        '7. Before editing a deck people may have changed, get_presentation and use its revision; on PRESENTATION_REVISION_CONFLICT re-read and re-apply only your change. Do not delete slides you did not create unless asked.',
        '8. export_presentation (pptx or pdf), poll get_presentation_export until completed, then give the user app_url and app_download_url, or pass the file itself through with download_presentation_export.',
      ].join(' '),
      mutation_policy:
        'create_presentation, update_presentation, finish_presentation_image_upload, import_presentation_image, import_presentation_diagram_image and export_presentation need expected_workspace_id from current_workspace and change nothing on WORKSPACE_CONTEXT_MISMATCH; never retry them in another workspace. update_presentation needs expected_revision; send slides back with their positioning and frames (PRESENTATION_CLIENT_OUTDATED means the write would have dropped free placement). Reuse an idempotency_key only to retry the same export. There is no presentation delete tool.',
      fallback_when_missing:
        'If these tools are not visible in this client session, say the Sanka MCP tool catalog or plugin may be stale and ask the user to reconnect the Sanka plugin or start a fresh session.',
    };
  }
  if (MIGRATION_INTENT.test(combined)) {
    const codeMigration = includesAny(combined, ['code migration', 'drf', 'django', 'fastapi', 'repository']);
    return {
      capability_version: CAPABILITY_GUIDANCE_VERSION,
      intent_family: codeMigration ? 'code_migration_evidence' : 'data_migration',
      supported: true,
      recommended_tools:
        codeMigration ?
          [
            'list_code_projects',
            'get_code_migration',
            'get_code_migration_plan',
            'get_code_migration_verification',
          ]
        : [
            'list_migration_program_templates',
            'list_migration_connections',
            'list_migration_programs',
            'get_migration_program',
            'create_migration_program',
            'update_migration_program',
            'create_program_migration',
            'list_migrations',
            'get_migration_journey',
            'get_migration_result',
            'get_migration',
            'get_migration_plan',
            'plan_exchange_migration',
            'get_exchange_migration',
            'control_exchange_migration',
          ],
      route:
        codeMigration ?
          'Code migration tools register genuine client-produced DRF-to-FastAPI artifacts. They do not run code, scans, tests, repository rewrites or deployments. Only submit artifacts from a separately authorized client run.'
        : 'Use migration Programs for reusable endpoint configuration, then create_program_migration with both reviewed endpoint IDs. Discover and reuse the intended existing migration before creating another. Retrieve get_migration_journey first for compact four-stage state, blockers, result versions and available next action. Use get_migration_result for relevant version-pinned evidence pages; fetch complete safety evidence for the reviewed transfer scope. Preserve unknown versus zero and transfer completion versus verification. Return actual outputs and returned review links, or explicit link unavailability; ask only unresolved decisions after reading available configuration. start_migration_plan queues inspection/planning; read the plan before any authorized apply. Blocked plans remain reviewable: inspect ready/risk_level, document warnings, route issues and destination safety details. FERRY_DESTINATION_IDENTITY_REQUIRED identifies a missing mapped destination identity field, while quarantine_properties_missing identifies missing destination quarantine properties; resolve the reported mapping or destination configuration and re-plan before considering apply. Existing Ferry program docs/todos and diagrams serve collaboration/design; a diagram is not an executable mapping. Use inspect_migration/list_migration_source_objects/scan_migration for inventory, get_migration_mapping/save_migration_mapping for hash-checked field edits, validate_migration_mapping for write-free sample validation, and get_migration_report for stage evidence. These extend the record migration journey; broader assessment/research features remain separate. Connector availability remains server-owned.',
      mutation_policy:
        'Pin the internal workspace UUID on every call. Establish user authorization from the conversation; confirm=true is an acknowledgement, not proof of approval. Preserve exact reviewed plan/config hashes and tool-specific idempotency rules. Program POST/PATCH and code-artifact writes have no idempotency contract. Never replay an uncertain state change automatically; inspect state first. Supplied Program endpoint arrays replace that side, and read Program options and options_redacted before replacement; never discard redacted configuration. Queued status or Program completed metadata is not verified transfer evidence; inspect each verification check. For Google Workspace→Microsoft 365 native mail/calendar/contact batches, create a dedicated migration with source.options.mailbox_method=exchange_online, inspect it, then plan_exchange_migration; review its limitations and hash before control_exchange_migration. Keep Drive on a separate reviewed record-copy migration. Native complete can change forwarding and needs separate explicit cutover and source-freeze authorization. Use get_exchange_migration for batch evidence; ordinary record-copy verification does not certify Exchange batches. Lost creation acknowledgements require administrator reconciliation; never duplicate them.',
      fallback_when_missing:
        'If a recommended tool is unavailable, refresh/reconnect the Sanka MCP/plugin. Do not invent an endpoint or substitute local scripts for hosted Sanka operations.',
    };
  }
  if (isFlowActionIntent(combined)) {
    return flowActionGuidance();
  }
  if (isReadActionIntent(combined)) {
    return readActionGuidance();
  }
  if (isGoogleReadActionIntent(combined)) {
    return googleReadActionGuidance();
  }
  // Where Desk is on, sharing a calendar, a meeting room, a meeting handover, an interview or a
  // Gmail setting is a Desk Action, even worded like a change to the person's own calendar.
  if (desk === 'enabled' && isDeskGoogleActionIntent(combined)) {
    return deskActionGuidance();
  }
  if (isAccountCalendarSchedulingIntent(combined)) {
    return accountCalendarSchedulingGuidance();
  }
  // `desk` is read only for IT requests. Where Desk is on, they go to the IT desk, joiners and
  // leavers included; elsewhere the guidance stays as it was.
  if (desk === 'enabled') {
    if (isDeskWorkflowRunIntent(raw, combined)) return deskWorkflowGuidance();
    return isDeskActionIntent(combined) ? deskActionGuidance() : deskGuidance();
  }
  // After the migration branch: moving accounts between tenants is a migration.
  if (isDirectoryAccountIntent(combined)) {
    return {
      capability_version: CAPABILITY_GUIDANCE_VERSION,
      intent_family: 'directory_account_workflows',
      supported: true,
      recommended_tools: ['create_workflow', 'update_workflow'],
      route:
        "Build a Sanka workflow (provider=sanka) with an approval step first, then create-directory-account for onboarding or suspend-directory-account for offboarding; update-directory-groups and update-directory-licenses change an existing account. Node settings go in input_data.identity_directory as workflow_guidance describes. Remove licenses only after the user confirms the person's files are handed over; Sanka does not hand over Drive or OneDrive files yet. Use the provisioning connection, group and license IDs the user gives, or ask a workspace admin to pick them in the Sanka workflow builder. Runs start from the employee's record in Sanka; run_workflow cannot pass an employee.",
      mutation_policy:
        'Set confirmed: true on a suspend, remove_all or license removal step only after the user explicitly confirms that exact change. The steps need a user-provisioning connection, a workspace admin and a workspace in the pilot; saving does not check these, and the run fails closed. Deleting accounts is not offered.',
      fallback_when_missing:
        'If create_workflow or update_workflow is not visible in this client session, say the Sanka Skill or MCP tool catalog may be stale and ask the user to update/reconnect the Sanka plugin or start a fresh session.',
    };
  }
  if (isAppBuilderIntent(combined)) {
    return {
      capability_version: CAPABILITY_GUIDANCE_VERSION,
      intent_family: 'sanka_app_builder',
      supported: true,
      recommended_tools: ['list_app_blueprint_templates', 'preview_app_blueprint', 'apply_app_blueprint'],
      route:
        'Use app blueprint tools. Exact template intents should use a built-in template such as CRM, ERP, expense management, inventory management, procurement management, billing and collections, HR management, IT asset management, project management, or support desk. Partial matches should use the closest template plus overlay for adjusted module labels, custom objects, permission sets, and Mermaid artifacts. Completely unknown requests should send ai_generated blueprint_dsl to preview only. Pass language="ja" for Japanese requests and preserve the same language on apply. Call apply only after explicit user approval with confirm=true. Apply saves the generated guide and Mermaid diagrams as editable workspace Docs.',
      mutation_policy:
        'apply_app_blueprint performs real Sanka mutations: side-menu modules, missing custom object schemas, permission sets, and the generated guide and Mermaid diagrams as editable workspace Docs. Call apply only after explicit user approval with confirm=true. For ai_generated blueprints, also require a valid preview validator result and allow_generated_blueprint_apply=true. It does not assign users or delete records.',
      fallback_when_missing:
        'If app blueprint tools are not visible in this client session, say the Sanka Skill or MCP tool catalog may be stale and ask the user to update/reconnect the Sanka plugin or start a fresh session.',
    };
  }

  if (includesAny(combined, WORKSPACE_MESSAGE_TERMS)) {
    return {
      capability_version: CAPABILITY_GUIDANCE_VERSION,
      intent_family: 'workspace_integration_inbox_messages',
      supported: true,
      recommended_tools: [
        'sync_workspace_messages',
        'list_workspace_messages',
        'update_workspace_message_draft',
        'get_workspace_message_thread',
        'reply_workspace_message_thread',
      ],
      route:
        'Use workspace message tools for Sanka-connected Gmail, integration inbox, /conversation, Contact Conversation, shared inbox, group inbox, and workspace inbox. Use update_workspace_message_draft to edit a reviewed draft in place without sending or duplicating it. Use reply_workspace_message_thread only after the user explicitly asks to send the exact reply and pass confirm_send=true. If multiple distinct senders exist across private and workspace inboxes, ask the user to confirm the resolved sender and then pass expected_sender_email; with one sender, omit it. Never auto-retry SENDER_CONFIRMATION_REQUIRED. Report the returned sender_email. Drafting or writing is not send authorization. Do not use private message tools unless the user explicitly asks for their private/personal account-level inbox.',
      fallback_when_missing:
        'If workspace message tools are not visible in this client session, say the Sanka Skill or MCP tool catalog may be stale and ask the user to update/reconnect the Sanka plugin or start a fresh session.',
    };
  }

  if (
    includesAny(combined, ['hubspot', 'salesforce']) &&
    includesAny(combined, ['workflow', 'automation', '自動化', 'ワークフロー'])
  ) {
    const normalizedProvider = includesAny(combined, ['salesforce']) ? 'salesforce' : 'hubspot';
    const supported =
      normalizedProvider === 'hubspot' ?
        {
          supported: true,
          recommended_tools: ['create_workflow', 'update_workflow'],
          route:
            'Use the shared workflow endpoint with provider=hubspot. Do not look for a provider-specific create_hubspot_workflow tool.',
          dry_run_policy:
            'Run create_workflow/update_workflow with dry_run=true first. Set confirm=true only after explicit user approval.',
        }
      : {
          supported: false,
          recommended_tools: [],
          route:
            'Salesforce native automation creation is not currently exposed through Sanka MCP. Use Salesforce quote_readiness previews only for supported read-only CPQ checks.',
          dry_run_policy: null,
        };
    return {
      capability_version: CAPABILITY_GUIDANCE_VERSION,
      intent_family: `${normalizedProvider}_native_workflow_automation`,
      ...supported,
      fallback_when_missing:
        'If the recommended tool is not visible in this client session, do not answer that Sanka cannot do it from preview_workflow/start_workflow alone. Tell the user the Sanka Skill or MCP tool catalog may be stale and ask them to update/reconnect the Sanka plugin or start a fresh session.',
      stale_skill_guardrail:
        'Do not use preview_workflow/start_workflow as evidence that provider-native workflow automation is unavailable.',
    };
  }

  if (
    includesAny(combined, ['signal']) &&
    includesAny(combined, ['booking', 'booked', 'book link', 'meeting', '予約', '商談'])
  ) {
    return {
      capability_version: CAPABILITY_GUIDANCE_VERSION,
      intent_family: 'signal_booking',
      supported: true,
      recommended_tools: ['list_signal_bookings', 'get_signal_booking'],
      route:
        'Use list_signal_bookings to find meetings Sanka Signal leads booked on sanka.com/book links (filter by rep, territory, status, variant or text), then get_signal_booking for its routing reason, assignment trace and timeline. Both are Sanka Admin only.',
      mutation_policy:
        'These tools are read-only. Reassigning, rescheduling, cancelling, marking no-shows and rep or routing settings stay in /manage/signal/booking.',
      fallback_when_missing:
        'If these tools are not visible, update or reconnect the Sanka MCP/plugin. Do not use calendar attendance tools for Signal bookings.',
    };
  }

  if (
    includesAny(combined, ['cargo']) &&
    includesAny(combined, [
      'catalog',
      'supplier',
      'research',
      'category',
      'カタログ',
      '仕入れ先',
      '調査',
      'カテゴリー',
    ])
  ) {
    return {
      capability_version: CAPABILITY_GUIDANCE_VERSION,
      intent_family: 'cargo_global_catalog',
      supported: true,
      recommended_tools: ['get_cargo_catalog', 'import_cargo_catalog'],
      route:
        'Use get_cargo_catalog for the global research, supplier, intake, and publication queue. Use import_cargo_catalog for idempotent research bundles. Do not create tenant Company records for global Cargo supplier research.',
      mutation_policy:
        'import_cargo_catalog may create or update research rows and draft or ready-for-review snapshots. It never publishes an LP. Publication remains an explicit admin action in /manage/cargo.',
      fallback_when_missing:
        'If these tools are not visible, update or reconnect the Sanka MCP/plugin before falling back to direct API access. Never give an agent direct database credentials.',
    };
  }

  return {
    capability_version: CAPABILITY_GUIDANCE_VERSION,
    intent_family: 'general_sanka_capability',
    supported: null,
    recommended_tools: [],
    route:
      'Use the dedicated Sanka MCP tool that matches the live operation. If no dedicated tool is visible, avoid guessing from older skill text and ask the user to update/reconnect the Sanka plugin or MCP session.',
    fallback_when_missing:
      'Before refusing, check the current hosted tool catalog or this guidance tool. Stale local skills can lag behind hosted MCP capabilities.',
  };
};

export const getCapabilityGuidanceTool: McpTool = {
  metadata: {
    resource: 'capability_guidance',
    operation: 'read',
    tags: ['guidance', 'capabilities', 'workflows'],
    operationId: 'mcp.capability_guidance.get',
  },
  tool: {
    name: 'get_capability_guidance',
    title: 'Get capability guidance',
    description:
      'Fetch current hosted Sanka MCP capability guidance plus the workflow rules for a request area. Call it before ambiguous or multi-step Sanka work and before refusing an ambiguous or newly added Sanka capability; the server instructions no longer embed these workflow rules.',
    inputSchema: GUIDANCE_INPUT_SCHEMA,
    outputSchema: {
      type: 'object',
      properties: {
        guidance: { type: 'object' },
      },
    },
    securitySchemes: [{ type: 'noauth' }],
    annotations: {
      title: 'Get capability guidance',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }): Promise<ToolCallResult> => {
    const desk = isDeskRequestIntent(args) ? await readDeskAvailability(reqContext) : undefined;
    const guidance = {
      ...buildGuidance(args, desk),
      ...(desk && desk !== 'enabled' ? DESK_NOTES[desk] : undefined),
      ...selectWorkflowGuidance(args),
    };
    return {
      content: [
        {
          type: 'text',
          text: `Current Sanka capability guidance:\n${JSON.stringify(guidance, null, 2)}`,
        },
      ],
      structuredContent: { guidance },
    };
  },
};
