// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import fs from 'fs/promises';
import { getLogger } from './logger';
import { ToolProfile } from './profile';

const INSTRUCTIONS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_FULL_INSTRUCTIONS =
  '\n  This is the Sanka MCP server.\n\n  Available tools:\n  - search_docs: Search SDK documentation to find the right methods and parameters.\n  - execute: Run TypeScript code against a pre-authenticated SDK client. Define an async run(client) function.\n  - auth_status: Debug whether the Sanka connector is authenticated. Do not use this as a preflight before protected CRM, deal, or expense tools.\n  - list_companies: Search and review companies in Sanka.\n  - list_contacts: Search and review contacts in Sanka.\n  - list_deals: Review deals (sales pipeline records) in Sanka.\n  - get_deal: Load one deal in Sanka.\n  - list_deal_pipelines: List the deal pipelines and stages defined in the workspace.\n  - list_expenses: Review expense records in Sanka.\n  - get_expense: Load one expense in Sanka.\n  - upload_expense_attachment: Upload an expense attachment and return a file_id.\n  - create_expense: Create an expense in Sanka.\n  - update_expense: Update an existing expense in Sanka.\n  - delete_expense: Delete an expense in Sanka.\n\n  Guardrails:\n  - Treat CRM, deal, and expense requests as live Sanka operations. Results and mutations must come from the dedicated MCP tools above.\n  - For companies, contacts, deals, or expenses, call the matching protected tool directly without first calling auth_status.\n  - Protected CRM, deal, and expense tool calls are the OAuth trigger in clients like Codex, Claude, and Cursor.\n  - Do not use search_docs or execute as a fallback for live CRM, deal, or expense work when a dedicated MCP tool covers the request.\n  - If a protected tool is unavailable in the current client session, say the Sanka MCP server or plugin attachment is missing and ask the user to reconnect rather than guessing.\n  - Never fabricate live Sanka data or substitute repo-local state, database access, or other out-of-band sources for dedicated CRM, deal, or expense tool results.\n\n  Workflow:\n  - Use search_docs before writing code when you need to discover the right SDK method or parameter shape for uncovered workflows.\n  - Use execute only for Sanka SDK workflows that are not covered by dedicated MCP tools.\n  - Keep CRM queries narrow with search, pagination, workspace filters, or result limits when possible.\n  - Prefer list_deal_pipelines before describing deal stages so stage labels and ordering match the workspace configuration.\n  - Use upload_expense_attachment before create_expense or update_expense when the user wants a receipt or invoice attached.\n  - upload_expense_attachment expects filename plus content_base64. Do not assume the hosted MCP server can read a client-local file path.\n  - If a tool reports missing authentication, prompt the client to re-authenticate rather than guessing.\n  - Individual HTTP requests to the API have a 30-second timeout. If a request times out, try a smaller query or add filters.\n  - Code execution has a total timeout of approximately 5 minutes. If your code times out, simplify it or break it into smaller steps.\n  ';
const DEFAULT_HOSTED_INSTRUCTIONS =
  '\n  This is the hosted Sanka MCP server used by packaged AI clients.\n\n  Available tools:\n  - auth_status: Debug whether the Sanka connector is authenticated. Do not use this as a preflight before protected CRM, deal, or expense tools.\n  - list_companies: Search and review companies in Sanka.\n  - list_contacts: Search and review contacts in Sanka.\n  - list_deals: Review deals (sales pipeline records) in Sanka.\n  - get_deal: Load one deal in Sanka.\n  - list_deal_pipelines: List the deal pipelines and stages defined in the workspace.\n  - list_expenses: Review expense records in Sanka.\n  - get_expense: Load one expense in Sanka.\n  - upload_expense_attachment: Upload an expense attachment and return a file_id.\n  - create_expense: Create an expense in Sanka.\n  - update_expense: Update an existing expense in Sanka.\n  - delete_expense: Delete an expense in Sanka.\n\n  Guardrails:\n  - Treat CRM, deal, and expense requests as live Sanka operations. Results and mutations must come from the dedicated MCP tools above.\n  - For companies, contacts, deals, or expenses, call the matching protected tool directly without first calling auth_status.\n  - Protected CRM, deal, and expense tool calls are the OAuth trigger in clients like Codex, Claude, and Cursor.\n  - If a protected tool is unavailable in the current client session, say the Sanka MCP server or plugin attachment is missing and ask the user to reconnect rather than guessing.\n  - Never fabricate live Sanka data or substitute repo-local state, database access, or other out-of-band sources for dedicated CRM, deal, or expense tool results.\n\n  Workflow:\n  - Keep CRM queries narrow with search, pagination, workspace filters, or result limits when possible.\n  - Prefer list_deal_pipelines before describing deal stages so stage labels and ordering match the workspace configuration.\n  - Use upload_expense_attachment before create_expense or update_expense when the user wants a receipt or invoice attached.\n  - upload_expense_attachment expects filename plus content_base64. Do not assume the hosted MCP server can read a client-local file path.\n  - If a tool reports missing authentication, prompt the client to re-authenticate rather than guessing.\n  - Individual HTTP requests to the API have a 30-second timeout. If a request times out, try a smaller query or add filters.\n  ';

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
