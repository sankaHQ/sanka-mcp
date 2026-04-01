// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import * as AuthAPI from './auth';
import { Auth, AuthGetCurrentIdentityResponse } from './auth';
import * as BillsAPI from './bills';
import {
  Bill,
  BillCreateParams,
  BillDeleteParams,
  BillListParams,
  BillListResponse,
  BillRetrieveParams,
  BillUpdateParams,
  Bills,
  PublicBillRequest,
  PublicBillResponse,
} from './bills';
import * as CompaniesAPI from './companies';
import {
  Companies,
  CompanyCreateParams,
  CompanyDeleteParams,
  CompanyListParams,
  CompanyListResponse,
  CompanyRetrieveParams,
  CompanyRetrieveResponse,
  CompanyUpdateParams,
  PublicCompanyRequest,
  PublicCompanyResponse,
} from './companies';
import * as ContactsAPI from './contacts';
import {
  ContactCreateParams,
  ContactDeleteParams,
  ContactListParams,
  ContactListResponse,
  ContactRetrieveParams,
  ContactRetrieveResponse,
  ContactUpdateParams,
  Contacts,
  PublicContactRequest,
  PublicContactResponse,
} from './contacts';
import * as DealsAPI from './deals';
import {
  Case,
  DealCreateParams,
  DealDeleteParams,
  DealListParams,
  DealListPipelinesParams,
  DealListPipelinesResponse,
  DealListResponse,
  DealRetrieveParams,
  DealUpdateParams,
  Deals,
  PublicCaseRequest,
  PublicCaseResponse,
} from './deals';
import * as DisbursementsAPI from './disbursements';
import {
  Disbursement,
  DisbursementCreateParams,
  DisbursementDeleteParams,
  DisbursementListParams,
  DisbursementListResponse,
  DisbursementRetrieveParams,
  DisbursementUpdateParams,
  Disbursements,
  PublicDisbursementRequest,
  PublicDisbursementResponse,
} from './disbursements';
import * as EstimatesAPI from './estimates';
import {
  Estimate,
  EstimateCreateParams,
  EstimateDeleteParams,
  EstimateListParams,
  EstimateListResponse,
  EstimateRetrieveParams,
  EstimateUpdateParams,
  Estimates,
  PublicEstimateRequest,
  PublicEstimateResponse,
} from './estimates';
import * as ExpensesAPI from './expenses';
import {
  Expense,
  ExpenseCreateParams,
  ExpenseDeleteParams,
  ExpenseListParams,
  ExpenseListResponse,
  ExpenseRetrieveParams,
  ExpenseUpdateParams,
  ExpenseUploadAttachmentParams,
  ExpenseUploadAttachmentResponse,
  Expenses,
  PublicExpenseRequest,
  PublicExpenseResponse,
} from './expenses';
import * as InventoriesAPI from './inventories';
import {
  Inventories,
  InventoryCreateParams,
  InventoryDeleteParams,
  InventoryListParams,
  InventoryListResponse,
  InventoryRequest,
  InventoryResponse,
  InventoryRetrieveParams,
  InventoryUpdateParams,
  ShopTurboInventory,
} from './inventories';
import * as InventoryTransactionsAPI from './inventory-transactions';
import {
  InventoryTransactionCreateParams,
  InventoryTransactionListParams,
  InventoryTransactionListResponse,
  InventoryTransactionRetrieveParams,
  InventoryTransactionUpdateParams,
  InventoryTransactions,
  TransactionRequest,
  TransactionResponse,
  TransactionSchema,
} from './inventory-transactions';
import * as InvoicesAPI from './invoices';
import {
  Invoice,
  InvoiceCreateParams,
  InvoiceDeleteParams,
  InvoiceListParams,
  InvoiceListResponse,
  InvoiceRequest,
  InvoiceRetrieveParams,
  InvoiceSchema,
  InvoiceUpdateParams,
  Invoices,
} from './invoices';
import * as ItemsAPI from './items';
import {
  ItemCreateParams,
  ItemDeleteParams,
  ItemListParams,
  ItemListResponse,
  ItemRequest,
  ItemResponse,
  ItemRetrieveParams,
  ItemUpdateParams,
  Items,
  ShopTurboItem,
} from './items';
import * as LocationsAPI from './locations';
import {
  Location,
  LocationCreateParams,
  LocationDeleteParams,
  LocationListParams,
  LocationListResponse,
  LocationRequest,
  LocationRetrieveParams,
  LocationUpdateParams,
  Locations,
  Warehouse,
} from './locations';
import * as MetersAPI from './meters';
import {
  CommerceMeter,
  Meter,
  MeterCreateParams,
  MeterDeleteParams,
  MeterListParams,
  MeterListResponse,
  MeterRequest,
  MeterRetrieveParams,
  MeterUpdateParams,
  Meters,
} from './meters';
import * as OrdersAPI from './orders';
import {
  BulkOrder,
  BulkOrders,
  Order,
  OrderBulkCreateParams,
  OrderCreateParams,
  OrderDeleteParams,
  OrderDeleteResponse,
  OrderListParams,
  OrderListResponse,
  OrderRetrieveParams,
  OrderRetrieveResponse,
  OrderUpdateParams,
  Orders,
} from './orders';
import * as PaymentsAPI from './payments';
import {
  PaymentCreateParams,
  PaymentDeleteParams,
  PaymentListParams,
  PaymentListResponse,
  PaymentRequest,
  PaymentResponse,
  PaymentRetrieveParams,
  PaymentUpdateParams,
  Payments,
  Receipt,
} from './payments';
import * as PropertiesAPI from './properties';
import {
  Properties,
  Property,
  PropertyCreateParams,
  PropertyDeleteParams,
  PropertyListParams,
  PropertyListResponse,
  PropertyMutation,
  PropertyRetrieveParams,
  PropertyUpdateParams,
  PropertyUpsert,
} from './properties';
import * as PurchaseOrdersAPI from './purchase-orders';
import {
  PurchaseOrder,
  PurchaseOrderCreateParams,
  PurchaseOrderDeleteParams,
  PurchaseOrderListParams,
  PurchaseOrderListResponse,
  PurchaseOrderRequest,
  PurchaseOrderResponse,
  PurchaseOrderRetrieveParams,
  PurchaseOrderUpdateParams,
  PurchaseOrders,
} from './purchase-orders';
import * as ReportsAPI from './reports';
import {
  CreateReport,
  ReportCreateParams,
  ReportDeleteParams,
  ReportDeleteResponse,
  ReportFilters,
  ReportListParams,
  ReportListResponse,
  ReportPanel,
  ReportRetrieveParams,
  ReportRetrieveResponse,
  ReportType,
  ReportUpdateParams,
  Reports,
} from './reports';
import * as SlipsAPI from './slips';
import {
  Slip,
  SlipCreateParams,
  SlipDeleteParams,
  SlipListParams,
  SlipListResponse,
  SlipRequest,
  SlipResponse,
  SlipRetrieveParams,
  SlipUpdateParams,
  Slips,
} from './slips';
import * as SubscriptionsAPI from './subscriptions';
import {
  SubscriptionCreateParams,
  SubscriptionDeleteParams,
  SubscriptionDeleteResponse,
  SubscriptionDetail,
  SubscriptionItemInput,
  SubscriptionListParams,
  SubscriptionListResponse,
  SubscriptionRetrieveParams,
  SubscriptionUpdateParams,
  Subscriptions,
} from './subscriptions';
import * as TicketsAPI from './tickets';
import {
  Ticket,
  TicketCreateParams,
  TicketDeleteParams,
  TicketListParams,
  TicketListPipelinesParams,
  TicketListPipelinesResponse,
  TicketListResponse,
  TicketRequest,
  TicketResponse,
  TicketRetrieveParams,
  TicketUpdateParams,
  TicketUpdateStatusParams,
  Tickets,
} from './tickets';
import * as WorkflowsAPI from './workflows';
import {
  WorkflowCreateOrUpdateParams,
  WorkflowCreateOrUpdateResponse,
  WorkflowListActionsResponse,
  WorkflowListParams,
  WorkflowListResponse,
  WorkflowRetrieveResponse,
  WorkflowRunResponse,
  Workflows,
} from './workflows';
import * as CalendarAPI from './calendar/calendar';
import {
  Calendar,
  CalendarBootstrapParams,
  CalendarBootstrapResponse,
  CalendarCheckAvailabilityParams,
  CalendarCheckAvailabilityResponse,
  PublicCalendarAttendance,
} from './calendar/calendar';

export class Public extends APIResource {
  orders: OrdersAPI.Orders = new OrdersAPI.Orders(this._client);
  items: ItemsAPI.Items = new ItemsAPI.Items(this._client);
  contacts: ContactsAPI.Contacts = new ContactsAPI.Contacts(this._client);
  companies: CompaniesAPI.Companies = new CompaniesAPI.Companies(this._client);
  deals: DealsAPI.Deals = new DealsAPI.Deals(this._client);
  tickets: TicketsAPI.Tickets = new TicketsAPI.Tickets(this._client);
  subscriptions: SubscriptionsAPI.Subscriptions = new SubscriptionsAPI.Subscriptions(this._client);
  estimates: EstimatesAPI.Estimates = new EstimatesAPI.Estimates(this._client);
  invoices: InvoicesAPI.Invoices = new InvoicesAPI.Invoices(this._client);
  payments: PaymentsAPI.Payments = new PaymentsAPI.Payments(this._client);
  expenses: ExpensesAPI.Expenses = new ExpensesAPI.Expenses(this._client);
  inventories: InventoriesAPI.Inventories = new InventoriesAPI.Inventories(this._client);
  locations: LocationsAPI.Locations = new LocationsAPI.Locations(this._client);
  inventoryTransactions: InventoryTransactionsAPI.InventoryTransactions =
    new InventoryTransactionsAPI.InventoryTransactions(this._client);
  meters: MetersAPI.Meters = new MetersAPI.Meters(this._client);
  properties: PropertiesAPI.Properties = new PropertiesAPI.Properties(this._client);
  purchaseOrders: PurchaseOrdersAPI.PurchaseOrders = new PurchaseOrdersAPI.PurchaseOrders(this._client);
  slips: SlipsAPI.Slips = new SlipsAPI.Slips(this._client);
  bills: BillsAPI.Bills = new BillsAPI.Bills(this._client);
  disbursements: DisbursementsAPI.Disbursements = new DisbursementsAPI.Disbursements(this._client);
  reports: ReportsAPI.Reports = new ReportsAPI.Reports(this._client);
  workflows: WorkflowsAPI.Workflows = new WorkflowsAPI.Workflows(this._client);
  calendar: CalendarAPI.Calendar = new CalendarAPI.Calendar(this._client);
  auth: AuthAPI.Auth = new AuthAPI.Auth(this._client);
}

Public.Orders = Orders;
Public.Items = Items;
Public.Contacts = Contacts;
Public.Companies = Companies;
Public.Deals = Deals;
Public.Tickets = Tickets;
Public.Subscriptions = Subscriptions;
Public.Estimates = Estimates;
Public.Invoices = Invoices;
Public.Payments = Payments;
Public.Expenses = Expenses;
Public.Inventories = Inventories;
Public.Locations = Locations;
Public.InventoryTransactions = InventoryTransactions;
Public.Meters = Meters;
Public.Properties = Properties;
Public.PurchaseOrders = PurchaseOrders;
Public.Slips = Slips;
Public.Bills = Bills;
Public.Disbursements = Disbursements;
Public.Reports = Reports;
Public.Workflows = Workflows;
Public.Calendar = Calendar;
Public.Auth = Auth;

export declare namespace Public {
  export {
    Orders as Orders,
    type BulkOrder as BulkOrder,
    type BulkOrders as BulkOrders,
    type Order as Order,
    type OrderRetrieveResponse as OrderRetrieveResponse,
    type OrderListResponse as OrderListResponse,
    type OrderDeleteResponse as OrderDeleteResponse,
    type OrderCreateParams as OrderCreateParams,
    type OrderRetrieveParams as OrderRetrieveParams,
    type OrderUpdateParams as OrderUpdateParams,
    type OrderListParams as OrderListParams,
    type OrderDeleteParams as OrderDeleteParams,
    type OrderBulkCreateParams as OrderBulkCreateParams,
  };

  export {
    Items as Items,
    type ItemRequest as ItemRequest,
    type ItemResponse as ItemResponse,
    type ShopTurboItem as ShopTurboItem,
    type ItemListResponse as ItemListResponse,
    type ItemCreateParams as ItemCreateParams,
    type ItemRetrieveParams as ItemRetrieveParams,
    type ItemUpdateParams as ItemUpdateParams,
    type ItemListParams as ItemListParams,
    type ItemDeleteParams as ItemDeleteParams,
  };

  export {
    Contacts as Contacts,
    type PublicContactRequest as PublicContactRequest,
    type PublicContactResponse as PublicContactResponse,
    type ContactRetrieveResponse as ContactRetrieveResponse,
    type ContactListResponse as ContactListResponse,
    type ContactCreateParams as ContactCreateParams,
    type ContactRetrieveParams as ContactRetrieveParams,
    type ContactUpdateParams as ContactUpdateParams,
    type ContactListParams as ContactListParams,
    type ContactDeleteParams as ContactDeleteParams,
  };

  export {
    Companies as Companies,
    type PublicCompanyRequest as PublicCompanyRequest,
    type PublicCompanyResponse as PublicCompanyResponse,
    type CompanyRetrieveResponse as CompanyRetrieveResponse,
    type CompanyListResponse as CompanyListResponse,
    type CompanyCreateParams as CompanyCreateParams,
    type CompanyRetrieveParams as CompanyRetrieveParams,
    type CompanyUpdateParams as CompanyUpdateParams,
    type CompanyListParams as CompanyListParams,
    type CompanyDeleteParams as CompanyDeleteParams,
  };

  export {
    Deals as Deals,
    type Case as Case,
    type PublicCaseRequest as PublicCaseRequest,
    type PublicCaseResponse as PublicCaseResponse,
    type DealListResponse as DealListResponse,
    type DealListPipelinesResponse as DealListPipelinesResponse,
    type DealCreateParams as DealCreateParams,
    type DealRetrieveParams as DealRetrieveParams,
    type DealUpdateParams as DealUpdateParams,
    type DealListParams as DealListParams,
    type DealDeleteParams as DealDeleteParams,
    type DealListPipelinesParams as DealListPipelinesParams,
  };

  export {
    Tickets as Tickets,
    type Ticket as Ticket,
    type TicketRequest as TicketRequest,
    type TicketResponse as TicketResponse,
    type TicketListResponse as TicketListResponse,
    type TicketListPipelinesResponse as TicketListPipelinesResponse,
    type TicketCreateParams as TicketCreateParams,
    type TicketRetrieveParams as TicketRetrieveParams,
    type TicketUpdateParams as TicketUpdateParams,
    type TicketListParams as TicketListParams,
    type TicketDeleteParams as TicketDeleteParams,
    type TicketListPipelinesParams as TicketListPipelinesParams,
    type TicketUpdateStatusParams as TicketUpdateStatusParams,
  };

  export {
    Subscriptions as Subscriptions,
    type SubscriptionDetail as SubscriptionDetail,
    type SubscriptionItemInput as SubscriptionItemInput,
    type SubscriptionListResponse as SubscriptionListResponse,
    type SubscriptionDeleteResponse as SubscriptionDeleteResponse,
    type SubscriptionCreateParams as SubscriptionCreateParams,
    type SubscriptionRetrieveParams as SubscriptionRetrieveParams,
    type SubscriptionUpdateParams as SubscriptionUpdateParams,
    type SubscriptionListParams as SubscriptionListParams,
    type SubscriptionDeleteParams as SubscriptionDeleteParams,
  };

  export {
    Estimates as Estimates,
    type Estimate as Estimate,
    type PublicEstimateRequest as PublicEstimateRequest,
    type PublicEstimateResponse as PublicEstimateResponse,
    type EstimateListResponse as EstimateListResponse,
    type EstimateCreateParams as EstimateCreateParams,
    type EstimateRetrieveParams as EstimateRetrieveParams,
    type EstimateUpdateParams as EstimateUpdateParams,
    type EstimateListParams as EstimateListParams,
    type EstimateDeleteParams as EstimateDeleteParams,
  };

  export {
    Invoices as Invoices,
    type Invoice as Invoice,
    type InvoiceRequest as InvoiceRequest,
    type InvoiceSchema as InvoiceSchema,
    type InvoiceListResponse as InvoiceListResponse,
    type InvoiceCreateParams as InvoiceCreateParams,
    type InvoiceRetrieveParams as InvoiceRetrieveParams,
    type InvoiceUpdateParams as InvoiceUpdateParams,
    type InvoiceListParams as InvoiceListParams,
    type InvoiceDeleteParams as InvoiceDeleteParams,
  };

  export {
    Payments as Payments,
    type PaymentRequest as PaymentRequest,
    type PaymentResponse as PaymentResponse,
    type Receipt as Receipt,
    type PaymentListResponse as PaymentListResponse,
    type PaymentCreateParams as PaymentCreateParams,
    type PaymentRetrieveParams as PaymentRetrieveParams,
    type PaymentUpdateParams as PaymentUpdateParams,
    type PaymentListParams as PaymentListParams,
    type PaymentDeleteParams as PaymentDeleteParams,
  };

  export {
    Expenses as Expenses,
    type Expense as Expense,
    type PublicExpenseRequest as PublicExpenseRequest,
    type PublicExpenseResponse as PublicExpenseResponse,
    type ExpenseListResponse as ExpenseListResponse,
    type ExpenseUploadAttachmentResponse as ExpenseUploadAttachmentResponse,
    type ExpenseCreateParams as ExpenseCreateParams,
    type ExpenseRetrieveParams as ExpenseRetrieveParams,
    type ExpenseUpdateParams as ExpenseUpdateParams,
    type ExpenseListParams as ExpenseListParams,
    type ExpenseDeleteParams as ExpenseDeleteParams,
    type ExpenseUploadAttachmentParams as ExpenseUploadAttachmentParams,
  };

  export {
    Inventories as Inventories,
    type InventoryRequest as InventoryRequest,
    type InventoryResponse as InventoryResponse,
    type ShopTurboInventory as ShopTurboInventory,
    type InventoryListResponse as InventoryListResponse,
    type InventoryCreateParams as InventoryCreateParams,
    type InventoryRetrieveParams as InventoryRetrieveParams,
    type InventoryUpdateParams as InventoryUpdateParams,
    type InventoryListParams as InventoryListParams,
    type InventoryDeleteParams as InventoryDeleteParams,
  };

  export {
    Locations as Locations,
    type Location as Location,
    type LocationRequest as LocationRequest,
    type Warehouse as Warehouse,
    type LocationListResponse as LocationListResponse,
    type LocationCreateParams as LocationCreateParams,
    type LocationRetrieveParams as LocationRetrieveParams,
    type LocationUpdateParams as LocationUpdateParams,
    type LocationListParams as LocationListParams,
    type LocationDeleteParams as LocationDeleteParams,
  };

  export {
    InventoryTransactions as InventoryTransactions,
    type TransactionRequest as TransactionRequest,
    type TransactionResponse as TransactionResponse,
    type TransactionSchema as TransactionSchema,
    type InventoryTransactionListResponse as InventoryTransactionListResponse,
    type InventoryTransactionCreateParams as InventoryTransactionCreateParams,
    type InventoryTransactionRetrieveParams as InventoryTransactionRetrieveParams,
    type InventoryTransactionUpdateParams as InventoryTransactionUpdateParams,
    type InventoryTransactionListParams as InventoryTransactionListParams,
  };

  export {
    Meters as Meters,
    type CommerceMeter as CommerceMeter,
    type Meter as Meter,
    type MeterRequest as MeterRequest,
    type MeterListResponse as MeterListResponse,
    type MeterCreateParams as MeterCreateParams,
    type MeterRetrieveParams as MeterRetrieveParams,
    type MeterUpdateParams as MeterUpdateParams,
    type MeterListParams as MeterListParams,
    type MeterDeleteParams as MeterDeleteParams,
  };

  export {
    Properties as Properties,
    type Property as Property,
    type PropertyMutation as PropertyMutation,
    type PropertyUpsert as PropertyUpsert,
    type PropertyListResponse as PropertyListResponse,
    type PropertyCreateParams as PropertyCreateParams,
    type PropertyRetrieveParams as PropertyRetrieveParams,
    type PropertyUpdateParams as PropertyUpdateParams,
    type PropertyListParams as PropertyListParams,
    type PropertyDeleteParams as PropertyDeleteParams,
  };

  export {
    PurchaseOrders as PurchaseOrders,
    type PurchaseOrder as PurchaseOrder,
    type PurchaseOrderRequest as PurchaseOrderRequest,
    type PurchaseOrderResponse as PurchaseOrderResponse,
    type PurchaseOrderListResponse as PurchaseOrderListResponse,
    type PurchaseOrderCreateParams as PurchaseOrderCreateParams,
    type PurchaseOrderRetrieveParams as PurchaseOrderRetrieveParams,
    type PurchaseOrderUpdateParams as PurchaseOrderUpdateParams,
    type PurchaseOrderListParams as PurchaseOrderListParams,
    type PurchaseOrderDeleteParams as PurchaseOrderDeleteParams,
  };

  export {
    Slips as Slips,
    type Slip as Slip,
    type SlipRequest as SlipRequest,
    type SlipResponse as SlipResponse,
    type SlipListResponse as SlipListResponse,
    type SlipCreateParams as SlipCreateParams,
    type SlipRetrieveParams as SlipRetrieveParams,
    type SlipUpdateParams as SlipUpdateParams,
    type SlipListParams as SlipListParams,
    type SlipDeleteParams as SlipDeleteParams,
  };

  export {
    Bills as Bills,
    type Bill as Bill,
    type PublicBillRequest as PublicBillRequest,
    type PublicBillResponse as PublicBillResponse,
    type BillListResponse as BillListResponse,
    type BillCreateParams as BillCreateParams,
    type BillRetrieveParams as BillRetrieveParams,
    type BillUpdateParams as BillUpdateParams,
    type BillListParams as BillListParams,
    type BillDeleteParams as BillDeleteParams,
  };

  export {
    Disbursements as Disbursements,
    type Disbursement as Disbursement,
    type PublicDisbursementRequest as PublicDisbursementRequest,
    type PublicDisbursementResponse as PublicDisbursementResponse,
    type DisbursementListResponse as DisbursementListResponse,
    type DisbursementCreateParams as DisbursementCreateParams,
    type DisbursementRetrieveParams as DisbursementRetrieveParams,
    type DisbursementUpdateParams as DisbursementUpdateParams,
    type DisbursementListParams as DisbursementListParams,
    type DisbursementDeleteParams as DisbursementDeleteParams,
  };

  export {
    Reports as Reports,
    type CreateReport as CreateReport,
    type ReportFilters as ReportFilters,
    type ReportPanel as ReportPanel,
    type ReportType as ReportType,
    type ReportRetrieveResponse as ReportRetrieveResponse,
    type ReportListResponse as ReportListResponse,
    type ReportDeleteResponse as ReportDeleteResponse,
    type ReportCreateParams as ReportCreateParams,
    type ReportRetrieveParams as ReportRetrieveParams,
    type ReportUpdateParams as ReportUpdateParams,
    type ReportListParams as ReportListParams,
    type ReportDeleteParams as ReportDeleteParams,
  };

  export {
    Workflows as Workflows,
    type WorkflowRunResponse as WorkflowRunResponse,
    type WorkflowRetrieveResponse as WorkflowRetrieveResponse,
    type WorkflowListResponse as WorkflowListResponse,
    type WorkflowCreateOrUpdateResponse as WorkflowCreateOrUpdateResponse,
    type WorkflowListActionsResponse as WorkflowListActionsResponse,
    type WorkflowListParams as WorkflowListParams,
    type WorkflowCreateOrUpdateParams as WorkflowCreateOrUpdateParams,
  };

  export {
    Calendar as Calendar,
    type PublicCalendarAttendance as PublicCalendarAttendance,
    type CalendarBootstrapResponse as CalendarBootstrapResponse,
    type CalendarCheckAvailabilityResponse as CalendarCheckAvailabilityResponse,
    type CalendarBootstrapParams as CalendarBootstrapParams,
    type CalendarCheckAvailabilityParams as CalendarCheckAvailabilityParams,
  };

  export { Auth as Auth, type AuthGetCurrentIdentityResponse as AuthGetCurrentIdentityResponse };
}
