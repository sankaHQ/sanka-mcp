// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { McpOptions } from './options';

export type SdkMethod = {
  clientCallName: string;
  fullyQualifiedName: string;
  httpMethod?: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'query';
  httpPath?: string;
};

export const sdkMethods: SdkMethod[] = [
  {
    clientCallName: 'client.enrich.create',
    fullyQualifiedName: 'enrich.create',
    httpMethod: 'post',
    httpPath: '/api/v2/enrich',
  },
  {
    clientCallName: 'client.prospect.companies.create',
    fullyQualifiedName: 'prospect.companies.create',
    httpMethod: 'post',
    httpPath: '/api/v2/prospect/companies',
  },
  {
    clientCallName: 'client.score.create',
    fullyQualifiedName: 'score.create',
    httpMethod: 'post',
    httpPath: '/api/v2/score',
  },
  {
    clientCallName: 'client.public.accountMessages.list',
    fullyQualifiedName: 'public.accountMessages.list',
    httpMethod: 'get',
    httpPath: '/api/v2/me/messages',
  },
  {
    clientCallName: 'client.public.accountMessages.sync',
    fullyQualifiedName: 'public.accountMessages.sync',
    httpMethod: 'post',
    httpPath: '/api/v2/me/messages/sync',
  },
  {
    clientCallName: 'client.public.accountMessages.bulkActions',
    fullyQualifiedName: 'public.accountMessages.bulkActions',
    httpMethod: 'post',
    httpPath: '/api/v2/me/messages/bulk-actions',
  },
  {
    clientCallName: 'client.public.accountMessages.threads.retrieve',
    fullyQualifiedName: 'public.accountMessages.threads.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/me/messages/threads/{thread_id}',
  },
  {
    clientCallName: 'client.public.accountMessages.threads.archive',
    fullyQualifiedName: 'public.accountMessages.threads.archive',
    httpMethod: 'post',
    httpPath: '/api/v2/me/messages/threads/{thread_id}/archive',
  },
  {
    clientCallName: 'client.public.accountMessages.threads.reply',
    fullyQualifiedName: 'public.accountMessages.threads.reply',
    httpMethod: 'post',
    httpPath: '/api/v2/me/messages/threads/{thread_id}/reply',
  },
  {
    clientCallName: 'client.public.workspaceMessages.list',
    fullyQualifiedName: 'public.workspaceMessages.list',
    httpMethod: 'get',
    httpPath: '/api/v2/workspace/messages',
  },
  {
    clientCallName: 'client.public.workspaceMessages.sync',
    fullyQualifiedName: 'public.workspaceMessages.sync',
    httpMethod: 'post',
    httpPath: '/api/v2/workspace/messages/sync',
  },
  {
    clientCallName: 'client.public.workspaceMessages.threads.retrieve',
    fullyQualifiedName: 'public.workspaceMessages.threads.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/workspace/messages/threads/{thread_id}',
  },
  {
    clientCallName: 'client.public.orders.create',
    fullyQualifiedName: 'public.orders.create',
    httpMethod: 'post',
    httpPath: '/api/v2/orders',
  },
  {
    clientCallName: 'client.public.orders.retrieve',
    fullyQualifiedName: 'public.orders.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/orders/{order_id}',
  },
  {
    clientCallName: 'client.public.orders.downloadPDF',
    fullyQualifiedName: 'public.orders.downloadPDF',
    httpMethod: 'get',
    httpPath: '/api/v2/orders/{order_id}/pdf',
  },
  {
    clientCallName: 'client.public.orders.uploadAttachment',
    fullyQualifiedName: 'public.orders.uploadAttachment',
    httpMethod: 'post',
    httpPath: '/api/v2/orders/files',
  },
  {
    clientCallName: 'client.public.orders.update',
    fullyQualifiedName: 'public.orders.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/orders/{order_id}',
  },
  {
    clientCallName: 'client.public.orders.list',
    fullyQualifiedName: 'public.orders.list',
    httpMethod: 'get',
    httpPath: '/api/v2/orders',
  },
  {
    clientCallName: 'client.public.orders.activate',
    fullyQualifiedName: 'public.orders.activate',
    httpMethod: 'post',
    httpPath: '/api/v2/orders/{order_id}/activate',
  },
  {
    clientCallName: 'client.public.orders.delete',
    fullyQualifiedName: 'public.orders.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/orders/{order_id}',
  },
  {
    clientCallName: 'client.public.orders.bulkCreate',
    fullyQualifiedName: 'public.orders.bulkCreate',
    httpMethod: 'post',
    httpPath: '/api/v2/orders/bulk',
  },
  {
    clientCallName: 'client.public.tasks.create',
    fullyQualifiedName: 'public.tasks.create',
    httpMethod: 'post',
    httpPath: '/api/v2/tasks',
  },
  {
    clientCallName: 'client.public.tasks.retrieve',
    fullyQualifiedName: 'public.tasks.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/tasks/{task_id}',
  },
  {
    clientCallName: 'client.public.tasks.update',
    fullyQualifiedName: 'public.tasks.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/tasks/{task_id}',
  },
  {
    clientCallName: 'client.public.tasks.list',
    fullyQualifiedName: 'public.tasks.list',
    httpMethod: 'get',
    httpPath: '/api/v2/tasks',
  },
  {
    clientCallName: 'client.public.tasks.delete',
    fullyQualifiedName: 'public.tasks.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/tasks/{task_id}',
  },
  {
    clientCallName: 'client.public.items.create',
    fullyQualifiedName: 'public.items.create',
    httpMethod: 'post',
    httpPath: '/api/v2/items',
  },
  {
    clientCallName: 'client.public.items.retrieve',
    fullyQualifiedName: 'public.items.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/items/{item_id}',
  },
  {
    clientCallName: 'client.public.items.update',
    fullyQualifiedName: 'public.items.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/items/{item_id}',
  },
  {
    clientCallName: 'client.public.items.list',
    fullyQualifiedName: 'public.items.list',
    httpMethod: 'get',
    httpPath: '/api/v2/items',
  },
  {
    clientCallName: 'client.public.items.delete',
    fullyQualifiedName: 'public.items.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/items/{item_id}',
  },
  {
    clientCallName: 'client.public.contacts.create',
    fullyQualifiedName: 'public.contacts.create',
    httpMethod: 'post',
    httpPath: '/api/v2/contacts',
  },
  {
    clientCallName: 'client.public.contacts.retrieve',
    fullyQualifiedName: 'public.contacts.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/contacts/{contact_id}',
  },
  {
    clientCallName: 'client.public.contacts.update',
    fullyQualifiedName: 'public.contacts.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/contacts/{contact_id}',
  },
  {
    clientCallName: 'client.public.contacts.list',
    fullyQualifiedName: 'public.contacts.list',
    httpMethod: 'get',
    httpPath: '/api/v2/contacts',
  },
  {
    clientCallName: 'client.public.contacts.delete',
    fullyQualifiedName: 'public.contacts.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/contacts/{contact_id}',
  },
  {
    clientCallName: 'client.public.companies.create',
    fullyQualifiedName: 'public.companies.create',
    httpMethod: 'post',
    httpPath: '/api/v2/companies',
  },
  {
    clientCallName: 'client.public.companies.retrieve',
    fullyQualifiedName: 'public.companies.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/companies/{company_id}',
  },
  {
    clientCallName: 'client.public.companies.update',
    fullyQualifiedName: 'public.companies.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/companies/{company_id}',
  },
  {
    clientCallName: 'client.public.companies.list',
    fullyQualifiedName: 'public.companies.list',
    httpMethod: 'get',
    httpPath: '/api/v2/companies',
  },
  {
    clientCallName: 'client.public.companies.delete',
    fullyQualifiedName: 'public.companies.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/companies/{company_id}',
  },
  {
    clientCallName: 'client.public.deals.create',
    fullyQualifiedName: 'public.deals.create',
    httpMethod: 'post',
    httpPath: '/api/v2/deals',
  },
  {
    clientCallName: 'client.public.deals.retrieve',
    fullyQualifiedName: 'public.deals.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/deals/{case_id}',
  },
  {
    clientCallName: 'client.public.deals.update',
    fullyQualifiedName: 'public.deals.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/deals/{case_id}',
  },
  {
    clientCallName: 'client.public.deals.list',
    fullyQualifiedName: 'public.deals.list',
    httpMethod: 'get',
    httpPath: '/api/v2/deals',
  },
  {
    clientCallName: 'client.public.deals.delete',
    fullyQualifiedName: 'public.deals.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/deals/{case_id}',
  },
  {
    clientCallName: 'client.public.deals.listPipelines',
    fullyQualifiedName: 'public.deals.listPipelines',
    httpMethod: 'get',
    httpPath: '/api/v2/deals/pipelines',
  },
  {
    clientCallName: 'client.public.tickets.create',
    fullyQualifiedName: 'public.tickets.create',
    httpMethod: 'post',
    httpPath: '/api/v2/tickets',
  },
  {
    clientCallName: 'client.public.tickets.retrieve',
    fullyQualifiedName: 'public.tickets.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/tickets/{ticket_id}',
  },
  {
    clientCallName: 'client.public.tickets.update',
    fullyQualifiedName: 'public.tickets.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/tickets/{ticket_id}',
  },
  {
    clientCallName: 'client.public.tickets.list',
    fullyQualifiedName: 'public.tickets.list',
    httpMethod: 'get',
    httpPath: '/api/v2/tickets',
  },
  {
    clientCallName: 'client.public.tickets.delete',
    fullyQualifiedName: 'public.tickets.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/tickets/{ticket_id}',
  },
  {
    clientCallName: 'client.public.tickets.listPipelines',
    fullyQualifiedName: 'public.tickets.listPipelines',
    httpMethod: 'get',
    httpPath: '/api/v2/tickets/pipelines',
  },
  {
    clientCallName: 'client.public.tickets.updateStatus',
    fullyQualifiedName: 'public.tickets.updateStatus',
    httpMethod: 'patch',
    httpPath: '/api/v2/tickets/{ticket_id}/status',
  },
  {
    clientCallName: 'client.public.subscriptions.create',
    fullyQualifiedName: 'public.subscriptions.create',
    httpMethod: 'post',
    httpPath: '/api/v2/subscriptions',
  },
  {
    clientCallName: 'client.public.subscriptions.retrieve',
    fullyQualifiedName: 'public.subscriptions.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/subscriptions/{subscription_id}',
  },
  {
    clientCallName: 'client.public.subscriptions.update',
    fullyQualifiedName: 'public.subscriptions.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/subscriptions/{subscription_id}',
  },
  {
    clientCallName: 'client.public.subscriptions.list',
    fullyQualifiedName: 'public.subscriptions.list',
    httpMethod: 'get',
    httpPath: '/api/v2/subscriptions',
  },
  {
    clientCallName: 'client.public.subscriptions.delete',
    fullyQualifiedName: 'public.subscriptions.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/subscriptions/{subscription_id}',
  },
  {
    clientCallName: 'client.public.estimates.create',
    fullyQualifiedName: 'public.estimates.create',
    httpMethod: 'post',
    httpPath: '/api/v2/estimates',
  },
  {
    clientCallName: 'client.public.estimates.retrieve',
    fullyQualifiedName: 'public.estimates.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/estimates/{estimate_id}',
  },
  {
    clientCallName: 'client.public.estimates.downloadPDF',
    fullyQualifiedName: 'public.estimates.downloadPDF',
    httpMethod: 'get',
    httpPath: '/api/v2/estimates/{estimate_id}/pdf',
  },
  {
    clientCallName: 'client.public.estimates.uploadAttachment',
    fullyQualifiedName: 'public.estimates.uploadAttachment',
    httpMethod: 'post',
    httpPath: '/api/v2/estimates/files',
  },
  {
    clientCallName: 'client.public.estimates.update',
    fullyQualifiedName: 'public.estimates.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/estimates/{estimate_id}',
  },
  {
    clientCallName: 'client.public.estimates.list',
    fullyQualifiedName: 'public.estimates.list',
    httpMethod: 'get',
    httpPath: '/api/v2/estimates',
  },
  {
    clientCallName: 'client.public.estimates.delete',
    fullyQualifiedName: 'public.estimates.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/estimates/{estimate_id}',
  },
  {
    clientCallName: 'client.public.invoices.create',
    fullyQualifiedName: 'public.invoices.create',
    httpMethod: 'post',
    httpPath: '/api/v2/invoices',
  },
  {
    clientCallName: 'client.public.invoices.retrieve',
    fullyQualifiedName: 'public.invoices.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/invoices/{invoice_id}',
  },
  {
    clientCallName: 'client.public.invoices.downloadPDF',
    fullyQualifiedName: 'public.invoices.downloadPDF',
    httpMethod: 'get',
    httpPath: '/api/v2/invoices/{invoice_id}/pdf',
  },
  {
    clientCallName: 'client.public.invoices.uploadAttachment',
    fullyQualifiedName: 'public.invoices.uploadAttachment',
    httpMethod: 'post',
    httpPath: '/api/v2/invoices/files',
  },
  {
    clientCallName: 'client.public.invoices.update',
    fullyQualifiedName: 'public.invoices.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/invoices/{invoice_id}',
  },
  {
    clientCallName: 'client.public.invoices.list',
    fullyQualifiedName: 'public.invoices.list',
    httpMethod: 'get',
    httpPath: '/api/v2/invoices',
  },
  {
    clientCallName: 'client.public.invoices.listOverdue',
    fullyQualifiedName: 'public.invoices.listOverdue',
    httpMethod: 'get',
    httpPath: '/api/v2/invoices/overdue',
  },
  {
    clientCallName: 'client.public.invoices.delete',
    fullyQualifiedName: 'public.invoices.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/invoices/{invoice_id}',
  },
  {
    clientCallName: 'client.public.associations.list',
    fullyQualifiedName: 'public.associations.list',
    httpMethod: 'get',
    httpPath: '/api/v2/public/associations',
  },
  {
    clientCallName: 'client.public.associations.create',
    fullyQualifiedName: 'public.associations.create',
    httpMethod: 'post',
    httpPath: '/api/v2/public/associations',
  },
  {
    clientCallName: 'client.public.associations.delete',
    fullyQualifiedName: 'public.associations.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/public/associations',
  },
  {
    clientCallName: 'client.public.payments.create',
    fullyQualifiedName: 'public.payments.create',
    httpMethod: 'post',
    httpPath: '/api/v2/payments',
  },
  {
    clientCallName: 'client.public.payments.retrieve',
    fullyQualifiedName: 'public.payments.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/payments/{payment_id}',
  },
  {
    clientCallName: 'client.public.payments.downloadPDF',
    fullyQualifiedName: 'public.payments.downloadPDF',
    httpMethod: 'get',
    httpPath: '/api/v2/payments/{payment_id}/pdf',
  },
  {
    clientCallName: 'client.public.payments.listAllocations',
    fullyQualifiedName: 'public.payments.listAllocations',
    httpMethod: 'get',
    httpPath: '/api/v2/public/payments/{payment_id}/allocations',
  },
  {
    clientCallName: 'client.public.payments.updateAllocations',
    fullyQualifiedName: 'public.payments.updateAllocations',
    httpMethod: 'put',
    httpPath: '/api/v2/public/payments/{payment_id}/allocations',
  },
  {
    clientCallName: 'client.public.payments.update',
    fullyQualifiedName: 'public.payments.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/payments/{payment_id}',
  },
  {
    clientCallName: 'client.public.payments.list',
    fullyQualifiedName: 'public.payments.list',
    httpMethod: 'get',
    httpPath: '/api/v2/payments',
  },
  {
    clientCallName: 'client.public.payments.delete',
    fullyQualifiedName: 'public.payments.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/payments/{payment_id}',
  },
  {
    clientCallName: 'client.public.expenses.create',
    fullyQualifiedName: 'public.expenses.create',
    httpMethod: 'post',
    httpPath: '/api/v2/expenses',
  },
  {
    clientCallName: 'client.public.expenses.retrieve',
    fullyQualifiedName: 'public.expenses.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/expenses/{expense_id}',
  },
  {
    clientCallName: 'client.public.expenses.update',
    fullyQualifiedName: 'public.expenses.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/expenses/{expense_id}',
  },
  {
    clientCallName: 'client.public.expenses.list',
    fullyQualifiedName: 'public.expenses.list',
    httpMethod: 'get',
    httpPath: '/api/v2/expenses',
  },
  {
    clientCallName: 'client.public.expenses.delete',
    fullyQualifiedName: 'public.expenses.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/expenses/{expense_id}',
  },
  {
    clientCallName: 'client.public.expenses.uploadAttachment',
    fullyQualifiedName: 'public.expenses.uploadAttachment',
    httpMethod: 'post',
    httpPath: '/api/v2/expenses/files',
  },
  {
    clientCallName: 'client.public.inventories.create',
    fullyQualifiedName: 'public.inventories.create',
    httpMethod: 'post',
    httpPath: '/api/v2/inventories',
  },
  {
    clientCallName: 'client.public.inventories.retrieve',
    fullyQualifiedName: 'public.inventories.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/inventories/{inventory_id}',
  },
  {
    clientCallName: 'client.public.inventories.update',
    fullyQualifiedName: 'public.inventories.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/inventories/{inventory_id}',
  },
  {
    clientCallName: 'client.public.inventories.list',
    fullyQualifiedName: 'public.inventories.list',
    httpMethod: 'get',
    httpPath: '/api/v2/inventories',
  },
  {
    clientCallName: 'client.public.inventories.delete',
    fullyQualifiedName: 'public.inventories.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/inventories/{inventory_id}',
  },
  {
    clientCallName: 'client.public.locations.create',
    fullyQualifiedName: 'public.locations.create',
    httpMethod: 'post',
    httpPath: '/api/v2/locations',
  },
  {
    clientCallName: 'client.public.locations.retrieve',
    fullyQualifiedName: 'public.locations.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/locations/{location_id}',
  },
  {
    clientCallName: 'client.public.locations.update',
    fullyQualifiedName: 'public.locations.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/locations/{location_id}',
  },
  {
    clientCallName: 'client.public.locations.list',
    fullyQualifiedName: 'public.locations.list',
    httpMethod: 'get',
    httpPath: '/api/v2/locations',
  },
  {
    clientCallName: 'client.public.locations.delete',
    fullyQualifiedName: 'public.locations.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/locations/{location_id}',
  },
  {
    clientCallName: 'client.public.inventoryTransactions.create',
    fullyQualifiedName: 'public.inventoryTransactions.create',
    httpMethod: 'post',
    httpPath: '/api/v2/public/inventory-transactions',
  },
  {
    clientCallName: 'client.public.inventoryTransactions.retrieve',
    fullyQualifiedName: 'public.inventoryTransactions.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/inventory-transactions/{transaction_id}',
  },
  {
    clientCallName: 'client.public.inventoryTransactions.update',
    fullyQualifiedName: 'public.inventoryTransactions.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/inventory-transactions/{transaction_id}',
  },
  {
    clientCallName: 'client.public.inventoryTransactions.list',
    fullyQualifiedName: 'public.inventoryTransactions.list',
    httpMethod: 'get',
    httpPath: '/api/v2/inventory-transactions',
  },
  {
    clientCallName: 'client.public.inventoryTransactions.delete',
    fullyQualifiedName: 'public.inventoryTransactions.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/inventory-transactions/{transaction_id}',
  },
  {
    clientCallName: 'client.public.meters.create',
    fullyQualifiedName: 'public.meters.create',
    httpMethod: 'post',
    httpPath: '/api/v2/meters',
  },
  {
    clientCallName: 'client.public.meters.retrieve',
    fullyQualifiedName: 'public.meters.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/meters/{meter_id}',
  },
  {
    clientCallName: 'client.public.meters.update',
    fullyQualifiedName: 'public.meters.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/meters/{meter_id}',
  },
  {
    clientCallName: 'client.public.meters.list',
    fullyQualifiedName: 'public.meters.list',
    httpMethod: 'get',
    httpPath: '/api/v2/meters',
  },
  {
    clientCallName: 'client.public.meters.delete',
    fullyQualifiedName: 'public.meters.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/meters/{meter_id}',
  },
  {
    clientCallName: 'client.public.properties.create',
    fullyQualifiedName: 'public.properties.create',
    httpMethod: 'post',
    httpPath: '/api/v2/properties/{object_name}',
  },
  {
    clientCallName: 'client.public.properties.retrieve',
    fullyQualifiedName: 'public.properties.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/properties/{object_name}/{property_ref}',
  },
  {
    clientCallName: 'client.public.properties.update',
    fullyQualifiedName: 'public.properties.update',
    httpMethod: 'put',
    httpPath: '/api/v2/properties/{object_name}/{property_ref}',
  },
  {
    clientCallName: 'client.public.properties.list',
    fullyQualifiedName: 'public.properties.list',
    httpMethod: 'get',
    httpPath: '/api/v2/properties/{object_name}',
  },
  {
    clientCallName: 'client.public.properties.delete',
    fullyQualifiedName: 'public.properties.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/properties/{object_name}/{property_ref}',
  },
  {
    clientCallName: 'client.public.objectSchemas.list',
    fullyQualifiedName: 'public.objectSchemas.list',
    httpMethod: 'get',
    httpPath: '/api/v2/object-schemas',
  },
  {
    clientCallName: 'client.public.objectSchemas.mutate',
    fullyQualifiedName: 'public.objectSchemas.mutate',
    httpMethod: 'post',
    httpPath: '/api/v2/object-schemas',
  },
  {
    clientCallName: 'client.public.purchaseOrders.create',
    fullyQualifiedName: 'public.purchaseOrders.create',
    httpMethod: 'post',
    httpPath: '/api/v2/purchase-orders',
  },
  {
    clientCallName: 'client.public.purchaseOrders.retrieve',
    fullyQualifiedName: 'public.purchaseOrders.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/purchase-orders/{purchase_order_id}',
  },
  {
    clientCallName: 'client.public.purchaseOrders.downloadPDF',
    fullyQualifiedName: 'public.purchaseOrders.downloadPDF',
    httpMethod: 'get',
    httpPath: '/api/v2/purchase-orders/{purchase_order_id}/pdf',
  },
  {
    clientCallName: 'client.public.purchaseOrders.update',
    fullyQualifiedName: 'public.purchaseOrders.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/purchase-orders/{purchase_order_id}',
  },
  {
    clientCallName: 'client.public.purchaseOrders.uploadAttachment',
    fullyQualifiedName: 'public.purchaseOrders.uploadAttachment',
    httpMethod: 'post',
    httpPath: '/api/v2/purchase-orders/files',
  },
  {
    clientCallName: 'client.public.purchaseOrders.list',
    fullyQualifiedName: 'public.purchaseOrders.list',
    httpMethod: 'get',
    httpPath: '/api/v2/purchase-orders',
  },
  {
    clientCallName: 'client.public.purchaseOrders.delete',
    fullyQualifiedName: 'public.purchaseOrders.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/purchase-orders/{purchase_order_id}',
  },
  {
    clientCallName: 'client.public.slips.create',
    fullyQualifiedName: 'public.slips.create',
    httpMethod: 'post',
    httpPath: '/api/v2/revenues',
  },
  {
    clientCallName: 'client.public.slips.retrieve',
    fullyQualifiedName: 'public.slips.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/revenues/{slip_id}',
  },
  {
    clientCallName: 'client.public.slips.downloadPDF',
    fullyQualifiedName: 'public.slips.downloadPDF',
    httpMethod: 'get',
    httpPath: '/api/v2/revenues/{slip_id}/pdf',
  },
  {
    clientCallName: 'client.public.slips.update',
    fullyQualifiedName: 'public.slips.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/revenues/{slip_id}',
  },
  {
    clientCallName: 'client.public.slips.list',
    fullyQualifiedName: 'public.slips.list',
    httpMethod: 'get',
    httpPath: '/api/v2/revenues',
  },
  {
    clientCallName: 'client.public.slips.delete',
    fullyQualifiedName: 'public.slips.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/revenues/{slip_id}',
  },
  {
    clientCallName: 'client.public.bills.create',
    fullyQualifiedName: 'public.bills.create',
    httpMethod: 'post',
    httpPath: '/api/v2/bills',
  },
  {
    clientCallName: 'client.public.bills.retrieve',
    fullyQualifiedName: 'public.bills.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/bills/{bill_id}',
  },
  {
    clientCallName: 'client.public.bills.update',
    fullyQualifiedName: 'public.bills.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/bills/{bill_id}',
  },
  {
    clientCallName: 'client.public.bills.list',
    fullyQualifiedName: 'public.bills.list',
    httpMethod: 'get',
    httpPath: '/api/v2/bills',
  },
  {
    clientCallName: 'client.public.bills.delete',
    fullyQualifiedName: 'public.bills.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/bills/{bill_id}',
  },
  {
    clientCallName: 'client.public.bills.uploadAttachment',
    fullyQualifiedName: 'public.bills.uploadAttachment',
    httpMethod: 'post',
    httpPath: '/api/v2/bills/files',
  },
  {
    clientCallName: 'client.public.disbursements.create',
    fullyQualifiedName: 'public.disbursements.create',
    httpMethod: 'post',
    httpPath: '/api/v2/disbursements',
  },
  {
    clientCallName: 'client.public.disbursements.retrieve',
    fullyQualifiedName: 'public.disbursements.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/disbursements/{disbursement_id}',
  },
  {
    clientCallName: 'client.public.disbursements.update',
    fullyQualifiedName: 'public.disbursements.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/disbursements/{disbursement_id}',
  },
  {
    clientCallName: 'client.public.disbursements.list',
    fullyQualifiedName: 'public.disbursements.list',
    httpMethod: 'get',
    httpPath: '/api/v2/disbursements',
  },
  {
    clientCallName: 'client.public.disbursements.delete',
    fullyQualifiedName: 'public.disbursements.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/disbursements/{disbursement_id}',
  },
  {
    clientCallName: 'client.public.reports.create',
    fullyQualifiedName: 'public.reports.create',
    httpMethod: 'post',
    httpPath: '/api/v2/public/reports',
  },
  {
    clientCallName: 'client.public.reports.retrieve',
    fullyQualifiedName: 'public.reports.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/public/reports/{report_id}',
  },
  {
    clientCallName: 'client.public.reports.update',
    fullyQualifiedName: 'public.reports.update',
    httpMethod: 'put',
    httpPath: '/api/v2/public/reports/{report_id}',
  },
  {
    clientCallName: 'client.public.reports.list',
    fullyQualifiedName: 'public.reports.list',
    httpMethod: 'get',
    httpPath: '/api/v2/public/reports',
  },
  {
    clientCallName: 'client.public.reports.delete',
    fullyQualifiedName: 'public.reports.delete',
    httpMethod: 'delete',
    httpPath: '/api/v2/public/reports/{report_id}',
  },
  {
    clientCallName: 'client.public.workflows.retrieve',
    fullyQualifiedName: 'public.workflows.retrieve',
    httpMethod: 'get',
    httpPath: '/api/v2/public/workflows/{workflow_ref}',
  },
  {
    clientCallName: 'client.public.workflows.list',
    fullyQualifiedName: 'public.workflows.list',
    httpMethod: 'get',
    httpPath: '/api/v2/public/workflows',
  },
  {
    clientCallName: 'client.public.workflows.createOrUpdate',
    fullyQualifiedName: 'public.workflows.createOrUpdate',
    httpMethod: 'post',
    httpPath: '/api/v2/public/workflows',
  },
  {
    clientCallName: 'client.public.workflows.update',
    fullyQualifiedName: 'public.workflows.update',
    httpMethod: 'patch',
    httpPath: '/api/v2/public/workflows/{workflow_ref}',
  },
  {
    clientCallName: 'client.public.workflows.listActions',
    fullyQualifiedName: 'public.workflows.listActions',
    httpMethod: 'get',
    httpPath: '/api/v2/public/workflows/actions',
  },
  {
    clientCallName: 'client.public.workflows.retrieveRun',
    fullyQualifiedName: 'public.workflows.retrieveRun',
    httpMethod: 'get',
    httpPath: '/api/v2/public/workflow-runs/{run_id}',
  },
  {
    clientCallName: 'client.public.workflows.run',
    fullyQualifiedName: 'public.workflows.run',
    httpMethod: 'post',
    httpPath: '/api/v2/public/workflows/{workflow_ref}/run',
  },
  {
    clientCallName: 'client.public.calendar.bootstrap',
    fullyQualifiedName: 'public.calendar.bootstrap',
    httpMethod: 'get',
    httpPath: '/api/v2/public/calendar/bootstrap',
  },
  {
    clientCallName: 'client.public.calendar.checkAvailability',
    fullyQualifiedName: 'public.calendar.checkAvailability',
    httpMethod: 'get',
    httpPath: '/api/v2/public/calendar/availability',
  },
  {
    clientCallName: 'client.public.calendar.attendance.create',
    fullyQualifiedName: 'public.calendar.attendance.create',
    httpMethod: 'post',
    httpPath: '/api/v2/public/calendar/attendance',
  },
  {
    clientCallName: 'client.public.calendar.attendance.cancel',
    fullyQualifiedName: 'public.calendar.attendance.cancel',
    httpMethod: 'post',
    httpPath: '/api/v2/public/calendar/attendance/{attendance_id}/cancel',
  },
  {
    clientCallName: 'client.public.calendar.attendance.reschedule',
    fullyQualifiedName: 'public.calendar.attendance.reschedule',
    httpMethod: 'post',
    httpPath: '/api/v2/public/calendar/attendance/{attendance_id}/reschedule',
  },
  {
    clientCallName: 'client.public.auth.getCurrentIdentity',
    fullyQualifiedName: 'public.auth.getCurrentIdentity',
    httpMethod: 'get',
    httpPath: '/api/v2/auth/session',
  },
];

function allowedMethodsForCodeTool(options: McpOptions | undefined): SdkMethod[] | undefined {
  if (!options) {
    return undefined;
  }

  let allowedMethods: SdkMethod[];

  if (options.codeAllowHttpGets || options.codeAllowedMethods) {
    // Start with nothing allowed and then add into it from options
    let allowedMethodsSet = new Set<SdkMethod>();

    if (options.codeAllowHttpGets) {
      // Add all methods that map to an HTTP GET
      sdkMethods
        .filter((method) => method.httpMethod === 'get')
        .forEach((method) => allowedMethodsSet.add(method));
    }

    if (options.codeAllowedMethods) {
      // Add all methods that match any of the allowed regexps
      const allowedRegexps = options.codeAllowedMethods.map((pattern) => {
        try {
          return new RegExp(pattern);
        } catch (e) {
          throw new Error(
            `Invalid regex pattern for allowed method: "${pattern}": ${e instanceof Error ? e.message : e}`,
          );
        }
      });

      sdkMethods
        .filter((method) => allowedRegexps.some((regexp) => regexp.test(method.fullyQualifiedName)))
        .forEach((method) => allowedMethodsSet.add(method));
    }

    allowedMethods = Array.from(allowedMethodsSet);
  } else {
    // Start with everything allowed
    allowedMethods = [...sdkMethods];
  }

  if (options.codeBlockedMethods) {
    // Filter down based on blocked regexps
    const blockedRegexps = options.codeBlockedMethods.map((pattern) => {
      try {
        return new RegExp(pattern);
      } catch (e) {
        throw new Error(
          `Invalid regex pattern for blocked method: "${pattern}": ${e instanceof Error ? e.message : e}`,
        );
      }
    });

    allowedMethods = allowedMethods.filter(
      (method) => !blockedRegexps.some((regexp) => regexp.test(method.fullyQualifiedName)),
    );
  }

  return allowedMethods;
}

export function blockedMethodsForCodeTool(options: McpOptions | undefined): SdkMethod[] | undefined {
  const allowedMethods = allowedMethodsForCodeTool(options);
  if (!allowedMethods) {
    return undefined;
  }

  const allowedSet = new Set(allowedMethods.map((method) => method.fullyQualifiedName));

  // Return any methods that are not explicitly allowed
  return sdkMethods.filter((method) => !allowedSet.has(method.fullyQualifiedName));
}
