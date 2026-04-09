# Enrich

Types:

- <code><a href="./src/resources/enrich.ts">EnrichCreateResponse</a></code>

Methods:

- <code title="post /v1/enrich">client.enrich.<a href="./src/resources/enrich.ts">create</a>({ ...params }) -> EnrichCreateResponse</code>

# Score

Types:

- <code><a href="./src/resources/score.ts">ScoreCreateResponse</a></code>

Methods:

- <code title="post /v1/score">client.score.<a href="./src/resources/score.ts">create</a>({ ...params }) -> ScoreCreateResponse</code>

# Public

## Orders

Types:

- <code><a href="./src/resources/public/orders.ts">BulkOrder</a></code>
- <code><a href="./src/resources/public/orders.ts">BulkOrders</a></code>
- <code><a href="./src/resources/public/orders.ts">Order</a></code>
- <code><a href="./src/resources/public/orders.ts">OrderRetrieveResponse</a></code>
- <code><a href="./src/resources/public/orders.ts">OrderListResponse</a></code>
- <code><a href="./src/resources/public/orders.ts">OrderDeleteResponse</a></code>

Methods:

- <code title="post /v1/public/orders">client.public.orders.<a href="./src/resources/public/orders.ts">create</a>({ ...params }) -> BulkOrders</code>
- <code title="get /v1/public/orders/{order_id}">client.public.orders.<a href="./src/resources/public/orders.ts">retrieve</a>(orderID, { ...params }) -> OrderRetrieveResponse</code>
- <code title="get /v1/public/orders/{order_id}/pdf">client.public.orders.<a href="./src/resources/public/orders.ts">downloadPDF</a>(orderID, { ...params }) -> Response</code>
- <code title="put /v1/public/orders/{order_id}">client.public.orders.<a href="./src/resources/public/orders.ts">update</a>(orderID, { ...params }) -> BulkOrders</code>
- <code title="get /v1/public/orders">client.public.orders.<a href="./src/resources/public/orders.ts">list</a>({ ...params }) -> OrderListResponse</code>
- <code title="delete /v1/public/orders/{order_id}">client.public.orders.<a href="./src/resources/public/orders.ts">delete</a>(orderID, { ...params }) -> OrderDeleteResponse</code>
- <code title="post /v1/public/orders/bulk">client.public.orders.<a href="./src/resources/public/orders.ts">bulkCreate</a>({ ...params }) -> BulkOrders</code>

## Tasks

Types:

- <code><a href="./src/resources/public/tasks.ts">PublicTaskRequest</a></code>
- <code><a href="./src/resources/public/tasks.ts">PublicTaskResponse</a></code>
- <code><a href="./src/resources/public/tasks.ts">PublicTaskSchema</a></code>
- <code><a href="./src/resources/public/tasks.ts">PublicTasksListResponse</a></code>

Methods:

- <code title="post /v1/public/tasks">client.public.tasks.<a href="./src/resources/public/tasks.ts">create</a>({ ...params }) -> PublicTaskResponse</code>
- <code title="get /v1/public/tasks/{task_id}">client.public.tasks.<a href="./src/resources/public/tasks.ts">retrieve</a>(taskID, { ...params }) -> PublicTaskSchema</code>
- <code title="put /v1/public/tasks/{task_id}">client.public.tasks.<a href="./src/resources/public/tasks.ts">update</a>(taskID, { ...params }) -> PublicTaskResponse</code>
- <code title="get /v1/public/tasks">client.public.tasks.<a href="./src/resources/public/tasks.ts">list</a>({ ...params }) -> PublicTasksListResponse</code>
- <code title="delete /v1/public/tasks/{task_id}">client.public.tasks.<a href="./src/resources/public/tasks.ts">delete</a>(taskID, { ...params }) -> PublicTaskResponse</code>

## Items

Types:

- <code><a href="./src/resources/public/items.ts">ItemRequest</a></code>
- <code><a href="./src/resources/public/items.ts">ItemResponse</a></code>
- <code><a href="./src/resources/public/items.ts">ShopTurboItem</a></code>
- <code><a href="./src/resources/public/items.ts">ItemListResponse</a></code>

Methods:

- <code title="post /v1/public/items">client.public.items.<a href="./src/resources/public/items.ts">create</a>({ ...params }) -> ItemResponse</code>
- <code title="get /v1/public/items/{item_id}">client.public.items.<a href="./src/resources/public/items.ts">retrieve</a>(itemID, { ...params }) -> ShopTurboItem</code>
- <code title="put /v1/public/items/{item_id}">client.public.items.<a href="./src/resources/public/items.ts">update</a>(itemID, { ...params }) -> ItemResponse</code>
- <code title="get /v1/public/items">client.public.items.<a href="./src/resources/public/items.ts">list</a>({ ...params }) -> ItemListResponse</code>
- <code title="delete /v1/public/items/{item_id}">client.public.items.<a href="./src/resources/public/items.ts">delete</a>(itemID, { ...params }) -> ItemResponse</code>

## Contacts

Types:

- <code><a href="./src/resources/public/contacts.ts">PublicContactRequest</a></code>
- <code><a href="./src/resources/public/contacts.ts">PublicContactResponse</a></code>
- <code><a href="./src/resources/public/contacts.ts">ContactRetrieveResponse</a></code>
- <code><a href="./src/resources/public/contacts.ts">ContactListResponse</a></code>

Methods:

- <code title="post /v1/public/contacts">client.public.contacts.<a href="./src/resources/public/contacts.ts">create</a>({ ...params }) -> PublicContactResponse</code>
- <code title="get /v1/public/contacts/{contact_id}">client.public.contacts.<a href="./src/resources/public/contacts.ts">retrieve</a>(contactID, { ...params }) -> ContactRetrieveResponse</code>
- <code title="put /v1/public/contacts/{contact_id}">client.public.contacts.<a href="./src/resources/public/contacts.ts">update</a>(contactID, { ...params }) -> PublicContactResponse</code>
- <code title="get /v1/public/contacts">client.public.contacts.<a href="./src/resources/public/contacts.ts">list</a>({ ...params }) -> ContactListResponse</code>
- <code title="delete /v1/public/contacts/{contact_id}">client.public.contacts.<a href="./src/resources/public/contacts.ts">delete</a>(contactID, { ...params }) -> PublicContactResponse</code>

## Companies

Types:

- <code><a href="./src/resources/public/companies.ts">PublicCompanyRequest</a></code>
- <code><a href="./src/resources/public/companies.ts">PublicCompanyResponse</a></code>
- <code><a href="./src/resources/public/companies.ts">CompanyRetrieveResponse</a></code>
- <code><a href="./src/resources/public/companies.ts">CompanyListResponse</a></code>

Methods:

- <code title="post /v1/public/companies">client.public.companies.<a href="./src/resources/public/companies.ts">create</a>({ ...params }) -> PublicCompanyResponse</code>
- <code title="get /v1/public/companies/{company_id}">client.public.companies.<a href="./src/resources/public/companies.ts">retrieve</a>(companyID, { ...params }) -> CompanyRetrieveResponse</code>
- <code title="put /v1/public/companies/{company_id}">client.public.companies.<a href="./src/resources/public/companies.ts">update</a>(companyID, { ...params }) -> PublicCompanyResponse</code>
- <code title="get /v1/public/companies">client.public.companies.<a href="./src/resources/public/companies.ts">list</a>({ ...params }) -> CompanyListResponse</code>
- <code title="delete /v1/public/companies/{company_id}">client.public.companies.<a href="./src/resources/public/companies.ts">delete</a>(companyID, { ...params }) -> PublicCompanyResponse</code>

## Deals

Types:

- <code><a href="./src/resources/public/deals.ts">Case</a></code>
- <code><a href="./src/resources/public/deals.ts">PublicCaseRequest</a></code>
- <code><a href="./src/resources/public/deals.ts">PublicCaseResponse</a></code>
- <code><a href="./src/resources/public/deals.ts">DealListResponse</a></code>
- <code><a href="./src/resources/public/deals.ts">DealListPipelinesResponse</a></code>

Methods:

- <code title="post /v1/public/deals">client.public.deals.<a href="./src/resources/public/deals.ts">create</a>({ ...params }) -> PublicCaseResponse</code>
- <code title="get /v1/public/deals/{case_id}">client.public.deals.<a href="./src/resources/public/deals.ts">retrieve</a>(caseID, { ...params }) -> Case</code>
- <code title="put /v1/public/deals/{case_id}">client.public.deals.<a href="./src/resources/public/deals.ts">update</a>(caseID, { ...params }) -> PublicCaseResponse</code>
- <code title="get /v1/public/deals">client.public.deals.<a href="./src/resources/public/deals.ts">list</a>({ ...params }) -> DealListResponse</code>
- <code title="delete /v1/public/deals/{case_id}">client.public.deals.<a href="./src/resources/public/deals.ts">delete</a>(caseID, { ...params }) -> PublicCaseResponse</code>
- <code title="get /v1/public/deals/pipelines">client.public.deals.<a href="./src/resources/public/deals.ts">listPipelines</a>({ ...params }) -> DealListPipelinesResponse</code>

## Tickets

Types:

- <code><a href="./src/resources/public/tickets.ts">Ticket</a></code>
- <code><a href="./src/resources/public/tickets.ts">TicketRequest</a></code>
- <code><a href="./src/resources/public/tickets.ts">TicketResponse</a></code>
- <code><a href="./src/resources/public/tickets.ts">TicketListResponse</a></code>
- <code><a href="./src/resources/public/tickets.ts">TicketListPipelinesResponse</a></code>

Methods:

- <code title="post /v1/public/tickets">client.public.tickets.<a href="./src/resources/public/tickets.ts">create</a>({ ...params }) -> TicketResponse</code>
- <code title="get /v1/public/tickets/{ticket_id}">client.public.tickets.<a href="./src/resources/public/tickets.ts">retrieve</a>(ticketID, { ...params }) -> Ticket</code>
- <code title="put /v1/public/tickets/{ticket_id}">client.public.tickets.<a href="./src/resources/public/tickets.ts">update</a>(ticketID, { ...params }) -> TicketResponse</code>
- <code title="get /v1/public/tickets">client.public.tickets.<a href="./src/resources/public/tickets.ts">list</a>({ ...params }) -> TicketListResponse</code>
- <code title="delete /v1/public/tickets/{ticket_id}">client.public.tickets.<a href="./src/resources/public/tickets.ts">delete</a>(ticketID, { ...params }) -> TicketResponse</code>
- <code title="get /v1/public/tickets/pipelines">client.public.tickets.<a href="./src/resources/public/tickets.ts">listPipelines</a>({ ...params }) -> TicketListPipelinesResponse</code>
- <code title="patch /v1/public/tickets/{ticket_id}/status">client.public.tickets.<a href="./src/resources/public/tickets.ts">updateStatus</a>(ticketID, { ...params }) -> TicketResponse</code>

## Subscriptions

Types:

- <code><a href="./src/resources/public/subscriptions.ts">SubscriptionDetail</a></code>
- <code><a href="./src/resources/public/subscriptions.ts">SubscriptionItemInput</a></code>
- <code><a href="./src/resources/public/subscriptions.ts">SubscriptionListResponse</a></code>
- <code><a href="./src/resources/public/subscriptions.ts">SubscriptionDeleteResponse</a></code>

Methods:

- <code title="post /v1/public/subscriptions">client.public.subscriptions.<a href="./src/resources/public/subscriptions.ts">create</a>({ ...params }) -> SubscriptionDetail</code>
- <code title="get /v1/public/subscriptions/{subscription_id}">client.public.subscriptions.<a href="./src/resources/public/subscriptions.ts">retrieve</a>(subscriptionID, { ...params }) -> SubscriptionDetail</code>
- <code title="put /v1/public/subscriptions/{subscription_id}">client.public.subscriptions.<a href="./src/resources/public/subscriptions.ts">update</a>(subscriptionID, { ...params }) -> SubscriptionDetail</code>
- <code title="get /v1/public/subscriptions">client.public.subscriptions.<a href="./src/resources/public/subscriptions.ts">list</a>({ ...params }) -> SubscriptionListResponse</code>
- <code title="delete /v1/public/subscriptions/{subscription_id}">client.public.subscriptions.<a href="./src/resources/public/subscriptions.ts">delete</a>(subscriptionID, { ...params }) -> SubscriptionDeleteResponse</code>

## Estimates

Types:

- <code><a href="./src/resources/public/estimates.ts">Estimate</a></code>
- <code><a href="./src/resources/public/estimates.ts">PublicEstimateRequest</a></code>
- <code><a href="./src/resources/public/estimates.ts">PublicEstimateResponse</a></code>
- <code><a href="./src/resources/public/estimates.ts">EstimateListResponse</a></code>

Methods:

- <code title="post /v1/public/estimates">client.public.estimates.<a href="./src/resources/public/estimates.ts">create</a>({ ...params }) -> PublicEstimateResponse</code>
- <code title="get /v1/public/estimates/{estimate_id}">client.public.estimates.<a href="./src/resources/public/estimates.ts">retrieve</a>(estimateID, { ...params }) -> Estimate</code>
- <code title="get /v1/public/estimates/{estimate_id}/pdf">client.public.estimates.<a href="./src/resources/public/estimates.ts">downloadPDF</a>(estimateID, { ...params }) -> Response</code>
- <code title="put /v1/public/estimates/{estimate_id}">client.public.estimates.<a href="./src/resources/public/estimates.ts">update</a>(estimateID, { ...params }) -> PublicEstimateResponse</code>
- <code title="get /v1/public/estimates">client.public.estimates.<a href="./src/resources/public/estimates.ts">list</a>({ ...params }) -> EstimateListResponse</code>
- <code title="delete /v1/public/estimates/{estimate_id}">client.public.estimates.<a href="./src/resources/public/estimates.ts">delete</a>(estimateID, { ...params }) -> PublicEstimateResponse</code>

## Invoices

Types:

- <code><a href="./src/resources/public/invoices.ts">Invoice</a></code>
- <code><a href="./src/resources/public/invoices.ts">InvoiceRequest</a></code>
- <code><a href="./src/resources/public/invoices.ts">InvoiceSchema</a></code>
- <code><a href="./src/resources/public/invoices.ts">InvoiceListResponse</a></code>

Methods:

- <code title="post /v1/public/invoices">client.public.invoices.<a href="./src/resources/public/invoices.ts">create</a>({ ...params }) -> Invoice</code>
- <code title="get /v1/public/invoices/{invoice_id}">client.public.invoices.<a href="./src/resources/public/invoices.ts">retrieve</a>(invoiceID, { ...params }) -> InvoiceSchema</code>
- <code title="get /v1/public/invoices/{invoice_id}/pdf">client.public.invoices.<a href="./src/resources/public/invoices.ts">downloadPDF</a>(invoiceID, { ...params }) -> Response</code>
- <code title="put /v1/public/invoices/{invoice_id}">client.public.invoices.<a href="./src/resources/public/invoices.ts">update</a>(invoiceID, { ...params }) -> Invoice</code>
- <code title="get /v1/public/invoices">client.public.invoices.<a href="./src/resources/public/invoices.ts">list</a>({ ...params }) -> InvoiceListResponse</code>
- <code title="delete /v1/public/invoices/{invoice_id}">client.public.invoices.<a href="./src/resources/public/invoices.ts">delete</a>(invoiceID, { ...params }) -> Invoice</code>

## Payments

Types:

- <code><a href="./src/resources/public/payments.ts">PaymentRequest</a></code>
- <code><a href="./src/resources/public/payments.ts">PaymentResponse</a></code>
- <code><a href="./src/resources/public/payments.ts">Receipt</a></code>
- <code><a href="./src/resources/public/payments.ts">PaymentListResponse</a></code>

Methods:

- <code title="post /v1/public/payments">client.public.payments.<a href="./src/resources/public/payments.ts">create</a>({ ...params }) -> PaymentResponse</code>
- <code title="get /v1/public/payments/{payment_id}">client.public.payments.<a href="./src/resources/public/payments.ts">retrieve</a>(paymentID, { ...params }) -> Receipt</code>
- <code title="get /v1/public/payments/{payment_id}/pdf">client.public.payments.<a href="./src/resources/public/payments.ts">downloadPDF</a>(paymentID, { ...params }) -> Response</code>
- <code title="put /v1/public/payments/{payment_id}">client.public.payments.<a href="./src/resources/public/payments.ts">update</a>(paymentID, { ...params }) -> PaymentResponse</code>
- <code title="get /v1/public/payments">client.public.payments.<a href="./src/resources/public/payments.ts">list</a>({ ...params }) -> PaymentListResponse</code>
- <code title="delete /v1/public/payments/{payment_id}">client.public.payments.<a href="./src/resources/public/payments.ts">delete</a>(paymentID, { ...params }) -> PaymentResponse</code>

## Expenses

Types:

- <code><a href="./src/resources/public/expenses.ts">Expense</a></code>
- <code><a href="./src/resources/public/expenses.ts">PublicExpenseRequest</a></code>
- <code><a href="./src/resources/public/expenses.ts">PublicExpenseResponse</a></code>
- <code><a href="./src/resources/public/expenses.ts">ExpenseListResponse</a></code>
- <code><a href="./src/resources/public/expenses.ts">ExpenseUploadAttachmentResponse</a></code>

Methods:

- <code title="post /v1/public/expenses">client.public.expenses.<a href="./src/resources/public/expenses.ts">create</a>({ ...params }) -> PublicExpenseResponse</code>
- <code title="get /v1/public/expenses/{expense_id}">client.public.expenses.<a href="./src/resources/public/expenses.ts">retrieve</a>(expenseID, { ...params }) -> Expense</code>
- <code title="put /v1/public/expenses/{expense_id}">client.public.expenses.<a href="./src/resources/public/expenses.ts">update</a>(expenseID, { ...params }) -> PublicExpenseResponse</code>
- <code title="get /v1/public/expenses">client.public.expenses.<a href="./src/resources/public/expenses.ts">list</a>({ ...params }) -> ExpenseListResponse</code>
- <code title="delete /v1/public/expenses/{expense_id}">client.public.expenses.<a href="./src/resources/public/expenses.ts">delete</a>(expenseID, { ...params }) -> PublicExpenseResponse</code>
- <code title="post /v1/public/expenses/files">client.public.expenses.<a href="./src/resources/public/expenses.ts">uploadAttachment</a>({ ...params }) -> ExpenseUploadAttachmentResponse</code>

## Inventories

Types:

- <code><a href="./src/resources/public/inventories.ts">InventoryRequest</a></code>
- <code><a href="./src/resources/public/inventories.ts">InventoryResponse</a></code>
- <code><a href="./src/resources/public/inventories.ts">ShopTurboInventory</a></code>
- <code><a href="./src/resources/public/inventories.ts">InventoryListResponse</a></code>

Methods:

- <code title="post /v1/public/inventories">client.public.inventories.<a href="./src/resources/public/inventories.ts">create</a>({ ...params }) -> InventoryResponse</code>
- <code title="get /v1/public/inventories/{inventory_id}">client.public.inventories.<a href="./src/resources/public/inventories.ts">retrieve</a>(inventoryID, { ...params }) -> ShopTurboInventory</code>
- <code title="put /v1/public/inventories/{inventory_id}">client.public.inventories.<a href="./src/resources/public/inventories.ts">update</a>(inventoryID, { ...params }) -> InventoryResponse</code>
- <code title="get /v1/public/inventories">client.public.inventories.<a href="./src/resources/public/inventories.ts">list</a>({ ...params }) -> InventoryListResponse</code>
- <code title="delete /v1/public/inventories/{inventory_id}">client.public.inventories.<a href="./src/resources/public/inventories.ts">delete</a>(inventoryID, { ...params }) -> InventoryResponse</code>

## Locations

Types:

- <code><a href="./src/resources/public/locations.ts">Location</a></code>
- <code><a href="./src/resources/public/locations.ts">LocationRequest</a></code>
- <code><a href="./src/resources/public/locations.ts">Warehouse</a></code>
- <code><a href="./src/resources/public/locations.ts">LocationListResponse</a></code>

Methods:

- <code title="post /v1/public/locations">client.public.locations.<a href="./src/resources/public/locations.ts">create</a>({ ...params }) -> Location</code>
- <code title="get /v1/public/locations/{location_id}">client.public.locations.<a href="./src/resources/public/locations.ts">retrieve</a>(locationID, { ...params }) -> Warehouse</code>
- <code title="put /v1/public/locations/{location_id}">client.public.locations.<a href="./src/resources/public/locations.ts">update</a>(locationID, { ...params }) -> Location</code>
- <code title="get /v1/public/locations">client.public.locations.<a href="./src/resources/public/locations.ts">list</a>({ ...params }) -> LocationListResponse</code>
- <code title="delete /v1/public/locations/{location_id}">client.public.locations.<a href="./src/resources/public/locations.ts">delete</a>(locationID, { ...params }) -> Location</code>

## InventoryTransactions

Types:

- <code><a href="./src/resources/public/inventory-transactions.ts">TransactionRequest</a></code>
- <code><a href="./src/resources/public/inventory-transactions.ts">TransactionResponse</a></code>
- <code><a href="./src/resources/public/inventory-transactions.ts">TransactionSchema</a></code>
- <code><a href="./src/resources/public/inventory-transactions.ts">InventoryTransactionListResponse</a></code>

Methods:

- <code title="post /v1/public/inventory-transactions">client.public.inventoryTransactions.<a href="./src/resources/public/inventory-transactions.ts">create</a>({ ...params }) -> TransactionResponse</code>
- <code title="get /v1/public/inventory-transactions/{transaction_id}">client.public.inventoryTransactions.<a href="./src/resources/public/inventory-transactions.ts">retrieve</a>(transactionID, { ...params }) -> TransactionSchema</code>
- <code title="put /v1/public/inventory-transactions/{transaction_id}">client.public.inventoryTransactions.<a href="./src/resources/public/inventory-transactions.ts">update</a>(transactionID, { ...params }) -> TransactionResponse</code>
- <code title="get /v1/public/inventory-transactions">client.public.inventoryTransactions.<a href="./src/resources/public/inventory-transactions.ts">list</a>({ ...params }) -> InventoryTransactionListResponse</code>
- <code title="delete /v1/public/inventory-transactions/{transaction_id}">client.public.inventoryTransactions.<a href="./src/resources/public/inventory-transactions.ts">delete</a>(transactionID) -> TransactionResponse</code>

## Meters

Types:

- <code><a href="./src/resources/public/meters.ts">CommerceMeter</a></code>
- <code><a href="./src/resources/public/meters.ts">Meter</a></code>
- <code><a href="./src/resources/public/meters.ts">MeterRequest</a></code>
- <code><a href="./src/resources/public/meters.ts">MeterListResponse</a></code>

Methods:

- <code title="post /v1/public/meters">client.public.meters.<a href="./src/resources/public/meters.ts">create</a>({ ...params }) -> Meter</code>
- <code title="get /v1/public/meters/{meter_id}">client.public.meters.<a href="./src/resources/public/meters.ts">retrieve</a>(meterID, { ...params }) -> CommerceMeter</code>
- <code title="put /v1/public/meters/{meter_id}">client.public.meters.<a href="./src/resources/public/meters.ts">update</a>(meterID, { ...params }) -> Meter</code>
- <code title="get /v1/public/meters">client.public.meters.<a href="./src/resources/public/meters.ts">list</a>({ ...params }) -> MeterListResponse</code>
- <code title="delete /v1/public/meters/{meter_id}">client.public.meters.<a href="./src/resources/public/meters.ts">delete</a>(meterID, { ...params }) -> Meter</code>

## Properties

Types:

- <code><a href="./src/resources/public/properties.ts">Property</a></code>
- <code><a href="./src/resources/public/properties.ts">PropertyMutation</a></code>
- <code><a href="./src/resources/public/properties.ts">PropertyUpsert</a></code>
- <code><a href="./src/resources/public/properties.ts">PropertyListResponse</a></code>

Methods:

- <code title="post /v1/public/properties/{object_name}">client.public.properties.<a href="./src/resources/public/properties.ts">create</a>(objectName, { ...params }) -> PropertyMutation</code>
- <code title="get /v1/public/properties/{object_name}/{property_ref}">client.public.properties.<a href="./src/resources/public/properties.ts">retrieve</a>(propertyRef, { ...params }) -> Property</code>
- <code title="put /v1/public/properties/{object_name}/{property_ref}">client.public.properties.<a href="./src/resources/public/properties.ts">update</a>(propertyRef, { ...params }) -> PropertyMutation</code>
- <code title="get /v1/public/properties/{object_name}">client.public.properties.<a href="./src/resources/public/properties.ts">list</a>(objectName, { ...params }) -> PropertyListResponse</code>
- <code title="delete /v1/public/properties/{object_name}/{property_ref}">client.public.properties.<a href="./src/resources/public/properties.ts">delete</a>(propertyRef, { ...params }) -> PropertyMutation</code>

## PurchaseOrders

Types:

- <code><a href="./src/resources/public/purchase-orders.ts">PurchaseOrder</a></code>
- <code><a href="./src/resources/public/purchase-orders.ts">PurchaseOrderRequest</a></code>
- <code><a href="./src/resources/public/purchase-orders.ts">PurchaseOrderResponse</a></code>
- <code><a href="./src/resources/public/purchase-orders.ts">PurchaseOrderListResponse</a></code>

Methods:

- <code title="post /v1/public/purchase-orders">client.public.purchaseOrders.<a href="./src/resources/public/purchase-orders.ts">create</a>({ ...params }) -> PurchaseOrderResponse</code>
- <code title="get /v1/public/purchase-orders/{purchase_order_id}">client.public.purchaseOrders.<a href="./src/resources/public/purchase-orders.ts">retrieve</a>(purchaseOrderID, { ...params }) -> PurchaseOrder</code>
- <code title="put /v1/public/purchase-orders/{purchase_order_id}">client.public.purchaseOrders.<a href="./src/resources/public/purchase-orders.ts">update</a>(purchaseOrderID, { ...params }) -> PurchaseOrderResponse</code>
- <code title="get /v1/public/purchase-orders">client.public.purchaseOrders.<a href="./src/resources/public/purchase-orders.ts">list</a>({ ...params }) -> PurchaseOrderListResponse</code>
- <code title="delete /v1/public/purchase-orders/{purchase_order_id}">client.public.purchaseOrders.<a href="./src/resources/public/purchase-orders.ts">delete</a>(purchaseOrderID, { ...params }) -> PurchaseOrderResponse</code>

## Slips

Types:

- <code><a href="./src/resources/public/slips.ts">Slip</a></code>
- <code><a href="./src/resources/public/slips.ts">SlipRequest</a></code>
- <code><a href="./src/resources/public/slips.ts">SlipResponse</a></code>
- <code><a href="./src/resources/public/slips.ts">SlipListResponse</a></code>

Methods:

- <code title="post /v1/public/slips">client.public.slips.<a href="./src/resources/public/slips.ts">create</a>({ ...params }) -> SlipResponse</code>
- <code title="get /v1/public/slips/{slip_id}">client.public.slips.<a href="./src/resources/public/slips.ts">retrieve</a>(slipID, { ...params }) -> Slip</code>
- <code title="get /v1/public/slips/{slip_id}/pdf">client.public.slips.<a href="./src/resources/public/slips.ts">downloadPDF</a>(slipID, { ...params }) -> Response</code>
- <code title="put /v1/public/slips/{slip_id}">client.public.slips.<a href="./src/resources/public/slips.ts">update</a>(slipID, { ...params }) -> SlipResponse</code>
- <code title="get /v1/public/slips">client.public.slips.<a href="./src/resources/public/slips.ts">list</a>({ ...params }) -> SlipListResponse</code>
- <code title="delete /v1/public/slips/{slip_id}">client.public.slips.<a href="./src/resources/public/slips.ts">delete</a>(slipID, { ...params }) -> SlipResponse</code>

## Bills

Types:

- <code><a href="./src/resources/public/bills.ts">Bill</a></code>
- <code><a href="./src/resources/public/bills.ts">PublicBillRequest</a></code>
- <code><a href="./src/resources/public/bills.ts">PublicBillResponse</a></code>
- <code><a href="./src/resources/public/bills.ts">BillListResponse</a></code>

Methods:

- <code title="post /v1/public/bills">client.public.bills.<a href="./src/resources/public/bills.ts">create</a>({ ...params }) -> PublicBillResponse</code>
- <code title="get /v1/public/bills/{bill_id}">client.public.bills.<a href="./src/resources/public/bills.ts">retrieve</a>(billID, { ...params }) -> Bill</code>
- <code title="put /v1/public/bills/{bill_id}">client.public.bills.<a href="./src/resources/public/bills.ts">update</a>(billID, { ...params }) -> PublicBillResponse</code>
- <code title="get /v1/public/bills">client.public.bills.<a href="./src/resources/public/bills.ts">list</a>({ ...params }) -> BillListResponse</code>
- <code title="delete /v1/public/bills/{bill_id}">client.public.bills.<a href="./src/resources/public/bills.ts">delete</a>(billID, { ...params }) -> PublicBillResponse</code>

## Disbursements

Types:

- <code><a href="./src/resources/public/disbursements.ts">Disbursement</a></code>
- <code><a href="./src/resources/public/disbursements.ts">PublicDisbursementRequest</a></code>
- <code><a href="./src/resources/public/disbursements.ts">PublicDisbursementResponse</a></code>
- <code><a href="./src/resources/public/disbursements.ts">DisbursementListResponse</a></code>

Methods:

- <code title="post /v1/public/disbursements">client.public.disbursements.<a href="./src/resources/public/disbursements.ts">create</a>({ ...params }) -> PublicDisbursementResponse</code>
- <code title="get /v1/public/disbursements/{disbursement_id}">client.public.disbursements.<a href="./src/resources/public/disbursements.ts">retrieve</a>(disbursementID, { ...params }) -> Disbursement</code>
- <code title="put /v1/public/disbursements/{disbursement_id}">client.public.disbursements.<a href="./src/resources/public/disbursements.ts">update</a>(disbursementID, { ...params }) -> PublicDisbursementResponse</code>
- <code title="get /v1/public/disbursements">client.public.disbursements.<a href="./src/resources/public/disbursements.ts">list</a>({ ...params }) -> DisbursementListResponse</code>
- <code title="delete /v1/public/disbursements/{disbursement_id}">client.public.disbursements.<a href="./src/resources/public/disbursements.ts">delete</a>(disbursementID, { ...params }) -> PublicDisbursementResponse</code>

## Reports

Types:

- <code><a href="./src/resources/public/reports.ts">CreateReport</a></code>
- <code><a href="./src/resources/public/reports.ts">ReportFilters</a></code>
- <code><a href="./src/resources/public/reports.ts">ReportPanel</a></code>
- <code><a href="./src/resources/public/reports.ts">ReportType</a></code>
- <code><a href="./src/resources/public/reports.ts">ReportRetrieveResponse</a></code>
- <code><a href="./src/resources/public/reports.ts">ReportListResponse</a></code>
- <code><a href="./src/resources/public/reports.ts">ReportDeleteResponse</a></code>

Methods:

- <code title="post /v1/public/reports">client.public.reports.<a href="./src/resources/public/reports.ts">create</a>({ ...params }) -> CreateReport</code>
- <code title="get /v1/public/reports/{report_id}">client.public.reports.<a href="./src/resources/public/reports.ts">retrieve</a>(reportID, { ...params }) -> ReportRetrieveResponse</code>
- <code title="put /v1/public/reports/{report_id}">client.public.reports.<a href="./src/resources/public/reports.ts">update</a>(reportID, { ...params }) -> CreateReport</code>
- <code title="get /v1/public/reports">client.public.reports.<a href="./src/resources/public/reports.ts">list</a>({ ...params }) -> ReportListResponse</code>
- <code title="delete /v1/public/reports/{report_id}">client.public.reports.<a href="./src/resources/public/reports.ts">delete</a>(reportID, { ...params }) -> ReportDeleteResponse</code>

## Workflows

Types:

- <code><a href="./src/resources/public/workflows.ts">WorkflowRunResponse</a></code>
- <code><a href="./src/resources/public/workflows.ts">WorkflowRetrieveResponse</a></code>
- <code><a href="./src/resources/public/workflows.ts">WorkflowListResponse</a></code>
- <code><a href="./src/resources/public/workflows.ts">WorkflowCreateOrUpdateResponse</a></code>
- <code><a href="./src/resources/public/workflows.ts">WorkflowListActionsResponse</a></code>

Methods:

- <code title="get /v1/public/workflows/{workflow_ref}">client.public.workflows.<a href="./src/resources/public/workflows.ts">retrieve</a>(workflowRef) -> WorkflowRetrieveResponse</code>
- <code title="get /v1/public/workflows">client.public.workflows.<a href="./src/resources/public/workflows.ts">list</a>({ ...params }) -> WorkflowListResponse</code>
- <code title="post /v1/public/workflows">client.public.workflows.<a href="./src/resources/public/workflows.ts">createOrUpdate</a>({ ...params }) -> WorkflowCreateOrUpdateResponse</code>
- <code title="get /v1/public/workflows/actions">client.public.workflows.<a href="./src/resources/public/workflows.ts">listActions</a>() -> WorkflowListActionsResponse</code>
- <code title="get /v1/public/workflows/runs/{run_id}">client.public.workflows.<a href="./src/resources/public/workflows.ts">retrieveRun</a>(runID) -> WorkflowRunResponse</code>
- <code title="post /v1/public/workflows/{workflow_ref}/run">client.public.workflows.<a href="./src/resources/public/workflows.ts">run</a>(workflowRef) -> WorkflowRunResponse</code>

## Calendar

Types:

- <code><a href="./src/resources/public/calendar/calendar.ts">PublicCalendarAttendance</a></code>
- <code><a href="./src/resources/public/calendar/calendar.ts">CalendarBootstrapResponse</a></code>
- <code><a href="./src/resources/public/calendar/calendar.ts">CalendarCheckAvailabilityResponse</a></code>

Methods:

- <code title="get /v1/public/calendar/bootstrap">client.public.calendar.<a href="./src/resources/public/calendar/calendar.ts">bootstrap</a>({ ...params }) -> CalendarBootstrapResponse</code>
- <code title="get /v1/public/calendar/availability">client.public.calendar.<a href="./src/resources/public/calendar/calendar.ts">checkAvailability</a>({ ...params }) -> CalendarCheckAvailabilityResponse</code>

### Attendance

Types:

- <code><a href="./src/resources/public/calendar/attendance.ts">PublicCalendarMutation</a></code>

Methods:

- <code title="post /v1/public/calendar/attendance">client.public.calendar.attendance.<a href="./src/resources/public/calendar/attendance.ts">create</a>({ ...params }) -> PublicCalendarMutation</code>
- <code title="post /v1/public/calendar/attendance/{attendance_id}/cancel">client.public.calendar.attendance.<a href="./src/resources/public/calendar/attendance.ts">cancel</a>(attendanceID) -> PublicCalendarMutation</code>
- <code title="post /v1/public/calendar/attendance/{attendance_id}/reschedule">client.public.calendar.attendance.<a href="./src/resources/public/calendar/attendance.ts">reschedule</a>(attendanceID, { ...params }) -> PublicCalendarMutation</code>

## Auth

Types:

- <code><a href="./src/resources/public/auth.ts">AuthGetCurrentIdentityResponse</a></code>

Methods:

- <code title="get /v1/public/auth/whoami">client.public.auth.<a href="./src/resources/public/auth.ts">getCurrentIdentity</a>() -> AuthGetCurrentIdentityResponse</code>
