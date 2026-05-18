import { buildSafeRecordLabel, sanitizeRecordLabel } from '../../packages/mcp-server/src/record-labels';

describe('MCP record labels', () => {
  it('formats financial document numbers without Markdown issue references', () => {
    expect(buildSafeRecordLabel({ entity: 'invoice', payload: { id_inv: 7 } })).toBe('Invoice No. 7');
    expect(buildSafeRecordLabel({ entity: 'estimate', payload: { id_est: 12 } })).toBe('Estimate No. 12');
    expect(buildSafeRecordLabel({ entity: 'purchase orders', payload: { id_po: 3 } })).toBe(
      'Purchase Order No. 3',
    );
    expect(buildSafeRecordLabel({ entity: 'payments', payload: { id_rcp: 301 } })).toBe('Payment No. 301');
  });

  it('sanitizes model-facing labels that already contain hash references', () => {
    expect(sanitizeRecordLabel('#7')).toBe('No. 7');
    expect(
      buildSafeRecordLabel({ entity: 'invoice', payload: { invoice_display_label: 'Invoice #7' } }),
    ).toBe('Invoice No. 7');
  });

  it('formats non-financial object ids with ID labels', () => {
    expect(buildSafeRecordLabel({ entity: 'task', payload: { task_id: 44 } })).toBe('Task ID 44');
    expect(
      buildSafeRecordLabel({ entity: 'inventory transactions', payload: { transaction_id: 'tx-1' } }),
    ).toBe('Inventory Transaction ID tx-1');
  });
});
