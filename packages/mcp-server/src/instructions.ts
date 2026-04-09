// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import fs from 'fs/promises';
import { getLogger } from './logger';
import { ToolProfile } from './profile';

const INSTRUCTIONS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_FULL_INSTRUCTIONS = [
  'This is the Sanka MCP server.',
  '',
  'Available tools:',
  '- search_docs: Search SDK documentation to find the right methods and parameters.',
  '- execute: Run TypeScript code against a pre-authenticated SDK client. Define an async run(client) function.',
  '- auth_status: Debug whether the Sanka connector is authenticated. Do not use this as a preflight before protected Sanka tools.',
  '- list_companies: Search and review companies in Sanka.',
  '- get_company: Load one company in Sanka.',
  '- create_company: Create a company in Sanka.',
  '- update_company: Update a company in Sanka.',
  '- delete_company: Delete a company in Sanka.',
  '- list_contacts: Search and review contacts in Sanka.',
  '- get_contact: Load one contact in Sanka.',
  '- create_contact: Create a contact in Sanka.',
  '- update_contact: Update a contact in Sanka.',
  '- delete_contact: Delete a contact in Sanka.',
  '- list_deals: Review deals (sales pipeline records) in Sanka.',
  '- get_deal: Load one deal in Sanka.',
  '- create_deal: Create a deal in Sanka.',
  '- update_deal: Update a deal in Sanka.',
  '- delete_deal: Delete a deal in Sanka.',
  '- list_deal_pipelines: List the deal pipelines and stages defined in the workspace.',
  '- list_orders: Search and review orders in Sanka.',
  '- get_order: Load one order in Sanka.',
  '- create_order: Create an order in Sanka.',
  '- update_order: Update an order in Sanka.',
  '- delete_order: Delete an order in Sanka.',
  '- list_estimates: Review estimates in Sanka.',
  '- get_estimate: Load one estimate in Sanka.',
  '- create_estimate: Create an estimate in Sanka.',
  '- update_estimate: Update an estimate in Sanka.',
  '- delete_estimate: Delete an estimate in Sanka.',
  '- list_invoices: Review invoices in Sanka.',
  '- get_invoice: Load one invoice in Sanka.',
  '- create_invoice: Create an invoice in Sanka.',
  '- update_invoice: Update an invoice in Sanka.',
  '- delete_invoice: Delete an invoice in Sanka.',
  '- list_tickets: Review tickets in Sanka.',
  '- get_ticket: Load one ticket in Sanka.',
  '- create_ticket: Create a ticket in Sanka.',
  '- update_ticket: Update a ticket in Sanka.',
  '- delete_ticket: Delete a ticket in Sanka.',
  '- list_ticket_pipelines: List the ticket pipelines and stages defined in the workspace.',
  '- update_ticket_status: Update only the stage or status of a ticket in Sanka.',
  '- list_expenses: Review expense records in Sanka.',
  '- get_expense: Load one expense in Sanka.',
  '- upload_expense_attachment: Upload an expense attachment and return a file_id.',
  '- create_expense: Create an expense in Sanka.',
  '- update_expense: Update an existing expense in Sanka.',
  '- delete_expense: Delete an expense in Sanka.',
  '- list_properties: Review object property definitions in Sanka.',
  '- get_property: Load one property definition in Sanka.',
  '- create_property: Create a custom property in Sanka.',
  '- update_property: Update a custom property in Sanka.',
  '- delete_property: Delete a custom property in Sanka.',
  '- get_calendar_bootstrap: Load the public calendar booking context for an event or attendance.',
  '- check_calendar_availability: Check available booking slots for a public calendar event.',
  '- create_calendar_attendance: Book a new public calendar attendance.',
  '- cancel_calendar_attendance: Cancel an existing public calendar attendance.',
  '- reschedule_calendar_attendance: Reschedule an existing public calendar attendance.',
  '- prospect_companies: Discover net-new companies from external sources using Sanka prospecting.',
  '- score_record: Score a company or deal in Sanka and explain the result.',
  '',
  'Guardrails:',
  '- Treat company, contact, deal, order, estimate, invoice, ticket, expense, property, calendar, prospecting, and scoring requests as live Sanka operations. Results and mutations must come from the dedicated MCP tools above.',
  '- For companies, contacts, deals, orders, estimates, invoices, tickets, expenses, properties, calendar workflows, prospecting, or scoring, call the matching protected tool directly without first calling auth_status.',
  '- Protected Sanka tool calls are the OAuth trigger in clients like Codex, Claude, and Cursor.',
  '- Do not use search_docs or execute as a fallback for live company, contact, deal, order, estimate, invoice, ticket, expense, property, calendar, prospecting, or scoring work when a dedicated MCP tool covers the request.',
  '- If a protected tool is unavailable in the current client session, say the Sanka MCP server or plugin attachment is missing and ask the user to reconnect rather than guessing.',
  '- Never fabricate live Sanka data or substitute repo-local state, database access, or other out-of-band sources for dedicated Sanka tool results.',
  '',
  'Workflow:',
  '- Use search_docs before writing code when you need to discover the right SDK method or parameter shape for uncovered workflows.',
  '- Use execute only for Sanka SDK workflows that are not covered by dedicated MCP tools.',
  '- Keep CRM queries narrow with search, pagination, workspace filters, or result limits when possible.',
  '- Prefer list_deal_pipelines before describing deal stages so stage labels and ordering match the workspace configuration.',
  '- For orders, provide line items inside the nested `order` payload and prefer external references for linked companies or items when available.',
  '- Prefer list_ticket_pipelines before moving tickets across stages so stage keys and labels match the workspace configuration.',
  '- Prefer list_properties or get_property before mutating object records when you need to confirm the current schema.',
  '- Start booking, rescheduling, or cancellation flows with get_calendar_bootstrap when you need the event context or existing attendance details.',
  '- Use check_calendar_availability before create_calendar_attendance or reschedule_calendar_attendance when the user needs the next available slot.',
  '- Prefer update_ticket_status over update_ticket when only the stage or status is changing.',
  '- Use prospect_companies when the user wants external company discovery or target-account research rather than only searching existing CRM records.',
  '- Use score_record when the user wants qualification, prioritization, or a transparent explanation of why a company or deal is strong or weak.',
  '- Use upload_expense_attachment before create_expense or update_expense when the user wants a receipt or invoice attached.',
  '- upload_expense_attachment expects filename plus content_base64. Do not assume the hosted MCP server can read a client-local file path.',
  '- If a tool reports missing authentication, prompt the client to re-authenticate rather than guessing.',
  '- Individual HTTP requests to the API have a 30-second timeout. If a request times out, try a smaller query or add filters.',
  '- Code execution has a total timeout of approximately 5 minutes. If your code times out, simplify it or break it into smaller steps.',
].join('\n');

const DEFAULT_HOSTED_INSTRUCTIONS = [
  'This is the hosted Sanka MCP server used by packaged AI clients.',
  '',
  'Available tools:',
  '- auth_status: Debug whether the Sanka connector is authenticated. Do not use this as a preflight before protected Sanka tools.',
  '- list_companies: Search and review companies in Sanka.',
  '- get_company: Load one company in Sanka.',
  '- create_company: Create a company in Sanka.',
  '- update_company: Update a company in Sanka.',
  '- delete_company: Delete a company in Sanka.',
  '- list_contacts: Search and review contacts in Sanka.',
  '- get_contact: Load one contact in Sanka.',
  '- create_contact: Create a contact in Sanka.',
  '- update_contact: Update a contact in Sanka.',
  '- delete_contact: Delete a contact in Sanka.',
  '- list_deals: Review deals (sales pipeline records) in Sanka.',
  '- get_deal: Load one deal in Sanka.',
  '- create_deal: Create a deal in Sanka.',
  '- update_deal: Update a deal in Sanka.',
  '- delete_deal: Delete a deal in Sanka.',
  '- list_deal_pipelines: List the deal pipelines and stages defined in the workspace.',
  '- list_orders: Search and review orders in Sanka.',
  '- get_order: Load one order in Sanka.',
  '- create_order: Create an order in Sanka.',
  '- update_order: Update an order in Sanka.',
  '- delete_order: Delete an order in Sanka.',
  '- list_estimates: Review estimates in Sanka.',
  '- get_estimate: Load one estimate in Sanka.',
  '- create_estimate: Create an estimate in Sanka.',
  '- update_estimate: Update an estimate in Sanka.',
  '- delete_estimate: Delete an estimate in Sanka.',
  '- list_invoices: Review invoices in Sanka.',
  '- get_invoice: Load one invoice in Sanka.',
  '- create_invoice: Create an invoice in Sanka.',
  '- update_invoice: Update an invoice in Sanka.',
  '- delete_invoice: Delete an invoice in Sanka.',
  '- list_tickets: Review tickets in Sanka.',
  '- get_ticket: Load one ticket in Sanka.',
  '- create_ticket: Create a ticket in Sanka.',
  '- update_ticket: Update a ticket in Sanka.',
  '- delete_ticket: Delete a ticket in Sanka.',
  '- list_ticket_pipelines: List the ticket pipelines and stages defined in the workspace.',
  '- update_ticket_status: Update only the stage or status of a ticket in Sanka.',
  '- list_expenses: Review expense records in Sanka.',
  '- get_expense: Load one expense in Sanka.',
  '- upload_expense_attachment: Upload an expense attachment and return a file_id.',
  '- create_expense: Create an expense in Sanka.',
  '- update_expense: Update an existing expense in Sanka.',
  '- delete_expense: Delete an expense in Sanka.',
  '- list_properties: Review object property definitions in Sanka.',
  '- get_property: Load one property definition in Sanka.',
  '- create_property: Create a custom property in Sanka.',
  '- update_property: Update a custom property in Sanka.',
  '- delete_property: Delete a custom property in Sanka.',
  '- get_calendar_bootstrap: Load the public calendar booking context for an event or attendance.',
  '- check_calendar_availability: Check available booking slots for a public calendar event.',
  '- create_calendar_attendance: Book a new public calendar attendance.',
  '- cancel_calendar_attendance: Cancel an existing public calendar attendance.',
  '- reschedule_calendar_attendance: Reschedule an existing public calendar attendance.',
  '- prospect_companies: Discover net-new companies from external sources using Sanka prospecting.',
  '- score_record: Score a company or deal in Sanka and explain the result.',
  '',
  'Guardrails:',
  '- Treat company, contact, deal, order, estimate, invoice, ticket, expense, property, calendar, prospecting, and scoring requests as live Sanka operations. Results and mutations must come from the dedicated MCP tools above.',
  '- For companies, contacts, deals, orders, estimates, invoices, tickets, expenses, properties, calendar workflows, prospecting, or scoring, call the matching protected tool directly without first calling auth_status.',
  '- Protected Sanka tool calls are the OAuth trigger in clients like Codex, Claude, and Cursor.',
  '- If a protected tool is unavailable in the current client session, say the Sanka MCP server or plugin attachment is missing and ask the user to reconnect rather than guessing.',
  '- Never fabricate live Sanka data or substitute repo-local state, database access, or other out-of-band sources for dedicated Sanka tool results.',
  '',
  'Workflow:',
  '- Keep CRM queries narrow with search, pagination, workspace filters, or result limits when possible.',
  '- Prefer list_deal_pipelines before describing deal stages so stage labels and ordering match the workspace configuration.',
  '- For orders, provide line items inside the nested `order` payload and prefer external references for linked companies or items when available.',
  '- Prefer list_ticket_pipelines before moving tickets across stages so stage keys and labels match the workspace configuration.',
  '- Prefer list_properties or get_property before mutating object records when you need to confirm the current schema.',
  '- Start booking, rescheduling, or cancellation flows with get_calendar_bootstrap when you need the event context or existing attendance details.',
  '- Use check_calendar_availability before create_calendar_attendance or reschedule_calendar_attendance when the user needs the next available slot.',
  '- Prefer update_ticket_status over update_ticket when only the stage or status is changing.',
  '- Use prospect_companies when the user wants external company discovery or target-account research rather than only searching existing CRM records.',
  '- Use score_record when the user wants qualification, prioritization, or a transparent explanation of why a company or deal is strong or weak.',
  '- Use upload_expense_attachment before create_expense or update_expense when the user wants a receipt or invoice attached.',
  '- upload_expense_attachment expects filename plus content_base64. Do not assume the hosted MCP server can read a client-local file path.',
  '- If a tool reports missing authentication, prompt the client to re-authenticate rather than guessing.',
  '- Individual HTTP requests to the API have a 30-second timeout. If a request times out, try a smaller query or add filters.',
].join('\n');

interface InstructionsCacheEntry {
  fetchedInstructions: string;
  fetchedAt: number;
}

const instructionsCache = new Map<string, InstructionsCacheEntry>();

export async function getInstructions({
  customInstructionsPath,
  toolProfile = 'full',
}: {
  customInstructionsPath?: string | undefined;
  toolProfile?: ToolProfile | undefined;
}): Promise<string> {
  const now = Date.now();
  const cacheKey = `${customInstructionsPath ?? '__default__'}:${toolProfile}`;
  const cached = instructionsCache.get(cacheKey);

  if (cached && now - cached.fetchedAt <= INSTRUCTIONS_CACHE_TTL_MS) {
    return cached.fetchedInstructions;
  }

  // Evict stale entries so the cache doesn't grow unboundedly.
  for (const [key, entry] of instructionsCache) {
    if (now - entry.fetchedAt > INSTRUCTIONS_CACHE_TTL_MS) {
      instructionsCache.delete(key);
    }
  }

  let fetchedInstructions: string;

  if (customInstructionsPath) {
    fetchedInstructions = await fetchLatestInstructionsFromFile(customInstructionsPath);
  } else {
    fetchedInstructions = toolProfile === 'hosted' ? DEFAULT_HOSTED_INSTRUCTIONS : DEFAULT_FULL_INSTRUCTIONS;
  }

  instructionsCache.set(cacheKey, { fetchedInstructions, fetchedAt: now });
  return fetchedInstructions;
}

async function fetchLatestInstructionsFromFile(path: string): Promise<string> {
  try {
    return await fs.readFile(path, 'utf-8');
  } catch (error) {
    getLogger().error({ error, path }, 'Error fetching instructions from file');
    throw error;
  }
}
