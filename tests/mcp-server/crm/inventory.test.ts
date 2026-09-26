import {
  crmCreateInventoryTransactionTool,
  crmDeleteItemTool,
  crmGetInventoryTool,
  crmListInventoriesTool,
  crmListInventoryTransactionsTool,
  crmListItemsTool,
  crmListLocationsTool,
  crmUpdateInventoryTool,
  crmUpdateItemTool,
} from '../../../packages/mcp-server/src/crm-tools';
import { describeV2Requests, oauthContext, type V2RequestCase } from './helpers';

const v2Requests: V2RequestCase[] = [
  {
    name: 'lists items with workspace and language filters',
    tool: crmListItemsTool,
    args: {
      workspace_id: 'ws-1',
      language: 'en',
      search: 'Widget',
      limit: 5,
      page: 2,
      sort: 'name',
      view_id: 'view-1',
    },
    expectedRequests: [
      {
        method: 'GET',
        url: 'http://localhost:5000/api/v2/items?limit=5&page=2&search=Widget&sort=name&view_id=view-1&workspace_id=ws-1',
        headers: { 'accept-language': 'en' },
      },
    ],
  },
  {
    name: 'updates items through the SDK V2 item update method',
    tool: crmUpdateItemTool,
    args: {
      item_id: 'item-1',
      external_id: 'ITEM-EXT',
      name: 'Updated starter kit',
      price: 1400,
      purchase_price: 900,
      status: 'active',
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/items/item-1?external_id=ITEM-EXT',
        body: {
          properties: { name: 'Updated starter kit', status: 'active', price: 1400, purchase_price: 900 },
        },
      },
    ],
  },
  {
    name: 'updates inventory with required external id body',
    tool: crmUpdateInventoryTool,
    args: {
      inventory_id: 'inv-1',
      external_id: 'inv-ext-1',
      name: 'Warehouse stock',
      unit_price: 12.5,
    },
    expectedRequests: [
      {
        method: 'PATCH',
        url: 'http://localhost:5000/api/v2/inventories/inv-1?external_id=inv-ext-1',
        body: { properties: { external_id: 'inv-ext-1', name: 'Warehouse stock', unit_price: 12.5 } },
      },
    ],
  },
  {
    name: 'creates inventory transactions with mapped payload keys',
    tool: crmCreateInventoryTransactionTool,
    args: {
      transaction_type: 'incoming',
      inventory_id: 'inv-1',
      amount: 3,
      use_unit_value: true,
    },
    expectedRequests: [
      {
        method: 'POST',
        url: 'http://localhost:5000/api/v2/inventory-transactions',
        body: {
          properties: {
            amount: 3,
            inventory_id: 'inv-1',
            transaction_type: 'incoming',
            use_unit_value: true,
          },
        },
      },
    ],
  },
];

describe('CRM item and inventory tools', () => {
  it('archives an item with read-after-write verification instead of permanently deleting it', async () => {
    const archive = jest.fn().mockResolvedValue({
      ok: true,
      status: 'archived',
      item_id: 'item-1',
      external_id: 'ITEM-EXT',
      ctx_id: 'ctx-1',
    });
    const retrieve = jest.fn().mockResolvedValue({
      id: 'item-1',
      item_id: 1001,
      status: 'archived',
    });
    const del = jest.fn();

    const result = await crmDeleteItemTool.handler({
      reqContext: {
        client: {
          public: {
            items: { archive, retrieve, delete: del },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        item_id: 'item-1',
        external_id: 'ITEM-EXT',
      },
    });

    expect(crmDeleteItemTool.metadata).toMatchObject({
      httpMethod: 'post',
      httpPath: '/api/v2/items/{item_id}/archive',
      operationId: 'public.items.archive',
    });
    expect(archive).toHaveBeenCalledWith('item-1', { external_id: 'ITEM-EXT' }, undefined);
    expect(retrieve).toHaveBeenCalledWith('item-1', { external_id: 'ITEM-EXT' }, undefined);
    expect(del).not.toHaveBeenCalled();
    expect(result.content[0]).toEqual({ type: 'text', text: 'Item archived: item-1. status=archived' });
    expect(result.structuredContent).toEqual({
      ok: true,
      status: 'archived',
      item_id: 'item-1',
      external_id: 'ITEM-EXT',
      ctx_id: 'ctx-1',
      verification: {
        entity: 'item',
        expected_status: 'archived',
        actual_status: 'archived',
        matched: true,
        record_id: 'item-1',
      },
    });
  });

  it('lists locations with search filters', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id: 'loc-1',
        id_iw: '17',
        warehouse: 'Main',
        location: 'A-1-1',
      },
    ]);

    const result = await crmListLocationsTool.handler({
      reqContext: {
        client: {
          public: {
            locations: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        workspace_id: 'ws-1',
        search: 'A-1',
      },
    });

    expect(list).toHaveBeenCalledWith(
      {
        workspace_id: 'ws-1',
        search: 'A-1',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 1,
      message: 'Returned 1 of 1 locations.',
      permission: undefined,
      results: [
        {
          id: 'loc-1',
          id_iw: '17',
          warehouse: 'Main',
          location: 'A-1-1',
        },
      ],
    });
  });

  it('lists inventories with search and pagination filters', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id: 'inventory-1',
        inventory_id: 1,
        name: 'Sensor kit stock',
        total_inventory: 5,
        available: 5,
      },
    ]);

    const result = await crmListInventoriesTool.handler({
      reqContext: {
        client: {
          public: {
            inventories: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        workspace_id: 'ws-1',
        language: 'ja',
        search: 'Sensor kit',
        limit: 3,
        page: 1,
      },
    });

    expect(list).toHaveBeenCalledWith(
      {
        limit: 3,
        page: 1,
        workspace_id: 'ws-1',
        search: 'Sensor kit',
        'Accept-Language': 'ja',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 1,
      message: 'Returned 1 of 1 inventories.',
      permission: undefined,
      results: [
        {
          id: 'inventory-1',
          inventory_id: 1,
          name: 'Sensor kit stock',
          total_inventory: 5,
          available: 5,
        },
      ],
    });
  });

  it('falls back to list inventory data when inventory detail retrieval fails', async () => {
    const retrieve = jest.fn().mockRejectedValue(new Error('HTTP 500'));
    const list = jest.fn().mockResolvedValue([
      {
        id: 'inventory-1',
        inventory_id: 1,
        name: 'Sensor kit stock',
        total_inventory: 5,
      },
    ]);

    const result = await crmGetInventoryTool.handler({
      reqContext: {
        client: {
          public: {
            inventories: { retrieve, list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        inventory_id: 'inventory-1',
      },
    });

    expect(retrieve).toHaveBeenCalledWith('inventory-1', {}, undefined);
    expect(list).toHaveBeenCalledWith({ limit: 100, page: 1 }, undefined);
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      id: 'inventory-1',
      inventory_id: 1,
      total_inventory: 5,
      detail_fetch_status: 'fallback_from_list',
    });
  });

  it('lists inventory transactions with search filters', async () => {
    const list = jest.fn().mockResolvedValue([
      {
        id: 'transaction-1',
        transaction_id: 7,
        inventory_id: 1,
        amount: 5,
      },
    ]);

    const result = await crmListInventoryTransactionsTool.handler({
      reqContext: {
        client: {
          public: {
            inventoryTransactions: { list },
          },
        } as any,
        auth: oauthContext(),
        toolProfile: 'full',
      },
      args: {
        search: 'Sensor kit',
        limit: 5,
        page: 1,
      },
    });

    expect(list).toHaveBeenCalledWith(
      {
        limit: 5,
        page: 1,
        search: 'Sensor kit',
      },
      undefined,
    );
    expect(result.structuredContent).toEqual({
      count: 1,
      page: 1,
      total: 1,
      message: 'Returned 1 of 1 inventory transactions.',
      permission: undefined,
      results: [
        {
          id: 'transaction-1',
          transaction_id: 7,
          inventory_id: 1,
          amount: 5,
        },
      ],
    });
  });

  describeV2Requests(v2Requests);
});
