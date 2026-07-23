import { asErrorResult, McpTool, ToolCallResult } from './types';
import { requireAuthentication } from './tool-auth';

const CONVOY_BASE_PATH = '/api/v2/convoy';

const OUTPUT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: true,
};

const ID_PROPERTY = {
  type: 'string' as const,
  minLength: 1,
};

const CONFIRM_PROPERTY = {
  type: 'boolean' as const,
  description: 'Must be true after the user explicitly approves this state-changing action.',
};

const readString = (value: unknown): string | undefined => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
};

const readNumber = (value: unknown): number | undefined => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
};

const readBoolean = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined);

const readRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ?
    (value as Record<string, unknown>)
  : undefined;

const unwrapV2Data = (payload: unknown): Record<string, unknown> => {
  const record = readRecord(payload) ?? {};
  if (typeof record['success'] === 'boolean' && Object.prototype.hasOwnProperty.call(record, 'data')) {
    return readRecord(record['data']) ?? {};
  }
  return readRecord(record['data']) ?? record;
};

const pickDefined = (args: Record<string, unknown> | undefined, keys: string[]): Record<string, unknown> =>
  Object.fromEntries(
    keys
      .filter((key) => Boolean(args && Object.prototype.hasOwnProperty.call(args, key)))
      .map((key) => [key, args?.[key]])
      .filter(([, value]) => value !== undefined),
  );

const convoyResult = (payload: unknown, summary: string): ToolCallResult => {
  const structuredContent = unwrapV2Data(payload);
  return {
    content: [{ type: 'text', text: summary }],
    structuredContent,
  };
};

const requireConvoyAuth = (reqContext: Parameters<McpTool['handler']>[0]['reqContext'], title: string) =>
  requireAuthentication({ reqContext, toolTitle: title });

const requireConfirmation = (
  args: Record<string, unknown> | undefined,
  key = 'confirm',
): ToolCallResult | undefined =>
  args?.[key] === true ?
    undefined
  : asErrorResult(`\`${key}=true\` is required after explicit user approval.`);

const listQuery = (
  args: Record<string, unknown> | undefined,
  extraKeys: string[] = [],
): Record<string, unknown> => {
  const page = readNumber(args?.['page']);
  const pageSize = readNumber(args?.['page_size']);
  return {
    ...(page ? { page } : undefined),
    ...(pageSize ? { page_size: pageSize } : undefined),
    ...pickDefined(args, extraKeys),
  };
};

const listInputSchema = (properties: Record<string, unknown> = {}) => ({
  type: 'object' as const,
  additionalProperties: false,
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    page_size: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
    ...properties,
  },
});

export const listConvoyPartnersTool: McpTool = {
  metadata: {
    resource: 'convoyPartners',
    operation: 'read',
    tags: ['convoy', 'partners'],
    httpMethod: 'get',
    httpPath: `${CONVOY_BASE_PATH}/partners`,
    operationId: 'convoy.partners.list',
  },
  tool: {
    name: 'list_convoy_partners',
    title: 'List Convoy partners',
    description:
      'List partner organizations managed in Convoy, including company, status, tier, type, and member count.',
    inputSchema: listInputSchema({
      q: { type: 'string', description: 'Optional partner or company name search.' },
      status: {
        type: 'string',
        enum: ['invited', 'active', 'suspended', 'archived'],
      },
    }),
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List Convoy partners',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireConvoyAuth(reqContext, 'List Convoy partners');
    if (authError) return authError;
    const payload = await reqContext.client.get(`${CONVOY_BASE_PATH}/partners`, {
      query: listQuery(args, ['q', 'status']),
    });
    return convoyResult(payload, 'Loaded Convoy partners.');
  },
};

export const getConvoyPartnerTool: McpTool = {
  metadata: {
    resource: 'convoyPartners',
    operation: 'read',
    tags: ['convoy', 'partners'],
    httpMethod: 'get',
    httpPath: `${CONVOY_BASE_PATH}/partners/{partner_id}`,
    operationId: 'convoy.partners.retrieve',
  },
  tool: {
    name: 'get_convoy_partner',
    title: 'Get Convoy partner',
    description: 'Load one Convoy partner organization by UUID.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['partner_id'],
      properties: { partner_id: ID_PROPERTY },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get Convoy partner',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireConvoyAuth(reqContext, 'Get Convoy partner');
    if (authError) return authError;
    const partnerID = readString(args?.['partner_id']);
    if (!partnerID) return asErrorResult('`partner_id` is required.');
    const payload = await reqContext.client.get(
      `${CONVOY_BASE_PATH}/partners/${encodeURIComponent(partnerID)}`,
    );
    return convoyResult(payload, `Loaded Convoy partner ${partnerID}.`);
  },
};

export const createConvoyPartnerTool: McpTool = {
  metadata: {
    resource: 'convoyPartners',
    operation: 'write',
    tags: ['convoy', 'partners'],
    httpMethod: 'post',
    httpPath: `${CONVOY_BASE_PATH}/partners`,
    operationId: 'convoy.partners.create',
  },
  tool: {
    name: 'create_convoy_partner',
    title: 'Create Convoy partner',
    description:
      'Create a Convoy partner linked to an existing Sanka company or create and link a new company. This does not send an invitation; use invite_convoy_partner_member separately.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        company_id: {
          type: 'string',
          description: 'Existing Sanka company UUID. Use exactly one of company_id or company.',
        },
        company: {
          type: 'object',
          additionalProperties: false,
          required: ['name'],
          description: 'New company to create. Use exactly one of company_id or company.',
          properties: {
            name: { type: 'string', minLength: 1 },
            email: { type: ['string', 'null'] },
            phone_number: { type: ['string', 'null'] },
            url: { type: ['string', 'null'] },
            address: { type: ['string', 'null'] },
          },
        },
        name: { type: ['string', 'null'] },
        tier: { type: ['string', 'null'] },
        partner_type: { type: ['string', 'null'] },
        owner_user_management_id: { type: ['string', 'null'] },
        default_commission_plan_id: { type: ['string', 'null'] },
        notes: { type: ['string', 'null'] },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create Convoy partner',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireConvoyAuth(reqContext, 'Create Convoy partner');
    if (authError) return authError;
    const companyID = readString(args?.['company_id']);
    const company = readRecord(args?.['company']);
    if (Boolean(companyID) === Boolean(company)) {
      return asErrorResult('Pass exactly one of `company_id` or `company`.');
    }
    if (company && !readString(company['name'])) {
      return asErrorResult('`company.name` is required when creating a new company.');
    }
    const body = {
      ...(companyID ? { company_id: companyID } : { company }),
      ...pickDefined(args, [
        'name',
        'tier',
        'partner_type',
        'owner_user_management_id',
        'default_commission_plan_id',
        'notes',
      ]),
    };
    const payload = await reqContext.client.post(`${CONVOY_BASE_PATH}/partners`, { body });
    return convoyResult(payload, 'Created Convoy partner.');
  },
};

export const updateConvoyPartnerTool: McpTool = {
  metadata: {
    resource: 'convoyPartners',
    operation: 'write',
    tags: ['convoy', 'partners'],
    httpMethod: 'patch',
    httpPath: `${CONVOY_BASE_PATH}/partners/{partner_id}`,
    operationId: 'convoy.partners.update',
  },
  tool: {
    name: 'update_convoy_partner',
    title: 'Update Convoy partner',
    description: 'Update selected Convoy partner profile and lifecycle fields.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['partner_id'],
      properties: {
        partner_id: ID_PROPERTY,
        name: { type: ['string', 'null'] },
        status: {
          anyOf: [{ type: 'string', enum: ['invited', 'active', 'suspended'] }, { type: 'null' }],
        },
        tier: { type: ['string', 'null'] },
        partner_type: { type: ['string', 'null'] },
        owner_user_management_id: { type: ['string', 'null'] },
        default_commission_plan_id: { type: ['string', 'null'] },
        notes: { type: ['string', 'null'] },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Update Convoy partner',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireConvoyAuth(reqContext, 'Update Convoy partner');
    if (authError) return authError;
    const partnerID = readString(args?.['partner_id']);
    if (!partnerID) return asErrorResult('`partner_id` is required.');
    const body = pickDefined(args, [
      'name',
      'status',
      'tier',
      'partner_type',
      'owner_user_management_id',
      'default_commission_plan_id',
      'notes',
    ]);
    if (Object.keys(body).length === 0) {
      return asErrorResult('At least one partner field is required.');
    }
    const payload = await reqContext.client.patch(
      `${CONVOY_BASE_PATH}/partners/${encodeURIComponent(partnerID)}`,
      { body },
    );
    return convoyResult(payload, `Updated Convoy partner ${partnerID}.`);
  },
};

export const archiveConvoyPartnerTool: McpTool = {
  metadata: {
    resource: 'convoyPartners',
    operation: 'write',
    tags: ['convoy', 'partners'],
    httpMethod: 'post',
    httpPath: `${CONVOY_BASE_PATH}/partners/{partner_id}/archive`,
    operationId: 'convoy.partners.archive',
  },
  tool: {
    name: 'archive_convoy_partner',
    title: 'Archive Convoy partner',
    description:
      'Archive a Convoy partner after explicit approval. This preserves history and does not delete the linked Sanka company.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['partner_id', 'confirm'],
      properties: { partner_id: ID_PROPERTY, confirm: CONFIRM_PROPERTY },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Archive Convoy partner',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireConvoyAuth(reqContext, 'Archive Convoy partner');
    if (authError) return authError;
    const confirmationError = requireConfirmation(args);
    if (confirmationError) return confirmationError;
    const partnerID = readString(args?.['partner_id']);
    if (!partnerID) return asErrorResult('`partner_id` is required.');
    const payload = await reqContext.client.post(
      `${CONVOY_BASE_PATH}/partners/${encodeURIComponent(partnerID)}/archive`,
      { body: {} },
    );
    return convoyResult(payload, `Archived Convoy partner ${partnerID}.`);
  },
};

export const listConvoyPartnerMembersTool: McpTool = {
  metadata: {
    resource: 'convoyPartnerMembers',
    operation: 'read',
    tags: ['convoy', 'partners', 'members'],
    httpMethod: 'get',
    httpPath: `${CONVOY_BASE_PATH}/partners/{partner_id}/members`,
    operationId: 'convoy.partnerMembers.list',
  },
  tool: {
    name: 'list_convoy_partner_members',
    title: 'List Convoy partner members',
    description: 'List portal members and invitation status for one Convoy partner.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['partner_id'],
      properties: { partner_id: ID_PROPERTY },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List Convoy partner members',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireConvoyAuth(reqContext, 'List Convoy partner members');
    if (authError) return authError;
    const partnerID = readString(args?.['partner_id']);
    if (!partnerID) return asErrorResult('`partner_id` is required.');
    const payload = await reqContext.client.get(
      `${CONVOY_BASE_PATH}/partners/${encodeURIComponent(partnerID)}/members`,
    );
    return convoyResult(payload, `Loaded members for Convoy partner ${partnerID}.`);
  },
};

export const inviteConvoyPartnerMemberTool: McpTool = {
  metadata: {
    resource: 'convoyPartnerMembers',
    operation: 'write',
    tags: ['convoy', 'partners', 'members', 'email'],
    httpMethod: 'post',
    httpPath: `${CONVOY_BASE_PATH}/partners/{partner_id}/members`,
    operationId: 'convoy.partnerMembers.invite',
  },
  tool: {
    name: 'invite_convoy_partner_member',
    title: 'Invite Convoy partner member',
    description:
      'Invite a partner member to the Convoy portal. This sends email and requires explicit user approval with confirm_send=true.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['partner_id', 'confirm_send'],
      properties: {
        partner_id: ID_PROPERTY,
        contact_id: { type: 'string' },
        email: { type: 'string' },
        display_name: { type: 'string' },
        role: { type: 'string', enum: ['admin', 'member'], default: 'member' },
        language: { type: 'string', enum: ['en', 'ja'], default: 'en' },
        confirm_send: {
          type: 'boolean',
          description: 'Must be true after the user approves sending the invitation email.',
        },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Invite Convoy partner member',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireConvoyAuth(reqContext, 'Invite Convoy partner member');
    if (authError) return authError;
    const confirmationError = requireConfirmation(args, 'confirm_send');
    if (confirmationError) return confirmationError;
    const partnerID = readString(args?.['partner_id']);
    if (!partnerID) return asErrorResult('`partner_id` is required.');
    const contactID = readString(args?.['contact_id']);
    const email = readString(args?.['email']);
    const displayName = readString(args?.['display_name']);
    if (contactID && (email || displayName)) {
      return asErrorResult('Use `contact_id` alone, or pass both `email` and `display_name`.');
    }
    if (!contactID && (!email || !displayName)) {
      return asErrorResult('Pass `contact_id`, or both `email` and `display_name`.');
    }
    const body = {
      ...(contactID ? { contact_id: contactID } : { email, display_name: displayName }),
      role: readString(args?.['role']) ?? 'member',
      language: readString(args?.['language']) ?? 'en',
    };
    const payload = await reqContext.client.post(
      `${CONVOY_BASE_PATH}/partners/${encodeURIComponent(partnerID)}/members`,
      { body },
    );
    return convoyResult(payload, `Invited a member to Convoy partner ${partnerID}.`);
  },
};

export const resendConvoyPartnerInviteTool: McpTool = {
  metadata: {
    resource: 'convoyPartnerMembers',
    operation: 'write',
    tags: ['convoy', 'partners', 'members', 'email'],
    httpMethod: 'post',
    httpPath: `${CONVOY_BASE_PATH}/members/{member_id}/resend-invite`,
    operationId: 'convoy.partnerMembers.resendInvite',
  },
  tool: {
    name: 'resend_convoy_partner_invite',
    title: 'Resend Convoy partner invitation',
    description:
      'Resend a Convoy portal invitation email. Requires explicit user approval with confirm_send=true.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['member_id', 'confirm_send'],
      properties: {
        member_id: ID_PROPERTY,
        language: { type: 'string', enum: ['en', 'ja'], default: 'en' },
        confirm_send: {
          type: 'boolean',
          description: 'Must be true after the user approves resending the invitation email.',
        },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Resend Convoy partner invitation',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireConvoyAuth(reqContext, 'Resend Convoy partner invitation');
    if (authError) return authError;
    const confirmationError = requireConfirmation(args, 'confirm_send');
    if (confirmationError) return confirmationError;
    const memberID = readString(args?.['member_id']);
    if (!memberID) return asErrorResult('`member_id` is required.');
    const payload = await reqContext.client.post(
      `${CONVOY_BASE_PATH}/members/${encodeURIComponent(memberID)}/resend-invite`,
      { query: { language: readString(args?.['language']) ?? 'en' } },
    );
    return convoyResult(payload, `Resent Convoy invitation for member ${memberID}.`);
  },
};

export const revokeConvoyPartnerMemberTool: McpTool = {
  metadata: {
    resource: 'convoyPartnerMembers',
    operation: 'write',
    tags: ['convoy', 'partners', 'members'],
    httpMethod: 'post',
    httpPath: `${CONVOY_BASE_PATH}/members/{member_id}/revoke`,
    operationId: 'convoy.partnerMembers.revoke',
  },
  tool: {
    name: 'revoke_convoy_partner_member',
    title: 'Revoke Convoy partner member',
    description: 'Revoke a partner member invitation and portal access after explicit approval.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['member_id', 'confirm'],
      properties: { member_id: ID_PROPERTY, confirm: CONFIRM_PROPERTY },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Revoke Convoy partner member',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireConvoyAuth(reqContext, 'Revoke Convoy partner member');
    if (authError) return authError;
    const confirmationError = requireConfirmation(args);
    if (confirmationError) return confirmationError;
    const memberID = readString(args?.['member_id']);
    if (!memberID) return asErrorResult('`member_id` is required.');
    const payload = await reqContext.client.post(
      `${CONVOY_BASE_PATH}/members/${encodeURIComponent(memberID)}/revoke`,
      { body: {} },
    );
    return convoyResult(payload, `Revoked Convoy member ${memberID}.`);
  },
};

export const listConvoyInvoiceRequestsTool: McpTool = {
  metadata: {
    resource: 'convoyInvoiceRequests',
    operation: 'read',
    tags: ['convoy', 'invoices', 'payments'],
    httpMethod: 'get',
    httpPath: `${CONVOY_BASE_PATH}/invoice-requests`,
    operationId: 'convoy.invoiceRequests.list',
  },
  tool: {
    name: 'list_convoy_invoice_requests',
    title: 'List Convoy invoice requests',
    description: 'List partner invoice requests and their submission, review, and payment status.',
    inputSchema: listInputSchema({
      partner_id: { type: 'string' },
      period: { type: 'string', pattern: '^[0-9]{4}-(0[1-9]|1[0-2])$' },
      status: {
        type: 'string',
        enum: ['open', 'submitted', 'approved', 'rejected', 'paid', 'cancelled'],
      },
    }),
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List Convoy invoice requests',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireConvoyAuth(reqContext, 'List Convoy invoice requests');
    if (authError) return authError;
    const payload = await reqContext.client.get(`${CONVOY_BASE_PATH}/invoice-requests`, {
      query: listQuery(args, ['partner_id', 'period', 'status']),
    });
    return convoyResult(payload, 'Loaded Convoy invoice requests.');
  },
};

export const getConvoyInvoiceRequestTool: McpTool = {
  metadata: {
    resource: 'convoyInvoiceRequests',
    operation: 'read',
    tags: ['convoy', 'invoices', 'payments'],
    httpMethod: 'get',
    httpPath: `${CONVOY_BASE_PATH}/invoice-requests/{invoice_request_id}`,
    operationId: 'convoy.invoiceRequests.retrieve',
  },
  tool: {
    name: 'get_convoy_invoice_request',
    title: 'Get Convoy invoice request',
    description: 'Load one Convoy invoice request with submission, review, and payment evidence.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['invoice_request_id'],
      properties: { invoice_request_id: ID_PROPERTY },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get Convoy invoice request',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireConvoyAuth(reqContext, 'Get Convoy invoice request');
    if (authError) return authError;
    const requestID = readString(args?.['invoice_request_id']);
    if (!requestID) return asErrorResult('`invoice_request_id` is required.');
    const payload = await reqContext.client.get(
      `${CONVOY_BASE_PATH}/invoice-requests/${encodeURIComponent(requestID)}`,
    );
    return convoyResult(payload, `Loaded Convoy invoice request ${requestID}.`);
  },
};

export const createConvoyInvoiceRequestTool: McpTool = {
  metadata: {
    resource: 'convoyInvoiceRequests',
    operation: 'write',
    tags: ['convoy', 'invoices', 'payments', 'email'],
    httpMethod: 'post',
    httpPath: `${CONVOY_BASE_PATH}/invoice-requests`,
    operationId: 'convoy.invoiceRequests.create',
  },
  tool: {
    name: 'create_convoy_invoice_request',
    title: 'Create Convoy invoice request',
    description:
      'Create one monthly invoice request for a partner. Active partner members may receive an email, so explicit approval with confirm_send=true is required.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['partner_id', 'period', 'expected_amount', 'submission_due_date', 'confirm_send'],
      properties: {
        partner_id: ID_PROPERTY,
        period: { type: 'string', pattern: '^[0-9]{4}-(0[1-9]|1[0-2])$' },
        expected_amount: { type: 'number', exclusiveMinimum: 0 },
        currency: { type: 'string', minLength: 3, maxLength: 3, default: 'JPY' },
        submission_due_date: { type: 'string', format: 'date' },
        notes: { type: ['string', 'null'] },
        confirm_send: {
          type: 'boolean',
          description:
            'Must be true after the user approves creating the request and sending any partner notification.',
        },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Create Convoy invoice request',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireConvoyAuth(reqContext, 'Create Convoy invoice request');
    if (authError) return authError;
    const confirmationError = requireConfirmation(args, 'confirm_send');
    if (confirmationError) return confirmationError;
    const partnerID = readString(args?.['partner_id']);
    const period = readString(args?.['period']);
    const expectedAmount = readNumber(args?.['expected_amount']);
    const submissionDueDate = readString(args?.['submission_due_date']);
    if (!partnerID || !period || !expectedAmount || expectedAmount <= 0 || !submissionDueDate) {
      return asErrorResult(
        '`partner_id`, `period`, positive `expected_amount`, and `submission_due_date` are required.',
      );
    }
    const body = {
      partner_id: partnerID,
      period,
      expected_amount: expectedAmount,
      currency: (readString(args?.['currency']) ?? 'JPY').toUpperCase(),
      submission_due_date: submissionDueDate,
      ...(Object.prototype.hasOwnProperty.call(args ?? {}, 'notes') ? { notes: args?.['notes'] } : undefined),
    };
    const payload = await reqContext.client.post(`${CONVOY_BASE_PATH}/invoice-requests`, { body });
    return convoyResult(payload, `Created Convoy invoice request for ${period}.`);
  },
};

export const reviewConvoyInvoiceRequestTool: McpTool = {
  metadata: {
    resource: 'convoyInvoiceRequests',
    operation: 'write',
    tags: ['convoy', 'invoices', 'payments'],
    httpMethod: 'post',
    httpPath: `${CONVOY_BASE_PATH}/invoice-requests/{invoice_request_id}/{action}`,
    operationId: 'convoy.invoiceRequests.review',
  },
  tool: {
    name: 'review_convoy_invoice_request',
    title: 'Review Convoy invoice request',
    description:
      'Approve, reject, cancel, or mark a Convoy invoice request paid. Requires explicit approval with confirm=true. Marking paid records evidence only; it does not execute a bank transfer.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['invoice_request_id', 'action', 'confirm'],
      properties: {
        invoice_request_id: ID_PROPERTY,
        action: { type: 'string', enum: ['approve', 'reject', 'cancel', 'mark_paid'] },
        bill_id: { type: ['string', 'null'] },
        review_note: { type: ['string', 'null'] },
        reason: { type: ['string', 'null'] },
        disbursement_id: { type: ['string', 'null'] },
        payment_reference: { type: ['string', 'null'] },
        paid_at: { type: ['string', 'null'], format: 'date-time' },
        confirm: CONFIRM_PROPERTY,
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Review Convoy invoice request',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireConvoyAuth(reqContext, 'Review Convoy invoice request');
    if (authError) return authError;
    const confirmationError = requireConfirmation(args);
    if (confirmationError) return confirmationError;
    const requestID = readString(args?.['invoice_request_id']);
    const action = readString(args?.['action']);
    if (!requestID || !action) return asErrorResult('`invoice_request_id` and `action` are required.');
    let body: Record<string, unknown>;
    if (action === 'approve') {
      body = pickDefined(args, ['bill_id', 'review_note']);
    } else if (action === 'reject') {
      const reason = readString(args?.['reason']);
      if (!reason) return asErrorResult('`reason` is required when action=reject.');
      body = { reason };
    } else if (action === 'cancel') {
      body = pickDefined(args, ['reason']);
    } else if (action === 'mark_paid') {
      const disbursementID = readString(args?.['disbursement_id']);
      const paymentReference = readString(args?.['payment_reference']);
      if (!disbursementID && !paymentReference) {
        return asErrorResult('`disbursement_id` or `payment_reference` is required when action=mark_paid.');
      }
      body = pickDefined(args, ['disbursement_id', 'payment_reference', 'paid_at']);
    } else {
      return asErrorResult('Unsupported invoice review action.');
    }
    const pathAction = action === 'mark_paid' ? 'mark-paid' : action;
    const payload = await reqContext.client.post(
      `${CONVOY_BASE_PATH}/invoice-requests/${encodeURIComponent(requestID)}/${pathAction}`,
      { body },
    );
    return convoyResult(payload, `Applied ${action} to Convoy invoice request ${requestID}.`);
  },
};

export const listConvoyCommissionsTool: McpTool = {
  metadata: {
    resource: 'convoyCommissions',
    operation: 'read',
    tags: ['convoy', 'commissions', 'payments'],
    httpMethod: 'get',
    httpPath: `${CONVOY_BASE_PATH}/commissions`,
    operationId: 'convoy.commissions.list',
  },
  tool: {
    name: 'list_convoy_commissions',
    title: 'List Convoy commissions',
    description: 'List Convoy commission calculations and approval or payment status.',
    inputSchema: listInputSchema({
      partner_id: { type: 'string' },
      period: { type: 'string', pattern: '^[0-9]{4}-(0[1-9]|1[0-2])$' },
      status: { type: 'string', enum: ['draft', 'approved', 'paid', 'reversed'] },
    }),
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'List Convoy commissions',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireConvoyAuth(reqContext, 'List Convoy commissions');
    if (authError) return authError;
    const payload = await reqContext.client.get(`${CONVOY_BASE_PATH}/commissions`, {
      query: listQuery(args, ['partner_id', 'period', 'status']),
    });
    return convoyResult(payload, 'Loaded Convoy commissions.');
  },
};

export const getConvoyCommissionTool: McpTool = {
  metadata: {
    resource: 'convoyCommissions',
    operation: 'read',
    tags: ['convoy', 'commissions', 'payments'],
    httpMethod: 'get',
    httpPath: `${CONVOY_BASE_PATH}/commissions/{commission_id}`,
    operationId: 'convoy.commissions.retrieve',
  },
  tool: {
    name: 'get_convoy_commission',
    title: 'Get Convoy commission',
    description: 'Load one Convoy commission with calculation and lifecycle details.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['commission_id'],
      properties: { commission_id: ID_PROPERTY },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Get Convoy commission',
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireConvoyAuth(reqContext, 'Get Convoy commission');
    if (authError) return authError;
    const commissionID = readString(args?.['commission_id']);
    if (!commissionID) return asErrorResult('`commission_id` is required.');
    const payload = await reqContext.client.get(
      `${CONVOY_BASE_PATH}/commissions/${encodeURIComponent(commissionID)}`,
    );
    return convoyResult(payload, `Loaded Convoy commission ${commissionID}.`);
  },
};

export const calculateConvoyCommissionsTool: McpTool = {
  metadata: {
    resource: 'convoyCommissions',
    operation: 'write',
    tags: ['convoy', 'commissions', 'payments'],
    httpMethod: 'post',
    httpPath: `${CONVOY_BASE_PATH}/commissions/calculate`,
    operationId: 'convoy.commissions.calculate',
  },
  tool: {
    name: 'calculate_convoy_commissions',
    title: 'Calculate Convoy commissions',
    description:
      'Preview monthly Convoy commissions by default. Set dry_run=false only after explicit approval to store draft commissions.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['period'],
      properties: {
        period: { type: 'string', pattern: '^[0-9]{4}-(0[1-9]|1[0-2])$' },
        dry_run: { type: 'boolean', default: true },
        confirm: {
          type: 'boolean',
          description: 'Required only when dry_run=false and draft commissions will be stored.',
        },
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Calculate Convoy commissions',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireConvoyAuth(reqContext, 'Calculate Convoy commissions');
    if (authError) return authError;
    const period = readString(args?.['period']);
    if (!period) return asErrorResult('`period` is required.');
    const dryRun = readBoolean(args?.['dry_run']) ?? true;
    if (!dryRun) {
      const confirmationError = requireConfirmation(args);
      if (confirmationError) return confirmationError;
    }
    const payload = await reqContext.client.post(`${CONVOY_BASE_PATH}/commissions/calculate`, {
      body: { period, dry_run: dryRun },
    });
    return convoyResult(
      payload,
      dryRun ?
        `Previewed Convoy commissions for ${period}.`
      : `Stored draft Convoy commissions for ${period}.`,
    );
  },
};

export const reviewConvoyCommissionTool: McpTool = {
  metadata: {
    resource: 'convoyCommissions',
    operation: 'write',
    tags: ['convoy', 'commissions', 'payments'],
    httpMethod: 'post',
    httpPath: `${CONVOY_BASE_PATH}/commissions/{commission_id}/{action}`,
    operationId: 'convoy.commissions.review',
  },
  tool: {
    name: 'review_convoy_commission',
    title: 'Review Convoy commission',
    description:
      'Approve or mark one Convoy commission paid after explicit approval. Marking paid records status only and does not execute a bank transfer.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['commission_id', 'action', 'confirm'],
      properties: {
        commission_id: ID_PROPERTY,
        action: { type: 'string', enum: ['approve', 'mark_paid'] },
        confirm: CONFIRM_PROPERTY,
      },
    },
    outputSchema: OUTPUT_SCHEMA,
    securitySchemes: [{ type: 'oauth2' }],
    annotations: {
      title: 'Review Convoy commission',
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  handler: async ({ reqContext, args }) => {
    const authError = requireConvoyAuth(reqContext, 'Review Convoy commission');
    if (authError) return authError;
    const confirmationError = requireConfirmation(args);
    if (confirmationError) return confirmationError;
    const commissionID = readString(args?.['commission_id']);
    const action = readString(args?.['action']);
    if (!commissionID || !action) return asErrorResult('`commission_id` and `action` are required.');
    if (!['approve', 'mark_paid'].includes(action)) {
      return asErrorResult('Unsupported commission review action.');
    }
    const pathAction = action === 'mark_paid' ? 'mark-paid' : action;
    const payload = await reqContext.client.post(
      `${CONVOY_BASE_PATH}/commissions/${encodeURIComponent(commissionID)}/${pathAction}`,
      { body: {} },
    );
    return convoyResult(payload, `Applied ${action} to Convoy commission ${commissionID}.`);
  },
};

export const convoyTools: McpTool[] = [
  listConvoyPartnersTool,
  getConvoyPartnerTool,
  createConvoyPartnerTool,
  updateConvoyPartnerTool,
  archiveConvoyPartnerTool,
  listConvoyPartnerMembersTool,
  inviteConvoyPartnerMemberTool,
  resendConvoyPartnerInviteTool,
  revokeConvoyPartnerMemberTool,
  listConvoyInvoiceRequestsTool,
  getConvoyInvoiceRequestTool,
  createConvoyInvoiceRequestTool,
  reviewConvoyInvoiceRequestTool,
  listConvoyCommissionsTool,
  getConvoyCommissionTool,
  calculateConvoyCommissionsTool,
  reviewConvoyCommissionTool,
];
