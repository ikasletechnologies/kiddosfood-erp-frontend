# ERP Modules

The following table maps verified frontend screens to backend code and principal data entities. “Roles” reflects route/navigation evidence, not an independently audited permission matrix.

| Module | Screens/routes | Backend references | Principal entities | Roles/notes |
|---|---|---|---|---|
| Authentication/setup | `/login`, `/setup` | `auth.*`, `setup.*` | User, RefreshToken, Franchise, Warehouse | Login public; setup creation super-admin only |
| Executive dashboard | `/`, `/franchise/dashboard`, `/franchise/analytics` | `dashboard.*`, `analytics.*` | Aggregates across orders, stock, finance | Both roles with scoped data |
| Users/audit/approvals | `/admin/users`, `/audit/logs`, `/admin/approvals` | `users`, `audit`, `workflow-approvals` | User, ActivityLog, AuditLog, WorkflowRequest/History | User CRUD super-admin; workflow routes mixed |
| Vendors/procurement | `/vendors`, `/purchases/orders`, `/purchases/rfq`, `/purchases/requests` | `procurement`, `purchase`, `purchase-requests` | Vendor, VendorMaterial, ProcurementOrder/Item, RFQ entities | Primarily super-admin |
| Receiving/QC/bills | `/purchases/grn`, `/purchases/qc`, `/purchases/invoices`, `/purchases/inward` | `grn`, `inspection`, `vendor-invoices` | GoodsReceipt/Item, InspectionRecord, VendorInvoice | GRN and QC alter stock/financial workflow |
| Purchase returns | `/purchases/returns`, `/purchases/debit-notes`, `/purchases/payout-receipts` | `purchase.service.ts` | PurchaseReturn/Item, VendorLedger | Route registration currently franchise-admin for return endpoints |
| Products/raw materials | `/products`, `/inventory/items`, `/inventory/raw-material-stock` | `product`, `inventory/raw-materials` | Product, InventoryItem, Unit, conversions | Creation/update mainly super-admin |
| Inventory/warehouses | `/inventory/stock`, reconciliation/ledger/expiry routes, `/warehouse` | `inventory`, `warehouse`, reservation service | Warehouse/Bin, InventoryBatch, StockMovement, Reservation | Scope varies by operation |
| Recipes/formulation | `/production/recipes`, `/recipes` | `recipes` | Recipe, RecipeItem, RecipeCategory | Super-admin routes |
| Production/QC | `/production`, `/production/batches`, `/purchases/qc` | `production.service.ts` | Production, ProductionStageLog, ProductBatch | Raw material consumption, costing, QC approval |
| Packaging/cartons | `/packaging/*` | `production.service.ts`, `carton.service.ts` | Carton, ProductPackaging, Product, InventoryItem | Verification, confirmation, labels/barcodes |
| Waste/recall | `/production/wastage`, `/production/batch-recall` | `waste`, `recall` | WasteEntry, BatchRecall/Event, stock movements | Recall can block sales and collect returns |
| POS | `/pos`, `/pos/invoices`, `/pos/settlement`, `/pos/cheque-settle` | `pos`, `order`, `cheque` | Order/Item, Payment, DailySettlement, Cheque | Checkout server-recalculates totals and consumes stock |
| Customers/dealers/partners | `/customers`, `/franchise/dealers`, business-owner/retailer screens | customer, dealer, business-partner modules | Customer, Dealer, BusinessPartner, ledgers | Franchise isolation applies in services |
| Sales documents | `/sales/estimation`, orders, proforma, invoices, returns | `sales`, `finance` | Quotation/Item, SalesOrder/Item, ProformaInvoice/Item, Order, ReturnOrder/Item | Both roles on primary sales routes |
| Delivery/dispatch | delivery challan, transit stock, `/delivery` | `sales`, `delivery`, `logistics` | DeliveryChallan/Item/Return, Delivery, StockTransfer | Status changes drive stock movement |
| E-Way Bill | `/sales/eway-bill` | `eway-bill` router/service | EWayBill, items, vehicle updates | Draft/generate/update/extend/cancel lifecycle |
| Franchise ordering | `/franchise-orders`, requests/transfers/payments | `franchise-order`, `franchise/logistics`, `logistics` | FranchiseOrder/Item, StockRequest/Item, Transfer/Item, FranchiseLedger | HQ/branch shared workflow |
| Accounting | `/accounting/*`, `/banking/accounts` | `finance`, account, cheque services | Account, Payment/Allocation, Expense, ledgers, LoanAccount/Transaction | Many legacy accounting mutation routes are franchise-admin only; reports support both |
| GST/reporting | `/reports`, `/reports/gst/*` | `finance.service.ts`, `gst.service.ts` | Computed aggregates, orders, invoices, GST cache | Read-heavy, filter-driven |
| HR | `/hr/employees`, attendance, leaves, shifts | `employee` | Employee, AttendanceLog, LeaveType/Balance/Leave, Shift/EmployeeShift | Backend routes franchise-admin |
| Payroll | `/hr/payroll/*`, `/payroll` | `payroll` | SalaryComponent/Structure/Item, Payroll, Payslip | Franchise-admin routes |
| Alerts/notifications | `/alerts`, header notification center | `alerts` + Socket.IO | Alert | Both roles, franchise-scoped |
| Settings/profile | `/settings/*`, `/profile/*` | `settings`, user controllers | SystemSetting, User, Franchise | Company/user configuration |
| Drafts/attachments | embedded in sales/order flows | drafts, attachment router | Draft, Attachment | Authenticated; attachments limited to 5 MB by service/UI evidence |

## Cross-module dependencies

- Inventory movements are shared by procurement receipt, production consumption/QC, packaging, POS, returns, transfers, waste and recall.
- Finance/ledger entries are created by sales, purchases, payments, refunds and franchise transactions.
- Products link to recipes and inventory items; production turns recipe/raw material stock into batches and packaging turns bulk stock into sellable product inventory.
- Franchise-aware entities carry `franchiseId`; helper functions and services attempt to isolate non-super-admin access.
