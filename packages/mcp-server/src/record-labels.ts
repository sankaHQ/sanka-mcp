type RecordLabelConfig = {
  aliases: string[];
  displayName: string;
  referenceWord: 'No.' | 'ID';
  numberKeys: string[];
  displayKeys?: string[];
};

const RECORD_LABEL_CONFIGS: RecordLabelConfig[] = [
  {
    aliases: ['deal', 'deals'],
    displayName: 'Deal',
    referenceWord: 'ID',
    numberKeys: ['deal_id'],
  },
  {
    aliases: ['order', 'orders'],
    displayName: 'Order',
    referenceWord: 'No.',
    numberKeys: ['order_id', 'id_order'],
  },
  {
    aliases: ['purchase order', 'purchase orders'],
    displayName: 'Purchase Order',
    referenceWord: 'No.',
    numberKeys: ['id_po', 'purchase_order_number', 'purchase_order_id'],
  },
  {
    aliases: ['task', 'tasks'],
    displayName: 'Task',
    referenceWord: 'ID',
    numberKeys: ['task_id'],
  },
  {
    aliases: ['estimate', 'estimates'],
    displayName: 'Estimate',
    referenceWord: 'No.',
    numberKeys: ['id_est', 'estimate_number'],
  },
  {
    aliases: ['invoice', 'invoices', 'overdue invoices'],
    displayName: 'Invoice',
    referenceWord: 'No.',
    numberKeys: ['id_inv', 'invoice_number'],
    displayKeys: ['invoice_display_label', 'invoice_label', 'display_label'],
  },
  {
    aliases: ['slip', 'slips'],
    displayName: 'Slip',
    referenceWord: 'No.',
    numberKeys: ['id_slip', 'slip_number'],
  },
  {
    aliases: ['bill', 'bills'],
    displayName: 'Bill',
    referenceWord: 'No.',
    numberKeys: ['id_bill', 'bill_number'],
  },
  {
    aliases: ['disbursement', 'disbursements'],
    displayName: 'Disbursement',
    referenceWord: 'No.',
    numberKeys: ['id_dsb', 'disbursement_number'],
  },
  {
    aliases: ['ticket', 'tickets'],
    displayName: 'Ticket',
    referenceWord: 'ID',
    numberKeys: ['ticket_id'],
  },
  {
    aliases: ['item', 'items'],
    displayName: 'Item',
    referenceWord: 'ID',
    numberKeys: ['item_id'],
  },
  {
    aliases: ['payment', 'payments'],
    displayName: 'Payment',
    referenceWord: 'No.',
    numberKeys: ['id_rcp', 'payment_number'],
  },
  {
    aliases: ['location', 'locations'],
    displayName: 'Location',
    referenceWord: 'ID',
    numberKeys: ['id_iw', 'location_id'],
  },
  {
    aliases: ['inventory', 'inventories'],
    displayName: 'Inventory',
    referenceWord: 'ID',
    numberKeys: ['inventory_id'],
  },
  {
    aliases: ['inventory transaction', 'inventory transactions'],
    displayName: 'Inventory Transaction',
    referenceWord: 'ID',
    numberKeys: ['transaction_id'],
  },
];

const normalizeEntity = (entity: string): string => entity.trim().toLowerCase().replace(/\s+/g, ' ');

const getConfig = (entity: string): RecordLabelConfig | undefined => {
  const normalizedEntity = normalizeEntity(entity);
  return RECORD_LABEL_CONFIGS.find((config) =>
    config.aliases.some((alias) => normalizeEntity(alias) === normalizedEntity),
  );
};

const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const readStringOrNumber = (value: unknown): string | undefined => {
  const stringValue = readString(value);
  if (stringValue) {
    return stringValue;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

export const sanitizeRecordLabel = (label: string): string => {
  const bareIssueReference = /^#(\d+)$/.exec(label.trim());
  if (bareIssueReference) {
    return `No. ${bareIssueReference[1]}`;
  }
  return label.replace(/#(\d+)/g, 'No. $1');
};

export const buildSafeRecordLabel = ({
  entity,
  payload,
}: {
  entity: string;
  payload: Record<string, unknown>;
}): string | undefined => {
  const config = getConfig(entity);
  if (!config) {
    return undefined;
  }

  const explicitLabel = (config.displayKeys ?? []).map((key) => readString(payload[key])).find(Boolean);
  if (explicitLabel) {
    return sanitizeRecordLabel(explicitLabel);
  }

  const recordNumber = config.numberKeys.map((key) => readStringOrNumber(payload[key])).find(Boolean);
  if (!recordNumber) {
    return undefined;
  }

  return `${config.displayName} ${config.referenceWord} ${recordNumber}`;
};
