// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import fs from 'fs/promises';
import { getLogger } from './logger';
import { ToolProfile } from './profile';

const INSTRUCTIONS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_FULL_INSTRUCTIONS =
  '\n  This is the sanka MCP server.\n\n  Available tools:\n  - search_docs: Search SDK documentation to find the right methods and parameters.\n  - execute: Run TypeScript code against a pre-authenticated SDK client. Define an async run(client) function.\n\n  Workflow:\n  - If unsure about the API, call search_docs first.\n  - Write complete solutions in a single execute call when possible. For large datasets, use API filters to narrow results or paginate within a single execute block.\n  - If execute returns an error, read the error and fix your code rather than retrying the same approach.\n  - Variables do not persist between execute calls. Return or log all data you need.\n  - Individual HTTP requests to the API have a 30-second timeout. If a request times out, try a smaller query or add filters.\n  - Code execution has a total timeout of approximately 5 minutes. If your code times out, simplify it or break it into smaller steps.\n  ';
const DEFAULT_CRM_INSTRUCTIONS =
  '\n  This is the sanka MCP server.\n\n  Available tools:\n  - crm.auth_status: Check whether the Sanka CRM connector is authenticated and ready.\n  - crm.list_companies: Search and review companies in Sanka.\n  - crm.list_contacts: Search and review contacts in Sanka.\n\n  Workflow:\n  - Use crm.auth_status when the user asks whether OAuth is needed or when the connector might be disconnected.\n  - Use the CRM tools directly when the user wants to find or inspect companies or contacts.\n  - Keep queries narrow with search, pagination, or view filters when possible.\n  - These tools are read-only and return structured results for the current authenticated workspace.\n  - If a tool reports missing authentication or missing scopes, prompt the client to re-authenticate rather than guessing.\n  ';

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
    fetchedInstructions = toolProfile === 'crm' ? DEFAULT_CRM_INSTRUCTIONS : DEFAULT_FULL_INSTRUCTIONS;
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
