// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import MiniSearch from 'minisearch';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getLogger } from './logger';

type PerLanguageData = {
  method?: string;
  example?: string;
};

type MethodEntry = {
  name: string;
  endpoint: string;
  httpMethod: string;
  summary: string;
  description: string;
  stainlessPath: string;
  qualified: string;
  params?: string[];
  response?: string;
  markdown?: string;
  perLanguage?: Record<string, PerLanguageData>;
};

type ProseChunk = {
  content: string;
  tag: string;
  sectionContext?: string;
  source?: string;
};

type MiniSearchDocument = {
  id: string;
  kind: 'http_method' | 'prose';
  name?: string;
  endpoint?: string;
  summary?: string;
  description?: string;
  qualified?: string;
  stainlessPath?: string;
  content?: string;
  sectionContext?: string;
  _original: Record<string, unknown>;
};

type SearchResult = {
  results: (string | Record<string, unknown>)[];
};

const EMBEDDED_METHODS: MethodEntry[] = [
  {
    name: 'create',
    endpoint: '/v1/enrich',
    httpMethod: 'post',
    summary: 'Enrich Company Data',
    description: 'Enrich Company Data',
    stainlessPath: '(resource) enrich > (method) create',
    qualified: 'client.enrich.create',
    params: [
      'object_type: string;',
      'custom_field_map?: object;',
      'dry_run?: boolean;',
      'force_refresh?: boolean;',
      'record_id?: string;',
      'seed?: { external_id?: string; name?: string; url?: string; };',
    ],
    response:
      '{ data: { pipeline_version: string; request_hash: string; run_id: string; company_id?: string; field_evidence?: object; proposed_fields?: object; provider_meta?: object; seed_external_id?: string; skipped_fields?: object; updated_builtin_fields?: object; updated_custom_fields?: object; }; message: string; ctx_id?: string; }',
    markdown:
      "## create\n\n`client.enrich.create(object_type: string, custom_field_map?: object, dry_run?: boolean, force_refresh?: boolean, record_id?: string, seed?: { external_id?: string; name?: string; url?: string; }): { data: object; message: string; ctx_id?: string; }`\n\n**post** `/v1/enrich`\n\nEnrich Company Data\n\n### Parameters\n\n- `object_type: string`\n\n- `custom_field_map?: object`\n\n- `dry_run?: boolean`\n\n- `force_refresh?: boolean`\n\n- `record_id?: string`\n\n- `seed?: { external_id?: string; name?: string; url?: string; }`\n  - `external_id?: string`\n  - `name?: string`\n  - `url?: string`\n\n### Returns\n\n- `{ data: { pipeline_version: string; request_hash: string; run_id: string; company_id?: string; field_evidence?: object; proposed_fields?: object; provider_meta?: object; seed_external_id?: string; skipped_fields?: object; updated_builtin_fields?: object; updated_custom_fields?: object; }; message: string; ctx_id?: string; }`\n\n  - `data: { pipeline_version: string; request_hash: string; run_id: string; company_id?: string; field_evidence?: object; proposed_fields?: object; provider_meta?: object; seed_external_id?: string; skipped_fields?: object; updated_builtin_fields?: object; updated_custom_fields?: object; }`\n  - `message: string`\n  - `ctx_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst enrich = await client.enrich.create({ object_type: 'object_type' });\n\nconsole.log(enrich);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/score',
    httpMethod: 'post',
    summary: 'Score Company or Deal Data',
    description: 'Score Company or Deal Data',
    stainlessPath: '(resource) score > (method) create',
    qualified: 'client.score.create',
    params: ['object_type: string;', 'record_id: string;', 'score_model_id?: string;'],
    response:
      '{ data: { algorithm_key: string; algorithm_version: string; band: string; input_hash: string; object_type: string; output_hash: string; record_id: string; score: number; snapshot_id: string; dimensions?: object[]; explanation?: string; reasons?: object[]; score_model_id?: string; score_model_name?: string; score_model_version?: number; }; message: string; ctx_id?: string; }',
    markdown:
      "## create\n\n`client.score.create(object_type: string, record_id: string, score_model_id?: string): { data: object; message: string; ctx_id?: string; }`\n\n**post** `/v1/score`\n\nScore Company or Deal Data\n\n### Parameters\n\n- `object_type: string`\n\n- `record_id: string`\n\n- `score_model_id?: string`\n\n### Returns\n\n- `{ data: { algorithm_key: string; algorithm_version: string; band: string; input_hash: string; object_type: string; output_hash: string; record_id: string; score: number; snapshot_id: string; dimensions?: object[]; explanation?: string; reasons?: object[]; score_model_id?: string; score_model_name?: string; score_model_version?: number; }; message: string; ctx_id?: string; }`\n\n  - `data: { algorithm_key: string; algorithm_version: string; band: string; input_hash: string; object_type: string; output_hash: string; record_id: string; score: number; snapshot_id: string; dimensions?: object[]; explanation?: string; reasons?: object[]; score_model_id?: string; score_model_name?: string; score_model_version?: number; }`\n  - `message: string`\n  - `ctx_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst score = await client.score.create({ object_type: 'object_type', record_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e' });\n\nconsole.log(score);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/account-messages',
    httpMethod: 'get',
    summary: 'List Account Messages',
    description: 'List private account-level inbox messages for the authenticated user.',
    stainlessPath: '(resource) public.accountMessages > (method) list',
    qualified: 'client.public.accountMessages.list',
    params: ['status?: string;', "'Accept-Language'?: string;"],
    response:
      '{ data: { channels: { id: string; integration_slug: string; display_name: string; thread_count: number; unread_count: number; account_username?: string; status?: string; updated_at?: string; }[]; threads: { id: string; title: string; channel_id: string; channel_label: string; counterparty: string; preview: string; has_unread: boolean; message_count: number; message_type: string; last_message_at?: string; }[]; }; message: string; ctx_id?: string; }',
    markdown:
      "## list\n\n`client.public.accountMessages.list(status?: string, 'Accept-Language'?: string): { data: object; message: string; ctx_id?: string; }`\n\n**get** `/v1/public/account-messages`\n\nList Account Messages\n\n### Parameters\n\n- `status?: string`\n\n- `'Accept-Language'?: string`\n\n### Returns\n\n- `{ data: { channels: { id: string; integration_slug: string; display_name: string; thread_count: number; unread_count: number; account_username?: string; status?: string; updated_at?: string; }[]; threads: { id: string; title: string; channel_id: string; channel_label: string; counterparty: string; preview: string; has_unread: boolean; message_count: number; message_type: string; last_message_at?: string; }[]; }; message: string; ctx_id?: string; }`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst response = await client.public.accountMessages.list({ status: 'active' });\n\nconsole.log(response);\n```",
  },
  {
    name: 'sync',
    endpoint: '/v1/public/account-messages/sync',
    httpMethod: 'post',
    summary: 'Sync Account Messages',
    description: 'Sync private account-level inbox messages for the authenticated user.',
    stainlessPath: '(resource) public.accountMessages > (method) sync',
    qualified: 'client.public.accountMessages.sync',
    params: ['channel_id?: string;', 'status?: string;', "'Accept-Language'?: string;"],
    response: '{ data: { channels: object[]; threads: object[]; }; message: string; ctx_id?: string; }',
    markdown:
      "## sync\n\n`client.public.accountMessages.sync(channel_id?: string, status?: string, 'Accept-Language'?: string): { data: object; message: string; ctx_id?: string; }`\n\n**post** `/v1/public/account-messages/sync`\n\nSync Account Messages\n\n### Parameters\n\n- `channel_id?: string`\n\n- `status?: string`\n\n- `'Accept-Language'?: string`\n\n### Returns\n\n- `{ data: { channels: object[]; threads: object[]; }; message: string; ctx_id?: string; }`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst response = await client.public.accountMessages.sync({ channel_id: 'channel_id' });\n\nconsole.log(response);\n```",
  },
  {
    name: 'bulk_actions',
    endpoint: '/v1/public/account-messages/bulk-actions',
    httpMethod: 'post',
    summary: 'Bulk Update Account Message Threads',
    description: 'Apply a bulk action to private account-level inbox threads.',
    stainlessPath: '(resource) public.accountMessages > (method) bulkActions',
    qualified: 'client.public.accountMessages.bulkActions',
    params: ['action: string;', 'thread_ids: string[];', 'status?: string;', "'Accept-Language'?: string;"],
    response: '{ data: { channels: object[]; threads: object[]; }; message: string; ctx_id?: string; }',
    markdown:
      "## bulk_actions\n\n`client.public.accountMessages.bulkActions(action: string, thread_ids: string[], status?: string, 'Accept-Language'?: string): { data: object; message: string; ctx_id?: string; }`\n\n**post** `/v1/public/account-messages/bulk-actions`\n\nBulk Update Account Message Threads\n\n### Parameters\n\n- `action: string`\n\n- `thread_ids: string[]`\n\n- `status?: string`\n\n- `'Accept-Language'?: string`\n\n### Returns\n\n- `{ data: { channels: object[]; threads: object[]; }; message: string; ctx_id?: string; }`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst response = await client.public.accountMessages.bulkActions({ action: 'archive', thread_ids: ['thread_id'] });\n\nconsole.log(response);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/account-messages/threads/{thread_id}',
    httpMethod: 'get',
    summary: 'Get Account Message Thread',
    description: 'Load one private account-level inbox thread, including message history and reply metadata.',
    stainlessPath: '(resource) public.accountMessages.threads > (method) retrieve',
    qualified: 'client.public.accountMessages.threads.retrieve',
    params: ['thread_id: string;', "'Accept-Language'?: string;"],
    response:
      '{ data: { id: string; title: string; channel_id: string; channel_label: string; counterparty: string; preview: string; has_unread: boolean; message_count: number; message_type: string; open_in_web_url: string; can_reply: boolean; reply_target?: string; messages: { id: string; body: string; direction: string; sender_label: string; sent_at?: string; status?: string; }[]; last_message_at?: string; }; message: string; ctx_id?: string; }',
    markdown:
      "## retrieve\n\n`client.public.accountMessages.threads.retrieve(thread_id: string, 'Accept-Language'?: string): { data: object; message: string; ctx_id?: string; }`\n\n**get** `/v1/public/account-messages/threads/{thread_id}`\n\nGet Account Message Thread\n\n### Parameters\n\n- `thread_id: string`\n\n- `'Accept-Language'?: string`\n\n### Returns\n\n- `{ data: { id: string; title: string; channel_id: string; channel_label: string; counterparty: string; preview: string; has_unread: boolean; message_count: number; message_type: string; open_in_web_url: string; can_reply: boolean; reply_target?: string; messages: object[]; last_message_at?: string; }; message: string; ctx_id?: string; }`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst response = await client.public.accountMessages.threads.retrieve('thread_id');\n\nconsole.log(response);\n```",
  },
  {
    name: 'archive',
    endpoint: '/v1/public/account-messages/threads/{thread_id}/archive',
    httpMethod: 'post',
    summary: 'Archive Account Message Thread',
    description: 'Archive one private account-level inbox thread.',
    stainlessPath: '(resource) public.accountMessages.threads > (method) archive',
    qualified: 'client.public.accountMessages.threads.archive',
    params: ['thread_id: string;', "'Accept-Language'?: string;"],
    response: '{ data: { channels: object[]; threads: object[]; }; message: string; ctx_id?: string; }',
    markdown:
      "## archive\n\n`client.public.accountMessages.threads.archive(thread_id: string, 'Accept-Language'?: string): { data: object; message: string; ctx_id?: string; }`\n\n**post** `/v1/public/account-messages/threads/{thread_id}/archive`\n\nArchive Account Message Thread\n\n### Parameters\n\n- `thread_id: string`\n\n- `'Accept-Language'?: string`\n\n### Returns\n\n- `{ data: { channels: object[]; threads: object[]; }; message: string; ctx_id?: string; }`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst response = await client.public.accountMessages.threads.archive('thread_id');\n\nconsole.log(response);\n```",
  },
  {
    name: 'reply',
    endpoint: '/v1/public/account-messages/threads/{thread_id}/reply',
    httpMethod: 'post',
    summary: 'Reply To Account Message Thread',
    description: 'Send a reply on one private account-level inbox thread.',
    stainlessPath: '(resource) public.accountMessages.threads > (method) reply',
    qualified: 'client.public.accountMessages.threads.reply',
    params: ['thread_id: string;', 'body: string;', "'Accept-Language'?: string;"],
    response:
      '{ data: { thread_id: string; has_unread: boolean; message_id?: string; }; message: string; ctx_id?: string; }',
    markdown:
      "## reply\n\n`client.public.accountMessages.threads.reply(thread_id: string, body: string, 'Accept-Language'?: string): { data: object; message: string; ctx_id?: string; }`\n\n**post** `/v1/public/account-messages/threads/{thread_id}/reply`\n\nReply To Account Message Thread\n\n### Parameters\n\n- `thread_id: string`\n\n- `body: string`\n\n- `'Accept-Language'?: string`\n\n### Returns\n\n- `{ data: { thread_id: string; has_unread: boolean; message_id?: string; }; message: string; ctx_id?: string; }`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst response = await client.public.accountMessages.threads.reply('thread_id', { body: 'Thanks for the update.' });\n\nconsole.log(response);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/orders',
    httpMethod: 'post',
    summary: 'Create Orders',
    description: 'Create Orders',
    stainlessPath: '(resource) public.orders > (method) create',
    qualified: 'client.public.orders.create',
    params: [
      'order: { externalId: string; items: { item_id?: string; itemExternalId?: string; price?: number; quantity?: number; tax?: number; tax_rate?: number; }[]; companyExternalId?: string; companyId?: string; deliveryStatus?: string; orderAt?: string; };',
      'createMissingItems?: boolean;',
      'triggerWorkflows?: boolean;',
    ],
    response:
      '{ ok: boolean; ctx_id?: string; job_id?: string; results?: { external_id: string; status: string; errors?: string[]; order_id?: string; }[]; }',
    markdown:
      "## create\n\n`client.public.orders.create(order: { externalId: string; items: object[]; companyExternalId?: string; companyId?: string; deliveryStatus?: string; orderAt?: string; }, createMissingItems?: boolean, triggerWorkflows?: boolean): { ok: boolean; ctx_id?: string; job_id?: string; results?: object[]; }`\n\n**post** `/v1/public/orders`\n\nCreate Orders\n\n### Parameters\n\n- `order: { externalId: string; items: { item_id?: string; itemExternalId?: string; price?: number; quantity?: number; tax?: number; tax_rate?: number; }[]; companyExternalId?: string; companyId?: string; deliveryStatus?: string; orderAt?: string; }`\n  - `externalId: string`\n  - `items: { item_id?: string; itemExternalId?: string; price?: number; quantity?: number; tax?: number; tax_rate?: number; }[]`\n  - `companyExternalId?: string`\n  - `companyId?: string`\n  - `deliveryStatus?: string`\n  - `orderAt?: string`\n\n- `createMissingItems?: boolean`\n\n- `triggerWorkflows?: boolean`\n\n### Returns\n\n- `{ ok: boolean; ctx_id?: string; job_id?: string; results?: { external_id: string; status: string; errors?: string[]; order_id?: string; }[]; }`\n\n  - `ok: boolean`\n  - `ctx_id?: string`\n  - `job_id?: string`\n  - `results?: { external_id: string; status: string; errors?: string[]; order_id?: string; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst bulkOrders = await client.public.orders.create({ order: { externalId: 'externalId', items: [{}] } });\n\nconsole.log(bulkOrders);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/orders/{order_id}',
    httpMethod: 'get',
    summary: 'Get Order',
    description: 'Get Order',
    stainlessPath: '(resource) public.orders > (method) retrieve',
    qualified: 'client.public.orders.retrieve',
    params: ['order_id: string;', 'external_id?: string;'],
    response:
      '{ id: string; created_at: string; order_at: string; updated_at: string; company_id?: string; contact_id?: string; currency?: string; delivery_status?: string; number_item?: number; order_id?: number; status?: string; total_price?: number; total_price_without_tax?: number; }',
    markdown:
      "## retrieve\n\n`client.public.orders.retrieve(order_id: string, external_id?: string): { id: string; created_at: string; order_at: string; updated_at: string; company_id?: string; contact_id?: string; currency?: string; delivery_status?: string; number_item?: number; order_id?: number; status?: string; total_price?: number; total_price_without_tax?: number; }`\n\n**get** `/v1/public/orders/{order_id}`\n\nGet Order\n\n### Parameters\n\n- `order_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ id: string; created_at: string; order_at: string; updated_at: string; company_id?: string; contact_id?: string; currency?: string; delivery_status?: string; number_item?: number; order_id?: number; status?: string; total_price?: number; total_price_without_tax?: number; }`\n\n  - `id: string`\n  - `created_at: string`\n  - `order_at: string`\n  - `updated_at: string`\n  - `company_id?: string`\n  - `contact_id?: string`\n  - `currency?: string`\n  - `delivery_status?: string`\n  - `number_item?: number`\n  - `order_id?: number`\n  - `status?: string`\n  - `total_price?: number`\n  - `total_price_without_tax?: number`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst order = await client.public.orders.retrieve('order_id');\n\nconsole.log(order);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/orders/{order_id}',
    httpMethod: 'put',
    summary: 'Update Order',
    description: 'Update Order',
    stainlessPath: '(resource) public.orders > (method) update',
    qualified: 'client.public.orders.update',
    params: [
      'order_id: string;',
      'order: { externalId: string; items: { item_id?: string; itemExternalId?: string; price?: number; quantity?: number; tax?: number; tax_rate?: number; }[]; companyExternalId?: string; companyId?: string; deliveryStatus?: string; orderAt?: string; };',
      'createMissingItems?: boolean;',
      'triggerWorkflows?: boolean;',
    ],
    response:
      '{ ok: boolean; ctx_id?: string; job_id?: string; results?: { external_id: string; status: string; errors?: string[]; order_id?: string; }[]; }',
    markdown:
      "## update\n\n`client.public.orders.update(order_id: string, order: { externalId: string; items: object[]; companyExternalId?: string; companyId?: string; deliveryStatus?: string; orderAt?: string; }, createMissingItems?: boolean, triggerWorkflows?: boolean): { ok: boolean; ctx_id?: string; job_id?: string; results?: object[]; }`\n\n**put** `/v1/public/orders/{order_id}`\n\nUpdate Order\n\n### Parameters\n\n- `order_id: string`\n\n- `order: { externalId: string; items: { item_id?: string; itemExternalId?: string; price?: number; quantity?: number; tax?: number; tax_rate?: number; }[]; companyExternalId?: string; companyId?: string; deliveryStatus?: string; orderAt?: string; }`\n  - `externalId: string`\n  - `items: { item_id?: string; itemExternalId?: string; price?: number; quantity?: number; tax?: number; tax_rate?: number; }[]`\n  - `companyExternalId?: string`\n  - `companyId?: string`\n  - `deliveryStatus?: string`\n  - `orderAt?: string`\n\n- `createMissingItems?: boolean`\n\n- `triggerWorkflows?: boolean`\n\n### Returns\n\n- `{ ok: boolean; ctx_id?: string; job_id?: string; results?: { external_id: string; status: string; errors?: string[]; order_id?: string; }[]; }`\n\n  - `ok: boolean`\n  - `ctx_id?: string`\n  - `job_id?: string`\n  - `results?: { external_id: string; status: string; errors?: string[]; order_id?: string; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst bulkOrders = await client.public.orders.update('order_id', { order: { externalId: 'externalId', items: [{}] } });\n\nconsole.log(bulkOrders);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/orders',
    httpMethod: 'get',
    summary: 'List Orders',
    description: 'List Orders',
    stainlessPath: '(resource) public.orders > (method) list',
    qualified: 'client.public.orders.list',
    params: [
      'limit?: number;',
      'page?: number;',
      'reference_id?: string;',
      'search?: string;',
      'sort?: string;',
      'view?: string;',
      'Accept-Language?: string;',
    ],
    response:
      '{ count: number; data: object[]; message: string; page: number; total: number; ctx_id?: string; }',
    markdown:
      "## list\n\n`client.public.orders.list(limit?: number, page?: number, reference_id?: string, search?: string, sort?: string, view?: string, Accept-Language?: string): { count: number; data: object[]; message: string; page: number; total: number; ctx_id?: string; }`\n\n**get** `/v1/public/orders`\n\nList Orders\n\n### Parameters\n\n- `limit?: number`\n\n- `page?: number`\n\n- `reference_id?: string`\n\n- `search?: string`\n\n- `sort?: string`\n\n- `view?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ count: number; data: object[]; message: string; page: number; total: number; ctx_id?: string; }`\n\n  - `count: number`\n  - `data: object[]`\n  - `message: string`\n  - `page: number`\n  - `total: number`\n  - `ctx_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst orders = await client.public.orders.list();\n\nconsole.log(orders);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/orders/{order_id}',
    httpMethod: 'delete',
    summary: 'Delete Order',
    description: 'Delete Order',
    stainlessPath: '(resource) public.orders > (method) delete',
    qualified: 'client.public.orders.delete',
    params: ['order_id: string;', 'external_id?: string;'],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; order_id?: string; }',
    markdown:
      "## delete\n\n`client.public.orders.delete(order_id: string, external_id?: string): { ok: boolean; status: string; ctx_id?: string; external_id?: string; order_id?: string; }`\n\n**delete** `/v1/public/orders/{order_id}`\n\nDelete Order\n\n### Parameters\n\n- `order_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; order_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `order_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst order = await client.public.orders.delete('order_id');\n\nconsole.log(order);\n```",
  },
  {
    name: 'bulk_create',
    endpoint: '/v1/public/orders/bulk',
    httpMethod: 'post',
    summary: 'Bulk Create Orders',
    description: 'Bulk Create Orders',
    stainlessPath: '(resource) public.orders > (method) bulk_create',
    qualified: 'client.public.orders.bulkCreate',
    params: [
      'orders: { externalId: string; items: { item_id?: string; itemExternalId?: string; price?: number; quantity?: number; tax?: number; tax_rate?: number; }[]; companyExternalId?: string; companyId?: string; deliveryStatus?: string; orderAt?: string; }[];',
      'createMissingItems?: boolean;',
      'triggerWorkflows?: boolean;',
    ],
    response:
      '{ ok: boolean; ctx_id?: string; job_id?: string; results?: { external_id: string; status: string; errors?: string[]; order_id?: string; }[]; }',
    markdown:
      "## bulk_create\n\n`client.public.orders.bulkCreate(orders: { externalId: string; items: object[]; companyExternalId?: string; companyId?: string; deliveryStatus?: string; orderAt?: string; }[], createMissingItems?: boolean, triggerWorkflows?: boolean): { ok: boolean; ctx_id?: string; job_id?: string; results?: object[]; }`\n\n**post** `/v1/public/orders/bulk`\n\nBulk Create Orders\n\n### Parameters\n\n- `orders: { externalId: string; items: { item_id?: string; itemExternalId?: string; price?: number; quantity?: number; tax?: number; tax_rate?: number; }[]; companyExternalId?: string; companyId?: string; deliveryStatus?: string; orderAt?: string; }[]`\n\n- `createMissingItems?: boolean`\n\n- `triggerWorkflows?: boolean`\n\n### Returns\n\n- `{ ok: boolean; ctx_id?: string; job_id?: string; results?: { external_id: string; status: string; errors?: string[]; order_id?: string; }[]; }`\n\n  - `ok: boolean`\n  - `ctx_id?: string`\n  - `job_id?: string`\n  - `results?: { external_id: string; status: string; errors?: string[]; order_id?: string; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst bulkOrders = await client.public.orders.bulkCreate({ orders: [{ externalId: 'externalId', items: [{}] }] });\n\nconsole.log(bulkOrders);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/tasks',
    httpMethod: 'post',
    summary: 'Create Task',
    description: 'Create Task',
    stainlessPath: '(resource) public.tasks > (method) create',
    qualified: 'client.public.tasks.create',
    params: [
      'external_id?: string;',
      'title?: string;',
      'description?: string;',
      'status?: string;',
      'usage_status?: string;',
      'project_id?: string;',
      'start_date?: string;',
      'due_date?: string;',
      'main_task_id?: string;',
      'owner_id?: string;',
      'assignees?: string[];',
      'projects?: string[];',
    ],
    response: '{ ok: boolean; status: string; external_id?: string; task_id?: string; ctx_id?: string; }',
    markdown:
      "## create\n\n`client.public.tasks.create(external_id?: string, title?: string, description?: string, status?: string, usage_status?: string, project_id?: string, start_date?: string, due_date?: string, main_task_id?: string, owner_id?: string, assignees?: string[], projects?: string[]): { ok: boolean; status: string; external_id?: string; task_id?: string; ctx_id?: string; }`\n\n**post** `/v1/public/tasks`\n\nCreate Task\n\n### Parameters\n\n- `external_id?: string`\n\n- `title?: string`\n\n- `description?: string`\n\n- `status?: string`\n\n- `usage_status?: string`\n\n- `project_id?: string`\n\n- `start_date?: string`\n\n- `due_date?: string`\n\n- `main_task_id?: string`\n\n- `owner_id?: string`\n\n- `assignees?: string[]`\n\n- `projects?: string[]`\n\n### Returns\n\n- `{ ok: boolean; status: string; external_id?: string; task_id?: string; ctx_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `external_id?: string`\n  - `task_id?: string`\n  - `ctx_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst taskResponse = await client.public.tasks.create({ title: 'Follow up with Acme' });\n\nconsole.log(taskResponse);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/tasks/{task_id}',
    httpMethod: 'get',
    summary: 'Get Task',
    description: 'Get Task',
    stainlessPath: '(resource) public.tasks > (method) retrieve',
    qualified: 'client.public.tasks.retrieve',
    params: [
      'task_id: string;',
      'workspace_id?: string;',
      'external_id?: string;',
      "'Accept-Language'?: string;",
    ],
    response:
      '{ id?: string; task_id?: number; external_id?: string; title?: string; description?: string; status?: string; status_label?: string; usage_status?: string; project_id?: string; project_title?: string; main_task_id?: string; owner_id?: string; start_date?: string; due_date?: string; created_at?: string; updated_at?: string; }',
    markdown:
      "## retrieve\n\n`client.public.tasks.retrieve(task_id: string, workspace_id?: string, external_id?: string, 'Accept-Language'?: string): { id?: string; task_id?: number; external_id?: string; title?: string; description?: string; status?: string; status_label?: string; usage_status?: string; project_id?: string; project_title?: string; main_task_id?: string; owner_id?: string; start_date?: string; due_date?: string; created_at?: string; updated_at?: string; }`\n\n**get** `/v1/public/tasks/{task_id}`\n\nGet Task\n\n### Parameters\n\n- `task_id: string`\n\n- `workspace_id?: string`\n\n- `external_id?: string`\n\n- `'Accept-Language'?: string`\n\n### Returns\n\n- `{ id?: string; task_id?: number; external_id?: string; title?: string; description?: string; status?: string; status_label?: string; usage_status?: string; project_id?: string; project_title?: string; main_task_id?: string; owner_id?: string; start_date?: string; due_date?: string; created_at?: string; updated_at?: string; }`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst task = await client.public.tasks.retrieve('task_id');\n\nconsole.log(task);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/tasks/{task_id}',
    httpMethod: 'put',
    summary: 'Update Task',
    description: 'Update Task',
    stainlessPath: '(resource) public.tasks > (method) update',
    qualified: 'client.public.tasks.update',
    params: [
      'task_id: string;',
      'external_id?: string;',
      'body_external_id?: string;',
      'title?: string;',
      'description?: string;',
      'status?: string;',
      'usage_status?: string;',
      'project_id?: string;',
      'start_date?: string;',
      'due_date?: string;',
      'main_task_id?: string;',
      'owner_id?: string;',
      'assignees?: string[];',
      'projects?: string[];',
    ],
    response: '{ ok: boolean; status: string; external_id?: string; task_id?: string; ctx_id?: string; }',
    markdown:
      "## update\n\n`client.public.tasks.update(task_id: string, external_id?: string, body_external_id?: string, title?: string, description?: string, status?: string, usage_status?: string, project_id?: string, start_date?: string, due_date?: string, main_task_id?: string, owner_id?: string, assignees?: string[], projects?: string[]): { ok: boolean; status: string; external_id?: string; task_id?: string; ctx_id?: string; }`\n\n**put** `/v1/public/tasks/{task_id}`\n\nUpdate Task\n\n### Parameters\n\n- `task_id: string`\n\n- `external_id?: string`\n\n- `body_external_id?: string`\n\n- `title?: string`\n\n- `description?: string`\n\n- `status?: string`\n\n- `usage_status?: string`\n\n- `project_id?: string`\n\n- `start_date?: string`\n\n- `due_date?: string`\n\n- `main_task_id?: string`\n\n- `owner_id?: string`\n\n- `assignees?: string[]`\n\n- `projects?: string[]`\n\n### Returns\n\n- `{ ok: boolean; status: string; external_id?: string; task_id?: string; ctx_id?: string; }`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst taskResponse = await client.public.tasks.update('task_id', { description: 'Add latest customer note' });\n\nconsole.log(taskResponse);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/tasks',
    httpMethod: 'get',
    summary: 'List Tasks',
    description: 'List Tasks',
    stainlessPath: '(resource) public.tasks > (method) list',
    qualified: 'client.public.tasks.list',
    params: [
      'search?: string;',
      'usage_status?: string;',
      'project_id?: string;',
      'page?: number;',
      'limit?: number;',
      'lang?: string;',
      'language?: string;',
      'workspace_id?: string;',
      "'Accept-Language'?: string;",
    ],
    response:
      '{ data: { id?: string; task_id?: number; external_id?: string; title?: string; description?: string; status?: string; status_label?: string; usage_status?: string; project_id?: string; project_title?: string; main_task_id?: string; owner_id?: string; start_date?: string; due_date?: string; created_at?: string; updated_at?: string; }[]; page: number; count: number; total: number; has_next: boolean; message: string; ctx_id?: string; }',
    markdown:
      "## list\n\n`client.public.tasks.list(search?: string, usage_status?: string, project_id?: string, page?: number, limit?: number, lang?: string, language?: string, workspace_id?: string, 'Accept-Language'?: string): { data: object[]; page: number; count: number; total: number; has_next: boolean; message: string; ctx_id?: string; }`\n\n**get** `/v1/public/tasks`\n\nList Tasks\n\n### Parameters\n\n- `search?: string`\n\n- `usage_status?: string`\n\n- `project_id?: string`\n\n- `page?: number`\n\n- `limit?: number`\n\n- `lang?: string`\n\n- `language?: string`\n\n- `workspace_id?: string`\n\n- `'Accept-Language'?: string`\n\n### Returns\n\n- `{ data: { id?: string; task_id?: number; external_id?: string; title?: string; description?: string; status?: string; status_label?: string; usage_status?: string; project_id?: string; project_title?: string; main_task_id?: string; owner_id?: string; start_date?: string; due_date?: string; created_at?: string; updated_at?: string; }[]; page: number; count: number; total: number; has_next: boolean; message: string; ctx_id?: string; }`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst tasks = await client.public.tasks.list({ search: 'Acme' });\n\nconsole.log(tasks);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/tasks/{task_id}',
    httpMethod: 'delete',
    summary: 'Delete Task',
    description: 'Delete Task',
    stainlessPath: '(resource) public.tasks > (method) delete',
    qualified: 'client.public.tasks.delete',
    params: ['task_id: string;', 'external_id?: string;'],
    response: '{ ok: boolean; status: string; external_id?: string; task_id?: string; ctx_id?: string; }',
    markdown:
      "## delete\n\n`client.public.tasks.delete(task_id: string, external_id?: string): { ok: boolean; status: string; external_id?: string; task_id?: string; ctx_id?: string; }`\n\n**delete** `/v1/public/tasks/{task_id}`\n\nDelete Task\n\n### Parameters\n\n- `task_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; external_id?: string; task_id?: string; ctx_id?: string; }`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst taskResponse = await client.public.tasks.delete('task_id');\n\nconsole.log(taskResponse);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/items',
    httpMethod: 'post',
    summary: 'Create Item',
    description: 'Create Item',
    stainlessPath: '(resource) public.items > (method) create',
    qualified: 'client.public.items.create',
    params: [
      'externalId: string;',
      'currency?: string;',
      'description?: string;',
      'name?: string;',
      'price?: number;',
      'purchasePrice?: number;',
      'status?: string;',
      'tax?: number;',
    ],
    response: '{ external_id: string; ok: boolean; status: string; ctx_id?: string; item_id?: string; }',
    markdown:
      "## create\n\n`client.public.items.create(externalId: string, currency?: string, description?: string, name?: string, price?: number, purchasePrice?: number, status?: string, tax?: number): { external_id: string; ok: boolean; status: string; ctx_id?: string; item_id?: string; }`\n\n**post** `/v1/public/items`\n\nCreate Item\n\n### Parameters\n\n- `externalId: string`\n\n- `currency?: string`\n\n- `description?: string`\n\n- `name?: string`\n\n- `price?: number`\n\n- `purchasePrice?: number`\n\n- `status?: string`\n\n- `tax?: number`\n\n### Returns\n\n- `{ external_id: string; ok: boolean; status: string; ctx_id?: string; item_id?: string; }`\n\n  - `external_id: string`\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `item_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst itemResponse = await client.public.items.create({ externalId: 'externalId' });\n\nconsole.log(itemResponse);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/items/{item_id}',
    httpMethod: 'get',
    summary: 'Get Item',
    description: 'Get Item',
    stainlessPath: '(resource) public.items > (method) retrieve',
    qualified: 'client.public.items.retrieve',
    params: ['item_id: string;', 'external_id?: string;'],
    response:
      '{ created_at: string; updated_at: string; id?: string; company_id?: string; contact_id?: string; currency?: string; item_id?: number; name?: string; price?: number; status?: string; }',
    markdown:
      "## retrieve\n\n`client.public.items.retrieve(item_id: string, external_id?: string): { created_at: string; updated_at: string; id?: string; company_id?: string; contact_id?: string; currency?: string; item_id?: number; name?: string; price?: number; status?: string; }`\n\n**get** `/v1/public/items/{item_id}`\n\nGet Item\n\n### Parameters\n\n- `item_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; id?: string; company_id?: string; contact_id?: string; currency?: string; item_id?: number; name?: string; price?: number; status?: string; }`\n\n  - `created_at: string`\n  - `updated_at: string`\n  - `id?: string`\n  - `company_id?: string`\n  - `contact_id?: string`\n  - `currency?: string`\n  - `item_id?: number`\n  - `name?: string`\n  - `price?: number`\n  - `status?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst shopTurboItem = await client.public.items.retrieve('item_id');\n\nconsole.log(shopTurboItem);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/items/{item_id}',
    httpMethod: 'put',
    summary: 'Update Item',
    description: 'Update Item',
    stainlessPath: '(resource) public.items > (method) update',
    qualified: 'client.public.items.update',
    params: [
      'item_id: string;',
      'externalId: string;',
      'currency?: string;',
      'description?: string;',
      'name?: string;',
      'price?: number;',
      'purchasePrice?: number;',
      'status?: string;',
      'tax?: number;',
    ],
    response: '{ external_id: string; ok: boolean; status: string; ctx_id?: string; item_id?: string; }',
    markdown:
      "## update\n\n`client.public.items.update(item_id: string, externalId: string, currency?: string, description?: string, name?: string, price?: number, purchasePrice?: number, status?: string, tax?: number): { external_id: string; ok: boolean; status: string; ctx_id?: string; item_id?: string; }`\n\n**put** `/v1/public/items/{item_id}`\n\nUpdate Item\n\n### Parameters\n\n- `item_id: string`\n\n- `externalId: string`\n\n- `currency?: string`\n\n- `description?: string`\n\n- `name?: string`\n\n- `price?: number`\n\n- `purchasePrice?: number`\n\n- `status?: string`\n\n- `tax?: number`\n\n### Returns\n\n- `{ external_id: string; ok: boolean; status: string; ctx_id?: string; item_id?: string; }`\n\n  - `external_id: string`\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `item_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst itemResponse = await client.public.items.update('item_id', { externalId: 'externalId' });\n\nconsole.log(itemResponse);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/items',
    httpMethod: 'get',
    summary: 'List Items',
    description: 'List Items',
    stainlessPath: '(resource) public.items > (method) list',
    qualified: 'client.public.items.list',
    params: ['lang?: string;', 'language?: string;', 'workspace_id?: string;', 'Accept-Language?: string;'],
    response:
      '{ created_at: string; updated_at: string; id?: string; company_id?: string; contact_id?: string; currency?: string; item_id?: number; name?: string; price?: number; status?: string; }[]',
    markdown:
      "## list\n\n`client.public.items.list(lang?: string, language?: string, workspace_id?: string, Accept-Language?: string): object[]`\n\n**get** `/v1/public/items`\n\nList Items\n\n### Parameters\n\n- `lang?: string`\n\n- `language?: string`\n\n- `workspace_id?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; id?: string; company_id?: string; contact_id?: string; currency?: string; item_id?: number; name?: string; price?: number; status?: string; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst shopTurboItems = await client.public.items.list();\n\nconsole.log(shopTurboItems);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/items/{item_id}',
    httpMethod: 'delete',
    summary: 'Delete Item',
    description: 'Delete Item',
    stainlessPath: '(resource) public.items > (method) delete',
    qualified: 'client.public.items.delete',
    params: ['item_id: string;', 'external_id?: string;'],
    response: '{ external_id: string; ok: boolean; status: string; ctx_id?: string; item_id?: string; }',
    markdown:
      "## delete\n\n`client.public.items.delete(item_id: string, external_id?: string): { external_id: string; ok: boolean; status: string; ctx_id?: string; item_id?: string; }`\n\n**delete** `/v1/public/items/{item_id}`\n\nDelete Item\n\n### Parameters\n\n- `item_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ external_id: string; ok: boolean; status: string; ctx_id?: string; item_id?: string; }`\n\n  - `external_id: string`\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `item_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst itemResponse = await client.public.items.delete('item_id');\n\nconsole.log(itemResponse);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/contacts',
    httpMethod: 'post',
    summary: 'Create Contact',
    description: 'Create Contact',
    stainlessPath: '(resource) public.contacts > (method) create',
    qualified: 'client.public.contacts.create',
    params: [
      'allowed_in_store?: boolean;',
      'company?: string;',
      'email?: string;',
      'external_id?: string;',
      'last_name?: string;',
      'name?: string;',
      'phone_number?: string;',
      'status?: string;',
    ],
    response: '{ ok: boolean; status: string; contact_id?: string; ctx_id?: string; external_id?: string; }',
    markdown:
      "## create\n\n`client.public.contacts.create(allowed_in_store?: boolean, company?: string, email?: string, external_id?: string, last_name?: string, name?: string, phone_number?: string, status?: string): { ok: boolean; status: string; contact_id?: string; ctx_id?: string; external_id?: string; }`\n\n**post** `/v1/public/contacts`\n\nCreate Contact\n\n### Parameters\n\n- `allowed_in_store?: boolean`\n\n- `company?: string`\n\n- `email?: string`\n\n- `external_id?: string`\n\n- `last_name?: string`\n\n- `name?: string`\n\n- `phone_number?: string`\n\n- `status?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; contact_id?: string; ctx_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `contact_id?: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicContactResponse = await client.public.contacts.create();\n\nconsole.log(publicContactResponse);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/contacts/{contact_id}',
    httpMethod: 'get',
    summary: 'Get Contact',
    description: 'Get Contact',
    stainlessPath: '(resource) public.contacts > (method) retrieve',
    qualified: 'client.public.contacts.retrieve',
    params: ['contact_id: string;', 'external_id?: string;'],
    response:
      '{ created_at: string; updated_at: string; id?: string; allowed_in_store?: boolean; contact_id?: number; email?: string; name?: string; phone_number?: string; }',
    markdown:
      "## retrieve\n\n`client.public.contacts.retrieve(contact_id: string, external_id?: string): { created_at: string; updated_at: string; id?: string; allowed_in_store?: boolean; contact_id?: number; email?: string; name?: string; phone_number?: string; }`\n\n**get** `/v1/public/contacts/{contact_id}`\n\nGet Contact\n\n### Parameters\n\n- `contact_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; id?: string; allowed_in_store?: boolean; contact_id?: number; email?: string; name?: string; phone_number?: string; }`\n\n  - `created_at: string`\n  - `updated_at: string`\n  - `id?: string`\n  - `allowed_in_store?: boolean`\n  - `contact_id?: number`\n  - `email?: string`\n  - `name?: string`\n  - `phone_number?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst contact = await client.public.contacts.retrieve('contact_id');\n\nconsole.log(contact);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/contacts/{contact_id}',
    httpMethod: 'put',
    summary: 'Update Contact',
    description: 'Update Contact',
    stainlessPath: '(resource) public.contacts > (method) update',
    qualified: 'client.public.contacts.update',
    params: [
      'contact_id: string;',
      'allowed_in_store?: boolean;',
      'company?: string;',
      'email?: string;',
      'external_id?: string;',
      'last_name?: string;',
      'name?: string;',
      'phone_number?: string;',
      'status?: string;',
    ],
    response: '{ ok: boolean; status: string; contact_id?: string; ctx_id?: string; external_id?: string; }',
    markdown:
      "## update\n\n`client.public.contacts.update(contact_id: string, allowed_in_store?: boolean, company?: string, email?: string, external_id?: string, last_name?: string, name?: string, phone_number?: string, status?: string): { ok: boolean; status: string; contact_id?: string; ctx_id?: string; external_id?: string; }`\n\n**put** `/v1/public/contacts/{contact_id}`\n\nUpdate Contact\n\n### Parameters\n\n- `contact_id: string`\n\n- `allowed_in_store?: boolean`\n\n- `company?: string`\n\n- `email?: string`\n\n- `external_id?: string`\n\n- `last_name?: string`\n\n- `name?: string`\n\n- `phone_number?: string`\n\n- `status?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; contact_id?: string; ctx_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `contact_id?: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicContactResponse = await client.public.contacts.update('contact_id');\n\nconsole.log(publicContactResponse);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/contacts',
    httpMethod: 'get',
    summary: 'List Contacts',
    description: 'List Contacts',
    stainlessPath: '(resource) public.contacts > (method) list',
    qualified: 'client.public.contacts.list',
    params: [
      'limit?: number;',
      'page?: number;',
      'reference_id?: string;',
      'search?: string;',
      'sort?: string;',
      'view?: string;',
      'Accept-Language?: string;',
    ],
    response:
      '{ count: number; data: object[]; message: string; page: number; total: number; ctx_id?: string; permission?: string; }',
    markdown:
      "## list\n\n`client.public.contacts.list(limit?: number, page?: number, reference_id?: string, search?: string, sort?: string, view?: string, Accept-Language?: string): { count: number; data: object[]; message: string; page: number; total: number; ctx_id?: string; permission?: string; }`\n\n**get** `/v1/public/contacts`\n\nList Contacts\n\n### Parameters\n\n- `limit?: number`\n\n- `page?: number`\n\n- `reference_id?: string`\n\n- `search?: string`\n\n- `sort?: string`\n\n- `view?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ count: number; data: object[]; message: string; page: number; total: number; ctx_id?: string; permission?: string; }`\n\n  - `count: number`\n  - `data: object[]`\n  - `message: string`\n  - `page: number`\n  - `total: number`\n  - `ctx_id?: string`\n  - `permission?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst contacts = await client.public.contacts.list();\n\nconsole.log(contacts);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/contacts/{contact_id}',
    httpMethod: 'delete',
    summary: 'Delete Contact',
    description: 'Delete Contact',
    stainlessPath: '(resource) public.contacts > (method) delete',
    qualified: 'client.public.contacts.delete',
    params: ['contact_id: string;', 'external_id?: string;'],
    response: '{ ok: boolean; status: string; contact_id?: string; ctx_id?: string; external_id?: string; }',
    markdown:
      "## delete\n\n`client.public.contacts.delete(contact_id: string, external_id?: string): { ok: boolean; status: string; contact_id?: string; ctx_id?: string; external_id?: string; }`\n\n**delete** `/v1/public/contacts/{contact_id}`\n\nDelete Contact\n\n### Parameters\n\n- `contact_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; contact_id?: string; ctx_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `contact_id?: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicContactResponse = await client.public.contacts.delete('contact_id');\n\nconsole.log(publicContactResponse);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/companies',
    httpMethod: 'post',
    summary: 'Create Company',
    description: 'Create Company',
    stainlessPath: '(resource) public.companies > (method) create',
    qualified: 'client.public.companies.create',
    params: [
      'address?: string;',
      'allowed_in_store?: boolean;',
      'email?: string;',
      'external_id?: string;',
      'name?: string;',
      'phone_number?: string;',
      'status?: string;',
      'url?: string;',
    ],
    response: '{ ok: boolean; status: string; company_id?: string; ctx_id?: string; external_id?: string; }',
    markdown:
      "## create\n\n`client.public.companies.create(address?: string, allowed_in_store?: boolean, email?: string, external_id?: string, name?: string, phone_number?: string, status?: string, url?: string): { ok: boolean; status: string; company_id?: string; ctx_id?: string; external_id?: string; }`\n\n**post** `/v1/public/companies`\n\nCreate Company\n\n### Parameters\n\n- `address?: string`\n\n- `allowed_in_store?: boolean`\n\n- `email?: string`\n\n- `external_id?: string`\n\n- `name?: string`\n\n- `phone_number?: string`\n\n- `status?: string`\n\n- `url?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; company_id?: string; ctx_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `company_id?: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicCompanyResponse = await client.public.companies.create();\n\nconsole.log(publicCompanyResponse);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/companies/{company_id}',
    httpMethod: 'get',
    summary: 'Get Company',
    description: 'Get Company',
    stainlessPath: '(resource) public.companies > (method) retrieve',
    qualified: 'client.public.companies.retrieve',
    params: ['company_id: string;', 'external_id?: string;'],
    response:
      '{ created_at: string; updated_at: string; id?: string; address?: string; allowed_in_store?: boolean; company_id?: number; email?: string; name?: string; phone_number?: string; url?: string; }',
    markdown:
      "## retrieve\n\n`client.public.companies.retrieve(company_id: string, external_id?: string): { created_at: string; updated_at: string; id?: string; address?: string; allowed_in_store?: boolean; company_id?: number; email?: string; name?: string; phone_number?: string; url?: string; }`\n\n**get** `/v1/public/companies/{company_id}`\n\nGet Company\n\n### Parameters\n\n- `company_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; id?: string; address?: string; allowed_in_store?: boolean; company_id?: number; email?: string; name?: string; phone_number?: string; url?: string; }`\n\n  - `created_at: string`\n  - `updated_at: string`\n  - `id?: string`\n  - `address?: string`\n  - `allowed_in_store?: boolean`\n  - `company_id?: number`\n  - `email?: string`\n  - `name?: string`\n  - `phone_number?: string`\n  - `url?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst company = await client.public.companies.retrieve('company_id');\n\nconsole.log(company);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/companies/{company_id}',
    httpMethod: 'put',
    summary: 'Update Company',
    description: 'Update Company',
    stainlessPath: '(resource) public.companies > (method) update',
    qualified: 'client.public.companies.update',
    params: [
      'company_id: string;',
      'address?: string;',
      'allowed_in_store?: boolean;',
      'email?: string;',
      'external_id?: string;',
      'name?: string;',
      'phone_number?: string;',
      'status?: string;',
      'url?: string;',
    ],
    response: '{ ok: boolean; status: string; company_id?: string; ctx_id?: string; external_id?: string; }',
    markdown:
      "## update\n\n`client.public.companies.update(company_id: string, address?: string, allowed_in_store?: boolean, email?: string, external_id?: string, name?: string, phone_number?: string, status?: string, url?: string): { ok: boolean; status: string; company_id?: string; ctx_id?: string; external_id?: string; }`\n\n**put** `/v1/public/companies/{company_id}`\n\nUpdate Company\n\n### Parameters\n\n- `company_id: string`\n\n- `address?: string`\n\n- `allowed_in_store?: boolean`\n\n- `email?: string`\n\n- `external_id?: string`\n\n- `name?: string`\n\n- `phone_number?: string`\n\n- `status?: string`\n\n- `url?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; company_id?: string; ctx_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `company_id?: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicCompanyResponse = await client.public.companies.update('company_id');\n\nconsole.log(publicCompanyResponse);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/companies',
    httpMethod: 'get',
    summary: 'List Companies',
    description: 'List Companies',
    stainlessPath: '(resource) public.companies > (method) list',
    qualified: 'client.public.companies.list',
    params: [
      'limit?: number;',
      'page?: number;',
      'reference_id?: string;',
      'search?: string;',
      'sort?: string;',
      'view?: string;',
      'Accept-Language?: string;',
    ],
    response:
      '{ count: number; data: object[]; message: string; page: number; total: number; ctx_id?: string; permission?: string; }',
    markdown:
      "## list\n\n`client.public.companies.list(limit?: number, page?: number, reference_id?: string, search?: string, sort?: string, view?: string, Accept-Language?: string): { count: number; data: object[]; message: string; page: number; total: number; ctx_id?: string; permission?: string; }`\n\n**get** `/v1/public/companies`\n\nList Companies\n\n### Parameters\n\n- `limit?: number`\n\n- `page?: number`\n\n- `reference_id?: string`\n\n- `search?: string`\n\n- `sort?: string`\n\n- `view?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ count: number; data: object[]; message: string; page: number; total: number; ctx_id?: string; permission?: string; }`\n\n  - `count: number`\n  - `data: object[]`\n  - `message: string`\n  - `page: number`\n  - `total: number`\n  - `ctx_id?: string`\n  - `permission?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst companies = await client.public.companies.list();\n\nconsole.log(companies);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/companies/{company_id}',
    httpMethod: 'delete',
    summary: 'Delete Company',
    description: 'Delete Company',
    stainlessPath: '(resource) public.companies > (method) delete',
    qualified: 'client.public.companies.delete',
    params: ['company_id: string;', 'external_id?: string;'],
    response: '{ ok: boolean; status: string; company_id?: string; ctx_id?: string; external_id?: string; }',
    markdown:
      "## delete\n\n`client.public.companies.delete(company_id: string, external_id?: string): { ok: boolean; status: string; company_id?: string; ctx_id?: string; external_id?: string; }`\n\n**delete** `/v1/public/companies/{company_id}`\n\nDelete Company\n\n### Parameters\n\n- `company_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; company_id?: string; ctx_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `company_id?: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicCompanyResponse = await client.public.companies.delete('company_id');\n\nconsole.log(publicCompanyResponse);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/deals',
    httpMethod: 'post',
    summary: 'Create Deal',
    description: 'Create Deal',
    stainlessPath: '(resource) public.deals > (method) create',
    qualified: 'client.public.deals.create',
    params: [
      'caseStatus?: string;',
      'companyExternalId?: string;',
      'companyId?: string;',
      'contactExternalId?: string;',
      'contactId?: string;',
      'currency?: string;',
      'externalId?: string;',
      'name?: string;',
      'status?: string;',
    ],
    response: '{ ok: boolean; status: string; case_id?: string; ctx_id?: string; external_id?: string; }',
    markdown:
      "## create\n\n`client.public.deals.create(caseStatus?: string, companyExternalId?: string, companyId?: string, contactExternalId?: string, contactId?: string, currency?: string, externalId?: string, name?: string, status?: string): { ok: boolean; status: string; case_id?: string; ctx_id?: string; external_id?: string; }`\n\n**post** `/v1/public/deals`\n\nCreate Deal\n\n### Parameters\n\n- `caseStatus?: string`\n\n- `companyExternalId?: string`\n\n- `companyId?: string`\n\n- `contactExternalId?: string`\n\n- `contactId?: string`\n\n- `currency?: string`\n\n- `externalId?: string`\n\n- `name?: string`\n\n- `status?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; case_id?: string; ctx_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `case_id?: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicCaseResponse = await client.public.deals.create();\n\nconsole.log(publicCaseResponse);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/deals/{case_id}',
    httpMethod: 'get',
    summary: 'Get Deal',
    description: 'Get Deal',
    stainlessPath: '(resource) public.deals > (method) retrieve',
    qualified: 'client.public.deals.retrieve',
    params: [
      'case_id: string;',
      'external_id?: string;',
      'lang?: string;',
      'language?: string;',
      'Accept-Language?: string;',
    ],
    response:
      '{ created_at: string; updated_at: string; id?: string; case_status?: string; currency?: string; deal_id?: number; name?: string; pipeline_name?: string; pipeline_order?: number; stage_key?: string; stage_label?: string; stage_position?: number; stage_score?: number; status?: string; }',
    markdown:
      "## retrieve\n\n`client.public.deals.retrieve(case_id: string, external_id?: string, lang?: string, language?: string, Accept-Language?: string): { created_at: string; updated_at: string; id?: string; case_status?: string; currency?: string; deal_id?: number; name?: string; pipeline_name?: string; pipeline_order?: number; stage_key?: string; stage_label?: string; stage_position?: number; stage_score?: number; status?: string; }`\n\n**get** `/v1/public/deals/{case_id}`\n\nGet Deal\n\n### Parameters\n\n- `case_id: string`\n\n- `external_id?: string`\n\n- `lang?: string`\n\n- `language?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; id?: string; case_status?: string; currency?: string; deal_id?: number; name?: string; pipeline_name?: string; pipeline_order?: number; stage_key?: string; stage_label?: string; stage_position?: number; stage_score?: number; status?: string; }`\n\n  - `created_at: string`\n  - `updated_at: string`\n  - `id?: string`\n  - `case_status?: string`\n  - `currency?: string`\n  - `deal_id?: number`\n  - `name?: string`\n  - `pipeline_name?: string`\n  - `pipeline_order?: number`\n  - `stage_key?: string`\n  - `stage_label?: string`\n  - `stage_position?: number`\n  - `stage_score?: number`\n  - `status?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst _case = await client.public.deals.retrieve('case_id');\n\nconsole.log(_case);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/deals/{case_id}',
    httpMethod: 'put',
    summary: 'Update Deal',
    description: 'Update Deal',
    stainlessPath: '(resource) public.deals > (method) update',
    qualified: 'client.public.deals.update',
    params: [
      'case_id: string;',
      'external_id?: string;',
      'caseStatus?: string;',
      'companyExternalId?: string;',
      'companyId?: string;',
      'contactExternalId?: string;',
      'contactId?: string;',
      'currency?: string;',
      'externalId?: string;',
      'name?: string;',
      'status?: string;',
    ],
    response: '{ ok: boolean; status: string; case_id?: string; ctx_id?: string; external_id?: string; }',
    markdown:
      "## update\n\n`client.public.deals.update(case_id: string, external_id?: string, caseStatus?: string, companyExternalId?: string, companyId?: string, contactExternalId?: string, contactId?: string, currency?: string, externalId?: string, name?: string, status?: string): { ok: boolean; status: string; case_id?: string; ctx_id?: string; external_id?: string; }`\n\n**put** `/v1/public/deals/{case_id}`\n\nUpdate Deal\n\n### Parameters\n\n- `case_id: string`\n\n- `external_id?: string`\n\n- `caseStatus?: string`\n\n- `companyExternalId?: string`\n\n- `companyId?: string`\n\n- `contactExternalId?: string`\n\n- `contactId?: string`\n\n- `currency?: string`\n\n- `externalId?: string`\n\n- `name?: string`\n\n- `status?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; case_id?: string; ctx_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `case_id?: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicCaseResponse = await client.public.deals.update('case_id');\n\nconsole.log(publicCaseResponse);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/deals',
    httpMethod: 'get',
    summary: 'List Deals',
    description: 'List Deals',
    stainlessPath: '(resource) public.deals > (method) list',
    qualified: 'client.public.deals.list',
    params: ['lang?: string;', 'language?: string;', 'workspace_id?: string;', 'Accept-Language?: string;'],
    response:
      '{ created_at: string; updated_at: string; id?: string; case_status?: string; currency?: string; deal_id?: number; name?: string; pipeline_name?: string; pipeline_order?: number; stage_key?: string; stage_label?: string; stage_position?: number; stage_score?: number; status?: string; }[]',
    markdown:
      "## list\n\n`client.public.deals.list(lang?: string, language?: string, workspace_id?: string, Accept-Language?: string): object[]`\n\n**get** `/v1/public/deals`\n\nList Deals\n\n### Parameters\n\n- `lang?: string`\n\n- `language?: string`\n\n- `workspace_id?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; id?: string; case_status?: string; currency?: string; deal_id?: number; name?: string; pipeline_name?: string; pipeline_order?: number; stage_key?: string; stage_label?: string; stage_position?: number; stage_score?: number; status?: string; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst cases = await client.public.deals.list();\n\nconsole.log(cases);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/deals/{case_id}',
    httpMethod: 'delete',
    summary: 'Delete Deal',
    description: 'Delete Deal',
    stainlessPath: '(resource) public.deals > (method) delete',
    qualified: 'client.public.deals.delete',
    params: ['case_id: string;', 'external_id?: string;'],
    response: '{ ok: boolean; status: string; case_id?: string; ctx_id?: string; external_id?: string; }',
    markdown:
      "## delete\n\n`client.public.deals.delete(case_id: string, external_id?: string): { ok: boolean; status: string; case_id?: string; ctx_id?: string; external_id?: string; }`\n\n**delete** `/v1/public/deals/{case_id}`\n\nDelete Deal\n\n### Parameters\n\n- `case_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; case_id?: string; ctx_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `case_id?: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicCaseResponse = await client.public.deals.delete('case_id');\n\nconsole.log(publicCaseResponse);\n```",
  },
  {
    name: 'list_pipelines',
    endpoint: '/v1/public/deals/pipelines',
    httpMethod: 'get',
    summary: 'List Deal Pipelines',
    description: 'List Deal Pipelines',
    stainlessPath: '(resource) public.deals > (method) list_pipelines',
    qualified: 'client.public.deals.listPipelines',
    params: ['workspace_id?: string;'],
    response:
      '{ id?: string; internal_name?: string; is_default?: boolean; name?: string; order?: number; stages?: { id?: string; internal_value?: string; name?: string; order?: number; score?: number; }[]; }[]',
    markdown:
      "## list_pipelines\n\n`client.public.deals.listPipelines(workspace_id?: string): { id?: string; internal_name?: string; is_default?: boolean; name?: string; order?: number; stages?: object[]; }[]`\n\n**get** `/v1/public/deals/pipelines`\n\nList Deal Pipelines\n\n### Parameters\n\n- `workspace_id?: string`\n\n### Returns\n\n- `{ id?: string; internal_name?: string; is_default?: boolean; name?: string; order?: number; stages?: { id?: string; internal_value?: string; name?: string; order?: number; score?: number; }[]; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst response = await client.public.deals.listPipelines();\n\nconsole.log(response);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/tickets',
    httpMethod: 'post',
    summary: 'Create Ticket',
    description: 'Create Ticket',
    stainlessPath: '(resource) public.tickets > (method) create',
    qualified: 'client.public.tickets.create',
    params: [
      'deal_ids?: string[];',
      'description?: string;',
      'external_id?: string;',
      'first_response_due_at?: string;',
      'owner_id?: string;',
      'priority?: string;',
      'resolution_due_at?: string;',
      'stage_key?: string;',
      'status?: string;',
      'title?: string;',
      'visibility?: string;',
    ],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; ticket_id?: string; }',
    markdown:
      "## create\n\n`client.public.tickets.create(deal_ids?: string[], description?: string, external_id?: string, first_response_due_at?: string, owner_id?: string, priority?: string, resolution_due_at?: string, stage_key?: string, status?: string, title?: string, visibility?: string): { ok: boolean; status: string; ctx_id?: string; external_id?: string; ticket_id?: string; }`\n\n**post** `/v1/public/tickets`\n\nCreate Ticket\n\n### Parameters\n\n- `deal_ids?: string[]`\n\n- `description?: string`\n\n- `external_id?: string`\n\n- `first_response_due_at?: string`\n\n- `owner_id?: string`\n\n- `priority?: string`\n\n- `resolution_due_at?: string`\n\n- `stage_key?: string`\n\n- `status?: string`\n\n- `title?: string`\n\n- `visibility?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; ticket_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `ticket_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst ticketResponse = await client.public.tickets.create();\n\nconsole.log(ticketResponse);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/tickets/{ticket_id}',
    httpMethod: 'get',
    summary: 'Get Ticket',
    description: 'Get Ticket',
    stainlessPath: '(resource) public.tickets > (method) retrieve',
    qualified: 'client.public.tickets.retrieve',
    params: ['ticket_id: string;', 'external_id?: string;', 'workspace_id?: string;'],
    response:
      '{ created_at: string; updated_at: string; id?: string; deal_ids?: string[]; description?: string; first_response_due_at?: string; owner?: object; owner_id?: string; pipeline_id?: string; pipeline_name?: string; pipeline_order?: number; priority?: string; record_source?: string; record_source_detail?: string; resolution_due_at?: string; resolved_at?: string; responded_at?: string; sla_status?: string; source_channel?: string; stage_key?: string; status?: string; ticket_id?: number; title?: string; visibility?: string; }',
    markdown:
      "## retrieve\n\n`client.public.tickets.retrieve(ticket_id: string, external_id?: string, workspace_id?: string): { created_at: string; updated_at: string; id?: string; deal_ids?: string[]; description?: string; first_response_due_at?: string; owner?: object; owner_id?: string; pipeline_id?: string; pipeline_name?: string; pipeline_order?: number; priority?: string; record_source?: string; record_source_detail?: string; resolution_due_at?: string; resolved_at?: string; responded_at?: string; sla_status?: string; source_channel?: string; stage_key?: string; status?: string; ticket_id?: number; title?: string; visibility?: string; }`\n\n**get** `/v1/public/tickets/{ticket_id}`\n\nGet Ticket\n\n### Parameters\n\n- `ticket_id: string`\n\n- `external_id?: string`\n\n- `workspace_id?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; id?: string; deal_ids?: string[]; description?: string; first_response_due_at?: string; owner?: object; owner_id?: string; pipeline_id?: string; pipeline_name?: string; pipeline_order?: number; priority?: string; record_source?: string; record_source_detail?: string; resolution_due_at?: string; resolved_at?: string; responded_at?: string; sla_status?: string; source_channel?: string; stage_key?: string; status?: string; ticket_id?: number; title?: string; visibility?: string; }`\n\n  - `created_at: string`\n  - `updated_at: string`\n  - `id?: string`\n  - `deal_ids?: string[]`\n  - `description?: string`\n  - `first_response_due_at?: string`\n  - `owner?: object`\n  - `owner_id?: string`\n  - `pipeline_id?: string`\n  - `pipeline_name?: string`\n  - `pipeline_order?: number`\n  - `priority?: string`\n  - `record_source?: string`\n  - `record_source_detail?: string`\n  - `resolution_due_at?: string`\n  - `resolved_at?: string`\n  - `responded_at?: string`\n  - `sla_status?: string`\n  - `source_channel?: string`\n  - `stage_key?: string`\n  - `status?: string`\n  - `ticket_id?: number`\n  - `title?: string`\n  - `visibility?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst ticket = await client.public.tickets.retrieve('ticket_id');\n\nconsole.log(ticket);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/tickets/{ticket_id}',
    httpMethod: 'put',
    summary: 'Update Ticket',
    description: 'Update Ticket',
    stainlessPath: '(resource) public.tickets > (method) update',
    qualified: 'client.public.tickets.update',
    params: [
      'ticket_id: string;',
      'external_id?: string;',
      'deal_ids?: string[];',
      'description?: string;',
      'external_id?: string;',
      'first_response_due_at?: string;',
      'owner_id?: string;',
      'priority?: string;',
      'resolution_due_at?: string;',
      'stage_key?: string;',
      'status?: string;',
      'title?: string;',
      'visibility?: string;',
    ],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; ticket_id?: string; }',
    markdown:
      "## update\n\n`client.public.tickets.update(ticket_id: string, external_id?: string, deal_ids?: string[], description?: string, external_id?: string, first_response_due_at?: string, owner_id?: string, priority?: string, resolution_due_at?: string, stage_key?: string, status?: string, title?: string, visibility?: string): { ok: boolean; status: string; ctx_id?: string; external_id?: string; ticket_id?: string; }`\n\n**put** `/v1/public/tickets/{ticket_id}`\n\nUpdate Ticket\n\n### Parameters\n\n- `ticket_id: string`\n\n- `external_id?: string`\n\n- `deal_ids?: string[]`\n\n- `description?: string`\n\n- `external_id?: string`\n\n- `first_response_due_at?: string`\n\n- `owner_id?: string`\n\n- `priority?: string`\n\n- `resolution_due_at?: string`\n\n- `stage_key?: string`\n\n- `status?: string`\n\n- `title?: string`\n\n- `visibility?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; ticket_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `ticket_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst ticketResponse = await client.public.tickets.update('ticket_id');\n\nconsole.log(ticketResponse);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/tickets',
    httpMethod: 'get',
    summary: 'List Tickets',
    description: 'List Tickets',
    stainlessPath: '(resource) public.tickets > (method) list',
    qualified: 'client.public.tickets.list',
    params: ['workspace_id?: string;'],
    response:
      '{ created_at: string; updated_at: string; id?: string; deal_ids?: string[]; description?: string; first_response_due_at?: string; owner?: object; owner_id?: string; pipeline_id?: string; pipeline_name?: string; pipeline_order?: number; priority?: string; record_source?: string; record_source_detail?: string; resolution_due_at?: string; resolved_at?: string; responded_at?: string; sla_status?: string; source_channel?: string; stage_key?: string; status?: string; ticket_id?: number; title?: string; visibility?: string; }[]',
    markdown:
      "## list\n\n`client.public.tickets.list(workspace_id?: string): object[]`\n\n**get** `/v1/public/tickets`\n\nList Tickets\n\n### Parameters\n\n- `workspace_id?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; id?: string; deal_ids?: string[]; description?: string; first_response_due_at?: string; owner?: object; owner_id?: string; pipeline_id?: string; pipeline_name?: string; pipeline_order?: number; priority?: string; record_source?: string; record_source_detail?: string; resolution_due_at?: string; resolved_at?: string; responded_at?: string; sla_status?: string; source_channel?: string; stage_key?: string; status?: string; ticket_id?: number; title?: string; visibility?: string; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst tickets = await client.public.tickets.list();\n\nconsole.log(tickets);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/tickets/{ticket_id}',
    httpMethod: 'delete',
    summary: 'Delete Ticket',
    description: 'Delete Ticket',
    stainlessPath: '(resource) public.tickets > (method) delete',
    qualified: 'client.public.tickets.delete',
    params: ['ticket_id: string;', 'external_id?: string;'],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; ticket_id?: string; }',
    markdown:
      "## delete\n\n`client.public.tickets.delete(ticket_id: string, external_id?: string): { ok: boolean; status: string; ctx_id?: string; external_id?: string; ticket_id?: string; }`\n\n**delete** `/v1/public/tickets/{ticket_id}`\n\nDelete Ticket\n\n### Parameters\n\n- `ticket_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; ticket_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `ticket_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst ticketResponse = await client.public.tickets.delete('ticket_id');\n\nconsole.log(ticketResponse);\n```",
  },
  {
    name: 'list_pipelines',
    endpoint: '/v1/public/tickets/pipelines',
    httpMethod: 'get',
    summary: 'List Ticket Pipelines',
    description: 'List Ticket Pipelines',
    stainlessPath: '(resource) public.tickets > (method) list_pipelines',
    qualified: 'client.public.tickets.listPipelines',
    params: ['workspace_id?: string;'],
    response:
      '{ internal_name: string; name: string; id?: string; is_default?: boolean; order?: number; stages?: { internal_value: string; name: string; id?: string; is_terminal?: boolean; order?: number; score?: number; }[]; }[]',
    markdown:
      "## list_pipelines\n\n`client.public.tickets.listPipelines(workspace_id?: string): { internal_name: string; name: string; id?: string; is_default?: boolean; order?: number; stages?: object[]; }[]`\n\n**get** `/v1/public/tickets/pipelines`\n\nList Ticket Pipelines\n\n### Parameters\n\n- `workspace_id?: string`\n\n### Returns\n\n- `{ internal_name: string; name: string; id?: string; is_default?: boolean; order?: number; stages?: { internal_value: string; name: string; id?: string; is_terminal?: boolean; order?: number; score?: number; }[]; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst response = await client.public.tickets.listPipelines();\n\nconsole.log(response);\n```",
  },
  {
    name: 'update_status',
    endpoint: '/v1/public/tickets/{ticket_id}/status',
    httpMethod: 'patch',
    summary: 'Update Ticket Status',
    description: 'Update Ticket Status',
    stainlessPath: '(resource) public.tickets > (method) update_status',
    qualified: 'client.public.tickets.updateStatus',
    params: [
      'ticket_id: string;',
      'external_id?: string;',
      'stage_key?: string;',
      'status?: string;',
      'Accept-Language?: string;',
    ],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; ticket_id?: string; }',
    markdown:
      "## update_status\n\n`client.public.tickets.updateStatus(ticket_id: string, external_id?: string, stage_key?: string, status?: string, Accept-Language?: string): { ok: boolean; status: string; ctx_id?: string; external_id?: string; ticket_id?: string; }`\n\n**patch** `/v1/public/tickets/{ticket_id}/status`\n\nUpdate Ticket Status\n\n### Parameters\n\n- `ticket_id: string`\n\n- `external_id?: string`\n\n- `stage_key?: string`\n\n- `status?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; ticket_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `ticket_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst ticketResponse = await client.public.tickets.updateStatus('ticket_id');\n\nconsole.log(ticketResponse);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/subscriptions',
    httpMethod: 'post',
    summary: 'Create Subscription',
    description: 'Create Subscription',
    stainlessPath: '(resource) public.subscriptions > (method) create',
    qualified: 'client.public.subscriptions.create',
    params: [
      'cid: string;',
      'items: { id: string; amount: number; name?: string; price?: number; }[];',
      'subscription_status: string;',
      'currency?: string;',
      'frequency?: number;',
      'frequency_time?: string;',
      'shipping_cost_tax_status?: string;',
      'start_date?: string;',
      'tax?: number;',
      'total_price?: number;',
    ],
    response:
      '{ id: string; contact_info: { id: string; email?: string; name?: string; phone?: string; }[]; created_at: string; items: { id: string; amount: number; name?: string; price?: number; status?: string; }[]; number_item: number; currency?: string; frequency?: number; frequency_time?: string; prior_to_time?: string; shipping_cost_tax_status?: string; start_date?: string; status?: string; subscription_status?: string; tax?: number; total_price?: number; }',
    markdown:
      "## create\n\n`client.public.subscriptions.create(cid: string, items: { id: string; amount: number; name?: string; price?: number; }[], subscription_status: string, currency?: string, frequency?: number, frequency_time?: string, shipping_cost_tax_status?: string, start_date?: string, tax?: number, total_price?: number): { id: string; contact_info: object[]; created_at: string; items: object[]; number_item: number; currency?: string; frequency?: number; frequency_time?: string; prior_to_time?: string; shipping_cost_tax_status?: string; start_date?: string; status?: string; subscription_status?: string; tax?: number; total_price?: number; }`\n\n**post** `/v1/public/subscriptions`\n\nCreate Subscription\n\n### Parameters\n\n- `cid: string`\n\n- `items: { id: string; amount: number; name?: string; price?: number; }[]`\n\n- `subscription_status: string`\n\n- `currency?: string`\n\n- `frequency?: number`\n\n- `frequency_time?: string`\n\n- `shipping_cost_tax_status?: string`\n\n- `start_date?: string`\n\n- `tax?: number`\n\n- `total_price?: number`\n\n### Returns\n\n- `{ id: string; contact_info: { id: string; email?: string; name?: string; phone?: string; }[]; created_at: string; items: { id: string; amount: number; name?: string; price?: number; status?: string; }[]; number_item: number; currency?: string; frequency?: number; frequency_time?: string; prior_to_time?: string; shipping_cost_tax_status?: string; start_date?: string; status?: string; subscription_status?: string; tax?: number; total_price?: number; }`\n\n  - `id: string`\n  - `contact_info: { id: string; email?: string; name?: string; phone?: string; }[]`\n  - `created_at: string`\n  - `items: { id: string; amount: number; name?: string; price?: number; status?: string; }[]`\n  - `number_item: number`\n  - `currency?: string`\n  - `frequency?: number`\n  - `frequency_time?: string`\n  - `prior_to_time?: string`\n  - `shipping_cost_tax_status?: string`\n  - `start_date?: string`\n  - `status?: string`\n  - `subscription_status?: string`\n  - `tax?: number`\n  - `total_price?: number`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst subscriptionDetail = await client.public.subscriptions.create({\n  cid: 'cid',\n  items: [{ id: 'id', amount: 0 }],\n  subscription_status: 'subscription_status',\n});\n\nconsole.log(subscriptionDetail);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/subscriptions/{subscription_id}',
    httpMethod: 'get',
    summary: 'Get Subscription',
    description: 'Get Subscription',
    stainlessPath: '(resource) public.subscriptions > (method) retrieve',
    qualified: 'client.public.subscriptions.retrieve',
    params: ['subscription_id: string;', 'external_id?: string;'],
    response:
      '{ id: string; contact_info: { id: string; email?: string; name?: string; phone?: string; }[]; created_at: string; items: { id: string; amount: number; name?: string; price?: number; status?: string; }[]; number_item: number; currency?: string; frequency?: number; frequency_time?: string; prior_to_time?: string; shipping_cost_tax_status?: string; start_date?: string; status?: string; subscription_status?: string; tax?: number; total_price?: number; }',
    markdown:
      "## retrieve\n\n`client.public.subscriptions.retrieve(subscription_id: string, external_id?: string): { id: string; contact_info: object[]; created_at: string; items: object[]; number_item: number; currency?: string; frequency?: number; frequency_time?: string; prior_to_time?: string; shipping_cost_tax_status?: string; start_date?: string; status?: string; subscription_status?: string; tax?: number; total_price?: number; }`\n\n**get** `/v1/public/subscriptions/{subscription_id}`\n\nGet Subscription\n\n### Parameters\n\n- `subscription_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ id: string; contact_info: { id: string; email?: string; name?: string; phone?: string; }[]; created_at: string; items: { id: string; amount: number; name?: string; price?: number; status?: string; }[]; number_item: number; currency?: string; frequency?: number; frequency_time?: string; prior_to_time?: string; shipping_cost_tax_status?: string; start_date?: string; status?: string; subscription_status?: string; tax?: number; total_price?: number; }`\n\n  - `id: string`\n  - `contact_info: { id: string; email?: string; name?: string; phone?: string; }[]`\n  - `created_at: string`\n  - `items: { id: string; amount: number; name?: string; price?: number; status?: string; }[]`\n  - `number_item: number`\n  - `currency?: string`\n  - `frequency?: number`\n  - `frequency_time?: string`\n  - `prior_to_time?: string`\n  - `shipping_cost_tax_status?: string`\n  - `start_date?: string`\n  - `status?: string`\n  - `subscription_status?: string`\n  - `tax?: number`\n  - `total_price?: number`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst subscriptionDetail = await client.public.subscriptions.retrieve('subscription_id');\n\nconsole.log(subscriptionDetail);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/subscriptions/{subscription_id}',
    httpMethod: 'put',
    summary: 'Update Subscription',
    description: 'Update Subscription',
    stainlessPath: '(resource) public.subscriptions > (method) update',
    qualified: 'client.public.subscriptions.update',
    params: [
      'subscription_id: string;',
      'external_id?: string;',
      'contact?: string;',
      'items?: { id: string; amount: number; name?: string; price?: number; }[];',
      'status?: string;',
    ],
    response:
      '{ id: string; contact_info: { id: string; email?: string; name?: string; phone?: string; }[]; created_at: string; items: { id: string; amount: number; name?: string; price?: number; status?: string; }[]; number_item: number; currency?: string; frequency?: number; frequency_time?: string; prior_to_time?: string; shipping_cost_tax_status?: string; start_date?: string; status?: string; subscription_status?: string; tax?: number; total_price?: number; }',
    markdown:
      "## update\n\n`client.public.subscriptions.update(subscription_id: string, external_id?: string, contact?: string, items?: { id: string; amount: number; name?: string; price?: number; }[], status?: string): { id: string; contact_info: object[]; created_at: string; items: object[]; number_item: number; currency?: string; frequency?: number; frequency_time?: string; prior_to_time?: string; shipping_cost_tax_status?: string; start_date?: string; status?: string; subscription_status?: string; tax?: number; total_price?: number; }`\n\n**put** `/v1/public/subscriptions/{subscription_id}`\n\nUpdate Subscription\n\n### Parameters\n\n- `subscription_id: string`\n\n- `external_id?: string`\n\n- `contact?: string`\n\n- `items?: { id: string; amount: number; name?: string; price?: number; }[]`\n\n- `status?: string`\n\n### Returns\n\n- `{ id: string; contact_info: { id: string; email?: string; name?: string; phone?: string; }[]; created_at: string; items: { id: string; amount: number; name?: string; price?: number; status?: string; }[]; number_item: number; currency?: string; frequency?: number; frequency_time?: string; prior_to_time?: string; shipping_cost_tax_status?: string; start_date?: string; status?: string; subscription_status?: string; tax?: number; total_price?: number; }`\n\n  - `id: string`\n  - `contact_info: { id: string; email?: string; name?: string; phone?: string; }[]`\n  - `created_at: string`\n  - `items: { id: string; amount: number; name?: string; price?: number; status?: string; }[]`\n  - `number_item: number`\n  - `currency?: string`\n  - `frequency?: number`\n  - `frequency_time?: string`\n  - `prior_to_time?: string`\n  - `shipping_cost_tax_status?: string`\n  - `start_date?: string`\n  - `status?: string`\n  - `subscription_status?: string`\n  - `tax?: number`\n  - `total_price?: number`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst subscriptionDetail = await client.public.subscriptions.update('subscription_id');\n\nconsole.log(subscriptionDetail);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/subscriptions',
    httpMethod: 'get',
    summary: 'List Subscriptions',
    description: 'List Subscriptions',
    stainlessPath: '(resource) public.subscriptions > (method) list',
    qualified: 'client.public.subscriptions.list',
    params: ['workspace_id?: string;', 'Accept-Language?: string;'],
    response:
      '{ id: string; contact_info: { id: string; email?: string; name?: string; phone?: string; }[]; created_at: string; items: { id: string; amount: number; name?: string; price?: number; status?: string; }[]; number_item: number; currency?: string; frequency?: number; frequency_time?: string; prior_to_time?: string; shipping_cost_tax_status?: string; start_date?: string; status?: string; subscription_status?: string; tax?: number; total_price?: number; }[]',
    markdown:
      "## list\n\n`client.public.subscriptions.list(workspace_id?: string, Accept-Language?: string): object[]`\n\n**get** `/v1/public/subscriptions`\n\nList Subscriptions\n\n### Parameters\n\n- `workspace_id?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ id: string; contact_info: { id: string; email?: string; name?: string; phone?: string; }[]; created_at: string; items: { id: string; amount: number; name?: string; price?: number; status?: string; }[]; number_item: number; currency?: string; frequency?: number; frequency_time?: string; prior_to_time?: string; shipping_cost_tax_status?: string; start_date?: string; status?: string; subscription_status?: string; tax?: number; total_price?: number; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst subscriptionDetails = await client.public.subscriptions.list();\n\nconsole.log(subscriptionDetails);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/subscriptions/{subscription_id}',
    httpMethod: 'delete',
    summary: 'Delete Subscription',
    description: 'Delete Subscription',
    stainlessPath: '(resource) public.subscriptions > (method) delete',
    qualified: 'client.public.subscriptions.delete',
    params: ['subscription_id: string;', 'external_id?: string;'],
    response:
      '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; subscription_id?: string; }',
    markdown:
      "## delete\n\n`client.public.subscriptions.delete(subscription_id: string, external_id?: string): { ok: boolean; status: string; ctx_id?: string; external_id?: string; subscription_id?: string; }`\n\n**delete** `/v1/public/subscriptions/{subscription_id}`\n\nDelete Subscription\n\n### Parameters\n\n- `subscription_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; subscription_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `subscription_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst subscription = await client.public.subscriptions.delete('subscription_id');\n\nconsole.log(subscription);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/estimates',
    httpMethod: 'post',
    summary: 'Create Estimate',
    description: 'Create Estimate',
    stainlessPath: '(resource) public.estimates > (method) create',
    qualified: 'client.public.estimates.create',
    params: [
      'company_external_id?: string;',
      'company_id?: string;',
      'contact_external_id?: string;',
      'contact_id?: string;',
      'currency?: string;',
      'due_date?: string;',
      'external_id?: string;',
      'notes?: string;',
      'start_date?: string;',
      'status?: string;',
      'tax_inclusive?: boolean;',
      'tax_option?: string;',
      'tax_rate?: number;',
      'total_price?: number;',
      'total_price_without_tax?: number;',
    ],
    response: '{ ok: boolean; status: string; ctx_id?: string; estimate_id?: string; external_id?: string; }',
    markdown:
      "## create\n\n`client.public.estimates.create(company_external_id?: string, company_id?: string, contact_external_id?: string, contact_id?: string, currency?: string, due_date?: string, external_id?: string, notes?: string, start_date?: string, status?: string, tax_inclusive?: boolean, tax_option?: string, tax_rate?: number, total_price?: number, total_price_without_tax?: number): { ok: boolean; status: string; ctx_id?: string; estimate_id?: string; external_id?: string; }`\n\n**post** `/v1/public/estimates`\n\nCreate Estimate\n\n### Parameters\n\n- `company_external_id?: string`\n\n- `company_id?: string`\n\n- `contact_external_id?: string`\n\n- `contact_id?: string`\n\n- `currency?: string`\n\n- `due_date?: string`\n\n- `external_id?: string`\n\n- `notes?: string`\n\n- `start_date?: string`\n\n- `status?: string`\n\n- `tax_inclusive?: boolean`\n\n- `tax_option?: string`\n\n- `tax_rate?: number`\n\n- `total_price?: number`\n\n- `total_price_without_tax?: number`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; estimate_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `estimate_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicEstimateResponse = await client.public.estimates.create();\n\nconsole.log(publicEstimateResponse);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/estimates/{estimate_id}',
    httpMethod: 'get',
    summary: 'Get Estimate',
    description: 'Get Estimate',
    stainlessPath: '(resource) public.estimates > (method) retrieve',
    qualified: 'client.public.estimates.retrieve',
    params: [
      'estimate_id: string;',
      'external_id?: string;',
      'lang?: string;',
      'language?: string;',
      'Accept-Language?: string;',
    ],
    response:
      '{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; due_date?: string; id_est?: number; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }',
    markdown:
      "## retrieve\n\n`client.public.estimates.retrieve(estimate_id: string, external_id?: string, lang?: string, language?: string, Accept-Language?: string): { created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; due_date?: string; id_est?: number; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }`\n\n**get** `/v1/public/estimates/{estimate_id}`\n\nGet Estimate\n\n### Parameters\n\n- `estimate_id: string`\n\n- `external_id?: string`\n\n- `lang?: string`\n\n- `language?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; due_date?: string; id_est?: number; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }`\n\n  - `created_at: string`\n  - `updated_at: string`\n  - `company_name?: string`\n  - `contact_name?: string`\n  - `currency?: string`\n  - `due_date?: string`\n  - `id_est?: number`\n  - `start_date?: string`\n  - `status?: string`\n  - `total_price?: number`\n  - `total_price_without_tax?: number`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst estimate = await client.public.estimates.retrieve('estimate_id');\n\nconsole.log(estimate);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/estimates/{estimate_id}',
    httpMethod: 'put',
    summary: 'Update Estimate',
    description: 'Update Estimate',
    stainlessPath: '(resource) public.estimates > (method) update',
    qualified: 'client.public.estimates.update',
    params: [
      'estimate_id: string;',
      'company_external_id?: string;',
      'company_id?: string;',
      'contact_external_id?: string;',
      'contact_id?: string;',
      'currency?: string;',
      'due_date?: string;',
      'external_id?: string;',
      'notes?: string;',
      'start_date?: string;',
      'status?: string;',
      'tax_inclusive?: boolean;',
      'tax_option?: string;',
      'tax_rate?: number;',
      'total_price?: number;',
      'total_price_without_tax?: number;',
    ],
    response: '{ ok: boolean; status: string; ctx_id?: string; estimate_id?: string; external_id?: string; }',
    markdown:
      "## update\n\n`client.public.estimates.update(estimate_id: string, company_external_id?: string, company_id?: string, contact_external_id?: string, contact_id?: string, currency?: string, due_date?: string, external_id?: string, notes?: string, start_date?: string, status?: string, tax_inclusive?: boolean, tax_option?: string, tax_rate?: number, total_price?: number, total_price_without_tax?: number): { ok: boolean; status: string; ctx_id?: string; estimate_id?: string; external_id?: string; }`\n\n**put** `/v1/public/estimates/{estimate_id}`\n\nUpdate Estimate\n\n### Parameters\n\n- `estimate_id: string`\n\n- `company_external_id?: string`\n\n- `company_id?: string`\n\n- `contact_external_id?: string`\n\n- `contact_id?: string`\n\n- `currency?: string`\n\n- `due_date?: string`\n\n- `external_id?: string`\n\n- `notes?: string`\n\n- `start_date?: string`\n\n- `status?: string`\n\n- `tax_inclusive?: boolean`\n\n- `tax_option?: string`\n\n- `tax_rate?: number`\n\n- `total_price?: number`\n\n- `total_price_without_tax?: number`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; estimate_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `estimate_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicEstimateResponse = await client.public.estimates.update('estimate_id');\n\nconsole.log(publicEstimateResponse);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/estimates',
    httpMethod: 'get',
    summary: 'List Estimates',
    description: 'List Estimates',
    stainlessPath: '(resource) public.estimates > (method) list',
    qualified: 'client.public.estimates.list',
    params: ['lang?: string;', 'language?: string;', 'workspace_id?: string;', 'Accept-Language?: string;'],
    response:
      '{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; due_date?: string; id_est?: number; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }[]',
    markdown:
      "## list\n\n`client.public.estimates.list(lang?: string, language?: string, workspace_id?: string, Accept-Language?: string): object[]`\n\n**get** `/v1/public/estimates`\n\nList Estimates\n\n### Parameters\n\n- `lang?: string`\n\n- `language?: string`\n\n- `workspace_id?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; due_date?: string; id_est?: number; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst estimates = await client.public.estimates.list();\n\nconsole.log(estimates);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/estimates/{estimate_id}',
    httpMethod: 'delete',
    summary: 'Delete Estimate',
    description: 'Delete Estimate',
    stainlessPath: '(resource) public.estimates > (method) delete',
    qualified: 'client.public.estimates.delete',
    params: ['estimate_id: string;', 'external_id?: string;'],
    response: '{ ok: boolean; status: string; ctx_id?: string; estimate_id?: string; external_id?: string; }',
    markdown:
      "## delete\n\n`client.public.estimates.delete(estimate_id: string, external_id?: string): { ok: boolean; status: string; ctx_id?: string; estimate_id?: string; external_id?: string; }`\n\n**delete** `/v1/public/estimates/{estimate_id}`\n\nDelete Estimate\n\n### Parameters\n\n- `estimate_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; estimate_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `estimate_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicEstimateResponse = await client.public.estimates.delete('estimate_id');\n\nconsole.log(publicEstimateResponse);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/invoices',
    httpMethod: 'post',
    summary: 'Create Invoice',
    description: 'Create Invoice',
    stainlessPath: '(resource) public.invoices > (method) create',
    qualified: 'client.public.invoices.create',
    params: [
      'company_external_id?: string;',
      'company_id?: string;',
      'contact_external_id?: string;',
      'contact_id?: string;',
      'currency?: string;',
      'due_date?: string;',
      'external_id?: string;',
      'notes?: string;',
      'start_date?: string;',
      'status?: string;',
      'tax_inclusive?: boolean;',
      'tax_option?: string;',
      'tax_rate?: number;',
      'total_price?: number;',
      'total_price_without_tax?: number;',
    ],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; invoice_id?: string; }',
    markdown:
      "## create\n\n`client.public.invoices.create(company_external_id?: string, company_id?: string, contact_external_id?: string, contact_id?: string, currency?: string, due_date?: string, external_id?: string, notes?: string, start_date?: string, status?: string, tax_inclusive?: boolean, tax_option?: string, tax_rate?: number, total_price?: number, total_price_without_tax?: number): { ok: boolean; status: string; ctx_id?: string; external_id?: string; invoice_id?: string; }`\n\n**post** `/v1/public/invoices`\n\nCreate Invoice\n\n### Parameters\n\n- `company_external_id?: string`\n\n- `company_id?: string`\n\n- `contact_external_id?: string`\n\n- `contact_id?: string`\n\n- `currency?: string`\n\n- `due_date?: string`\n\n- `external_id?: string`\n\n- `notes?: string`\n\n- `start_date?: string`\n\n- `status?: string`\n\n- `tax_inclusive?: boolean`\n\n- `tax_option?: string`\n\n- `tax_rate?: number`\n\n- `total_price?: number`\n\n- `total_price_without_tax?: number`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; invoice_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `invoice_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst invoice = await client.public.invoices.create();\n\nconsole.log(invoice);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/invoices/{invoice_id}',
    httpMethod: 'get',
    summary: 'Get Invoice',
    description: 'Get Invoice',
    stainlessPath: '(resource) public.invoices > (method) retrieve',
    qualified: 'client.public.invoices.retrieve',
    params: [
      'invoice_id: string;',
      'external_id?: string;',
      'lang?: string;',
      'language?: string;',
      'Accept-Language?: string;',
    ],
    response:
      '{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; days_overdue?: number; due_date?: string; id_inv?: number; outstanding_balance?: number; paid_amount?: number; start_date?: string; status?: string; status_key?: string; total_price?: number; total_price_without_tax?: number; }',
    markdown:
      "## retrieve\n\n`client.public.invoices.retrieve(invoice_id: string, external_id?: string, lang?: string, language?: string, Accept-Language?: string): { created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; days_overdue?: number; due_date?: string; id_inv?: number; outstanding_balance?: number; paid_amount?: number; start_date?: string; status?: string; status_key?: string; total_price?: number; total_price_without_tax?: number; }`\n\n**get** `/v1/public/invoices/{invoice_id}`\n\nGet Invoice\n\n### Parameters\n\n- `invoice_id: string`\n\n- `external_id?: string`\n\n- `lang?: string`\n\n- `language?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; days_overdue?: number; due_date?: string; id_inv?: number; outstanding_balance?: number; paid_amount?: number; start_date?: string; status?: string; status_key?: string; total_price?: number; total_price_without_tax?: number; }`\n\n  - `created_at: string`\n  - `updated_at: string`\n  - `company_name?: string`\n  - `contact_name?: string`\n  - `currency?: string`\n  - `days_overdue?: number`\n  - `due_date?: string`\n  - `id_inv?: number`\n  - `outstanding_balance?: number`\n  - `paid_amount?: number`\n  - `start_date?: string`\n  - `status?: string`\n  - `status_key?: string`\n  - `total_price?: number`\n  - `total_price_without_tax?: number`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst invoiceSchema = await client.public.invoices.retrieve('invoice_id');\n\nconsole.log(invoiceSchema);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/invoices/{invoice_id}',
    httpMethod: 'put',
    summary: 'Update Invoice',
    description: 'Update Invoice',
    stainlessPath: '(resource) public.invoices > (method) update',
    qualified: 'client.public.invoices.update',
    params: [
      'invoice_id: string;',
      'company_external_id?: string;',
      'company_id?: string;',
      'contact_external_id?: string;',
      'contact_id?: string;',
      'currency?: string;',
      'due_date?: string;',
      'external_id?: string;',
      'notes?: string;',
      'start_date?: string;',
      'status?: string;',
      'tax_inclusive?: boolean;',
      'tax_option?: string;',
      'tax_rate?: number;',
      'total_price?: number;',
      'total_price_without_tax?: number;',
    ],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; invoice_id?: string; }',
    markdown:
      "## update\n\n`client.public.invoices.update(invoice_id: string, company_external_id?: string, company_id?: string, contact_external_id?: string, contact_id?: string, currency?: string, due_date?: string, external_id?: string, notes?: string, start_date?: string, status?: string, tax_inclusive?: boolean, tax_option?: string, tax_rate?: number, total_price?: number, total_price_without_tax?: number): { ok: boolean; status: string; ctx_id?: string; external_id?: string; invoice_id?: string; }`\n\n**put** `/v1/public/invoices/{invoice_id}`\n\nUpdate Invoice\n\n### Parameters\n\n- `invoice_id: string`\n\n- `company_external_id?: string`\n\n- `company_id?: string`\n\n- `contact_external_id?: string`\n\n- `contact_id?: string`\n\n- `currency?: string`\n\n- `due_date?: string`\n\n- `external_id?: string`\n\n- `notes?: string`\n\n- `start_date?: string`\n\n- `status?: string`\n\n- `tax_inclusive?: boolean`\n\n- `tax_option?: string`\n\n- `tax_rate?: number`\n\n- `total_price?: number`\n\n- `total_price_without_tax?: number`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; invoice_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `invoice_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst invoice = await client.public.invoices.update('invoice_id');\n\nconsole.log(invoice);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/invoices',
    httpMethod: 'get',
    summary: 'List Invoices',
    description: 'List Invoices',
    stainlessPath: '(resource) public.invoices > (method) list',
    qualified: 'client.public.invoices.list',
    params: ['lang?: string;', 'language?: string;', 'workspace_id?: string;', 'Accept-Language?: string;'],
    response:
      '{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; days_overdue?: number; due_date?: string; id_inv?: number; outstanding_balance?: number; paid_amount?: number; start_date?: string; status?: string; status_key?: string; total_price?: number; total_price_without_tax?: number; }[]',
    markdown:
      "## list\n\n`client.public.invoices.list(lang?: string, language?: string, workspace_id?: string, Accept-Language?: string): object[]`\n\n**get** `/v1/public/invoices`\n\nList Invoices\n\n### Parameters\n\n- `lang?: string`\n\n- `language?: string`\n\n- `workspace_id?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; days_overdue?: number; due_date?: string; id_inv?: number; outstanding_balance?: number; paid_amount?: number; start_date?: string; status?: string; status_key?: string; total_price?: number; total_price_without_tax?: number; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst invoiceSchemata = await client.public.invoices.list();\n\nconsole.log(invoiceSchemata);\n```",
  },
  {
    name: 'listOverdue',
    endpoint: '/v1/public/invoices/overdue',
    httpMethod: 'get',
    summary: 'List Overdue Invoices',
    description: 'List Overdue Invoices',
    stainlessPath: '(resource) public.invoices > (method) listOverdue',
    qualified: 'client.public.invoices.listOverdue',
    params: [
      'as_of_date?: string;',
      'lang?: string;',
      'language?: string;',
      'workspace_id?: string;',
      'Accept-Language?: string;',
    ],
    response:
      '{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; days_overdue?: number; due_date?: string; id_inv?: number; outstanding_balance?: number; paid_amount?: number; start_date?: string; status?: string; status_key?: string; total_price?: number; total_price_without_tax?: number; }[]',
    markdown:
      "## listOverdue\n\n`client.public.invoices.listOverdue(as_of_date?: string, lang?: string, language?: string, workspace_id?: string, Accept-Language?: string): object[]`\n\n**get** `/v1/public/invoices/overdue`\n\nList Overdue Invoices\n\n### Parameters\n\n- `as_of_date?: string`\n\n- `lang?: string`\n\n- `language?: string`\n\n- `workspace_id?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; days_overdue?: number; due_date?: string; id_inv?: number; outstanding_balance?: number; paid_amount?: number; start_date?: string; status?: string; status_key?: string; total_price?: number; total_price_without_tax?: number; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst invoiceSchemata = await client.public.invoices.listOverdue();\n\nconsole.log(invoiceSchemata);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/invoices/{invoice_id}',
    httpMethod: 'delete',
    summary: 'Delete Invoice',
    description: 'Delete Invoice',
    stainlessPath: '(resource) public.invoices > (method) delete',
    qualified: 'client.public.invoices.delete',
    params: ['invoice_id: string;', 'external_id?: string;'],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; invoice_id?: string; }',
    markdown:
      "## delete\n\n`client.public.invoices.delete(invoice_id: string, external_id?: string): { ok: boolean; status: string; ctx_id?: string; external_id?: string; invoice_id?: string; }`\n\n**delete** `/v1/public/invoices/{invoice_id}`\n\nDelete Invoice\n\n### Parameters\n\n- `invoice_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; invoice_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `invoice_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst invoice = await client.public.invoices.delete('invoice_id');\n\nconsole.log(invoice);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/payments',
    httpMethod: 'post',
    summary: 'Create Payment',
    description: 'Create Payment',
    stainlessPath: '(resource) public.payments > (method) create',
    qualified: 'client.public.payments.create',
    params: [
      'companyExternalId?: string;',
      'companyId?: string;',
      'contactExternalId?: string;',
      'contactId?: string;',
      'currency?: string;',
      'entryType?: string;',
      'externalId?: string;',
      'notes?: string;',
      'startDate?: string;',
      'status?: string;',
      'totalPrice?: number;',
      'totalPriceWithoutTax?: number;',
    ],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; payment_id?: string; }',
    markdown:
      "## create\n\n`client.public.payments.create(companyExternalId?: string, companyId?: string, contactExternalId?: string, contactId?: string, currency?: string, entryType?: string, externalId?: string, notes?: string, startDate?: string, status?: string, totalPrice?: number, totalPriceWithoutTax?: number): { ok: boolean; status: string; ctx_id?: string; external_id?: string; payment_id?: string; }`\n\n**post** `/v1/public/payments`\n\nCreate Payment\n\n### Parameters\n\n- `companyExternalId?: string`\n\n- `companyId?: string`\n\n- `contactExternalId?: string`\n\n- `contactId?: string`\n\n- `currency?: string`\n\n- `entryType?: string`\n\n- `externalId?: string`\n\n- `notes?: string`\n\n- `startDate?: string`\n\n- `status?: string`\n\n- `totalPrice?: number`\n\n- `totalPriceWithoutTax?: number`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; payment_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `payment_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst paymentResponse = await client.public.payments.create();\n\nconsole.log(paymentResponse);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/payments/{payment_id}',
    httpMethod: 'get',
    summary: 'Get Payment',
    description: 'Get Payment',
    stainlessPath: '(resource) public.payments > (method) retrieve',
    qualified: 'client.public.payments.retrieve',
    params: [
      'payment_id: string;',
      'external_id?: string;',
      'lang?: string;',
      'language?: string;',
      'Accept-Language?: string;',
    ],
    response:
      '{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; entry_type?: string; id_rcp?: number; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }',
    markdown:
      "## retrieve\n\n`client.public.payments.retrieve(payment_id: string, external_id?: string, lang?: string, language?: string, Accept-Language?: string): { created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; entry_type?: string; id_rcp?: number; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }`\n\n**get** `/v1/public/payments/{payment_id}`\n\nGet Payment\n\n### Parameters\n\n- `payment_id: string`\n\n- `external_id?: string`\n\n- `lang?: string`\n\n- `language?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; entry_type?: string; id_rcp?: number; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }`\n\n  - `created_at: string`\n  - `updated_at: string`\n  - `company_name?: string`\n  - `contact_name?: string`\n  - `currency?: string`\n  - `entry_type?: string`\n  - `id_rcp?: number`\n  - `start_date?: string`\n  - `status?: string`\n  - `total_price?: number`\n  - `total_price_without_tax?: number`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst receipt = await client.public.payments.retrieve('payment_id');\n\nconsole.log(receipt);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/payments/{payment_id}',
    httpMethod: 'put',
    summary: 'Update Payment',
    description: 'Update Payment',
    stainlessPath: '(resource) public.payments > (method) update',
    qualified: 'client.public.payments.update',
    params: [
      'payment_id: string;',
      'external_id?: string;',
      'companyExternalId?: string;',
      'companyId?: string;',
      'contactExternalId?: string;',
      'contactId?: string;',
      'currency?: string;',
      'entryType?: string;',
      'externalId?: string;',
      'notes?: string;',
      'startDate?: string;',
      'status?: string;',
      'totalPrice?: number;',
      'totalPriceWithoutTax?: number;',
    ],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; payment_id?: string; }',
    markdown:
      "## update\n\n`client.public.payments.update(payment_id: string, external_id?: string, companyExternalId?: string, companyId?: string, contactExternalId?: string, contactId?: string, currency?: string, entryType?: string, externalId?: string, notes?: string, startDate?: string, status?: string, totalPrice?: number, totalPriceWithoutTax?: number): { ok: boolean; status: string; ctx_id?: string; external_id?: string; payment_id?: string; }`\n\n**put** `/v1/public/payments/{payment_id}`\n\nUpdate Payment\n\n### Parameters\n\n- `payment_id: string`\n\n- `external_id?: string`\n\n- `companyExternalId?: string`\n\n- `companyId?: string`\n\n- `contactExternalId?: string`\n\n- `contactId?: string`\n\n- `currency?: string`\n\n- `entryType?: string`\n\n- `externalId?: string`\n\n- `notes?: string`\n\n- `startDate?: string`\n\n- `status?: string`\n\n- `totalPrice?: number`\n\n- `totalPriceWithoutTax?: number`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; payment_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `payment_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst paymentResponse = await client.public.payments.update('payment_id');\n\nconsole.log(paymentResponse);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/payments',
    httpMethod: 'get',
    summary: 'List Payments',
    description: 'List Payments',
    stainlessPath: '(resource) public.payments > (method) list',
    qualified: 'client.public.payments.list',
    params: ['lang?: string;', 'language?: string;', 'workspace_id?: string;', 'Accept-Language?: string;'],
    response:
      '{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; entry_type?: string; id_rcp?: number; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }[]',
    markdown:
      "## list\n\n`client.public.payments.list(lang?: string, language?: string, workspace_id?: string, Accept-Language?: string): object[]`\n\n**get** `/v1/public/payments`\n\nList Payments\n\n### Parameters\n\n- `lang?: string`\n\n- `language?: string`\n\n- `workspace_id?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; entry_type?: string; id_rcp?: number; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst receipts = await client.public.payments.list();\n\nconsole.log(receipts);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/payments/{payment_id}',
    httpMethod: 'delete',
    summary: 'Delete Payment',
    description: 'Delete Payment',
    stainlessPath: '(resource) public.payments > (method) delete',
    qualified: 'client.public.payments.delete',
    params: ['payment_id: string;', 'external_id?: string;'],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; payment_id?: string; }',
    markdown:
      "## delete\n\n`client.public.payments.delete(payment_id: string, external_id?: string): { ok: boolean; status: string; ctx_id?: string; external_id?: string; payment_id?: string; }`\n\n**delete** `/v1/public/payments/{payment_id}`\n\nDelete Payment\n\n### Parameters\n\n- `payment_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; payment_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `payment_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst paymentResponse = await client.public.payments.delete('payment_id');\n\nconsole.log(paymentResponse);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/expenses',
    httpMethod: 'post',
    summary: 'Create Expense',
    description: 'Create Expense',
    stainlessPath: '(resource) public.expenses > (method) create',
    qualified: 'client.public.expenses.create',
    params: [
      'amount?: number;',
      'attachment_file?: { files?: { id?: string; file_id?: string; name?: string; }[]; };',
      'company_external_id?: string;',
      'company_id?: string;',
      'contact_external_id?: string;',
      'contact_id?: string;',
      'currency?: string;',
      'description?: string;',
      'due_date?: string;',
      'external_id?: string;',
      'reimburse_date?: string;',
      'status?: string;',
    ],
    response: '{ ok: boolean; status: string; ctx_id?: string; expense_id?: string; external_id?: string; }',
    markdown:
      "## create\n\n`client.public.expenses.create(amount?: number, attachment_file?: { files?: { id?: string; file_id?: string; name?: string; }[]; }, company_external_id?: string, company_id?: string, contact_external_id?: string, contact_id?: string, currency?: string, description?: string, due_date?: string, external_id?: string, reimburse_date?: string, status?: string): { ok: boolean; status: string; ctx_id?: string; expense_id?: string; external_id?: string; }`\n\n**post** `/v1/public/expenses`\n\nCreate Expense\n\n### Parameters\n\n- `amount?: number`\n\n- `attachment_file?: { files?: { id?: string; file_id?: string; name?: string; }[]; }`\n  - `files?: { id?: string; file_id?: string; name?: string; }[]`\n\n- `company_external_id?: string`\n\n- `company_id?: string`\n\n- `contact_external_id?: string`\n\n- `contact_id?: string`\n\n- `currency?: string`\n\n- `description?: string`\n\n- `due_date?: string`\n\n- `external_id?: string`\n\n- `reimburse_date?: string`\n\n- `status?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; expense_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `expense_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicExpenseResponse = await client.public.expenses.create();\n\nconsole.log(publicExpenseResponse);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/expenses/{expense_id}',
    httpMethod: 'get',
    summary: 'Get Expense',
    description: 'Get Expense',
    stainlessPath: '(resource) public.expenses > (method) retrieve',
    qualified: 'client.public.expenses.retrieve',
    params: [
      'expense_id: string;',
      'external_id?: string;',
      'lang?: string;',
      'language?: string;',
      'Accept-Language?: string;',
    ],
    response:
      '{ id: string; created_at: string; amount?: number; company_name?: string; contact_name?: string; currency?: string; description?: string; due_date?: string; id_pm?: number; reimburse_date?: string; status?: string; updated_at?: string; }',
    markdown:
      "## retrieve\n\n`client.public.expenses.retrieve(expense_id: string, external_id?: string, lang?: string, language?: string, Accept-Language?: string): { id: string; created_at: string; amount?: number; company_name?: string; contact_name?: string; currency?: string; description?: string; due_date?: string; id_pm?: number; reimburse_date?: string; status?: string; updated_at?: string; }`\n\n**get** `/v1/public/expenses/{expense_id}`\n\nGet Expense\n\n### Parameters\n\n- `expense_id: string`\n\n- `external_id?: string`\n\n- `lang?: string`\n\n- `language?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ id: string; created_at: string; amount?: number; company_name?: string; contact_name?: string; currency?: string; description?: string; due_date?: string; id_pm?: number; reimburse_date?: string; status?: string; updated_at?: string; }`\n\n  - `id: string`\n  - `created_at: string`\n  - `amount?: number`\n  - `company_name?: string`\n  - `contact_name?: string`\n  - `currency?: string`\n  - `description?: string`\n  - `due_date?: string`\n  - `id_pm?: number`\n  - `reimburse_date?: string`\n  - `status?: string`\n  - `updated_at?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst expense = await client.public.expenses.retrieve('expense_id');\n\nconsole.log(expense);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/expenses/{expense_id}',
    httpMethod: 'put',
    summary: 'Update Expense',
    description: 'Update Expense',
    stainlessPath: '(resource) public.expenses > (method) update',
    qualified: 'client.public.expenses.update',
    params: [
      'expense_id: string;',
      'amount?: number;',
      'attachment_file?: { files?: { id?: string; file_id?: string; name?: string; }[]; };',
      'company_external_id?: string;',
      'company_id?: string;',
      'contact_external_id?: string;',
      'contact_id?: string;',
      'currency?: string;',
      'description?: string;',
      'due_date?: string;',
      'external_id?: string;',
      'reimburse_date?: string;',
      'status?: string;',
    ],
    response: '{ ok: boolean; status: string; ctx_id?: string; expense_id?: string; external_id?: string; }',
    markdown:
      "## update\n\n`client.public.expenses.update(expense_id: string, amount?: number, attachment_file?: { files?: { id?: string; file_id?: string; name?: string; }[]; }, company_external_id?: string, company_id?: string, contact_external_id?: string, contact_id?: string, currency?: string, description?: string, due_date?: string, external_id?: string, reimburse_date?: string, status?: string): { ok: boolean; status: string; ctx_id?: string; expense_id?: string; external_id?: string; }`\n\n**put** `/v1/public/expenses/{expense_id}`\n\nUpdate Expense\n\n### Parameters\n\n- `expense_id: string`\n\n- `amount?: number`\n\n- `attachment_file?: { files?: { id?: string; file_id?: string; name?: string; }[]; }`\n  - `files?: { id?: string; file_id?: string; name?: string; }[]`\n\n- `company_external_id?: string`\n\n- `company_id?: string`\n\n- `contact_external_id?: string`\n\n- `contact_id?: string`\n\n- `currency?: string`\n\n- `description?: string`\n\n- `due_date?: string`\n\n- `external_id?: string`\n\n- `reimburse_date?: string`\n\n- `status?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; expense_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `expense_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicExpenseResponse = await client.public.expenses.update('expense_id');\n\nconsole.log(publicExpenseResponse);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/expenses',
    httpMethod: 'get',
    summary: 'List Expenses',
    description: 'List Expenses',
    stainlessPath: '(resource) public.expenses > (method) list',
    qualified: 'client.public.expenses.list',
    params: ['lang?: string;', 'language?: string;', 'workspace_id?: string;', 'Accept-Language?: string;'],
    response:
      '{ id: string; created_at: string; amount?: number; company_name?: string; contact_name?: string; currency?: string; description?: string; due_date?: string; id_pm?: number; reimburse_date?: string; status?: string; updated_at?: string; }[]',
    markdown:
      "## list\n\n`client.public.expenses.list(lang?: string, language?: string, workspace_id?: string, Accept-Language?: string): object[]`\n\n**get** `/v1/public/expenses`\n\nList Expenses\n\n### Parameters\n\n- `lang?: string`\n\n- `language?: string`\n\n- `workspace_id?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ id: string; created_at: string; amount?: number; company_name?: string; contact_name?: string; currency?: string; description?: string; due_date?: string; id_pm?: number; reimburse_date?: string; status?: string; updated_at?: string; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst expenses = await client.public.expenses.list();\n\nconsole.log(expenses);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/expenses/{expense_id}',
    httpMethod: 'delete',
    summary: 'Delete Expense',
    description: 'Delete Expense',
    stainlessPath: '(resource) public.expenses > (method) delete',
    qualified: 'client.public.expenses.delete',
    params: ['expense_id: string;', 'external_id?: string;'],
    response: '{ ok: boolean; status: string; ctx_id?: string; expense_id?: string; external_id?: string; }',
    markdown:
      "## delete\n\n`client.public.expenses.delete(expense_id: string, external_id?: string): { ok: boolean; status: string; ctx_id?: string; expense_id?: string; external_id?: string; }`\n\n**delete** `/v1/public/expenses/{expense_id}`\n\nDelete Expense\n\n### Parameters\n\n- `expense_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; expense_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `expense_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicExpenseResponse = await client.public.expenses.delete('expense_id');\n\nconsole.log(publicExpenseResponse);\n```",
  },
  {
    name: 'upload_attachment',
    endpoint: '/v1/public/expenses/files',
    httpMethod: 'post',
    summary: 'Upload Expense Attachment File',
    description: 'Upload Expense Attachment File',
    stainlessPath: '(resource) public.expenses > (method) upload_attachment',
    qualified: 'client.public.expenses.uploadAttachment',
    params: ['file: string;'],
    response: '{ file_id: string; ok: boolean; ctx_id?: string; filename?: string; }',
    markdown:
      "## upload_attachment\n\n`client.public.expenses.uploadAttachment(file: string): { file_id: string; ok: boolean; ctx_id?: string; filename?: string; }`\n\n**post** `/v1/public/expenses/files`\n\nUpload Expense Attachment File\n\n### Parameters\n\n- `file: string`\n\n### Returns\n\n- `{ file_id: string; ok: boolean; ctx_id?: string; filename?: string; }`\n\n  - `file_id: string`\n  - `ok: boolean`\n  - `ctx_id?: string`\n  - `filename?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst response = await client.public.expenses.uploadAttachment({ file: fs.createReadStream('path/to/file') });\n\nconsole.log(response);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/inventories',
    httpMethod: 'post',
    summary: 'Create Inventory',
    description: 'Create Inventory',
    stainlessPath: '(resource) public.inventories > (method) create',
    qualified: 'client.public.inventories.create',
    params: [
      'externalId: string;',
      'currency?: string;',
      'date?: string;',
      'initialValue?: number;',
      'inventoryStatus?: string;',
      'itemExternalId?: string;',
      'itemId?: string;',
      'name?: string;',
      'status?: string;',
      'unitPrice?: number;',
      'warehouseId?: string;',
    ],
    response:
      '{ external_id: string; ok: boolean; status: string; ctx_id?: string; inventory_id?: string; inventory_record_id?: string; }',
    markdown:
      "## create\n\n`client.public.inventories.create(externalId: string, currency?: string, date?: string, initialValue?: number, inventoryStatus?: string, itemExternalId?: string, itemId?: string, name?: string, status?: string, unitPrice?: number, warehouseId?: string): { external_id: string; ok: boolean; status: string; ctx_id?: string; inventory_id?: string; inventory_record_id?: string; }`\n\n**post** `/v1/public/inventories`\n\nCreate Inventory\n\n### Parameters\n\n- `externalId: string`\n\n- `currency?: string`\n\n- `date?: string`\n\n- `initialValue?: number`\n\n- `inventoryStatus?: string`\n\n- `itemExternalId?: string`\n\n- `itemId?: string`\n\n- `name?: string`\n\n- `status?: string`\n\n- `unitPrice?: number`\n\n- `warehouseId?: string`\n\n### Returns\n\n- `{ external_id: string; ok: boolean; status: string; ctx_id?: string; inventory_id?: string; inventory_record_id?: string; }`\n\n  - `external_id: string`\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `inventory_id?: string`\n  - `inventory_record_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst inventoryResponse = await client.public.inventories.create({ externalId: 'externalId' });\n\nconsole.log(inventoryResponse);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/inventories/{inventory_id}',
    httpMethod: 'get',
    summary: 'Get Inventory',
    description: 'Get Inventory',
    stainlessPath: '(resource) public.inventories > (method) retrieve',
    qualified: 'client.public.inventories.retrieve',
    params: ['inventory_id: string;', 'external_id?: string;', 'Accept-Language?: string;'],
    response:
      '{ created_at: string; updated_at: string; id?: string; available?: number; committed?: number; currency?: string; date?: string; initial_value?: number; inventory_id?: number; inventory_status?: string; inventory_value?: number; item_ids?: string[]; name?: string; record_source?: string; record_source_detail?: string; status?: string; total_inventory?: number; unavailable?: number; unit_price?: number; warehouse_id?: string; }',
    markdown:
      "## retrieve\n\n`client.public.inventories.retrieve(inventory_id: string, external_id?: string, Accept-Language?: string): { created_at: string; updated_at: string; id?: string; available?: number; committed?: number; currency?: string; date?: string; initial_value?: number; inventory_id?: number; inventory_status?: string; inventory_value?: number; item_ids?: string[]; name?: string; record_source?: string; record_source_detail?: string; status?: string; total_inventory?: number; unavailable?: number; unit_price?: number; warehouse_id?: string; }`\n\n**get** `/v1/public/inventories/{inventory_id}`\n\nGet Inventory\n\n### Parameters\n\n- `inventory_id: string`\n\n- `external_id?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; id?: string; available?: number; committed?: number; currency?: string; date?: string; initial_value?: number; inventory_id?: number; inventory_status?: string; inventory_value?: number; item_ids?: string[]; name?: string; record_source?: string; record_source_detail?: string; status?: string; total_inventory?: number; unavailable?: number; unit_price?: number; warehouse_id?: string; }`\n\n  - `created_at: string`\n  - `updated_at: string`\n  - `id?: string`\n  - `available?: number`\n  - `committed?: number`\n  - `currency?: string`\n  - `date?: string`\n  - `initial_value?: number`\n  - `inventory_id?: number`\n  - `inventory_status?: string`\n  - `inventory_value?: number`\n  - `item_ids?: string[]`\n  - `name?: string`\n  - `record_source?: string`\n  - `record_source_detail?: string`\n  - `status?: string`\n  - `total_inventory?: number`\n  - `unavailable?: number`\n  - `unit_price?: number`\n  - `warehouse_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst shopTurboInventory = await client.public.inventories.retrieve('inventory_id');\n\nconsole.log(shopTurboInventory);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/inventories/{inventory_id}',
    httpMethod: 'put',
    summary: 'Update Inventory',
    description: 'Update Inventory',
    stainlessPath: '(resource) public.inventories > (method) update',
    qualified: 'client.public.inventories.update',
    params: [
      'inventory_id: string;',
      'externalId: string;',
      'currency?: string;',
      'date?: string;',
      'initialValue?: number;',
      'inventoryStatus?: string;',
      'itemExternalId?: string;',
      'itemId?: string;',
      'name?: string;',
      'status?: string;',
      'unitPrice?: number;',
      'warehouseId?: string;',
    ],
    response:
      '{ external_id: string; ok: boolean; status: string; ctx_id?: string; inventory_id?: string; inventory_record_id?: string; }',
    markdown:
      "## update\n\n`client.public.inventories.update(inventory_id: string, externalId: string, currency?: string, date?: string, initialValue?: number, inventoryStatus?: string, itemExternalId?: string, itemId?: string, name?: string, status?: string, unitPrice?: number, warehouseId?: string): { external_id: string; ok: boolean; status: string; ctx_id?: string; inventory_id?: string; inventory_record_id?: string; }`\n\n**put** `/v1/public/inventories/{inventory_id}`\n\nUpdate Inventory\n\n### Parameters\n\n- `inventory_id: string`\n\n- `externalId: string`\n\n- `currency?: string`\n\n- `date?: string`\n\n- `initialValue?: number`\n\n- `inventoryStatus?: string`\n\n- `itemExternalId?: string`\n\n- `itemId?: string`\n\n- `name?: string`\n\n- `status?: string`\n\n- `unitPrice?: number`\n\n- `warehouseId?: string`\n\n### Returns\n\n- `{ external_id: string; ok: boolean; status: string; ctx_id?: string; inventory_id?: string; inventory_record_id?: string; }`\n\n  - `external_id: string`\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `inventory_id?: string`\n  - `inventory_record_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst inventoryResponse = await client.public.inventories.update('inventory_id', { externalId: 'externalId' });\n\nconsole.log(inventoryResponse);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/inventories',
    httpMethod: 'get',
    summary: 'List Inventories',
    description: 'List Inventories',
    stainlessPath: '(resource) public.inventories > (method) list',
    qualified: 'client.public.inventories.list',
    params: ['lang?: string;', 'language?: string;', 'workspace_id?: string;', 'Accept-Language?: string;'],
    response:
      '{ created_at: string; updated_at: string; id?: string; available?: number; committed?: number; currency?: string; date?: string; initial_value?: number; inventory_id?: number; inventory_status?: string; inventory_value?: number; item_ids?: string[]; name?: string; record_source?: string; record_source_detail?: string; status?: string; total_inventory?: number; unavailable?: number; unit_price?: number; warehouse_id?: string; }[]',
    markdown:
      "## list\n\n`client.public.inventories.list(lang?: string, language?: string, workspace_id?: string, Accept-Language?: string): object[]`\n\n**get** `/v1/public/inventories`\n\nList Inventories\n\n### Parameters\n\n- `lang?: string`\n\n- `language?: string`\n\n- `workspace_id?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; id?: string; available?: number; committed?: number; currency?: string; date?: string; initial_value?: number; inventory_id?: number; inventory_status?: string; inventory_value?: number; item_ids?: string[]; name?: string; record_source?: string; record_source_detail?: string; status?: string; total_inventory?: number; unavailable?: number; unit_price?: number; warehouse_id?: string; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst shopTurboInventories = await client.public.inventories.list();\n\nconsole.log(shopTurboInventories);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/inventories/{inventory_id}',
    httpMethod: 'delete',
    summary: 'Delete Inventory',
    description: 'Delete Inventory',
    stainlessPath: '(resource) public.inventories > (method) delete',
    qualified: 'client.public.inventories.delete',
    params: ['inventory_id: string;', 'external_id?: string;'],
    response:
      '{ external_id: string; ok: boolean; status: string; ctx_id?: string; inventory_id?: string; inventory_record_id?: string; }',
    markdown:
      "## delete\n\n`client.public.inventories.delete(inventory_id: string, external_id?: string): { external_id: string; ok: boolean; status: string; ctx_id?: string; inventory_id?: string; inventory_record_id?: string; }`\n\n**delete** `/v1/public/inventories/{inventory_id}`\n\nDelete Inventory\n\n### Parameters\n\n- `inventory_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ external_id: string; ok: boolean; status: string; ctx_id?: string; inventory_id?: string; inventory_record_id?: string; }`\n\n  - `external_id: string`\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `inventory_id?: string`\n  - `inventory_record_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst inventoryResponse = await client.public.inventories.delete('inventory_id');\n\nconsole.log(inventoryResponse);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/locations',
    httpMethod: 'post',
    summary: 'Create Location',
    description: 'Create Location',
    stainlessPath: '(resource) public.locations > (method) create',
    qualified: 'client.public.locations.create',
    params: [
      'aisle?: string;',
      'bin?: string;',
      'externalId?: string;',
      'floor?: string;',
      'rack?: string;',
      'shelf?: string;',
      'usageStatus?: string;',
      'warehouse?: string;',
      'zone?: string;',
    ],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; location_id?: string; }',
    markdown:
      "## create\n\n`client.public.locations.create(aisle?: string, bin?: string, externalId?: string, floor?: string, rack?: string, shelf?: string, usageStatus?: string, warehouse?: string, zone?: string): { ok: boolean; status: string; ctx_id?: string; external_id?: string; location_id?: string; }`\n\n**post** `/v1/public/locations`\n\nCreate Location\n\n### Parameters\n\n- `aisle?: string`\n\n- `bin?: string`\n\n- `externalId?: string`\n\n- `floor?: string`\n\n- `rack?: string`\n\n- `shelf?: string`\n\n- `usageStatus?: string`\n\n- `warehouse?: string`\n\n- `zone?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; location_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `location_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst location = await client.public.locations.create();\n\nconsole.log(location);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/locations/{location_id}',
    httpMethod: 'get',
    summary: 'Get Location',
    description: 'Get Location',
    stainlessPath: '(resource) public.locations > (method) retrieve',
    qualified: 'client.public.locations.retrieve',
    params: ['location_id: string;', 'external_id?: string;'],
    response:
      '{ created_at: string; updated_at: string; id?: string; aisle?: string; bin?: string; floor?: string; id_iw?: string | number; location?: string; map_location_id?: string; rack?: string; shelf?: string; usage_status?: string; warehouse?: string; zone?: string; }',
    markdown:
      "## retrieve\n\n`client.public.locations.retrieve(location_id: string, external_id?: string): { created_at: string; updated_at: string; id?: string; aisle?: string; bin?: string; floor?: string; id_iw?: string | number; location?: string; map_location_id?: string; rack?: string; shelf?: string; usage_status?: string; warehouse?: string; zone?: string; }`\n\n**get** `/v1/public/locations/{location_id}`\n\nGet Location\n\n### Parameters\n\n- `location_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; id?: string; aisle?: string; bin?: string; floor?: string; id_iw?: string | number; location?: string; map_location_id?: string; rack?: string; shelf?: string; usage_status?: string; warehouse?: string; zone?: string; }`\n\n  - `created_at: string`\n  - `updated_at: string`\n  - `id?: string`\n  - `aisle?: string`\n  - `bin?: string`\n  - `floor?: string`\n  - `id_iw?: string | number`\n  - `location?: string`\n  - `map_location_id?: string`\n  - `rack?: string`\n  - `shelf?: string`\n  - `usage_status?: string`\n  - `warehouse?: string`\n  - `zone?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst warehouse = await client.public.locations.retrieve('location_id');\n\nconsole.log(warehouse);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/locations/{location_id}',
    httpMethod: 'put',
    summary: 'Update Location',
    description: 'Update Location',
    stainlessPath: '(resource) public.locations > (method) update',
    qualified: 'client.public.locations.update',
    params: [
      'location_id: string;',
      'external_id?: string;',
      'aisle?: string;',
      'bin?: string;',
      'externalId?: string;',
      'floor?: string;',
      'rack?: string;',
      'shelf?: string;',
      'usageStatus?: string;',
      'warehouse?: string;',
      'zone?: string;',
    ],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; location_id?: string; }',
    markdown:
      "## update\n\n`client.public.locations.update(location_id: string, external_id?: string, aisle?: string, bin?: string, externalId?: string, floor?: string, rack?: string, shelf?: string, usageStatus?: string, warehouse?: string, zone?: string): { ok: boolean; status: string; ctx_id?: string; external_id?: string; location_id?: string; }`\n\n**put** `/v1/public/locations/{location_id}`\n\nUpdate Location\n\n### Parameters\n\n- `location_id: string`\n\n- `external_id?: string`\n\n- `aisle?: string`\n\n- `bin?: string`\n\n- `externalId?: string`\n\n- `floor?: string`\n\n- `rack?: string`\n\n- `shelf?: string`\n\n- `usageStatus?: string`\n\n- `warehouse?: string`\n\n- `zone?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; location_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `location_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst location = await client.public.locations.update('location_id');\n\nconsole.log(location);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/locations',
    httpMethod: 'get',
    summary: 'List Locations',
    description: 'List Locations',
    stainlessPath: '(resource) public.locations > (method) list',
    qualified: 'client.public.locations.list',
    params: [
      'lang?: string;',
      'language?: string;',
      'q?: string;',
      'search?: string;',
      'workspace_id?: string;',
      'Accept-Language?: string;',
    ],
    response:
      '{ created_at: string; updated_at: string; id?: string; aisle?: string; bin?: string; floor?: string; id_iw?: string | number; location?: string; map_location_id?: string; rack?: string; shelf?: string; usage_status?: string; warehouse?: string; zone?: string; }[]',
    markdown:
      "## list\n\n`client.public.locations.list(lang?: string, language?: string, q?: string, search?: string, workspace_id?: string, Accept-Language?: string): object[]`\n\n**get** `/v1/public/locations`\n\nList Locations\n\n### Parameters\n\n- `lang?: string`\n\n- `language?: string`\n\n- `q?: string`\n\n- `search?: string`\n\n- `workspace_id?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; id?: string; aisle?: string; bin?: string; floor?: string; id_iw?: string | number; location?: string; map_location_id?: string; rack?: string; shelf?: string; usage_status?: string; warehouse?: string; zone?: string; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst warehouses = await client.public.locations.list();\n\nconsole.log(warehouses);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/locations/{location_id}',
    httpMethod: 'delete',
    summary: 'Delete Location',
    description: 'Delete Location',
    stainlessPath: '(resource) public.locations > (method) delete',
    qualified: 'client.public.locations.delete',
    params: ['location_id: string;', 'external_id?: string;'],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; location_id?: string; }',
    markdown:
      "## delete\n\n`client.public.locations.delete(location_id: string, external_id?: string): { ok: boolean; status: string; ctx_id?: string; external_id?: string; location_id?: string; }`\n\n**delete** `/v1/public/locations/{location_id}`\n\nDelete Location\n\n### Parameters\n\n- `location_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; location_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `location_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst location = await client.public.locations.delete('location_id');\n\nconsole.log(location);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/inventory-transactions',
    httpMethod: 'post',
    summary: 'Create Inventory Transaction',
    description: 'Create Inventory Transaction',
    stainlessPath: '(resource) public.inventory_transactions > (method) create',
    qualified: 'client.public.inventoryTransactions.create',
    params: [
      'transactionType: string;',
      'amount?: number;',
      'inventoryExternalId?: string;',
      'inventoryId?: string;',
      'inventoryType?: string;',
      'price?: number;',
      'status?: string;',
      'transactionAmount?: number;',
      'transactionDate?: string;',
      'useUnitValue?: boolean;',
    ],
    response:
      '{ ok: boolean; status: string; ctx_id?: string; inventory_id?: string; transaction_id?: string; }',
    markdown:
      "## create\n\n`client.public.inventoryTransactions.create(transactionType: string, amount?: number, inventoryExternalId?: string, inventoryId?: string, inventoryType?: string, price?: number, status?: string, transactionAmount?: number, transactionDate?: string, useUnitValue?: boolean): { ok: boolean; status: string; ctx_id?: string; inventory_id?: string; transaction_id?: string; }`\n\n**post** `/v1/public/inventory-transactions`\n\nCreate Inventory Transaction\n\n### Parameters\n\n- `transactionType: string`\n\n- `amount?: number`\n\n- `inventoryExternalId?: string`\n\n- `inventoryId?: string`\n\n- `inventoryType?: string`\n\n- `price?: number`\n\n- `status?: string`\n\n- `transactionAmount?: number`\n\n- `transactionDate?: string`\n\n- `useUnitValue?: boolean`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; inventory_id?: string; transaction_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `inventory_id?: string`\n  - `transaction_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst transactionResponse = await client.public.inventoryTransactions.create({ transactionType: 'transactionType' });\n\nconsole.log(transactionResponse);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/inventory-transactions/{transaction_id}',
    httpMethod: 'get',
    summary: 'Get Inventory Transaction',
    description: 'Get Inventory Transaction',
    stainlessPath: '(resource) public.inventory_transactions > (method) retrieve',
    qualified: 'client.public.inventoryTransactions.retrieve',
    params: ['transaction_id: string;', 'Accept-Language?: string;'],
    response:
      '{ created_at: string; updated_at: string; id?: string; amount?: number; average_price?: number; inventory_id?: string | number; inventory_type?: string; inventory_uuid?: string; price?: number; status?: string; total_price?: number; transaction_amount?: number; transaction_date?: string; transaction_id?: string | number; transaction_type?: string; usage_status?: string; use_unit_value?: boolean; }',
    markdown:
      "## retrieve\n\n`client.public.inventoryTransactions.retrieve(transaction_id: string, Accept-Language?: string): { created_at: string; updated_at: string; id?: string; amount?: number; average_price?: number; inventory_id?: string | number; inventory_type?: string; inventory_uuid?: string; price?: number; status?: string; total_price?: number; transaction_amount?: number; transaction_date?: string; transaction_id?: string | number; transaction_type?: string; usage_status?: string; use_unit_value?: boolean; }`\n\n**get** `/v1/public/inventory-transactions/{transaction_id}`\n\nGet Inventory Transaction\n\n### Parameters\n\n- `transaction_id: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; id?: string; amount?: number; average_price?: number; inventory_id?: string | number; inventory_type?: string; inventory_uuid?: string; price?: number; status?: string; total_price?: number; transaction_amount?: number; transaction_date?: string; transaction_id?: string | number; transaction_type?: string; usage_status?: string; use_unit_value?: boolean; }`\n\n  - `created_at: string`\n  - `updated_at: string`\n  - `id?: string`\n  - `amount?: number`\n  - `average_price?: number`\n  - `inventory_id?: string | number`\n  - `inventory_type?: string`\n  - `inventory_uuid?: string`\n  - `price?: number`\n  - `status?: string`\n  - `total_price?: number`\n  - `transaction_amount?: number`\n  - `transaction_date?: string`\n  - `transaction_id?: string | number`\n  - `transaction_type?: string`\n  - `usage_status?: string`\n  - `use_unit_value?: boolean`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst transactionSchema = await client.public.inventoryTransactions.retrieve('transaction_id');\n\nconsole.log(transactionSchema);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/inventory-transactions/{transaction_id}',
    httpMethod: 'put',
    summary: 'Update Inventory Transaction',
    description: 'Update Inventory Transaction',
    stainlessPath: '(resource) public.inventory_transactions > (method) update',
    qualified: 'client.public.inventoryTransactions.update',
    params: [
      'transaction_id: string;',
      'transactionType: string;',
      'amount?: number;',
      'inventoryExternalId?: string;',
      'inventoryId?: string;',
      'inventoryType?: string;',
      'price?: number;',
      'status?: string;',
      'transactionAmount?: number;',
      'transactionDate?: string;',
      'useUnitValue?: boolean;',
    ],
    response:
      '{ ok: boolean; status: string; ctx_id?: string; inventory_id?: string; transaction_id?: string; }',
    markdown:
      "## update\n\n`client.public.inventoryTransactions.update(transaction_id: string, transactionType: string, amount?: number, inventoryExternalId?: string, inventoryId?: string, inventoryType?: string, price?: number, status?: string, transactionAmount?: number, transactionDate?: string, useUnitValue?: boolean): { ok: boolean; status: string; ctx_id?: string; inventory_id?: string; transaction_id?: string; }`\n\n**put** `/v1/public/inventory-transactions/{transaction_id}`\n\nUpdate Inventory Transaction\n\n### Parameters\n\n- `transaction_id: string`\n\n- `transactionType: string`\n\n- `amount?: number`\n\n- `inventoryExternalId?: string`\n\n- `inventoryId?: string`\n\n- `inventoryType?: string`\n\n- `price?: number`\n\n- `status?: string`\n\n- `transactionAmount?: number`\n\n- `transactionDate?: string`\n\n- `useUnitValue?: boolean`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; inventory_id?: string; transaction_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `inventory_id?: string`\n  - `transaction_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst transactionResponse = await client.public.inventoryTransactions.update('transaction_id', { transactionType: 'transactionType' });\n\nconsole.log(transactionResponse);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/inventory-transactions',
    httpMethod: 'get',
    summary: 'List Inventory Transactions',
    description: 'List Inventory Transactions',
    stainlessPath: '(resource) public.inventory_transactions > (method) list',
    qualified: 'client.public.inventoryTransactions.list',
    params: ['lang?: string;', 'language?: string;', 'workspace_id?: string;', 'Accept-Language?: string;'],
    response:
      '{ created_at: string; updated_at: string; id?: string; amount?: number; average_price?: number; inventory_id?: string | number; inventory_type?: string; inventory_uuid?: string; price?: number; status?: string; total_price?: number; transaction_amount?: number; transaction_date?: string; transaction_id?: string | number; transaction_type?: string; usage_status?: string; use_unit_value?: boolean; }[]',
    markdown:
      "## list\n\n`client.public.inventoryTransactions.list(lang?: string, language?: string, workspace_id?: string, Accept-Language?: string): object[]`\n\n**get** `/v1/public/inventory-transactions`\n\nList Inventory Transactions\n\n### Parameters\n\n- `lang?: string`\n\n- `language?: string`\n\n- `workspace_id?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; id?: string; amount?: number; average_price?: number; inventory_id?: string | number; inventory_type?: string; inventory_uuid?: string; price?: number; status?: string; total_price?: number; transaction_amount?: number; transaction_date?: string; transaction_id?: string | number; transaction_type?: string; usage_status?: string; use_unit_value?: boolean; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst transactionSchemata = await client.public.inventoryTransactions.list();\n\nconsole.log(transactionSchemata);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/inventory-transactions/{transaction_id}',
    httpMethod: 'delete',
    summary: 'Delete Inventory Transaction',
    description: 'Delete Inventory Transaction',
    stainlessPath: '(resource) public.inventory_transactions > (method) delete',
    qualified: 'client.public.inventoryTransactions.delete',
    params: ['transaction_id: string;'],
    response:
      '{ ok: boolean; status: string; ctx_id?: string; inventory_id?: string; transaction_id?: string; }',
    markdown:
      "## delete\n\n`client.public.inventoryTransactions.delete(transaction_id: string): { ok: boolean; status: string; ctx_id?: string; inventory_id?: string; transaction_id?: string; }`\n\n**delete** `/v1/public/inventory-transactions/{transaction_id}`\n\nDelete Inventory Transaction\n\n### Parameters\n\n- `transaction_id: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; inventory_id?: string; transaction_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `inventory_id?: string`\n  - `transaction_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst transactionResponse = await client.public.inventoryTransactions.delete('transaction_id');\n\nconsole.log(transactionResponse);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/meters',
    httpMethod: 'post',
    summary: 'Create Meter',
    description: 'Create Meter',
    stainlessPath: '(resource) public.meters > (method) create',
    qualified: 'client.public.meters.create',
    params: [
      'companyExternalId?: string;',
      'companyId?: string;',
      'contactExternalId?: string;',
      'contactId?: string;',
      'externalId?: string;',
      'itemExternalId?: string;',
      'itemId?: string;',
      'subscriptionExternalId?: string;',
      'subscriptionId?: string;',
      'usage?: number;',
      'usageAt?: string;',
      'usageStatus?: string;',
    ],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; meter_id?: string; }',
    markdown:
      "## create\n\n`client.public.meters.create(companyExternalId?: string, companyId?: string, contactExternalId?: string, contactId?: string, externalId?: string, itemExternalId?: string, itemId?: string, subscriptionExternalId?: string, subscriptionId?: string, usage?: number, usageAt?: string, usageStatus?: string): { ok: boolean; status: string; ctx_id?: string; external_id?: string; meter_id?: string; }`\n\n**post** `/v1/public/meters`\n\nCreate Meter\n\n### Parameters\n\n- `companyExternalId?: string`\n\n- `companyId?: string`\n\n- `contactExternalId?: string`\n\n- `contactId?: string`\n\n- `externalId?: string`\n\n- `itemExternalId?: string`\n\n- `itemId?: string`\n\n- `subscriptionExternalId?: string`\n\n- `subscriptionId?: string`\n\n- `usage?: number`\n\n- `usageAt?: string`\n\n- `usageStatus?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; meter_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `meter_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst meter = await client.public.meters.create();\n\nconsole.log(meter);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/meters/{meter_id}',
    httpMethod: 'get',
    summary: 'Get Meter',
    description: 'Get Meter',
    stainlessPath: '(resource) public.meters > (method) retrieve',
    qualified: 'client.public.meters.retrieve',
    params: [
      'meter_id: string;',
      'external_id?: string;',
      'lang?: string;',
      'language?: string;',
      'Accept-Language?: string;',
    ],
    response:
      '{ created_at: string; updated_at: string; id?: string; company_id?: string; company_name?: string; contact_id?: string; contact_name?: string; item_id?: string; item_name?: string; meter_id?: string | number; subscription_id?: string; subscription_name?: string; usage?: number; usage_at?: string; usage_status?: string; }',
    markdown:
      "## retrieve\n\n`client.public.meters.retrieve(meter_id: string, external_id?: string, lang?: string, language?: string, Accept-Language?: string): { created_at: string; updated_at: string; id?: string; company_id?: string; company_name?: string; contact_id?: string; contact_name?: string; item_id?: string; item_name?: string; meter_id?: string | number; subscription_id?: string; subscription_name?: string; usage?: number; usage_at?: string; usage_status?: string; }`\n\n**get** `/v1/public/meters/{meter_id}`\n\nGet Meter\n\n### Parameters\n\n- `meter_id: string`\n\n- `external_id?: string`\n\n- `lang?: string`\n\n- `language?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; id?: string; company_id?: string; company_name?: string; contact_id?: string; contact_name?: string; item_id?: string; item_name?: string; meter_id?: string | number; subscription_id?: string; subscription_name?: string; usage?: number; usage_at?: string; usage_status?: string; }`\n\n  - `created_at: string`\n  - `updated_at: string`\n  - `id?: string`\n  - `company_id?: string`\n  - `company_name?: string`\n  - `contact_id?: string`\n  - `contact_name?: string`\n  - `item_id?: string`\n  - `item_name?: string`\n  - `meter_id?: string | number`\n  - `subscription_id?: string`\n  - `subscription_name?: string`\n  - `usage?: number`\n  - `usage_at?: string`\n  - `usage_status?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst commerceMeter = await client.public.meters.retrieve('meter_id');\n\nconsole.log(commerceMeter);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/meters/{meter_id}',
    httpMethod: 'put',
    summary: 'Update Meter',
    description: 'Update Meter',
    stainlessPath: '(resource) public.meters > (method) update',
    qualified: 'client.public.meters.update',
    params: [
      'meter_id: string;',
      'external_id?: string;',
      'companyExternalId?: string;',
      'companyId?: string;',
      'contactExternalId?: string;',
      'contactId?: string;',
      'externalId?: string;',
      'itemExternalId?: string;',
      'itemId?: string;',
      'subscriptionExternalId?: string;',
      'subscriptionId?: string;',
      'usage?: number;',
      'usageAt?: string;',
      'usageStatus?: string;',
    ],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; meter_id?: string; }',
    markdown:
      "## update\n\n`client.public.meters.update(meter_id: string, external_id?: string, companyExternalId?: string, companyId?: string, contactExternalId?: string, contactId?: string, externalId?: string, itemExternalId?: string, itemId?: string, subscriptionExternalId?: string, subscriptionId?: string, usage?: number, usageAt?: string, usageStatus?: string): { ok: boolean; status: string; ctx_id?: string; external_id?: string; meter_id?: string; }`\n\n**put** `/v1/public/meters/{meter_id}`\n\nUpdate Meter\n\n### Parameters\n\n- `meter_id: string`\n\n- `external_id?: string`\n\n- `companyExternalId?: string`\n\n- `companyId?: string`\n\n- `contactExternalId?: string`\n\n- `contactId?: string`\n\n- `externalId?: string`\n\n- `itemExternalId?: string`\n\n- `itemId?: string`\n\n- `subscriptionExternalId?: string`\n\n- `subscriptionId?: string`\n\n- `usage?: number`\n\n- `usageAt?: string`\n\n- `usageStatus?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; meter_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `meter_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst meter = await client.public.meters.update('meter_id');\n\nconsole.log(meter);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/meters',
    httpMethod: 'get',
    summary: 'List Meters',
    description: 'List Meters',
    stainlessPath: '(resource) public.meters > (method) list',
    qualified: 'client.public.meters.list',
    params: ['lang?: string;', 'language?: string;', 'workspace_id?: string;', 'Accept-Language?: string;'],
    response:
      '{ created_at: string; updated_at: string; id?: string; company_id?: string; company_name?: string; contact_id?: string; contact_name?: string; item_id?: string; item_name?: string; meter_id?: string | number; subscription_id?: string; subscription_name?: string; usage?: number; usage_at?: string; usage_status?: string; }[]',
    markdown:
      "## list\n\n`client.public.meters.list(lang?: string, language?: string, workspace_id?: string, Accept-Language?: string): object[]`\n\n**get** `/v1/public/meters`\n\nList Meters\n\n### Parameters\n\n- `lang?: string`\n\n- `language?: string`\n\n- `workspace_id?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; id?: string; company_id?: string; company_name?: string; contact_id?: string; contact_name?: string; item_id?: string; item_name?: string; meter_id?: string | number; subscription_id?: string; subscription_name?: string; usage?: number; usage_at?: string; usage_status?: string; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst commerceMeters = await client.public.meters.list();\n\nconsole.log(commerceMeters);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/meters/{meter_id}',
    httpMethod: 'delete',
    summary: 'Delete Meter',
    description: 'Delete Meter',
    stainlessPath: '(resource) public.meters > (method) delete',
    qualified: 'client.public.meters.delete',
    params: ['meter_id: string;', 'external_id?: string;'],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; meter_id?: string; }',
    markdown:
      "## delete\n\n`client.public.meters.delete(meter_id: string, external_id?: string): { ok: boolean; status: string; ctx_id?: string; external_id?: string; meter_id?: string; }`\n\n**delete** `/v1/public/meters/{meter_id}`\n\nDelete Meter\n\n### Parameters\n\n- `meter_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; meter_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `meter_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst meter = await client.public.meters.delete('meter_id');\n\nconsole.log(meter);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/properties/{object_name}',
    httpMethod: 'post',
    summary: 'Create Property',
    description: 'Create Property',
    stainlessPath: '(resource) public.properties > (method) create',
    qualified: 'client.public.properties.create',
    params: [
      'object_name: string;',
      'badge_color?: string;',
      'choice_values?: object | string[];',
      'conditional_choice_mapping?: object;',
      'description?: string;',
      'internal_name?: string;',
      'multiple_select?: boolean;',
      'name?: string;',
      'number_format?: string;',
      'order?: number;',
      'required_field?: boolean;',
      'show_badge?: boolean;',
      'tag_values?: string[];',
      'type?: string;',
      'unique?: boolean;',
    ],
    response: '{ ctx_id: string; object: string; ok: boolean; property_id: string; status: string; }',
    markdown:
      "## create\n\n`client.public.properties.create(object_name: string, badge_color?: string, choice_values?: object | string[], conditional_choice_mapping?: object, description?: string, internal_name?: string, multiple_select?: boolean, name?: string, number_format?: string, order?: number, required_field?: boolean, show_badge?: boolean, tag_values?: string[], type?: string, unique?: boolean): { ctx_id: string; object: string; ok: boolean; property_id: string; status: string; }`\n\n**post** `/v1/public/properties/{object_name}`\n\nCreate Property\n\n### Parameters\n\n- `object_name: string`\n\n- `badge_color?: string`\n\n- `choice_values?: object | string[]`\n\n- `conditional_choice_mapping?: object`\n\n- `description?: string`\n\n- `internal_name?: string`\n\n- `multiple_select?: boolean`\n\n- `name?: string`\n\n- `number_format?: string`\n\n- `order?: number`\n\n- `required_field?: boolean`\n\n- `show_badge?: boolean`\n\n- `tag_values?: string[]`\n\n- `type?: string`\n\n- `unique?: boolean`\n\n### Returns\n\n- `{ ctx_id: string; object: string; ok: boolean; property_id: string; status: string; }`\n\n  - `ctx_id: string`\n  - `object: string`\n  - `ok: boolean`\n  - `property_id: string`\n  - `status: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst propertyMutation = await client.public.properties.create('object_name');\n\nconsole.log(propertyMutation);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/properties/{object_name}/{property_ref}',
    httpMethod: 'get',
    summary: 'Retrieve Property',
    description: 'Retrieve Property',
    stainlessPath: '(resource) public.properties > (method) retrieve',
    qualified: 'client.public.properties.retrieve',
    params: [
      'object_name: string;',
      'property_ref: string;',
      'lang?: string;',
      'language?: string;',
      'workspace_id?: string;',
      'Accept-Language?: string;',
    ],
    response:
      '{ id: string; immutable: boolean; is_custom: boolean; object: string; badge_color?: string; choice_values?: object | string[]; conditional_choice_mapping?: object; created_at?: string; description?: string; internal_name?: string; multiple_select?: boolean; name?: string; number_format?: string; order?: number; required_field?: boolean; show_badge?: boolean; tag_values?: string[]; type?: string; unique?: boolean; updated_at?: string; }',
    markdown:
      "## retrieve\n\n`client.public.properties.retrieve(object_name: string, property_ref: string, lang?: string, language?: string, workspace_id?: string, Accept-Language?: string): { id: string; immutable: boolean; is_custom: boolean; object: string; badge_color?: string; choice_values?: object | string[]; conditional_choice_mapping?: object; created_at?: string; description?: string; internal_name?: string; multiple_select?: boolean; name?: string; number_format?: string; order?: number; required_field?: boolean; show_badge?: boolean; tag_values?: string[]; type?: string; unique?: boolean; updated_at?: string; }`\n\n**get** `/v1/public/properties/{object_name}/{property_ref}`\n\nRetrieve Property\n\n### Parameters\n\n- `object_name: string`\n\n- `property_ref: string`\n\n- `lang?: string`\n\n- `language?: string`\n\n- `workspace_id?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ id: string; immutable: boolean; is_custom: boolean; object: string; badge_color?: string; choice_values?: object | string[]; conditional_choice_mapping?: object; created_at?: string; description?: string; internal_name?: string; multiple_select?: boolean; name?: string; number_format?: string; order?: number; required_field?: boolean; show_badge?: boolean; tag_values?: string[]; type?: string; unique?: boolean; updated_at?: string; }`\n\n  - `id: string`\n  - `immutable: boolean`\n  - `is_custom: boolean`\n  - `object: string`\n  - `badge_color?: string`\n  - `choice_values?: object | string[]`\n  - `conditional_choice_mapping?: object`\n  - `created_at?: string`\n  - `description?: string`\n  - `internal_name?: string`\n  - `multiple_select?: boolean`\n  - `name?: string`\n  - `number_format?: string`\n  - `order?: number`\n  - `required_field?: boolean`\n  - `show_badge?: boolean`\n  - `tag_values?: string[]`\n  - `type?: string`\n  - `unique?: boolean`\n  - `updated_at?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst property = await client.public.properties.retrieve('property_ref', { object_name: 'object_name' });\n\nconsole.log(property);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/properties/{object_name}/{property_ref}',
    httpMethod: 'put',
    summary: 'Update Property',
    description: 'Update Property',
    stainlessPath: '(resource) public.properties > (method) update',
    qualified: 'client.public.properties.update',
    params: [
      'object_name: string;',
      'property_ref: string;',
      'badge_color?: string;',
      'choice_values?: object | string[];',
      'conditional_choice_mapping?: object;',
      'description?: string;',
      'internal_name?: string;',
      'multiple_select?: boolean;',
      'name?: string;',
      'number_format?: string;',
      'order?: number;',
      'required_field?: boolean;',
      'show_badge?: boolean;',
      'tag_values?: string[];',
      'type?: string;',
      'unique?: boolean;',
    ],
    response: '{ ctx_id: string; object: string; ok: boolean; property_id: string; status: string; }',
    markdown:
      "## update\n\n`client.public.properties.update(object_name: string, property_ref: string, badge_color?: string, choice_values?: object | string[], conditional_choice_mapping?: object, description?: string, internal_name?: string, multiple_select?: boolean, name?: string, number_format?: string, order?: number, required_field?: boolean, show_badge?: boolean, tag_values?: string[], type?: string, unique?: boolean): { ctx_id: string; object: string; ok: boolean; property_id: string; status: string; }`\n\n**put** `/v1/public/properties/{object_name}/{property_ref}`\n\nUpdate Property\n\n### Parameters\n\n- `object_name: string`\n\n- `property_ref: string`\n\n- `badge_color?: string`\n\n- `choice_values?: object | string[]`\n\n- `conditional_choice_mapping?: object`\n\n- `description?: string`\n\n- `internal_name?: string`\n\n- `multiple_select?: boolean`\n\n- `name?: string`\n\n- `number_format?: string`\n\n- `order?: number`\n\n- `required_field?: boolean`\n\n- `show_badge?: boolean`\n\n- `tag_values?: string[]`\n\n- `type?: string`\n\n- `unique?: boolean`\n\n### Returns\n\n- `{ ctx_id: string; object: string; ok: boolean; property_id: string; status: string; }`\n\n  - `ctx_id: string`\n  - `object: string`\n  - `ok: boolean`\n  - `property_id: string`\n  - `status: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst propertyMutation = await client.public.properties.update('property_ref', { object_name: 'object_name' });\n\nconsole.log(propertyMutation);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/properties/{object_name}',
    httpMethod: 'get',
    summary: 'List Properties',
    description: 'List Properties',
    stainlessPath: '(resource) public.properties > (method) list',
    qualified: 'client.public.properties.list',
    params: [
      'object_name: string;',
      'custom_only?: boolean;',
      'lang?: string;',
      'language?: string;',
      'workspace_id?: string;',
      'Accept-Language?: string;',
    ],
    response:
      '{ id: string; immutable: boolean; is_custom: boolean; object: string; badge_color?: string; choice_values?: object | string[]; conditional_choice_mapping?: object; created_at?: string; description?: string; internal_name?: string; multiple_select?: boolean; name?: string; number_format?: string; order?: number; required_field?: boolean; show_badge?: boolean; tag_values?: string[]; type?: string; unique?: boolean; updated_at?: string; }[]',
    markdown:
      "## list\n\n`client.public.properties.list(object_name: string, custom_only?: boolean, lang?: string, language?: string, workspace_id?: string, Accept-Language?: string): object[]`\n\n**get** `/v1/public/properties/{object_name}`\n\nList Properties\n\n### Parameters\n\n- `object_name: string`\n\n- `custom_only?: boolean`\n\n- `lang?: string`\n\n- `language?: string`\n\n- `workspace_id?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ id: string; immutable: boolean; is_custom: boolean; object: string; badge_color?: string; choice_values?: object | string[]; conditional_choice_mapping?: object; created_at?: string; description?: string; internal_name?: string; multiple_select?: boolean; name?: string; number_format?: string; order?: number; required_field?: boolean; show_badge?: boolean; tag_values?: string[]; type?: string; unique?: boolean; updated_at?: string; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst properties = await client.public.properties.list('object_name');\n\nconsole.log(properties);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/properties/{object_name}/{property_ref}',
    httpMethod: 'delete',
    summary: 'Delete Property',
    description: 'Delete Property',
    stainlessPath: '(resource) public.properties > (method) delete',
    qualified: 'client.public.properties.delete',
    params: ['object_name: string;', 'property_ref: string;'],
    response: '{ ctx_id: string; object: string; ok: boolean; property_id: string; status: string; }',
    markdown:
      "## delete\n\n`client.public.properties.delete(object_name: string, property_ref: string): { ctx_id: string; object: string; ok: boolean; property_id: string; status: string; }`\n\n**delete** `/v1/public/properties/{object_name}/{property_ref}`\n\nDelete Property\n\n### Parameters\n\n- `object_name: string`\n\n- `property_ref: string`\n\n### Returns\n\n- `{ ctx_id: string; object: string; ok: boolean; property_id: string; status: string; }`\n\n  - `ctx_id: string`\n  - `object: string`\n  - `ok: boolean`\n  - `property_id: string`\n  - `status: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst propertyMutation = await client.public.properties.delete('property_ref', { object_name: 'object_name' });\n\nconsole.log(propertyMutation);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/purchase-orders',
    httpMethod: 'post',
    summary: 'Create Purchase Order',
    description: 'Create Purchase Order',
    stainlessPath: '(resource) public.purchase_orders > (method) create',
    qualified: 'client.public.purchaseOrders.create',
    params: [
      'company_external_id?: string;',
      'company_id?: string;',
      'contact_external_id?: string;',
      'contact_id?: string;',
      'currency?: string;',
      'date?: string;',
      'external_id?: string;',
      'notes?: string;',
      'status?: string;',
      'tax_option?: string;',
      'tax_rate?: number;',
      'total_price?: number;',
      'total_price_without_tax?: number;',
    ],
    response:
      '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; purchase_order_id?: string; }',
    markdown:
      "## create\n\n`client.public.purchaseOrders.create(company_external_id?: string, company_id?: string, contact_external_id?: string, contact_id?: string, currency?: string, date?: string, external_id?: string, notes?: string, status?: string, tax_option?: string, tax_rate?: number, total_price?: number, total_price_without_tax?: number): { ok: boolean; status: string; ctx_id?: string; external_id?: string; purchase_order_id?: string; }`\n\n**post** `/v1/public/purchase-orders`\n\nCreate Purchase Order\n\n### Parameters\n\n- `company_external_id?: string`\n\n- `company_id?: string`\n\n- `contact_external_id?: string`\n\n- `contact_id?: string`\n\n- `currency?: string`\n\n- `date?: string`\n\n- `external_id?: string`\n\n- `notes?: string`\n\n- `status?: string`\n\n- `tax_option?: string`\n\n- `tax_rate?: number`\n\n- `total_price?: number`\n\n- `total_price_without_tax?: number`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; purchase_order_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `purchase_order_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst purchaseOrderResponse = await client.public.purchaseOrders.create();\n\nconsole.log(purchaseOrderResponse);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/purchase-orders/{purchase_order_id}',
    httpMethod: 'get',
    summary: 'Get Purchase Order',
    description: 'Get Purchase Order',
    stainlessPath: '(resource) public.purchase_orders > (method) retrieve',
    qualified: 'client.public.purchaseOrders.retrieve',
    params: [
      'purchase_order_id: string;',
      'external_id?: string;',
      'lang?: string;',
      'language?: string;',
      'Accept-Language?: string;',
    ],
    response:
      '{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; date?: string; id_po?: number; status?: string; total_price?: number; total_price_without_tax?: number; }',
    markdown:
      "## retrieve\n\n`client.public.purchaseOrders.retrieve(purchase_order_id: string, external_id?: string, lang?: string, language?: string, Accept-Language?: string): { created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; date?: string; id_po?: number; status?: string; total_price?: number; total_price_without_tax?: number; }`\n\n**get** `/v1/public/purchase-orders/{purchase_order_id}`\n\nGet Purchase Order\n\n### Parameters\n\n- `purchase_order_id: string`\n\n- `external_id?: string`\n\n- `lang?: string`\n\n- `language?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; date?: string; id_po?: number; status?: string; total_price?: number; total_price_without_tax?: number; }`\n\n  - `created_at: string`\n  - `updated_at: string`\n  - `company_name?: string`\n  - `contact_name?: string`\n  - `currency?: string`\n  - `date?: string`\n  - `id_po?: number`\n  - `status?: string`\n  - `total_price?: number`\n  - `total_price_without_tax?: number`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst purchaseOrder = await client.public.purchaseOrders.retrieve('purchase_order_id');\n\nconsole.log(purchaseOrder);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/purchase-orders/{purchase_order_id}',
    httpMethod: 'put',
    summary: 'Update Purchase Order',
    description: 'Update Purchase Order',
    stainlessPath: '(resource) public.purchase_orders > (method) update',
    qualified: 'client.public.purchaseOrders.update',
    params: [
      'purchase_order_id: string;',
      'company_external_id?: string;',
      'company_id?: string;',
      'contact_external_id?: string;',
      'contact_id?: string;',
      'currency?: string;',
      'date?: string;',
      'external_id?: string;',
      'notes?: string;',
      'status?: string;',
      'tax_option?: string;',
      'tax_rate?: number;',
      'total_price?: number;',
      'total_price_without_tax?: number;',
    ],
    response:
      '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; purchase_order_id?: string; }',
    markdown:
      "## update\n\n`client.public.purchaseOrders.update(purchase_order_id: string, company_external_id?: string, company_id?: string, contact_external_id?: string, contact_id?: string, currency?: string, date?: string, external_id?: string, notes?: string, status?: string, tax_option?: string, tax_rate?: number, total_price?: number, total_price_without_tax?: number): { ok: boolean; status: string; ctx_id?: string; external_id?: string; purchase_order_id?: string; }`\n\n**put** `/v1/public/purchase-orders/{purchase_order_id}`\n\nUpdate Purchase Order\n\n### Parameters\n\n- `purchase_order_id: string`\n\n- `company_external_id?: string`\n\n- `company_id?: string`\n\n- `contact_external_id?: string`\n\n- `contact_id?: string`\n\n- `currency?: string`\n\n- `date?: string`\n\n- `external_id?: string`\n\n- `notes?: string`\n\n- `status?: string`\n\n- `tax_option?: string`\n\n- `tax_rate?: number`\n\n- `total_price?: number`\n\n- `total_price_without_tax?: number`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; purchase_order_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `purchase_order_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst purchaseOrderResponse = await client.public.purchaseOrders.update('purchase_order_id');\n\nconsole.log(purchaseOrderResponse);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/purchase-orders',
    httpMethod: 'get',
    summary: 'List Purchase Orders',
    description: 'List Purchase Orders',
    stainlessPath: '(resource) public.purchase_orders > (method) list',
    qualified: 'client.public.purchaseOrders.list',
    params: ['lang?: string;', 'language?: string;', 'workspace_id?: string;', 'Accept-Language?: string;'],
    response:
      '{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; date?: string; id_po?: number; status?: string; total_price?: number; total_price_without_tax?: number; }[]',
    markdown:
      "## list\n\n`client.public.purchaseOrders.list(lang?: string, language?: string, workspace_id?: string, Accept-Language?: string): object[]`\n\n**get** `/v1/public/purchase-orders`\n\nList Purchase Orders\n\n### Parameters\n\n- `lang?: string`\n\n- `language?: string`\n\n- `workspace_id?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; date?: string; id_po?: number; status?: string; total_price?: number; total_price_without_tax?: number; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst purchaseOrders = await client.public.purchaseOrders.list();\n\nconsole.log(purchaseOrders);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/purchase-orders/{purchase_order_id}',
    httpMethod: 'delete',
    summary: 'Delete Purchase Order',
    description: 'Delete Purchase Order',
    stainlessPath: '(resource) public.purchase_orders > (method) delete',
    qualified: 'client.public.purchaseOrders.delete',
    params: ['purchase_order_id: string;', 'external_id?: string;'],
    response:
      '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; purchase_order_id?: string; }',
    markdown:
      "## delete\n\n`client.public.purchaseOrders.delete(purchase_order_id: string, external_id?: string): { ok: boolean; status: string; ctx_id?: string; external_id?: string; purchase_order_id?: string; }`\n\n**delete** `/v1/public/purchase-orders/{purchase_order_id}`\n\nDelete Purchase Order\n\n### Parameters\n\n- `purchase_order_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; purchase_order_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `purchase_order_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst purchaseOrderResponse = await client.public.purchaseOrders.delete('purchase_order_id');\n\nconsole.log(purchaseOrderResponse);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/slips',
    httpMethod: 'post',
    summary: 'Create Slip',
    description: 'Create Slip',
    stainlessPath: '(resource) public.slips > (method) create',
    qualified: 'client.public.slips.create',
    params: [
      'company_external_id?: string;',
      'company_id?: string;',
      'contact_external_id?: string;',
      'contact_id?: string;',
      'currency?: string;',
      'external_id?: string;',
      'notes?: string;',
      'slip_type?: string;',
      'start_date?: string;',
      'status?: string;',
      'tax_inclusive?: boolean;',
      'tax_option?: string;',
      'tax_rate?: number;',
      'total_price?: number;',
      'total_price_without_tax?: number;',
    ],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; slip_id?: string; }',
    markdown:
      "## create\n\n`client.public.slips.create(company_external_id?: string, company_id?: string, contact_external_id?: string, contact_id?: string, currency?: string, external_id?: string, notes?: string, slip_type?: string, start_date?: string, status?: string, tax_inclusive?: boolean, tax_option?: string, tax_rate?: number, total_price?: number, total_price_without_tax?: number): { ok: boolean; status: string; ctx_id?: string; external_id?: string; slip_id?: string; }`\n\n**post** `/v1/public/slips`\n\nCreate Slip\n\n### Parameters\n\n- `company_external_id?: string`\n\n- `company_id?: string`\n\n- `contact_external_id?: string`\n\n- `contact_id?: string`\n\n- `currency?: string`\n\n- `external_id?: string`\n\n- `notes?: string`\n\n- `slip_type?: string`\n\n- `start_date?: string`\n\n- `status?: string`\n\n- `tax_inclusive?: boolean`\n\n- `tax_option?: string`\n\n- `tax_rate?: number`\n\n- `total_price?: number`\n\n- `total_price_without_tax?: number`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; slip_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `slip_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst slipResponse = await client.public.slips.create();\n\nconsole.log(slipResponse);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/slips/{slip_id}',
    httpMethod: 'get',
    summary: 'Get Slip',
    description: 'Get Slip',
    stainlessPath: '(resource) public.slips > (method) retrieve',
    qualified: 'client.public.slips.retrieve',
    params: [
      'slip_id: string;',
      'external_id?: string;',
      'lang?: string;',
      'language?: string;',
      'Accept-Language?: string;',
    ],
    response:
      '{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; due_date?: string; id_slip?: number; slip_type?: string; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }',
    markdown:
      "## retrieve\n\n`client.public.slips.retrieve(slip_id: string, external_id?: string, lang?: string, language?: string, Accept-Language?: string): { created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; due_date?: string; id_slip?: number; slip_type?: string; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }`\n\n**get** `/v1/public/slips/{slip_id}`\n\nGet Slip\n\n### Parameters\n\n- `slip_id: string`\n\n- `external_id?: string`\n\n- `lang?: string`\n\n- `language?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; due_date?: string; id_slip?: number; slip_type?: string; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }`\n\n  - `created_at: string`\n  - `updated_at: string`\n  - `company_name?: string`\n  - `contact_name?: string`\n  - `currency?: string`\n  - `due_date?: string`\n  - `id_slip?: number`\n  - `slip_type?: string`\n  - `start_date?: string`\n  - `status?: string`\n  - `total_price?: number`\n  - `total_price_without_tax?: number`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst slip = await client.public.slips.retrieve('slip_id');\n\nconsole.log(slip);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/slips/{slip_id}',
    httpMethod: 'put',
    summary: 'Update Slip',
    description: 'Update Slip',
    stainlessPath: '(resource) public.slips > (method) update',
    qualified: 'client.public.slips.update',
    params: [
      'slip_id: string;',
      'company_external_id?: string;',
      'company_id?: string;',
      'contact_external_id?: string;',
      'contact_id?: string;',
      'currency?: string;',
      'external_id?: string;',
      'notes?: string;',
      'slip_type?: string;',
      'start_date?: string;',
      'status?: string;',
      'tax_inclusive?: boolean;',
      'tax_option?: string;',
      'tax_rate?: number;',
      'total_price?: number;',
      'total_price_without_tax?: number;',
    ],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; slip_id?: string; }',
    markdown:
      "## update\n\n`client.public.slips.update(slip_id: string, company_external_id?: string, company_id?: string, contact_external_id?: string, contact_id?: string, currency?: string, external_id?: string, notes?: string, slip_type?: string, start_date?: string, status?: string, tax_inclusive?: boolean, tax_option?: string, tax_rate?: number, total_price?: number, total_price_without_tax?: number): { ok: boolean; status: string; ctx_id?: string; external_id?: string; slip_id?: string; }`\n\n**put** `/v1/public/slips/{slip_id}`\n\nUpdate Slip\n\n### Parameters\n\n- `slip_id: string`\n\n- `company_external_id?: string`\n\n- `company_id?: string`\n\n- `contact_external_id?: string`\n\n- `contact_id?: string`\n\n- `currency?: string`\n\n- `external_id?: string`\n\n- `notes?: string`\n\n- `slip_type?: string`\n\n- `start_date?: string`\n\n- `status?: string`\n\n- `tax_inclusive?: boolean`\n\n- `tax_option?: string`\n\n- `tax_rate?: number`\n\n- `total_price?: number`\n\n- `total_price_without_tax?: number`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; slip_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `slip_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst slipResponse = await client.public.slips.update('slip_id');\n\nconsole.log(slipResponse);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/slips',
    httpMethod: 'get',
    summary: 'List Slips',
    description: 'List Slips',
    stainlessPath: '(resource) public.slips > (method) list',
    qualified: 'client.public.slips.list',
    params: ['lang?: string;', 'language?: string;', 'workspace_id?: string;', 'Accept-Language?: string;'],
    response:
      '{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; due_date?: string; id_slip?: number; slip_type?: string; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }[]',
    markdown:
      "## list\n\n`client.public.slips.list(lang?: string, language?: string, workspace_id?: string, Accept-Language?: string): object[]`\n\n**get** `/v1/public/slips`\n\nList Slips\n\n### Parameters\n\n- `lang?: string`\n\n- `language?: string`\n\n- `workspace_id?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; due_date?: string; id_slip?: number; slip_type?: string; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst slips = await client.public.slips.list();\n\nconsole.log(slips);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/slips/{slip_id}',
    httpMethod: 'delete',
    summary: 'Delete Slip',
    description: 'Delete Slip',
    stainlessPath: '(resource) public.slips > (method) delete',
    qualified: 'client.public.slips.delete',
    params: ['slip_id: string;', 'external_id?: string;'],
    response: '{ ok: boolean; status: string; ctx_id?: string; external_id?: string; slip_id?: string; }',
    markdown:
      "## delete\n\n`client.public.slips.delete(slip_id: string, external_id?: string): { ok: boolean; status: string; ctx_id?: string; external_id?: string; slip_id?: string; }`\n\n**delete** `/v1/public/slips/{slip_id}`\n\nDelete Slip\n\n### Parameters\n\n- `slip_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; external_id?: string; slip_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n  - `slip_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst slipResponse = await client.public.slips.delete('slip_id');\n\nconsole.log(slipResponse);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/bills',
    httpMethod: 'post',
    summary: 'Create Bill',
    description: 'Create Bill',
    stainlessPath: '(resource) public.bills > (method) create',
    qualified: 'client.public.bills.create',
    params: [
      'amount?: number;',
      'amount_without_tax?: number;',
      'company_external_id?: string;',
      'company_id?: string;',
      'contact_external_id?: string;',
      'contact_id?: string;',
      'currency?: string;',
      'description?: string;',
      'due_date?: string;',
      'external_id?: string;',
      'issued_date?: string;',
      'notes?: string;',
      'payment_date?: string;',
      'status?: string;',
      'tax_inclusive?: boolean;',
      'tax_option?: string;',
      'tax_rate?: number;',
    ],
    response: '{ ok: boolean; status: string; bill_id?: string; ctx_id?: string; external_id?: string; }',
    markdown:
      "## create\n\n`client.public.bills.create(amount?: number, amount_without_tax?: number, company_external_id?: string, company_id?: string, contact_external_id?: string, contact_id?: string, currency?: string, description?: string, due_date?: string, external_id?: string, issued_date?: string, notes?: string, payment_date?: string, status?: string, tax_inclusive?: boolean, tax_option?: string, tax_rate?: number): { ok: boolean; status: string; bill_id?: string; ctx_id?: string; external_id?: string; }`\n\n**post** `/v1/public/bills`\n\nCreate Bill\n\n### Parameters\n\n- `amount?: number`\n\n- `amount_without_tax?: number`\n\n- `company_external_id?: string`\n\n- `company_id?: string`\n\n- `contact_external_id?: string`\n\n- `contact_id?: string`\n\n- `currency?: string`\n\n- `description?: string`\n\n- `due_date?: string`\n\n- `external_id?: string`\n\n- `issued_date?: string`\n\n- `notes?: string`\n\n- `payment_date?: string`\n\n- `status?: string`\n\n- `tax_inclusive?: boolean`\n\n- `tax_option?: string`\n\n- `tax_rate?: number`\n\n### Returns\n\n- `{ ok: boolean; status: string; bill_id?: string; ctx_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `bill_id?: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicBillResponse = await client.public.bills.create();\n\nconsole.log(publicBillResponse);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/bills/{bill_id}',
    httpMethod: 'get',
    summary: 'Get Bill',
    description: 'Get Bill',
    stainlessPath: '(resource) public.bills > (method) retrieve',
    qualified: 'client.public.bills.retrieve',
    params: [
      'bill_id: string;',
      'external_id?: string;',
      'lang?: string;',
      'language?: string;',
      'Accept-Language?: string;',
    ],
    response:
      '{ created_at: string; amount?: number; amount_without_tax?: number; company_name?: string; contact_name?: string; currency?: string; due_date?: string; id_bill?: number; issued_date?: string; payment_date?: string; status?: string; updated_at?: string; }',
    markdown:
      "## retrieve\n\n`client.public.bills.retrieve(bill_id: string, external_id?: string, lang?: string, language?: string, Accept-Language?: string): { created_at: string; amount?: number; amount_without_tax?: number; company_name?: string; contact_name?: string; currency?: string; due_date?: string; id_bill?: number; issued_date?: string; payment_date?: string; status?: string; updated_at?: string; }`\n\n**get** `/v1/public/bills/{bill_id}`\n\nGet Bill\n\n### Parameters\n\n- `bill_id: string`\n\n- `external_id?: string`\n\n- `lang?: string`\n\n- `language?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; amount?: number; amount_without_tax?: number; company_name?: string; contact_name?: string; currency?: string; due_date?: string; id_bill?: number; issued_date?: string; payment_date?: string; status?: string; updated_at?: string; }`\n\n  - `created_at: string`\n  - `amount?: number`\n  - `amount_without_tax?: number`\n  - `company_name?: string`\n  - `contact_name?: string`\n  - `currency?: string`\n  - `due_date?: string`\n  - `id_bill?: number`\n  - `issued_date?: string`\n  - `payment_date?: string`\n  - `status?: string`\n  - `updated_at?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst bill = await client.public.bills.retrieve('bill_id');\n\nconsole.log(bill);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/bills/{bill_id}',
    httpMethod: 'put',
    summary: 'Update Bill',
    description: 'Update Bill',
    stainlessPath: '(resource) public.bills > (method) update',
    qualified: 'client.public.bills.update',
    params: [
      'bill_id: string;',
      'amount?: number;',
      'amount_without_tax?: number;',
      'company_external_id?: string;',
      'company_id?: string;',
      'contact_external_id?: string;',
      'contact_id?: string;',
      'currency?: string;',
      'description?: string;',
      'due_date?: string;',
      'external_id?: string;',
      'issued_date?: string;',
      'notes?: string;',
      'payment_date?: string;',
      'status?: string;',
      'tax_inclusive?: boolean;',
      'tax_option?: string;',
      'tax_rate?: number;',
    ],
    response: '{ ok: boolean; status: string; bill_id?: string; ctx_id?: string; external_id?: string; }',
    markdown:
      "## update\n\n`client.public.bills.update(bill_id: string, amount?: number, amount_without_tax?: number, company_external_id?: string, company_id?: string, contact_external_id?: string, contact_id?: string, currency?: string, description?: string, due_date?: string, external_id?: string, issued_date?: string, notes?: string, payment_date?: string, status?: string, tax_inclusive?: boolean, tax_option?: string, tax_rate?: number): { ok: boolean; status: string; bill_id?: string; ctx_id?: string; external_id?: string; }`\n\n**put** `/v1/public/bills/{bill_id}`\n\nUpdate Bill\n\n### Parameters\n\n- `bill_id: string`\n\n- `amount?: number`\n\n- `amount_without_tax?: number`\n\n- `company_external_id?: string`\n\n- `company_id?: string`\n\n- `contact_external_id?: string`\n\n- `contact_id?: string`\n\n- `currency?: string`\n\n- `description?: string`\n\n- `due_date?: string`\n\n- `external_id?: string`\n\n- `issued_date?: string`\n\n- `notes?: string`\n\n- `payment_date?: string`\n\n- `status?: string`\n\n- `tax_inclusive?: boolean`\n\n- `tax_option?: string`\n\n- `tax_rate?: number`\n\n### Returns\n\n- `{ ok: boolean; status: string; bill_id?: string; ctx_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `bill_id?: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicBillResponse = await client.public.bills.update('bill_id');\n\nconsole.log(publicBillResponse);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/bills',
    httpMethod: 'get',
    summary: 'List Bills',
    description: 'List Bills',
    stainlessPath: '(resource) public.bills > (method) list',
    qualified: 'client.public.bills.list',
    params: ['lang?: string;', 'language?: string;', 'workspace_id?: string;', 'Accept-Language?: string;'],
    response:
      '{ created_at: string; amount?: number; amount_without_tax?: number; company_name?: string; contact_name?: string; currency?: string; due_date?: string; id_bill?: number; issued_date?: string; payment_date?: string; status?: string; updated_at?: string; }[]',
    markdown:
      "## list\n\n`client.public.bills.list(lang?: string, language?: string, workspace_id?: string, Accept-Language?: string): object[]`\n\n**get** `/v1/public/bills`\n\nList Bills\n\n### Parameters\n\n- `lang?: string`\n\n- `language?: string`\n\n- `workspace_id?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; amount?: number; amount_without_tax?: number; company_name?: string; contact_name?: string; currency?: string; due_date?: string; id_bill?: number; issued_date?: string; payment_date?: string; status?: string; updated_at?: string; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst bills = await client.public.bills.list();\n\nconsole.log(bills);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/bills/{bill_id}',
    httpMethod: 'delete',
    summary: 'Delete Bill',
    description: 'Delete Bill',
    stainlessPath: '(resource) public.bills > (method) delete',
    qualified: 'client.public.bills.delete',
    params: ['bill_id: string;', 'external_id?: string;'],
    response: '{ ok: boolean; status: string; bill_id?: string; ctx_id?: string; external_id?: string; }',
    markdown:
      "## delete\n\n`client.public.bills.delete(bill_id: string, external_id?: string): { ok: boolean; status: string; bill_id?: string; ctx_id?: string; external_id?: string; }`\n\n**delete** `/v1/public/bills/{bill_id}`\n\nDelete Bill\n\n### Parameters\n\n- `bill_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; bill_id?: string; ctx_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `bill_id?: string`\n  - `ctx_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicBillResponse = await client.public.bills.delete('bill_id');\n\nconsole.log(publicBillResponse);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/disbursements',
    httpMethod: 'post',
    summary: 'Create Disbursement',
    description: 'Create Disbursement',
    stainlessPath: '(resource) public.disbursements > (method) create',
    qualified: 'client.public.disbursements.create',
    params: [
      'company_external_id?: string;',
      'company_id?: string;',
      'contact_external_id?: string;',
      'contact_id?: string;',
      'currency?: string;',
      'external_id?: string;',
      'fee?: number;',
      'notes?: string;',
      'start_date?: string;',
      'status?: string;',
      'tax_inclusive?: boolean;',
      'tax_option?: string;',
      'tax_rate?: number;',
      'total_price?: number;',
      'total_price_without_tax?: number;',
    ],
    response:
      '{ ok: boolean; status: string; ctx_id?: string; disbursement_id?: string; external_id?: string; }',
    markdown:
      "## create\n\n`client.public.disbursements.create(company_external_id?: string, company_id?: string, contact_external_id?: string, contact_id?: string, currency?: string, external_id?: string, fee?: number, notes?: string, start_date?: string, status?: string, tax_inclusive?: boolean, tax_option?: string, tax_rate?: number, total_price?: number, total_price_without_tax?: number): { ok: boolean; status: string; ctx_id?: string; disbursement_id?: string; external_id?: string; }`\n\n**post** `/v1/public/disbursements`\n\nCreate Disbursement\n\n### Parameters\n\n- `company_external_id?: string`\n\n- `company_id?: string`\n\n- `contact_external_id?: string`\n\n- `contact_id?: string`\n\n- `currency?: string`\n\n- `external_id?: string`\n\n- `fee?: number`\n\n- `notes?: string`\n\n- `start_date?: string`\n\n- `status?: string`\n\n- `tax_inclusive?: boolean`\n\n- `tax_option?: string`\n\n- `tax_rate?: number`\n\n- `total_price?: number`\n\n- `total_price_without_tax?: number`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; disbursement_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `disbursement_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicDisbursementResponse = await client.public.disbursements.create();\n\nconsole.log(publicDisbursementResponse);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/disbursements/{disbursement_id}',
    httpMethod: 'get',
    summary: 'Get Disbursement',
    description: 'Get Disbursement',
    stainlessPath: '(resource) public.disbursements > (method) retrieve',
    qualified: 'client.public.disbursements.retrieve',
    params: [
      'disbursement_id: string;',
      'external_id?: string;',
      'lang?: string;',
      'language?: string;',
      'Accept-Language?: string;',
    ],
    response:
      '{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; id_dsb?: number; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }',
    markdown:
      "## retrieve\n\n`client.public.disbursements.retrieve(disbursement_id: string, external_id?: string, lang?: string, language?: string, Accept-Language?: string): { created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; id_dsb?: number; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }`\n\n**get** `/v1/public/disbursements/{disbursement_id}`\n\nGet Disbursement\n\n### Parameters\n\n- `disbursement_id: string`\n\n- `external_id?: string`\n\n- `lang?: string`\n\n- `language?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; id_dsb?: number; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }`\n\n  - `created_at: string`\n  - `updated_at: string`\n  - `company_name?: string`\n  - `contact_name?: string`\n  - `currency?: string`\n  - `id_dsb?: number`\n  - `start_date?: string`\n  - `status?: string`\n  - `total_price?: number`\n  - `total_price_without_tax?: number`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst disbursement = await client.public.disbursements.retrieve('disbursement_id');\n\nconsole.log(disbursement);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/disbursements/{disbursement_id}',
    httpMethod: 'put',
    summary: 'Update Disbursement',
    description: 'Update Disbursement',
    stainlessPath: '(resource) public.disbursements > (method) update',
    qualified: 'client.public.disbursements.update',
    params: [
      'disbursement_id: string;',
      'company_external_id?: string;',
      'company_id?: string;',
      'contact_external_id?: string;',
      'contact_id?: string;',
      'currency?: string;',
      'external_id?: string;',
      'fee?: number;',
      'notes?: string;',
      'start_date?: string;',
      'status?: string;',
      'tax_inclusive?: boolean;',
      'tax_option?: string;',
      'tax_rate?: number;',
      'total_price?: number;',
      'total_price_without_tax?: number;',
    ],
    response:
      '{ ok: boolean; status: string; ctx_id?: string; disbursement_id?: string; external_id?: string; }',
    markdown:
      "## update\n\n`client.public.disbursements.update(disbursement_id: string, company_external_id?: string, company_id?: string, contact_external_id?: string, contact_id?: string, currency?: string, external_id?: string, fee?: number, notes?: string, start_date?: string, status?: string, tax_inclusive?: boolean, tax_option?: string, tax_rate?: number, total_price?: number, total_price_without_tax?: number): { ok: boolean; status: string; ctx_id?: string; disbursement_id?: string; external_id?: string; }`\n\n**put** `/v1/public/disbursements/{disbursement_id}`\n\nUpdate Disbursement\n\n### Parameters\n\n- `disbursement_id: string`\n\n- `company_external_id?: string`\n\n- `company_id?: string`\n\n- `contact_external_id?: string`\n\n- `contact_id?: string`\n\n- `currency?: string`\n\n- `external_id?: string`\n\n- `fee?: number`\n\n- `notes?: string`\n\n- `start_date?: string`\n\n- `status?: string`\n\n- `tax_inclusive?: boolean`\n\n- `tax_option?: string`\n\n- `tax_rate?: number`\n\n- `total_price?: number`\n\n- `total_price_without_tax?: number`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; disbursement_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `disbursement_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicDisbursementResponse = await client.public.disbursements.update('disbursement_id');\n\nconsole.log(publicDisbursementResponse);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/disbursements',
    httpMethod: 'get',
    summary: 'List Disbursements',
    description: 'List Disbursements',
    stainlessPath: '(resource) public.disbursements > (method) list',
    qualified: 'client.public.disbursements.list',
    params: ['lang?: string;', 'language?: string;', 'workspace_id?: string;', 'Accept-Language?: string;'],
    response:
      '{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; id_dsb?: number; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }[]',
    markdown:
      "## list\n\n`client.public.disbursements.list(lang?: string, language?: string, workspace_id?: string, Accept-Language?: string): object[]`\n\n**get** `/v1/public/disbursements`\n\nList Disbursements\n\n### Parameters\n\n- `lang?: string`\n\n- `language?: string`\n\n- `workspace_id?: string`\n\n- `Accept-Language?: string`\n\n### Returns\n\n- `{ created_at: string; updated_at: string; company_name?: string; contact_name?: string; currency?: string; id_dsb?: number; start_date?: string; status?: string; total_price?: number; total_price_without_tax?: number; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst disbursements = await client.public.disbursements.list();\n\nconsole.log(disbursements);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/disbursements/{disbursement_id}',
    httpMethod: 'delete',
    summary: 'Delete Disbursement',
    description: 'Delete Disbursement',
    stainlessPath: '(resource) public.disbursements > (method) delete',
    qualified: 'client.public.disbursements.delete',
    params: ['disbursement_id: string;', 'external_id?: string;'],
    response:
      '{ ok: boolean; status: string; ctx_id?: string; disbursement_id?: string; external_id?: string; }',
    markdown:
      "## delete\n\n`client.public.disbursements.delete(disbursement_id: string, external_id?: string): { ok: boolean; status: string; ctx_id?: string; disbursement_id?: string; external_id?: string; }`\n\n**delete** `/v1/public/disbursements/{disbursement_id}`\n\nDelete Disbursement\n\n### Parameters\n\n- `disbursement_id: string`\n\n- `external_id?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; disbursement_id?: string; external_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `disbursement_id?: string`\n  - `external_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicDisbursementResponse = await client.public.disbursements.delete('disbursement_id');\n\nconsole.log(publicDisbursementResponse);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/reports',
    httpMethod: 'post',
    summary: 'Create Report',
    description: 'Create Report',
    stainlessPath: '(resource) public.reports > (method) create',
    qualified: 'client.public.reports.create',
    params: [
      'reportMetadata: { name: string; reportType: { type: string; }; description?: string; detailColumns?: string[]; groupingsAcross?: string[]; groupingsDown?: string[]; reportFilters?: { filters?: { filter_operator: string; filter_select: string; filter_input?: object[]; filter_source?: string; filter_type?: string; }[]; }; reportFormat?: string; };',
      'createDefaultPanel?: boolean;',
      'panels?: { breakdown?: string; dataSource?: string; dataSources?: string[]; dataSourceType?: string; description?: string; filter?: object; heightPx?: number; metaData?: object; metrics?: { metric: string; dataSource?: string; displayResult?: string; filter?: object; metaData?: object; metricType?: string; name?: string; order?: number; rawSql?: string; role?: string; sort?: string; }[]; name?: string; order?: number; panelType?: string; ratio?: number; typeObjects?: string[]; widthUnits?: number; }[];',
    ],
    response:
      '{ ok: boolean; status: string; ctx_id?: string; report_extended_metadata?: object; report_id?: string; report_metadata?: object; }',
    markdown:
      "## create\n\n`client.public.reports.create(reportMetadata: { name: string; reportType: object; description?: string; detailColumns?: string[]; groupingsAcross?: string[]; groupingsDown?: string[]; reportFilters?: object; reportFormat?: string; }, createDefaultPanel?: boolean, panels?: { breakdown?: string; dataSource?: string; dataSources?: string[]; dataSourceType?: string; description?: string; filter?: object; heightPx?: number; metaData?: object; metrics?: object[]; name?: string; order?: number; panelType?: string; ratio?: number; typeObjects?: string[]; widthUnits?: number; }[]): { ok: boolean; status: string; ctx_id?: string; report_extended_metadata?: object; report_id?: string; report_metadata?: object; }`\n\n**post** `/v1/public/reports`\n\nCreate Report\n\n### Parameters\n\n- `reportMetadata: { name: string; reportType: { type: string; }; description?: string; detailColumns?: string[]; groupingsAcross?: string[]; groupingsDown?: string[]; reportFilters?: { filters?: { filter_operator: string; filter_select: string; filter_input?: object[]; filter_source?: string; filter_type?: string; }[]; }; reportFormat?: string; }`\n  - `name: string`\n  - `reportType: { type: string; }`\n  - `description?: string`\n  - `detailColumns?: string[]`\n  - `groupingsAcross?: string[]`\n  - `groupingsDown?: string[]`\n  - `reportFilters?: { filters?: { filter_operator: string; filter_select: string; filter_input?: { value: object; }[]; filter_source?: string; filter_type?: string; }[]; }`\n  - `reportFormat?: string`\n\n- `createDefaultPanel?: boolean`\n\n- `panels?: { breakdown?: string; dataSource?: string; dataSources?: string[]; dataSourceType?: string; description?: string; filter?: object; heightPx?: number; metaData?: object; metrics?: { metric: string; dataSource?: string; displayResult?: string; filter?: object; metaData?: object; metricType?: string; name?: string; order?: number; rawSql?: string; role?: string; sort?: string; }[]; name?: string; order?: number; panelType?: string; ratio?: number; typeObjects?: string[]; widthUnits?: number; }[]`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; report_extended_metadata?: object; report_id?: string; report_metadata?: object; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `report_extended_metadata?: object`\n  - `report_id?: string`\n  - `report_metadata?: object`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst createReport = await client.public.reports.create({ reportMetadata: {\n  name: 'name',\n  reportType: { type: 'type' },\n} });\n\nconsole.log(createReport);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/reports/{report_id}',
    httpMethod: 'get',
    summary: 'Get Report',
    description: 'Get Report',
    stainlessPath: '(resource) public.reports > (method) retrieve',
    qualified: 'client.public.reports.retrieve',
    params: ['report_id: string;', 'workspace_id?: string;'],
    response:
      '{ id: string; created_at: string; updated_at: string; description?: string; name?: string; panel_count?: number; panels?: { id: string; created_at: string; order: number; updated_at: string; breakdown?: string; data_source?: string; data_source_type?: string; description?: string; filter?: object; height_px?: number; meta_data?: object; metrics?: { id: string; data_source?: string; filter?: object; meta_data?: object; metric?: string; metric_type?: string; name?: string; order?: number; role?: string; sort?: string; }[]; name?: string; panel_type?: string; ratio?: number; type_objects?: string; width_units?: number; }[]; report_type?: string; }',
    markdown:
      "## retrieve\n\n`client.public.reports.retrieve(report_id: string, workspace_id?: string): { id: string; created_at: string; updated_at: string; description?: string; name?: string; panel_count?: number; panels?: object[]; report_type?: string; }`\n\n**get** `/v1/public/reports/{report_id}`\n\nGet Report\n\n### Parameters\n\n- `report_id: string`\n\n- `workspace_id?: string`\n\n### Returns\n\n- `{ id: string; created_at: string; updated_at: string; description?: string; name?: string; panel_count?: number; panels?: { id: string; created_at: string; order: number; updated_at: string; breakdown?: string; data_source?: string; data_source_type?: string; description?: string; filter?: object; height_px?: number; meta_data?: object; metrics?: { id: string; data_source?: string; filter?: object; meta_data?: object; metric?: string; metric_type?: string; name?: string; order?: number; role?: string; sort?: string; }[]; name?: string; panel_type?: string; ratio?: number; type_objects?: string; width_units?: number; }[]; report_type?: string; }`\n\n  - `id: string`\n  - `created_at: string`\n  - `updated_at: string`\n  - `description?: string`\n  - `name?: string`\n  - `panel_count?: number`\n  - `panels?: { id: string; created_at: string; order: number; updated_at: string; breakdown?: string; data_source?: string; data_source_type?: string; description?: string; filter?: object; height_px?: number; meta_data?: object; metrics?: { id: string; data_source?: string; filter?: object; meta_data?: object; metric?: string; metric_type?: string; name?: string; order?: number; role?: string; sort?: string; }[]; name?: string; panel_type?: string; ratio?: number; type_objects?: string; width_units?: number; }[]`\n  - `report_type?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst report = await client.public.reports.retrieve('report_id');\n\nconsole.log(report);\n```",
  },
  {
    name: 'update',
    endpoint: '/v1/public/reports/{report_id}',
    httpMethod: 'put',
    summary: 'Update Report',
    description: 'Update Report',
    stainlessPath: '(resource) public.reports > (method) update',
    qualified: 'client.public.reports.update',
    params: [
      'report_id: string;',
      'workspace_id?: string;',
      'createDefaultPanel?: boolean;',
      'panels?: { breakdown?: string; dataSource?: string; dataSources?: string[]; dataSourceType?: string; description?: string; filter?: object; heightPx?: number; metaData?: object; metrics?: { metric: string; dataSource?: string; displayResult?: string; filter?: object; metaData?: object; metricType?: string; name?: string; order?: number; rawSql?: string; role?: string; sort?: string; }[]; name?: string; order?: number; panelType?: string; ratio?: number; typeObjects?: string[]; widthUnits?: number; }[];',
      'reportMetadata?: { description?: string; detailColumns?: string[]; groupingsAcross?: string[]; groupingsDown?: string[]; name?: string; reportFilters?: { filters?: { filter_operator: string; filter_select: string; filter_input?: object[]; filter_source?: string; filter_type?: string; }[]; }; reportFormat?: string; reportType?: { type: string; }; };',
    ],
    response:
      '{ ok: boolean; status: string; ctx_id?: string; report_extended_metadata?: object; report_id?: string; report_metadata?: object; }',
    markdown:
      "## update\n\n`client.public.reports.update(report_id: string, workspace_id?: string, createDefaultPanel?: boolean, panels?: { breakdown?: string; dataSource?: string; dataSources?: string[]; dataSourceType?: string; description?: string; filter?: object; heightPx?: number; metaData?: object; metrics?: object[]; name?: string; order?: number; panelType?: string; ratio?: number; typeObjects?: string[]; widthUnits?: number; }[], reportMetadata?: { description?: string; detailColumns?: string[]; groupingsAcross?: string[]; groupingsDown?: string[]; name?: string; reportFilters?: object; reportFormat?: string; reportType?: object; }): { ok: boolean; status: string; ctx_id?: string; report_extended_metadata?: object; report_id?: string; report_metadata?: object; }`\n\n**put** `/v1/public/reports/{report_id}`\n\nUpdate Report\n\n### Parameters\n\n- `report_id: string`\n\n- `workspace_id?: string`\n\n- `createDefaultPanel?: boolean`\n\n- `panels?: { breakdown?: string; dataSource?: string; dataSources?: string[]; dataSourceType?: string; description?: string; filter?: object; heightPx?: number; metaData?: object; metrics?: { metric: string; dataSource?: string; displayResult?: string; filter?: object; metaData?: object; metricType?: string; name?: string; order?: number; rawSql?: string; role?: string; sort?: string; }[]; name?: string; order?: number; panelType?: string; ratio?: number; typeObjects?: string[]; widthUnits?: number; }[]`\n\n- `reportMetadata?: { description?: string; detailColumns?: string[]; groupingsAcross?: string[]; groupingsDown?: string[]; name?: string; reportFilters?: { filters?: { filter_operator: string; filter_select: string; filter_input?: object[]; filter_source?: string; filter_type?: string; }[]; }; reportFormat?: string; reportType?: { type: string; }; }`\n  - `description?: string`\n  - `detailColumns?: string[]`\n  - `groupingsAcross?: string[]`\n  - `groupingsDown?: string[]`\n  - `name?: string`\n  - `reportFilters?: { filters?: { filter_operator: string; filter_select: string; filter_input?: { value: object; }[]; filter_source?: string; filter_type?: string; }[]; }`\n  - `reportFormat?: string`\n  - `reportType?: { type: string; }`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; report_extended_metadata?: object; report_id?: string; report_metadata?: object; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `report_extended_metadata?: object`\n  - `report_id?: string`\n  - `report_metadata?: object`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst createReport = await client.public.reports.update('report_id');\n\nconsole.log(createReport);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/reports',
    httpMethod: 'get',
    summary: 'List Reports',
    description: 'List Reports',
    stainlessPath: '(resource) public.reports > (method) list',
    qualified: 'client.public.reports.list',
    params: ['workspace_id?: string;'],
    response:
      '{ id: string; created_at: string; updated_at: string; description?: string; name?: string; panel_count?: number; report_type?: string; }[]',
    markdown:
      "## list\n\n`client.public.reports.list(workspace_id?: string): { id: string; created_at: string; updated_at: string; description?: string; name?: string; panel_count?: number; report_type?: string; }[]`\n\n**get** `/v1/public/reports`\n\nList Reports\n\n### Parameters\n\n- `workspace_id?: string`\n\n### Returns\n\n- `{ id: string; created_at: string; updated_at: string; description?: string; name?: string; panel_count?: number; report_type?: string; }[]`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst reports = await client.public.reports.list();\n\nconsole.log(reports);\n```",
  },
  {
    name: 'delete',
    endpoint: '/v1/public/reports/{report_id}',
    httpMethod: 'delete',
    summary: 'Delete Report',
    description: 'Delete Report',
    stainlessPath: '(resource) public.reports > (method) delete',
    qualified: 'client.public.reports.delete',
    params: ['report_id: string;', 'workspace_id?: string;'],
    response: '{ ok: boolean; status: string; ctx_id?: string; report_id?: string; }',
    markdown:
      "## delete\n\n`client.public.reports.delete(report_id: string, workspace_id?: string): { ok: boolean; status: string; ctx_id?: string; report_id?: string; }`\n\n**delete** `/v1/public/reports/{report_id}`\n\nDelete Report\n\n### Parameters\n\n- `report_id: string`\n\n- `workspace_id?: string`\n\n### Returns\n\n- `{ ok: boolean; status: string; ctx_id?: string; report_id?: string; }`\n\n  - `ok: boolean`\n  - `status: string`\n  - `ctx_id?: string`\n  - `report_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst report = await client.public.reports.delete('report_id');\n\nconsole.log(report);\n```",
  },
  {
    name: 'retrieve',
    endpoint: '/v1/public/workflows/{workflow_ref}',
    httpMethod: 'get',
    summary: 'Get Workflow',
    description: 'Get Workflow',
    stainlessPath: '(resource) public.workflows > (method) retrieve',
    qualified: 'client.public.workflows.retrieve',
    params: ['workflow_ref: string;'],
    response:
      '{ external_id: string; is_trigger_active: boolean; valid_to_run: boolean; workflow_id: string; ctx_id?: string; description?: string; nodes?: { id: string; is_base: boolean; valid_to_run: boolean; action_id?: string; action_slug?: string; action_uid?: string; condition_groups?: { id: string; operator: string; conditions?: object[]; parent_group_id?: string; }[]; cost_minutes?: number; input_data?: object; integration_id?: string; integration_slug?: string; predefined_input?: object; previous_output_data?: object; user_display_name?: string; }[]; status?: string; title?: string; trigger_every?: number; trigger_type?: string; }',
    markdown:
      "## retrieve\n\n`client.public.workflows.retrieve(workflow_ref: string): { external_id: string; is_trigger_active: boolean; valid_to_run: boolean; workflow_id: string; ctx_id?: string; description?: string; nodes?: object[]; status?: string; title?: string; trigger_every?: number; trigger_type?: string; }`\n\n**get** `/v1/public/workflows/{workflow_ref}`\n\nGet Workflow\n\n### Parameters\n\n- `workflow_ref: string`\n\n### Returns\n\n- `{ external_id: string; is_trigger_active: boolean; valid_to_run: boolean; workflow_id: string; ctx_id?: string; description?: string; nodes?: { id: string; is_base: boolean; valid_to_run: boolean; action_id?: string; action_slug?: string; action_uid?: string; condition_groups?: { id: string; operator: string; conditions?: object[]; parent_group_id?: string; }[]; cost_minutes?: number; input_data?: object; integration_id?: string; integration_slug?: string; predefined_input?: object; previous_output_data?: object; user_display_name?: string; }[]; status?: string; title?: string; trigger_every?: number; trigger_type?: string; }`\n\n  - `external_id: string`\n  - `is_trigger_active: boolean`\n  - `valid_to_run: boolean`\n  - `workflow_id: string`\n  - `ctx_id?: string`\n  - `description?: string`\n  - `nodes?: { id: string; is_base: boolean; valid_to_run: boolean; action_id?: string; action_slug?: string; action_uid?: string; condition_groups?: { id: string; operator: string; conditions?: { id: string; extra_condition?: object; field_name?: string; object_type?: string; operator?: string; record_ids?: string; record_source?: string; value_date?: string; value_datetime?: string; value_number?: number; value_text?: string; value_type?: string; }[]; parent_group_id?: string; }[]; cost_minutes?: number; input_data?: object; integration_id?: string; integration_slug?: string; predefined_input?: object; previous_output_data?: object; user_display_name?: string; }[]`\n  - `status?: string`\n  - `title?: string`\n  - `trigger_every?: number`\n  - `trigger_type?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst workflow = await client.public.workflows.retrieve('workflow_ref');\n\nconsole.log(workflow);\n```",
  },
  {
    name: 'list',
    endpoint: '/v1/public/workflows',
    httpMethod: 'get',
    summary: 'List Workflows',
    description: 'List Workflows',
    stainlessPath: '(resource) public.workflows > (method) list',
    qualified: 'client.public.workflows.list',
    params: ['limit?: number;', 'page?: number;'],
    response:
      '{ count: number; data: { external_id: string; is_trigger_active: boolean; valid_to_run: boolean; workflow_id: string; description?: string; status?: string; title?: string; trigger_every?: number; trigger_type?: string; updated_at?: string; }[]; limit: number; page: number; ctx_id?: string; }',
    markdown:
      "## list\n\n`client.public.workflows.list(limit?: number, page?: number): { count: number; data: object[]; limit: number; page: number; ctx_id?: string; }`\n\n**get** `/v1/public/workflows`\n\nList Workflows\n\n### Parameters\n\n- `limit?: number`\n\n- `page?: number`\n\n### Returns\n\n- `{ count: number; data: { external_id: string; is_trigger_active: boolean; valid_to_run: boolean; workflow_id: string; description?: string; status?: string; title?: string; trigger_every?: number; trigger_type?: string; updated_at?: string; }[]; limit: number; page: number; ctx_id?: string; }`\n\n  - `count: number`\n  - `data: { external_id: string; is_trigger_active: boolean; valid_to_run: boolean; workflow_id: string; description?: string; status?: string; title?: string; trigger_every?: number; trigger_type?: string; updated_at?: string; }[]`\n  - `limit: number`\n  - `page: number`\n  - `ctx_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst workflows = await client.public.workflows.list();\n\nconsole.log(workflows);\n```",
  },
  {
    name: 'create_or_update',
    endpoint: '/v1/public/workflows',
    httpMethod: 'post',
    summary: 'Create or Update Workflow',
    description: 'Create or Update Workflow',
    stainlessPath: '(resource) public.workflows > (method) create_or_update',
    qualified: 'client.public.workflows.createOrUpdate',
    params: [
      'config?: object;',
      'description?: string;',
      'external_id?: string;',
      'is_trigger_active?: boolean;',
      'nodes?: { id?: string; action_id?: string; action_slug?: string; action_uid?: string; condition_groups?: { id?: string; conditions?: { id?: string; extra_condition?: object; field_name?: string; object_type?: string; operator?: string; record_ids?: string; record_source?: string; value_date?: string; value_datetime?: string; value_number?: number; value_text?: string; value_type?: string; }[]; operator?: string; parent_group_id?: string; }[]; cost_minutes?: number; input_data?: object; integration_id?: string; integration_slug?: string; is_base?: boolean; predefined_input?: object; previous_output_data?: object; user_display_name?: string; valid_to_run?: boolean; }[];',
      'status?: string;',
      'title?: string;',
      'trigger_every?: number;',
      'trigger_type?: string;',
      'type?: string;',
    ],
    response:
      '{ external_id: string; node_count: number; ok: boolean; status: string; valid_to_run: boolean; workflow_id: string; ctx_id?: string; }',
    markdown:
      "## create_or_update\n\n`client.public.workflows.createOrUpdate(config?: object, description?: string, external_id?: string, is_trigger_active?: boolean, nodes?: { id?: string; action_id?: string; action_slug?: string; action_uid?: string; condition_groups?: { id?: string; conditions?: object[]; operator?: string; parent_group_id?: string; }[]; cost_minutes?: number; input_data?: object; integration_id?: string; integration_slug?: string; is_base?: boolean; predefined_input?: object; previous_output_data?: object; user_display_name?: string; valid_to_run?: boolean; }[], status?: string, title?: string, trigger_every?: number, trigger_type?: string, type?: string): { external_id: string; node_count: number; ok: boolean; status: string; valid_to_run: boolean; workflow_id: string; ctx_id?: string; }`\n\n**post** `/v1/public/workflows`\n\nCreate or Update Workflow\n\n### Parameters\n\n- `config?: object`\n\n- `description?: string`\n\n- `external_id?: string`\n\n- `is_trigger_active?: boolean`\n\n- `nodes?: { id?: string; action_id?: string; action_slug?: string; action_uid?: string; condition_groups?: { id?: string; conditions?: { id?: string; extra_condition?: object; field_name?: string; object_type?: string; operator?: string; record_ids?: string; record_source?: string; value_date?: string; value_datetime?: string; value_number?: number; value_text?: string; value_type?: string; }[]; operator?: string; parent_group_id?: string; }[]; cost_minutes?: number; input_data?: object; integration_id?: string; integration_slug?: string; is_base?: boolean; predefined_input?: object; previous_output_data?: object; user_display_name?: string; valid_to_run?: boolean; }[]`\n\n- `status?: string`\n\n- `title?: string`\n\n- `trigger_every?: number`\n\n- `trigger_type?: string`\n\n- `type?: string`\n\n### Returns\n\n- `{ external_id: string; node_count: number; ok: boolean; status: string; valid_to_run: boolean; workflow_id: string; ctx_id?: string; }`\n\n  - `external_id: string`\n  - `node_count: number`\n  - `ok: boolean`\n  - `status: string`\n  - `valid_to_run: boolean`\n  - `workflow_id: string`\n  - `ctx_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst response = await client.public.workflows.createOrUpdate();\n\nconsole.log(response);\n```",
  },
  {
    name: 'list_actions',
    endpoint: '/v1/public/workflows/actions',
    httpMethod: 'get',
    summary: 'List Public Workflow Actions',
    description: 'List Public Workflow Actions',
    stainlessPath: '(resource) public.workflows > (method) list_actions',
    qualified: 'client.public.workflows.listActions',
    response:
      '{ count: number; data: { action_uid: string; is_trigger: boolean; action_slug?: string; input_format?: object; output_format?: object; required_conditions?: object; title?: string; title_ja?: string; trigger_type?: string; }[]; ctx_id?: string; }',
    markdown:
      "## list_actions\n\n`client.public.workflows.listActions(): { count: number; data: object[]; ctx_id?: string; }`\n\n**get** `/v1/public/workflows/actions`\n\nList Public Workflow Actions\n\n### Returns\n\n- `{ count: number; data: { action_uid: string; is_trigger: boolean; action_slug?: string; input_format?: object; output_format?: object; required_conditions?: object; title?: string; title_ja?: string; trigger_type?: string; }[]; ctx_id?: string; }`\n\n  - `count: number`\n  - `data: { action_uid: string; is_trigger: boolean; action_slug?: string; input_format?: object; output_format?: object; required_conditions?: object; title?: string; title_ja?: string; trigger_type?: string; }[]`\n  - `ctx_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst response = await client.public.workflows.listActions();\n\nconsole.log(response);\n```",
  },
  {
    name: 'retrieve_run',
    endpoint: '/v1/public/workflows/runs/{run_id}',
    httpMethod: 'get',
    summary: 'Get Workflow Run',
    description: 'Get Workflow Run',
    stainlessPath: '(resource) public.workflows > (method) retrieve_run',
    qualified: 'client.public.workflows.retrieveRun',
    params: ['run_id: string;'],
    response:
      '{ data: { run_id: string; started_at: string; status: string; workflow_id: string; background_job_id?: string; completed_at?: string; workflow_history_id?: string; }; message: string; ctx_id?: string; }',
    markdown:
      "## retrieve_run\n\n`client.public.workflows.retrieveRun(run_id: string): { data: object; message: string; ctx_id?: string; }`\n\n**get** `/v1/public/workflows/runs/{run_id}`\n\nGet Workflow Run\n\n### Parameters\n\n- `run_id: string`\n\n### Returns\n\n- `{ data: { run_id: string; started_at: string; status: string; workflow_id: string; background_job_id?: string; completed_at?: string; workflow_history_id?: string; }; message: string; ctx_id?: string; }`\n\n  - `data: { run_id: string; started_at: string; status: string; workflow_id: string; background_job_id?: string; completed_at?: string; workflow_history_id?: string; }`\n  - `message: string`\n  - `ctx_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst workflowRunResponse = await client.public.workflows.retrieveRun('run_id');\n\nconsole.log(workflowRunResponse);\n```",
  },
  {
    name: 'run',
    endpoint: '/v1/public/workflows/{workflow_ref}/run',
    httpMethod: 'post',
    summary: 'Run Workflow',
    description: 'Run Workflow',
    stainlessPath: '(resource) public.workflows > (method) run',
    qualified: 'client.public.workflows.run',
    params: ['workflow_ref: string;'],
    response:
      '{ data: { run_id: string; started_at: string; status: string; workflow_id: string; background_job_id?: string; completed_at?: string; workflow_history_id?: string; }; message: string; ctx_id?: string; }',
    markdown:
      "## run\n\n`client.public.workflows.run(workflow_ref: string): { data: object; message: string; ctx_id?: string; }`\n\n**post** `/v1/public/workflows/{workflow_ref}/run`\n\nRun Workflow\n\n### Parameters\n\n- `workflow_ref: string`\n\n### Returns\n\n- `{ data: { run_id: string; started_at: string; status: string; workflow_id: string; background_job_id?: string; completed_at?: string; workflow_history_id?: string; }; message: string; ctx_id?: string; }`\n\n  - `data: { run_id: string; started_at: string; status: string; workflow_id: string; background_job_id?: string; completed_at?: string; workflow_history_id?: string; }`\n  - `message: string`\n  - `ctx_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst workflowRunResponse = await client.public.workflows.run('workflow_ref');\n\nconsole.log(workflowRunResponse);\n```",
  },
  {
    name: 'bootstrap',
    endpoint: '/v1/public/calendar/bootstrap',
    httpMethod: 'get',
    summary: 'Public Calendar Bootstrap',
    description: 'Public Calendar Bootstrap',
    stainlessPath: '(resource) public.calendar > (method) bootstrap',
    qualified: 'client.public.calendar.bootstrap',
    params: ['attendance_id?: string;', 'mode?: string;', 'slug?: string;', 'url?: string;'],
    response:
      '{ message: string; mode: string; status: string; attendance?: { id: string; calendar_event_id?: string; comment?: string; event_id?: string; link?: string; select_date?: string; time_event?: string; timezone?: string; user_email?: string; user_name?: string; }; ctx_id?: string; event?: { id: string; title: string; description?: string; duration?: string; location?: string; schedule?: { day_index: number; day_name: string; enabled?: boolean; slots?: object[]; }[]; slug?: string; status?: string; time_increment?: string; timezone?: string; timezone_label?: string; timezone_locked?: boolean; url?: string; }; workspace?: { id: string; name: string; short_id?: string; timezone?: string; }; }',
    markdown:
      "## bootstrap\n\n`client.public.calendar.bootstrap(attendance_id?: string, mode?: string, slug?: string, url?: string): { message: string; mode: string; status: string; attendance?: public_calendar_attendance; ctx_id?: string; event?: object; workspace?: object; }`\n\n**get** `/v1/public/calendar/bootstrap`\n\nPublic Calendar Bootstrap\n\n### Parameters\n\n- `attendance_id?: string`\n\n- `mode?: string`\n\n- `slug?: string`\n\n- `url?: string`\n\n### Returns\n\n- `{ message: string; mode: string; status: string; attendance?: { id: string; calendar_event_id?: string; comment?: string; event_id?: string; link?: string; select_date?: string; time_event?: string; timezone?: string; user_email?: string; user_name?: string; }; ctx_id?: string; event?: { id: string; title: string; description?: string; duration?: string; location?: string; schedule?: { day_index: number; day_name: string; enabled?: boolean; slots?: object[]; }[]; slug?: string; status?: string; time_increment?: string; timezone?: string; timezone_label?: string; timezone_locked?: boolean; url?: string; }; workspace?: { id: string; name: string; short_id?: string; timezone?: string; }; }`\n\n  - `message: string`\n  - `mode: string`\n  - `status: string`\n  - `attendance?: { id: string; calendar_event_id?: string; comment?: string; event_id?: string; link?: string; select_date?: string; time_event?: string; timezone?: string; user_email?: string; user_name?: string; }`\n  - `ctx_id?: string`\n  - `event?: { id: string; title: string; description?: string; duration?: string; location?: string; schedule?: { day_index: number; day_name: string; enabled?: boolean; slots?: { end: string; start: string; }[]; }[]; slug?: string; status?: string; time_increment?: string; timezone?: string; timezone_label?: string; timezone_locked?: boolean; url?: string; }`\n  - `workspace?: { id: string; name: string; short_id?: string; timezone?: string; }`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst response = await client.public.calendar.bootstrap();\n\nconsole.log(response);\n```",
  },
  {
    name: 'check_availability',
    endpoint: '/v1/public/calendar/availability',
    httpMethod: 'get',
    summary: 'Public Calendar Availability',
    description: 'Public Calendar Availability',
    stainlessPath: '(resource) public.calendar > (method) check_availability',
    qualified: 'client.public.calendar.checkAvailability',
    params: ['event_id: string;', 'start_date: string;', 'days?: number;', 'timezone?: string;'],
    response:
      '{ message: string; ctx_id?: string; days?: { date: string; day_index: number; weekday: string; slots?: string[]; }[]; timezone?: string; }',
    markdown:
      "## check_availability\n\n`client.public.calendar.checkAvailability(event_id: string, start_date: string, days?: number, timezone?: string): { message: string; ctx_id?: string; days?: object[]; timezone?: string; }`\n\n**get** `/v1/public/calendar/availability`\n\nPublic Calendar Availability\n\n### Parameters\n\n- `event_id: string`\n\n- `start_date: string`\n\n- `days?: number`\n\n- `timezone?: string`\n\n### Returns\n\n- `{ message: string; ctx_id?: string; days?: { date: string; day_index: number; weekday: string; slots?: string[]; }[]; timezone?: string; }`\n\n  - `message: string`\n  - `ctx_id?: string`\n  - `days?: { date: string; day_index: number; weekday: string; slots?: string[]; }[]`\n  - `timezone?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst response = await client.public.calendar.checkAvailability({ event_id: 'event_id', start_date: 'start_date' });\n\nconsole.log(response);\n```",
  },
  {
    name: 'create',
    endpoint: '/v1/public/calendar/attendance',
    httpMethod: 'post',
    summary: 'Public Calendar Create Attendance',
    description: 'Public Calendar Create Attendance',
    stainlessPath: '(resource) public.calendar.attendance > (method) create',
    qualified: 'client.public.calendar.attendance.create',
    params: [
      'date: string;',
      'email: string;',
      'event_id: string;',
      'name: string;',
      'time: string;',
      'comment?: string;',
      'timezone?: string;',
    ],
    response:
      '{ message: string; status: string; attendance?: { id: string; calendar_event_id?: string; comment?: string; event_id?: string; link?: string; select_date?: string; time_event?: string; timezone?: string; user_email?: string; user_name?: string; }; ctx_id?: string; meet_link?: string; ok?: boolean; }',
    markdown:
      "## create\n\n`client.public.calendar.attendance.create(date: string, email: string, event_id: string, name: string, time: string, comment?: string, timezone?: string): { message: string; status: string; attendance?: public_calendar_attendance; ctx_id?: string; meet_link?: string; ok?: boolean; }`\n\n**post** `/v1/public/calendar/attendance`\n\nPublic Calendar Create Attendance\n\n### Parameters\n\n- `date: string`\n\n- `email: string`\n\n- `event_id: string`\n\n- `name: string`\n\n- `time: string`\n\n- `comment?: string`\n\n- `timezone?: string`\n\n### Returns\n\n- `{ message: string; status: string; attendance?: { id: string; calendar_event_id?: string; comment?: string; event_id?: string; link?: string; select_date?: string; time_event?: string; timezone?: string; user_email?: string; user_name?: string; }; ctx_id?: string; meet_link?: string; ok?: boolean; }`\n\n  - `message: string`\n  - `status: string`\n  - `attendance?: { id: string; calendar_event_id?: string; comment?: string; event_id?: string; link?: string; select_date?: string; time_event?: string; timezone?: string; user_email?: string; user_name?: string; }`\n  - `ctx_id?: string`\n  - `meet_link?: string`\n  - `ok?: boolean`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicCalendarMutation = await client.public.calendar.attendance.create({\n  date: 'date',\n  email: 'email',\n  event_id: 'event_id',\n  name: 'name',\n  time: 'time',\n});\n\nconsole.log(publicCalendarMutation);\n```",
  },
  {
    name: 'cancel',
    endpoint: '/v1/public/calendar/attendance/{attendance_id}/cancel',
    httpMethod: 'post',
    summary: 'Public Calendar Cancel Attendance',
    description: 'Public Calendar Cancel Attendance',
    stainlessPath: '(resource) public.calendar.attendance > (method) cancel',
    qualified: 'client.public.calendar.attendance.cancel',
    params: ['attendance_id: string;'],
    response:
      '{ message: string; status: string; attendance?: { id: string; calendar_event_id?: string; comment?: string; event_id?: string; link?: string; select_date?: string; time_event?: string; timezone?: string; user_email?: string; user_name?: string; }; ctx_id?: string; meet_link?: string; ok?: boolean; }',
    markdown:
      "## cancel\n\n`client.public.calendar.attendance.cancel(attendance_id: string): { message: string; status: string; attendance?: public_calendar_attendance; ctx_id?: string; meet_link?: string; ok?: boolean; }`\n\n**post** `/v1/public/calendar/attendance/{attendance_id}/cancel`\n\nPublic Calendar Cancel Attendance\n\n### Parameters\n\n- `attendance_id: string`\n\n### Returns\n\n- `{ message: string; status: string; attendance?: { id: string; calendar_event_id?: string; comment?: string; event_id?: string; link?: string; select_date?: string; time_event?: string; timezone?: string; user_email?: string; user_name?: string; }; ctx_id?: string; meet_link?: string; ok?: boolean; }`\n\n  - `message: string`\n  - `status: string`\n  - `attendance?: { id: string; calendar_event_id?: string; comment?: string; event_id?: string; link?: string; select_date?: string; time_event?: string; timezone?: string; user_email?: string; user_name?: string; }`\n  - `ctx_id?: string`\n  - `meet_link?: string`\n  - `ok?: boolean`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicCalendarMutation = await client.public.calendar.attendance.cancel('attendance_id');\n\nconsole.log(publicCalendarMutation);\n```",
  },
  {
    name: 'reschedule',
    endpoint: '/v1/public/calendar/attendance/{attendance_id}/reschedule',
    httpMethod: 'post',
    summary: 'Public Calendar Reschedule Attendance',
    description: 'Public Calendar Reschedule Attendance',
    stainlessPath: '(resource) public.calendar.attendance > (method) reschedule',
    qualified: 'client.public.calendar.attendance.reschedule',
    params: [
      'attendance_id: string;',
      'date: string;',
      'time: string;',
      'comment?: string;',
      'email?: string;',
      'name?: string;',
      'timezone?: string;',
    ],
    response:
      '{ message: string; status: string; attendance?: { id: string; calendar_event_id?: string; comment?: string; event_id?: string; link?: string; select_date?: string; time_event?: string; timezone?: string; user_email?: string; user_name?: string; }; ctx_id?: string; meet_link?: string; ok?: boolean; }',
    markdown:
      "## reschedule\n\n`client.public.calendar.attendance.reschedule(attendance_id: string, date: string, time: string, comment?: string, email?: string, name?: string, timezone?: string): { message: string; status: string; attendance?: public_calendar_attendance; ctx_id?: string; meet_link?: string; ok?: boolean; }`\n\n**post** `/v1/public/calendar/attendance/{attendance_id}/reschedule`\n\nPublic Calendar Reschedule Attendance\n\n### Parameters\n\n- `attendance_id: string`\n\n- `date: string`\n\n- `time: string`\n\n- `comment?: string`\n\n- `email?: string`\n\n- `name?: string`\n\n- `timezone?: string`\n\n### Returns\n\n- `{ message: string; status: string; attendance?: { id: string; calendar_event_id?: string; comment?: string; event_id?: string; link?: string; select_date?: string; time_event?: string; timezone?: string; user_email?: string; user_name?: string; }; ctx_id?: string; meet_link?: string; ok?: boolean; }`\n\n  - `message: string`\n  - `status: string`\n  - `attendance?: { id: string; calendar_event_id?: string; comment?: string; event_id?: string; link?: string; select_date?: string; time_event?: string; timezone?: string; user_email?: string; user_name?: string; }`\n  - `ctx_id?: string`\n  - `meet_link?: string`\n  - `ok?: boolean`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst publicCalendarMutation = await client.public.calendar.attendance.reschedule('attendance_id', { date: 'date', time: 'time' });\n\nconsole.log(publicCalendarMutation);\n```",
  },
  {
    name: 'get_current_identity',
    endpoint: '/v1/public/auth/whoami',
    httpMethod: 'get',
    summary: 'Get Current Public Auth Identity',
    description: 'Get Current Public Auth Identity',
    stainlessPath: '(resource) public.auth > (method) get_current_identity',
    qualified: 'client.public.auth.getCurrentIdentity',
    response:
      '{ data: { auth_mode: string; principal_key: string; user_id: string; email?: string; oauth_app_id?: string; permission_level?: string; permissions?: string[]; scopes?: string[]; token_id?: string; token_name?: string; username?: string; workspace_code?: string; workspace_id?: string; workspace_name?: string; }; message: string; ctx_id?: string; }',
    markdown:
      "## get_current_identity\n\n`client.public.auth.getCurrentIdentity(): { data: object; message: string; ctx_id?: string; }`\n\n**get** `/v1/public/auth/whoami`\n\nGet Current Public Auth Identity\n\n### Returns\n\n- `{ data: { auth_mode: string; principal_key: string; user_id: string; email?: string; oauth_app_id?: string; permission_level?: string; permissions?: string[]; scopes?: string[]; token_id?: string; token_name?: string; username?: string; workspace_code?: string; workspace_id?: string; workspace_name?: string; }; message: string; ctx_id?: string; }`\n\n  - `data: { auth_mode: string; principal_key: string; user_id: string; email?: string; oauth_app_id?: string; permission_level?: string; permissions?: string[]; scopes?: string[]; token_id?: string; token_name?: string; username?: string; workspace_code?: string; workspace_id?: string; workspace_name?: string; }`\n  - `message: string`\n  - `ctx_id?: string`\n\n### Example\n\n```typescript\nimport Sanka from 'sanka-sdk';\n\nconst client = new Sanka();\n\nconst response = await client.public.auth.getCurrentIdentity();\n\nconsole.log(response);\n```",
  },
];

const EMBEDDED_READMES: { language: string; content: string }[] = [];

const INDEX_OPTIONS = {
  fields: [
    'name',
    'endpoint',
    'summary',
    'description',
    'qualified',
    'stainlessPath',
    'content',
    'sectionContext',
  ],
  storeFields: ['kind', '_original'],
  searchOptions: {
    prefix: true,
    fuzzy: 0.1,
    boost: {
      name: 5,
      stainlessPath: 3,
      endpoint: 3,
      qualified: 3,
      summary: 2,
      content: 1,
      description: 1,
    } as Record<string, number>,
  },
};

/**
 * Self-contained local search engine backed by MiniSearch.
 * Method data is embedded at SDK build time; prose documents
 * can be loaded from an optional docs directory at runtime.
 */
export class LocalDocsSearch {
  private methodIndex: MiniSearch<MiniSearchDocument>;
  private proseIndex: MiniSearch<MiniSearchDocument>;

  private constructor() {
    this.methodIndex = new MiniSearch<MiniSearchDocument>(INDEX_OPTIONS);
    this.proseIndex = new MiniSearch<MiniSearchDocument>(INDEX_OPTIONS);
  }

  static async create(opts?: { docsDir?: string }): Promise<LocalDocsSearch> {
    const instance = new LocalDocsSearch();
    instance.indexMethods(EMBEDDED_METHODS);
    for (const readme of EMBEDDED_READMES) {
      instance.indexProse(readme.content, `readme:${readme.language}`);
    }
    if (opts?.docsDir) {
      await instance.loadDocsDirectory(opts.docsDir);
    }
    return instance;
  }

  search(props: {
    query: string;
    language?: string;
    detail?: string;
    maxResults?: number;
    maxLength?: number;
  }): SearchResult {
    const { query, language = 'typescript', detail = 'default', maxResults = 5, maxLength = 100_000 } = props;

    const useMarkdown = detail === 'verbose' || detail === 'high';

    // Search both indices and merge results by score.
    // Filter prose hits so language-tagged content (READMEs and docs with
    // frontmatter) only matches the requested language.
    const methodHits = this.methodIndex
      .search(query)
      .map((hit) => ({ ...hit, _kind: 'http_method' as const }));
    const proseHits = this.proseIndex
      .search(query)
      .filter((hit) => {
        const source = ((hit as Record<string, unknown>)['_original'] as ProseChunk | undefined)?.source;
        if (!source) return true;
        // Check for language-tagged sources: "readme:<lang>" or "lang:<lang>:<filename>"
        let taggedLang: string | undefined;
        if (source.startsWith('readme:')) taggedLang = source.slice('readme:'.length);
        else if (source.startsWith('lang:')) taggedLang = source.split(':')[1];
        if (!taggedLang) return true;
        return taggedLang === language || (language === 'javascript' && taggedLang === 'typescript');
      })
      .map((hit) => ({ ...hit, _kind: 'prose' as const }));
    const merged = [...methodHits, ...proseHits].sort((a, b) => b.score - a.score);
    const top = merged.slice(0, maxResults);

    const fullResults: (string | Record<string, unknown>)[] = [];

    for (const hit of top) {
      const original = (hit as Record<string, unknown>)['_original'];
      if (hit._kind === 'http_method') {
        const m = original as MethodEntry;
        if (useMarkdown && m.markdown) {
          fullResults.push(m.markdown);
        } else {
          // Use per-language data when available, falling back to the
          // top-level fields (which are TypeScript-specific in the
          // legacy codepath).
          const langData = m.perLanguage?.[language];
          fullResults.push({
            method: langData?.method ?? m.qualified,
            summary: m.summary,
            description: m.description,
            endpoint: `${m.httpMethod.toUpperCase()} ${m.endpoint}`,
            ...(langData?.example ? { example: langData.example } : {}),
            ...(m.params ? { params: m.params } : {}),
            ...(m.response ? { response: m.response } : {}),
          });
        }
      } else {
        const c = original as ProseChunk;
        fullResults.push({
          content: c.content,
          ...(c.source ? { source: c.source } : {}),
        });
      }
    }

    let totalLength = 0;
    const results: (string | Record<string, unknown>)[] = [];
    for (const result of fullResults) {
      const len = typeof result === 'string' ? result.length : JSON.stringify(result).length;
      totalLength += len;
      if (totalLength > maxLength) break;
      results.push(result);
    }

    if (results.length < fullResults.length) {
      results.unshift(`Truncated; showing ${results.length} of ${fullResults.length} results.`);
    }

    return { results };
  }

  private indexMethods(methods: MethodEntry[]): void {
    const docs: MiniSearchDocument[] = methods.map((m, i) => ({
      id: `method-${i}`,
      kind: 'http_method' as const,
      name: m.name,
      endpoint: m.endpoint,
      summary: m.summary,
      description: m.description,
      qualified: m.qualified,
      stainlessPath: m.stainlessPath,
      _original: m as unknown as Record<string, unknown>,
    }));
    if (docs.length > 0) {
      this.methodIndex.addAll(docs);
    }
  }

  private async loadDocsDirectory(docsDir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(docsDir, { withFileTypes: true });
    } catch (err) {
      getLogger().warn({ err, docsDir }, 'Could not read docs directory');
      return;
    }

    const files = entries
      .filter((e) => e.isFile())
      .filter((e) => e.name.endsWith('.md') || e.name.endsWith('.markdown') || e.name.endsWith('.json'));

    for (const file of files) {
      try {
        const filePath = path.join(docsDir, file.name);
        const content = await fs.readFile(filePath, 'utf-8');

        if (file.name.endsWith('.json')) {
          const texts = extractTexts(JSON.parse(content));
          if (texts.length > 0) {
            this.indexProse(texts.join('\n\n'), file.name);
          }
        } else {
          // Parse optional YAML frontmatter for language tagging.
          // Files with a "language" field in frontmatter will only
          // surface in searches for that language.
          //
          // Example:
          //   ---
          //   language: python
          //   ---
          //   # Error handling in Python
          //   ...
          const frontmatter = parseFrontmatter(content);
          const source = frontmatter.language ? `lang:${frontmatter.language}:${file.name}` : file.name;
          this.indexProse(content, source);
        }
      } catch (err) {
        getLogger().warn({ err, file: file.name }, 'Failed to index docs file');
      }
    }
  }

  private indexProse(markdown: string, source: string): void {
    const chunks = chunkMarkdown(markdown);
    const baseId = this.proseIndex.documentCount;

    const docs: MiniSearchDocument[] = chunks.map((chunk, i) => ({
      id: `prose-${baseId + i}`,
      kind: 'prose' as const,
      content: chunk.content,
      ...(chunk.sectionContext != null ? { sectionContext: chunk.sectionContext } : {}),
      _original: { ...chunk, source } as unknown as Record<string, unknown>,
    }));

    if (docs.length > 0) {
      this.proseIndex.addAll(docs);
    }
  }
}

/** Lightweight markdown chunker — splits on headers, chunks by word count. */
function chunkMarkdown(markdown: string): { content: string; tag: string; sectionContext?: string }[] {
  // Strip YAML frontmatter
  const stripped = markdown.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const lines = stripped.split('\n');

  const chunks: { content: string; tag: string; sectionContext?: string }[] = [];
  const headers: string[] = [];
  let current: string[] = [];

  const flush = () => {
    const text = current.join('\n').trim();
    if (!text) return;
    const sectionContext = headers.length > 0 ? headers.join(' > ') : undefined;
    // Split into ~200-word chunks
    const words = text.split(/\s+/);
    for (let i = 0; i < words.length; i += 200) {
      const slice = words.slice(i, i + 200).join(' ');
      if (slice) {
        chunks.push({ content: slice, tag: 'p', ...(sectionContext != null ? { sectionContext } : {}) });
      }
    }
    current = [];
  };

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headerMatch) {
      flush();
      const level = headerMatch[1]!.length;
      const text = headerMatch[2]!.trim();
      while (headers.length >= level) headers.pop();
      headers.push(text);
    } else {
      current.push(line);
    }
  }
  flush();

  return chunks;
}

/** Recursively extracts string values from a JSON structure. */
function extractTexts(data: unknown, depth = 0): string[] {
  if (depth > 10) return [];
  if (typeof data === 'string') return data.trim() ? [data] : [];
  if (Array.isArray(data)) return data.flatMap((item) => extractTexts(item, depth + 1));
  if (typeof data === 'object' && data !== null) {
    return Object.values(data).flatMap((v) => extractTexts(v, depth + 1));
  }
  return [];
}

/** Parses YAML frontmatter from a markdown string, extracting the language field if present. */
function parseFrontmatter(markdown: string): { language?: string } {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const body = match[1] ?? '';
  const langMatch = body.match(/^language:\s*(.+)$/m);
  return langMatch ? { language: langMatch[1]!.trim() } : {};
}
