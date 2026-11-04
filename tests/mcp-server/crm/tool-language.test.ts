import {
  crmActivateInvoiceTool,
  crmCreateDisbursementAllocationTool,
  crmCreateJournalStatementViewTool,
  crmDeleteDisbursementAllocationTool,
  crmGenerateIncentivePaymentNoticeTool,
  crmGetPropertyTool,
  crmListDealsTool,
  crmListDisbursementAllocationsTool,
  crmListIncentiveCompanyOptionsTool,
  crmListIncentivePlansTool,
  crmListIncentivesTool,
  crmListJournalEntriesTool,
  crmListPaymentAllocationsTool,
  crmListPropertiesTool,
  crmUpdateDisbursementAllocationTool,
  crmUpdatePaymentAllocationsTool,
} from '../../../packages/mcp-server/src/crm-tools';
import { validateToolArguments } from '../../../packages/mcp-server/src/tool-argument-validator';
import { sendThroughSDK } from './helpers';

// How each route reads a language, checked on the wire because an SDK method turns an
// `Accept-Language` param into a header and a raw call sends it as a query param no route reads.
const ALLOCATION = { disbursement_id: 'd-1', amount: 100 };
const ROWS = [
  // These routes read a `language` query param.
  { tool: crmListPropertiesTool, args: { object_name: 'orders' }, sends: 'query' },
  { tool: crmGetPropertyTool, args: { object_name: 'orders', property_ref: 'p-1' }, sends: 'query' },
  { tool: crmListJournalEntriesTool, args: {}, sends: 'query' },
  {
    tool: crmCreateJournalStatementViewTool,
    args: { name: 'PL', view_type: 'profit_and_loss' },
    sends: 'query',
  },
  { tool: crmListDisbursementAllocationsTool, args: { disbursement_id: 'd-1' }, sends: 'query' },
  { tool: crmCreateDisbursementAllocationTool, args: { ...ALLOCATION, invoice_id: 'b-1' }, sends: 'query' },
  {
    tool: crmUpdateDisbursementAllocationTool,
    args: { ...ALLOCATION, allocation_id: 'a-1' },
    sends: 'query',
  },
  {
    tool: crmDeleteDisbursementAllocationTool,
    args: { disbursement_id: 'd-1', allocation_id: 'a-1' },
    sends: 'query',
  },
  { tool: crmListPaymentAllocationsTool, args: { payment_id: 'p-1' }, sends: 'query' },
  {
    tool: crmUpdatePaymentAllocationsTool,
    args: { payment_id: 'p-1', allocations: [{ invoice_id: 'i-1', amount: 100 }] },
    sends: 'query',
  },
  // This route reads the header, through an SDK method.
  { tool: crmListDealsTool, args: {}, sends: 'header' },
  // These routes read no language at all.
  { tool: crmListIncentivesTool, args: {}, sends: 'nothing' },
  { tool: crmListIncentivePlansTool, args: {}, sends: 'nothing' },
  { tool: crmListIncentiveCompanyOptionsTool, args: {}, sends: 'nothing' },
  { tool: crmGenerateIncentivePaymentNoticeTool, args: { period_from: '2026-10' }, sends: 'nothing' },
  { tool: crmActivateInvoiceTool, args: { invoice_id: 'i-1' }, sends: 'nothing' },
];

describe('tool language', () => {
  it.each(ROWS)('$tool.tool.name sends language as $sends', async ({ tool, args, sends }) => {
    const toolArgs = { ...args, language: 'ja' };
    expect(validateToolArguments({ mcpTool: tool, args: toolArgs })).toBeUndefined();

    const { requests } = await sendThroughSDK({ tool, args: toolArgs });

    const [request] = requests;
    const { searchParams } = new URL(String(request?.url));
    expect(searchParams.get('Accept-Language')).toBeNull();
    expect(searchParams.get('language')).toBe(sends === 'query' ? 'ja' : null);
    expect(request?.headers?.['accept-language']).toBe(sends === 'header' ? 'ja' : undefined);
  });
});
