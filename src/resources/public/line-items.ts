// Shared public line item shape returned by detail endpoints.

export interface PublicLineItem {
  amount_item?: number | null;

  amount_price?: number | null;

  currency?: string | null;

  custom_fields?: Record<string, unknown>;

  id?: string | null;

  item_id?: string | null;

  item_name?: string | null;

  linked_item_name?: string | null;

  linked_item_number?: unknown | null;

  name?: string | null;

  price?: number | null;

  price_without_tax?: number | null;

  quantity?: number | null;

  source_item_fields?: Record<string, unknown>;

  status?: string | null;

  tax_rate?: unknown | null;

  tax_type?: string | null;

  total_price?: number | null;

  total_price_without_tax?: number | null;

  unit_price?: number | null;
}
