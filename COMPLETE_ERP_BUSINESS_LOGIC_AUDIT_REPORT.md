# COMPLETE ERP BUSINESS LOGIC AUDIT REPORT — Kiddos Food ERP

| | |
|---|---|
| **Audit date** | 2026-11-21 |
| **Systems in scope** | `kiddosfood-erp-backend` (Express + Prisma 7 + PostgreSQL, ~85k LOC) and `kiddosfood-erp-frontend` (Next.js 14) |
| **Backend commit** | `786f5a3` (working tree has uncommitted migration changes, see M-26) |
| **Frontend commit** | `1c4e90a` |
| **Method** | Static code analysis, business-logic tracing, frontend-to-backend flow tracing, schema/migration review |
| **Changes made** | None. No code, data, configuration, or migrations were touched. This report is the only file created. |

> **How to read verification statuses.** Nothing in this report was executed against a database. The backend test scripts connect to whatever `DATABASE_URL` points at (they are `tsx` scripts against a live DB, not an isolated suite), so they were deliberately **not run**. Every finding is classified as one of:
>
> - **CODE-VERIFIED**: the defect follows directly and unconditionally from the code path that was read. No runtime assumption is needed.
> - **CODE-POTENTIAL**: the defect depends on timing (concurrency), data shape, or runtime configuration that could not be observed.
> - **BUSINESS-CONFIRM**: the behaviour is consistent in code but may or may not match the intended business rule; the business owner must decide.
> - **REPRODUCED**: *none*. No finding has been reproduced at runtime. Each Critical/High item lists the steps to reproduce it safely on an isolated database.

---

## 1. Executive Summary

### 1.1 Overall assessment

The ERP has a **broad functional surface** (purchase → GRN → bill → payment, sales → invoice → dispatch → returns, POS, franchise ordering with stock reservation, production/packaging/recall, HR/payroll, GST reports, e-way bill). Many individual paths have been hardened: row locks on GRN creation/approval, idempotency keys on payments, sales orders and challans, server-side price/tax re-derivation, and lot-aware FIFO. These show careful iterative fixing.

However, the system has **systemic weaknesses that make it unsafe for production financial use today**:

1. **Authorization is the dominant risk.** There are only two roles (`SUPER_ADMIN`, `FRANCHISE_ADMIN`). Public registration can mint a `SUPER_ADMIN`. Many endpoints accept a record ID without checking that it belongs to the caller's franchise, and franchise admins can drive HQ-controlled workflows (franchise-order dispatch/delivery, inventory adjustment, payment cancellation, fund transfer).
2. **Reversal/cancellation paths are the weakest part of the business logic.** Cancelling a PO, a payment, an invoice, a franchise order, a production run or a POS order frequently leaves stock, ledgers, account balances and document statuses inconsistent.
3. **There is no general ledger.** Accounting is a set of sub-ledgers (`VendorLedger`, `CustomerLedger`, `FranchiseLedger`, `Account.balance`) plus derived reports. Trial balance and balance sheet are computed views, not balanced journals, so a missed or duplicated posting is never caught by a "debits ≠ credits" control.
4. **Several modules exist in the UI but are disconnected from the transactions they describe**: approval workflows, purchase requests, RFQ quotations, and the stock-request flow.

### 1.2 Counts

| Metric | Count |
|---|---|
| Backend modules discovered (`src/modules/*`) | 37 |
| Frontend pages discovered (`src/app/**/page.tsx`) | 150 |
| Modules audited in depth (code-path traced) | 16 |
| Modules inventoried with lighter review | 21 |
| End-to-end workflows analysed | 19 |
| **Total issues** | **66** |
| Critical | 8 |
| High | 20 |
| Medium | 30 |
| Low | 8 |
| Feature gaps (separate register, §8) | 18 |

### 1.3 Top risks by domain

| Domain | Most serious risks |
|---|---|
| **Security / authorization** | C-01 public SUPER_ADMIN registration; C-02 hard-coded JWT fallback secrets; C-03 franchise self-dispatch/delivery; C-08 inventory adjustment IDOR; H-13 payment/invoice/transfer IDOR |
| **Financial** | C-04 client-priced GRN-rejection returns reduce vendor payables; C-05 PO cancel creates phantom payables; C-07 payment cancellation reverses cash in the wrong direction and never reverses vendor ledger; H-01 duplicate vendor billing; H-04 advance without cash movement |
| **Inventory** | C-03 repeatable franchise stock transfer; C-06 QC inspection overwrites unrelated lots; H-07 invoice cancel does not restore stock; H-15 transfer receipts create no lots; M-10 negative stock and ledger/lot drift |
| **Data integrity** | M-14 duplicate HQ SKUs allowed by the unique index; M-15 cascade deletes of stock history; M-19 corrupted vendor running balances; M-20 Float money; M-26 uncommitted migration squash |
| **Workflow** | H-05 RFQ→PO broken; H-06 PO approval bypassed; M-17 approvals not linked to documents; H-10 SO status can advance with no stock movement |

---

## 2. System Architecture (as discovered)

### 2.1 Technical architecture

- **Backend**: a single Express app (`src/app.ts`, ~450 routes registered inline plus 10 sub-routers). Prisma 7 with the `pg` adapter. Interactive transactions are globally patched to `timeout: 30s` (`src/lib/prisma.ts`). Socket.io handles live updates and chat.
- **AuthN/AuthZ**: JWT access (15m) plus a rotating refresh token stored in DB. `authorizeRole([...])` is the only RBAC primitive, and `SUPER_ADMIN` bypasses every role check (`rbac.middleware.ts`). Franchise isolation is done ad hoc per controller via `IsolationUtil`.
- **Frontend**: Next.js App Router. Axios API clients live in `src/lib/api/*`. Business logic is mostly server-side, but some workflows are orchestrated client-side as multiple sequential calls (e.g. GRN, see M-08).

### 2.2 Accounting design (important context for every finance finding)

The ERP **does not use double-entry accounting**. Its actual design is:

| Store | Meaning | Sign convention |
|---|---|---|
| `Account.balance` (CASH / BANK / UPI) | Cash-book balance, mutated in place | increment = inflow |
| `VendorLedger` | Vendor payable sub-ledger | CREDIT = we owe more; DEBIT = we owe less (`getVendorBalance`) |
| `CustomerLedger` | Customer receivable sub-ledger | DEBIT = they owe us; CREDIT = paid/credited |
| `FranchiseLedger` | Franchise receivable sub-ledger | DEBIT/CREDIT with `balanceAfter` |
| Dealer | **No ledger**: balance derived from invoices and payments | — |
| `Payment` | Every money movement (in/out/transfer/reversal) | `flow` is **not stored**, only inferred (see C-07) |
| Trial Balance / Balance Sheet / P&L | Computed at read time from the stores above | — |

All findings were audited against this design, not against double-entry rules.

### 2.3 Inventory design

- `StockMovement` is the ledger and the declared single source of truth (`InventoryService.computeStock` sums `baseQty`).
- `InventoryItem.currentStock` is a cache incremented on each movement.
- `InventoryBatch` (lot) carries `currentQty`, `status` (QC_HOLD/APPROVED/BLOCKED/…), cost, expiry and warehouse. FIFO depletion (`depleteBatchesFIFO`) row-locks lots.
- Three quantity representations therefore exist (ledger, cache, lots) and must stay in sync. Several paths update only one or two of them (M-10, H-15, C-06).
- Stock reservation exists **only** for franchise orders (`InventoryReservation` keyed by `franchiseOrderId`).

### 2.4 Roles

`UserRole` = `SUPER_ADMIN` | `FRANCHISE_ADMIN`. There are no purchase, warehouse, sales, finance, HR or approver roles, and no action-level permissions. Every "approval" in the system is therefore performed by one of two roles.

---

## 3. Module Inventory

| # | Module (backend dir) | Key submodules / entities | Frontend pages | Audit depth |
|---|---|---|---|---|
| 1 | auth | login, refresh rotation, public register | `/login`, `/setup` | Deep |
| 2 | users | users, nav, password reset | `/admin/users`, `/settings/user/*` | Medium |
| 3 | workflow-approvals | WorkflowRequest/History (PURCHASE/PRODUCTION/EXPENSE) | `/admin/approvals` | Deep |
| 4 | procurement | Vendor, VendorLedger, PO, advance, vendor payments, aging | `/purchases/*`, `/vendors/*` | Deep |
| 5 | purchase-requests | PurchaseRequest | `/purchases/requests` | Deep |
| 6 | purchase | RFQ, VendorQuotation, PurchaseReturn, requisition | `/purchases/rfq`, `/purchases/returns`, `/purchases/debit-notes` | Deep |
| 7 | grn | GoodsReceipt, QC inspection | `/purchases/grn`, `/purchases/qc` (redirect) | Deep |
| 8 | vendor-invoices | Purchase bills, 3-way match | `/purchases/invoices` | Deep |
| 9 | inventory | items, movements, FIFO, adjustment, reconciliation, reservation, expiry, semi-finished, raw-material ledger | `/inventory/*` | Deep |
| 10 | warehouse | central warehouse, bins, central funds | `/warehouse/*`, `/central-warehouse` | Light |
| 11 | logistics | StockRequest, StockTransfer (inter-branch) | `/franchise/transfers`, `/dispatch/transit-stock` | Deep |
| 12 | waste | WasteEntry | `/production/wastage` | Medium |
| 13 | sales | quotation, SO, proforma, delivery challan, DC returns, sales returns, refunds, lot pricing, profitability | `/sales/*` | Deep (core paths) |
| 14 | finance | sales invoice, payments, allocations, expenses, transfers, cheques, accounts, loans, ~60 reports, GST reports | `/accounting/*`, `/banking/*`, `/reports/*` | Deep (transactions), Light (reports) |
| 15 | pos | POS checkout, legacy orders, day settlement | `/pos/*` | Deep (core) |
| 16 | kds | kitchen display | — | Light |
| 17 | franchise | franchise master, franchise orders, reservations, payments, documents, photo | `/franchise*`, `/franchise-orders`, `/purchases/inward` | Deep (orders) |
| 18 | production | runs, stages, QC, packaging, cartons, costing, recall | `/production/*`, `/packaging/*` | Medium |
| 19 | recipes | recipe, formulation, Word import | `/production/recipes*`, `/recipes` | Light |
| 20 | product | product master, bulk import | `/products/*` | Light |
| 21 | customers / dealers / business-partners | party masters | `/customers`, `/franchise/dealers`, `/franchise/retailers` | Light |
| 22 | payroll / employee | payroll runs, payslips, attendance, leave, shifts | `/hr/*`, `/payroll` | Medium |
| 23 | crm | pipelines, leads, forms | `/vendors/leads` | Light |
| 24 | loyalty | points | — | Light |
| 25 | eway-bill | Fynamics integration | `/sales/eway-bill` | Light |
| 26 | gst | GSTIN verify | — | Light |
| 27 | alerts | Alert engine | `/alerts` | Light |
| 28 | audit | AuditLog read | `/audit/logs`, `/settings/audit` | Medium |
| 29 | dashboard / analytics | KPIs | `/`, `/inventory/dashboard`, `/franchise/dashboard` | Light |
| 30 | settings / setup | SystemSetting, company profile, first-run setup | `/settings/*`, `/setup` | Light |
| 31 | drafts | per-user drafts | — | Light |
| 32 | attachments | base64 uploads | — | Light |
| 33 | chat | SA↔franchise chat | `/chat` | Light |
| 34 | delivery | rider delivery | `/delivery` | Light |
| 35 | assistant | AI assistant | — | Not audited |
| 36 | analytics | product performance, wastage | — | Light |
| 37 | business-partners | retailers/business owners | — | Light |

**Placeholder / non-functional UI** (CODE-VERIFIED): `/accounting/vouchers`, `/accounting/groups`, `/accounting/chart`, `/purchases/hire-vendors` render only an empty state (`RefrensEmptyState`). `/accounting/income-statement` redirects to P&L, and `/purchases/qc` redirects to production QC.

**Requested modules that do not exist**: General Ledger / Journal Vouchers / Chart of Accounts, Financial period close, Serial number management, Asset management, Service management, Bank reconciliation (cheques and bank statement exist, but no statement-matching), Debit/credit notes as independent documents (debit notes are purchase returns), Notifications beyond in-app alerts/socket (no email/SMS), and a fine-grained role/permission model.

---

## 4. Detailed Issue Register — CRITICAL

### C-01 — Public registration endpoint can create a SUPER_ADMIN

| Field | Detail |
|---|---|
| Module / Submodule | Auth / Registration |
| Category | Authorization / privilege escalation |
| Severity / Priority | **CRITICAL / P0** |
| Description | `POST /api/auth/register` has no `authenticate` middleware, and its Zod schema explicitly accepts `role: 'SUPER_ADMIN' \| 'FRANCHISE_ADMIN'`. `AuthService.register` stores the requested role verbatim. |
| Actual | Any unauthenticated caller who can reach the API can create a `SUPER_ADMIN`, log in, and receive god-mode (`authorizeRole` bypasses every check for SUPER_ADMIN). |
| Expected | Registration disabled, or restricted to SUPER_ADMIN callers. Role never accepted from an unauthenticated client. |
| Business / Financial / Inventory impact | Total compromise: every vendor payment, stock adjustment, payroll run and franchise record can be read or modified. |
| Root cause (verified) | `src/app.ts:180` (no auth); `src/modules/auth/auth.validation.ts` (`role: z.enum(['SUPER_ADMIN','FRANCHISE_ADMIN']).optional()`); `src/modules/auth/auth.service.ts` `register()` (`role: data.role \|\| FRANCHISE_ADMIN`). |
| Related modules | All |
| Steps to reproduce (isolated DB only) | `POST /api/auth/register {fullName, email, password(8+), role:"SUPER_ADMIN"}` → `POST /api/auth/login` → call `GET /api/users`. |
| Recommended solution | Remove the public route, or require `authenticate + authorizeRole(['SUPER_ADMIN'])`; drop `role` from the public schema; audit existing SUPER_ADMIN users. |
| Verification status | CODE-VERIFIED |

### C-02 — JWT signing secrets fall back to hard-coded values; local env uses the wrong variable name

| Field | Detail |
|---|---|
| Module | Auth / Token |
| Category | Security configuration |
| Severity / Priority | **CRITICAL / P0** |
| Description | `jwt.util.ts` reads `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` and falls back to literal strings committed in source. The backend `.env` in this workspace defines `JWT_SECRET` (and `JWT_EXPIRES_IN`), which the code never reads. |
| Actual | In this environment tokens are signed with the public source-code constants, so anyone with repo access can forge a `SUPER_ADMIN` token. |
| Expected | Process refuses to start without strong secrets; no defaults in code. |
| Root cause | `src/lib/jwt.util.ts:5-6`; `.env` key names (values not inspected). `.env.example` documents the correct names. |
| Steps to reproduce | Sign `{userId, role:"SUPER_ADMIN"}` with the fallback secret and call any SA endpoint. |
| Recommended solution | Remove the fallbacks, fail fast on a missing secret, rotate secrets in every environment, and invalidate refresh tokens. |
| Verification status | CODE-VERIFIED for this workspace; **production environment not verified** (BUSINESS-CONFIRM with DevOps). |

### C-03 — Franchise admins can move their own franchise orders through any status (self-approve, self-dispatch, self-deliver, repeat)

| Field | Detail |
|---|---|
| Module | Franchise Management / Franchise Orders |
| Category | Authorization + status lifecycle + inventory |
| Severity / Priority | **CRITICAL / P0** |
| Description | `PATCH /api/franchise-orders/:id/status` is open to `FRANCHISE_ADMIN`. The controller only checks that the order belongs to the caller's franchise and passes the requested `status` through. The service has **no transition table**: DISPATCHED triggers HQ stock deduction and DELIVERED credits franchise stock, while CANCELLED is accepted from any state. |
| Actual | (a) A franchise can approve and dispatch its own order, deducting HQ stock without HQ action. (b) A sequence of DELIVERED → APPROVED → DISPATCHED → DELIVERED is accepted: each DISPATCHED re-reserves and re-deducts HQ stock, and each DELIVERED re-credits the franchise. (c) CANCELLED after DISPATCHED/DELIVERED releases nothing (the reservation is already CONSUMED), restores no HQ stock, and does not reverse the franchise ledger debit posted at order creation. |
| Expected | Franchise can only create, cancel while PENDING, and confirm receipt of a DISPATCHED order. Only HQ approves and dispatches. A strict transition table is enforced server-side, and post-dispatch cancellation is replaced by a return flow. |
| Financial impact | Franchise receivable and HQ inventory value become wrong; stock duplication is possible. |
| Inventory impact | HQ stock deducted for goods never shipped; franchise stock inflated. |
| Root cause | `src/modules/franchise/franchise-order.controller.ts:53-74`; `src/modules/franchise/franchise-order.service.ts:652-835` (no source-status guard for APPROVED/IN_PRODUCTION/CANCELLED; dispatch guard only checks "not already DISPATCHED/CANCELLED/DELIVERED"); `releaseReservation` no-ops on non-ACTIVE reservations (`inventory-reservation.service.ts:246-278`). |
| Steps to reproduce | As FA: create order → PATCH status APPROVED → DISPATCHED → DELIVERED → APPROVED → DISPATCHED → DELIVERED; compare HQ and franchise `StockMovement` totals. |
| Recommended solution | Add a `FRANCHISE_ORDER_TRANSITIONS` table and role-per-transition rules; row-lock the order in every transition; disallow CANCELLED after DISPATCHED; post a franchise-ledger reversal on cancel. |
| Verification status | CODE-VERIFIED |

### C-04 — "GRN_REJECTION" purchase returns trust client quantity and rate, and can be created directly as COMPLETED

| Field | Detail |
|---|---|
| Module | Purchase / Purchase Returns (Debit Notes) |
| Category | Financial integrity / input trust |
| Severity / Priority | **CRITICAL / P0** |
| Description | `createPurchaseReturn` validates quantity and rate against received stock **only** when `returnSource === 'MANUAL'`. With `returnSource: 'GRN_REJECTION'` (a client-supplied field), item name, quantity, unit and rate are used as sent, `refundAmount = Σ qty × rate`, and `status` is taken from the client. If `status: 'COMPLETED'`, `recognizeReturn` immediately posts a vendor-ledger **DEBIT** (reducing the payable) plus GST. Completed GRN-rejection returns also count as **fulfilled PO quantity** (`getCumulativeReceived`, `updatePurchaseReturn`). |
| Actual | A caller can reduce any vendor's payable by an arbitrary amount and close open PO lines without delivery. There is no check against the GRN's `rejectedQty`. |
| Expected | GRN-rejection returns are created server-side from the GRN itself, bounded by `rejectedQty`, priced at the GRN line price, and never accept `status` from the client. |
| Financial impact | Under-stated payables and wrong ITC reversal in GST. |
| Inventory impact | PO shows fulfilled while goods were never received. |
| Root cause | `src/modules/purchase/purchase.service.ts:339-526` (client fields at :352, MANUAL-only validation at :375, client status at :349 and :515). The route is `FRANCHISE_ADMIN` (SA bypass) with no franchise scoping (`app.ts:826-828`). The frontend sends this payload from `src/app/purchases/grn/page.tsx:684-697`. |
| Steps to reproduce | `POST /api/purchase/returns {vendorId, procurementOrderId, returnSource:"GRN_REJECTION", status:"COMPLETED", items:[{itemName:"X", quantity:1000, rate:999}]}` → check `GET /api/vendors/:id/ledger`. |
| Recommended solution | Make GRN-rejection returns server-generated inside `GRNService.approve` (same transaction), keyed by GRN item ID, with qty ≤ rejectedQty and rate = GRN price. Reject client `status` on create. |
| Verification status | CODE-VERIFIED |

### C-05 — Cancelling (or deleting) a PO posts a phantom vendor payable and corrupts running balances

| Field | Detail |
|---|---|
| Module | Purchase / Purchase Orders |
| Category | Financial integrity / lifecycle |
| Severity / Priority | **CRITICAL / P0** |
| Description | PO creation posts **no** liability (liability is recognized only when a bill is created from a GRN). Yet `cancelPO` writes a vendor-ledger **CREDIT** equal to the **full PO total**, and CREDIT means "we owe more". It also omits `balanceAfterTransaction` (default 0). The code's own comment in `recordAdvancePayment` states that a bare 0 "would corrupt every balance computed after it". `cancelPO` only blocks RECEIVED and CANCELLED, so PARTIALLY_RECEIVED, INVOICED, PAID and CLOSED POs can be cancelled. `deletePO` does the same CREDIT for legacy `PENDING_APPROVAL` POs and hard-deletes in any non-RECEIVED state. |
| Actual | Cancelling an approved, unreceived ₹1,00,000 PO increases the vendor payable by ₹1,00,000. Cancelling a partially received PO adds a CREDIT on top of the bill already recognized for the received part, double-counting it. Advance reserved on the PO (`advanceApplied`) is released from the reservation sum but the PO keeps `paid`. No reason, user or audit log is recorded. |
| Expected | Cancel posts nothing to the vendor ledger unless a liability exists. Cancellation after partial receipt becomes "short-close the open balance". Advance is returned to vendor credit explicitly. |
| Financial impact | Overstated payables, wrong vendor aging, risk of overpayment, wrong balance sheet. |
| Root cause | `src/modules/procurement/procurement.service.ts:1534-1558` (cancelPO), `:1560-1583` (deletePO); sign convention at `:637-643`. |
| Steps to reproduce | Create PO (no advance) → `PATCH /api/purchase-orders/:id/cancel` → vendor balance rises by the PO total. |
| Recommended solution | Remove the ledger write; restrict cancel to statuses without GRNs; add a short-close action for PARTIALLY_RECEIVED; require a reason and write an audit log; replace delete with soft-cancel; run a data review of existing "PO Cancelled — Reversal" rows. |
| Verification status | CODE-VERIFIED (impact on existing data needs a read-only DB query) |

### C-06 — QC inspection endpoint can overwrite an unrelated lot's quantity and double-post stock

| Field | Detail |
|---|---|
| Module | GRN / Quality Control |
| Category | Inventory integrity |
| Severity / Priority | **CRITICAL / P1** (route is SUPER_ADMIN-only; the frontend no longer links to it, but it is live) |
| Description | `POST /api/qc/inspect` finds the lot with `findFirst({ inventoryItemId, batchNumber: item.vendorBatchNo \|\| undefined })`. When the GRN line has no vendor batch number, `batchNumber: undefined` removes the filter and the **most recent lot of that material from any GRN, warehouse or franchise** is selected. On APPROVE it sets that lot's `currentQty = approvedQty` and records an extra `PURCHASE_IN` movement with no lot, no warehouse and no unit conversion. Stock for that GRN line was already posted by `GRNService.approve`. |
| Actual | A random lot's quantity is overwritten, ledger stock is double-counted, the PO received quantity isn't recalculated, and the vendor bill isn't adjusted. |
| Expected | Inspection targets the exact lot via `InventoryBatch.goodsReceiptItemId`, runs **before** stock becomes usable, and adjusts stock and bill by the delta only. |
| Root cause | `src/modules/grn/inspection.service.ts:19-172` (lookup at ~:76-83, overwrite ~:93-100, extra movement ~:118-139). Pending list `getPendingInspections` returns COMPLETED-GRN items still PENDING. |
| Steps to reproduce | Approve two GRNs for the same material, the second with a partially rejected line and no vendor batch → `POST /api/qc/inspect` for the rejected line with APPROVE → the first lot's `currentQty` changes. |
| Recommended solution | Disable the route until redesigned; look up by `goodsReceiptItemId`; integrate QC into GRN approval (QC_HOLD → APPROVED). |
| Verification status | CODE-VERIFIED |

### C-07 — Payment cancellation reverses cash in the wrong direction for many payment types and never reverses the vendor ledger

| Field | Detail |
|---|---|
| Module | Finance / Payments |
| Category | Financial integrity / reversal |
| Severity / Priority | **CRITICAL / P0** |
| Description | `Payment` does not store its flow direction. `cancelPayment` infers it: `isOriginalOutflow = entityType === 'VENDOR' \|\| type === 'EXPENSE'`. Then: (a) **vendor refunds** (money IN, entityType VENDOR) are treated as outflows, so cancelling adds the money to the account a second time; (b) **customer refunds** (OUT, entityType CUSTOMER), **payroll** (OUT, EMPLOYEE), franchise settlements and similar outflows are treated as inflows, so cancelling debits the account again instead of restoring it; (c) **internal transfers** reverse only the leg that was cancelled; (d) the **VendorLedger** DEBIT/CREDIT created by `createPayment` is **not reversed**, so the vendor still appears paid; (e) `VendorInvoice.status`, `ProcurementOrder.paid/balance/status`, `Invoice.status` and `Order.paymentStatus` are **not recomputed**, so a cancelled payment leaves bills and invoices marked PAID; (f) the account balance can go negative. |
| Financial impact | Cash book wrong by up to 2× the payment; payables understated; invoices shown paid without money. |
| Root cause | `src/modules/finance/finance.service.ts:2049-2118`; the payment write side is `createPayment` (`:1584-1987`), where vendor-ledger rows are keyed `referenceId = payment.id`. The route `POST /api/accounting/payments/:id/cancel` is FA (SA bypass) with no ownership check (H-13). |
| Steps to reproduce | Record a vendor REFUND of ₹500 into account A (balance +500) → cancel → A is +1000 instead of 0. Record a vendor bill payment → cancel → vendor ledger balance unchanged. |
| Recommended solution | Persist `flow` on Payment; reverse using the stored flow; reverse all sub-ledger rows by `referenceId`; recompute invoice/bill/PO status in the same transaction; block cancel when it would overdraw; record a reason and audit log. |
| Verification status | CODE-VERIFIED |

### C-08 — Franchise admins can set the stock of any inventory item (IDOR) with no validation or approval

| Field | Detail |
|---|---|
| Module | Inventory / Stock Adjustment |
| Category | Authorization / inventory integrity |
| Severity / Priority | **CRITICAL / P0** |
| Description | `POST /api/inventory/adjustment` allows `FRANCHISE_ADMIN`. The controller passes `itemId` and `newQuantity` straight to `adjustStock` without checking that the item belongs to the caller's franchise, that `newQuantity` is a finite number ≥ 0, or that a reason is given. The service comment says "SUPER_ADMIN only". |
| Actual | A franchise user can zero or inflate HQ or another franchise's stock. A negative or NaN quantity is not rejected. A positive adjustment creates an APPROVED lot at current average cost. No financial write-off/write-on is recorded. |
| Root cause | `src/app.ts:234`; `src/modules/inventory/inventory.controller.ts:90-104`; `src/modules/inventory/inventory.service.ts:702-734`. `/api/inventory/items/:id` (GET) has the same missing ownership check. |
| Steps to reproduce | As FA of franchise X: `POST /api/inventory/adjustment {itemId:<HQ item>, newQuantity:0}`. |
| Recommended solution | Enforce item ownership; validate quantity; require reason codes; route adjustments above a threshold through approval; post a stock-variance entry for P&L. |
| Verification status | CODE-VERIFIED |

---

## 5. Detailed Issue Register — HIGH

### H-01 — Same goods can be billed twice (manual bill with `poId` only bills full PO value)
- **Module**: Purchase / Vendor Invoices. **Category**: duplicate transaction / financial.
- **Actual**: `GRNService.approve` auto-creates a bill for accepted quantities and recognizes the liability. `POST /api/vendor-invoices` with `poId` but no `grnId` calls `computeCommercialsFromPO(po)` with no GRN items, which **bills the entire PO total**, with no check against bills already posted for that PO. The new bill's liability is recognized immediately.
- **Expected**: Bills are always tied to GRN lines, and the Σ billed quantity per PO line must be ≤ Σ accepted quantity.
- **Impact**: Double payable, double ITC in GSTR-2.
- **Evidence**: `src/modules/vendor-invoices/vendor-invoices.service.ts:27-40, 210-225, 289-316`.
- **Reproduce**: Approve a GRN for 60/100 → `POST /api/vendor-invoices {vendorId, poId}` → vendor ledger has two PURCHASE credits (60% + 100%).
- **Fix**: Require `grnId`, or compute the unbilled remainder; add a unique `(grnId)` constraint for bills.
- **Status**: CODE-VERIFIED

### H-02 — Vendor bill status can be set to PAID with no payment; "match" overwrites PAID
- **Evidence**: `PATCH /api/vendor-invoices/:id/status` → `updateStatus` writes any status (`vendor-invoices.service.ts:477-483`). `match()` (`:325-352`) unconditionally sets MATCHED/MISMATCH, even on a PAID bill, outside a transaction.
- **Impact**: Bills marked PAID without cash (payables reports wrong); paid bills reopened.
- **Fix**: Make status derived only (from payments, advance and returns); remove the free status endpoint or restrict it to non-financial states with a transition table.
- **Status**: CODE-VERIFIED

### H-03 — 3-way match is meaningless for partial deliveries and doesn't gate payment
- **Actual**: `priceMismatch` compares the bill amount to the **full PO total**, so any partial-delivery bill is always MISMATCH. The tolerance is a hard-coded 1%. Payment is allowed regardless of match status.
- **Expected**: Per-line PO price vs bill price, per-line GRN accepted quantity vs billed quantity, configurable tolerance, and a payment block on MISMATCH without approval.
- **Evidence**: `vendor-invoices.service.ts:325-352`; payment path `procurement.service.ts:1788-1915` never reads match status.
- **Status**: CODE-VERIFIED

### H-04 — "Record advance" on a PO reduces vendor payable without moving cash
- **Actual**: `PATCH /api/purchase-orders/:id/advance` → `recordAdvancePayment` writes a VendorLedger DEBIT (paymentMode hard-coded CASH) and raises `po.paid`, but creates **no `Payment` row and no `Account` debit** (contrast with `createPurchaseOrder`, which correctly uses `FinanceService.createPayment`). It is allowed on RECEIVED/CLOSED POs, and can set CLOSED.
- **Impact**: Cash/bank balances overstated; advance doesn't appear in payments or day book; vendor appears paid.
- **Evidence**: `procurement.service.ts:1234-1273`; controller only checks non-negative (`procurement.controller.ts:173-188`).
- **Fix**: Route through `createPayment` with a source account; restrict to open POs.
- **Status**: CODE-VERIFIED

### H-05 — RFQ → Quotation → PO workflow is broken end-to-end
- **Actual**: (1) The frontend posts quotations to `POST /api/purchase/rfqs/:id/quotations` (`src/app/purchases/rfq/page.tsx:63`), but **no such backend route exists**, so the request 404s even though `PurchaseService.addVendorQuotation` exists. (2) `convertQuotationToPO` calls `createPurchaseOrder` without `gstRate` (required by `purchaseGstRate`) and without `expectedDeliveryDate` (required by `validateDeliveryDate`), so conversion throws for every quotation. (3) Conversion isn't transactional: quotation/RFQ status updates run after PO creation. (4) Items are matched to inventory by **name**.
- **Evidence**: `src/modules/purchase/purchase.service.ts:87-189`; `src/modules/procurement/purchase-tax.ts:1-6`; `purchase-dates.ts:18-22`; `app.ts:820-824`.
- **Status**: CODE-VERIFIED (route absence and missing required fields); runtime 404/throw not executed.

### H-06 — PO approval is bypassed; any client-supplied status is accepted at creation; no idempotency
- **Actual**: `savedPOStatus()` converts missing or `PENDING_APPROVAL` status to `APPROVED`, so every new PO is born approved without `approvedBy/approvedAt`. Any other client status (e.g. `RECEIVED`, `CLOSED`) is stored as-is at creation. `approvePO` records `approvedBy: 'SUPER_ADMIN'` (a literal, not the user). `PENDING_APPROVAL` remains GRN-eligible. There's no idempotency key, so a double-submit creates two POs, and with an advance, **two advance payments**.
- **Evidence**: `src/modules/procurement/po-receipt-status.ts:1-8`; `procurement.service.ts:875-950, 1275-1314`.
- **Fix**: Introduce a real approval step (threshold-based), validate status against an allow-list, store the approver user ID, and add `idempotencyKey` on PO.
- **Status**: CODE-VERIFIED; whether auto-approval is intended is BUSINESS-CONFIRM.

### H-07 — Cancelling a sales invoice does not restore stock and permanently strands the Sales Order
- **Actual**: `cancelInvoice` blocks only when payments exist or `INVOICE_FULFILMENT` dispatch movements exist. Stock issued at invoicing (`SALES_OUT`, `referenceType 'ORDER'`, via `issueInvoiceStock` / `createInvoice`) is **not reversed**. The source SO stays `DELIVERED` with `convertedInvoiceId` pointing at a cancelled invoice, and `Order.sourceSalesOrderId` is unique, so the SO **can never be re-invoiced**. Linked e-way bills are not cancelled.
- **Evidence**: `src/modules/finance/finance.service.ts:1053-1099`; `src/modules/sales/sales.service.ts:916-976, 1097-1100`.
- **Impact**: Stock understated by the invoice quantity; orphaned SO.
- **Status**: CODE-VERIFIED

### H-08 — Legacy POS order-status endpoint is a side door around invoice controls
- **Actual**: `PATCH /api/orders/:id/status` (`pos.service.ts:204-260`) writes **any** status to **any** `Order`, and `Order` also stores B2B tax invoices. Repeating `COMPLETED` posts a **new CustomerLedger SALE debit each time** (no idempotency). `CANCELLED`/`REFUNDED` reverse nothing: no stock, ledger or payment reversal, and the `Invoice` row is untouched. This bypasses `cancelInvoice`'s payment/dispatch guards. Steps aren't in one transaction, and ledger/invoice failures are swallowed by `console.error`. `addItemsToOrder` (`:148-200`) prices from the client and hard-codes 5% tax.
- **Status**: CODE-VERIFIED

### H-09 — Sales documents are not franchise-scoped; invoice seller franchise is client-chosen
- **Actual**: `SalesOrder` has **no `franchiseId` column**. `getSalesOrders`, `getSalesOrder`, `updateSalesOrder` and the conversions perform no user scoping, so every FRANCHISE_ADMIN can read, edit and convert every SO (and likewise quotations, proformas, delivery challans; `sales.controller.ts:101-170`). `convertSalesOrderToSale` passes `req.body` as payload, so the caller chooses `franchiseId` and stock is issued from **that franchise's** inventory.
- **Evidence**: schema `model SalesOrder` (no franchiseId); `sales.controller.ts:161-170`; `sales.service.ts:1001-1012, 1095`.
- **Status**: CODE-VERIFIED

### H-10 — Sales Order PATCH can change payment status, document number and lifecycle without transactions
- **Actual**: The `updateSalesOrder` whitelist includes `paymentStatus`, `orderNumber`, `idempotencyKey`, `quotationId` and `createdBy`. The transition table allows `CONFIRMED → SHIPPED/DELIVERED` by PATCH with **no delivery challan, stock issue or invoice**. A manually `DELIVERED` SO can then never be converted to an invoice (the convert path rejects DELIVERED as "already converted"). Customer/party can be changed on a CONFIRMED order.
- **Evidence**: `src/modules/sales/sales.service.ts:298-307, 991-998, 1945-1980`.
- **Status**: CODE-VERIFIED

### H-11 — No stock reservation for Sales Orders / Proformas (only franchise orders reserve)
- **Actual**: SO creation checks availability (`checkStock: true`) but reserves nothing. Two SOs can promise the same stock; dispatch/invoice later fails or goes negative for untracked items.
- **Evidence**: `InventoryReservation.franchiseOrderId @unique` is the only reservation key; `sales.service.ts:1853`.
- **Status**: CODE-VERIFIED (gap); whether SO-level reservation is required is BUSINESS-CONFIRM.

### H-12 — Credit limits are stored but never enforced
- **Actual**: `creditLimit` exists on Customer, Dealer, Vendor and Franchise and is shown in reports, but no sales invoice, SO, POS credit sale or franchise-order path reads it.
- **Evidence**: `grep creditLimit` shows only masters, controllers and reports (`finance.service.ts:7413-7651`, `franchise.service.ts:164`).
- **Status**: CODE-VERIFIED

### H-13 — Finance actions lack record ownership checks (IDOR); fund transfer lacks amount validation
- **Actual**: `cancelPayment`, `cancelInvoice`, `cancelExpense` and `recordExpensePayment` act on any ID for any FRANCHISE_ADMIN. `transferFunds` accepts any two account IDs (including HQ accounts or another franchise's), doesn't reject `amount ≤ 0` (a negative amount reverses the transfer **and skips the balance check**), doesn't reject from == to, and doesn't lock accounts.
- **Evidence**: `src/modules/finance/finance.controller.ts:400-499`; `finance.service.ts:1992-2044`.
- **Status**: CODE-VERIFIED

### H-14 — Customer payment can be applied to another customer's invoice; payments can be freely backdated
- **Actual**: The cross-party guard exists only in the multi-allocation path. The legacy single `invoiceId` path checks outstanding but **not** that the invoice belongs to `entityId`. `createdAt` is accepted from the client for payments and ledger rows, and there's no financial period lock.
- **Evidence**: `finance.service.ts:1695-1719` vs `:1760-1771`; `:1825, 1872, 1922`.
- **Status**: CODE-VERIFIED

### H-15 — Inter-branch transfer receipts create no lots; no cancel or short-receipt
- **Actual**: Dispatch depletes source lots FIFO (cost captured). Receipt posts `TRANSFER_IN` via `recordMovement` **without `receiveAtCost`**, so no `InventoryBatch` is created at the destination. Received stock is invisible to strict-FIFO consumers (dispatch/production "Insufficient approved stock"), loses expiry/lot/recall traceability, and is valued at the destination's unrelated average cost. There's no cancel endpoint (enum has CANCELLED), no partial/short receipt and no in-transit loss handling. Dispatch has no row lock.
- **Evidence**: `src/modules/logistics/logistics.service.ts:191-339`.
- **Status**: CODE-VERIFIED (concurrency part CODE-POTENTIAL)

### H-16 — Payroll is not franchise-scoped and can be re-processed
- **Actual**: `Payroll` has no `franchiseId`. `processPayroll` loads **all employees in the system** and doesn't guard against re-processing a PROCESSED payroll. Steps aren't in a transaction. Routes are FRANCHISE_ADMIN, so any franchise admin can generate payslips for every franchise's staff. `markPaid` moves money from a client-chosen account.
- **Evidence**: `src/modules/payroll/payroll.service.ts:73-180, 216-250`; `app.ts:707-723`.
- **Status**: CODE-VERIFIED (employee-level scoping on reads not fully traced)

### H-17 — Purchase returns: no franchise scoping and name-based material resolution
- **Actual**: Routes are FRANCHISE_ADMIN-only (SA via bypass), so franchise admins can create returns against HQ vendors and deplete HQ lots. `getPurchaseReturns` returns all returns system-wide. Bill-rate refinement and legacy stock deduction resolve materials with `inventoryItem.findFirst({ name: insensitive })` and **no franchise filter**, so a return can deduct a same-named item from another franchise.
- **Evidence**: `app.ts:826-828`; `purchase.service.ts:193-208, 447-457, 556-569`.
- **Status**: CODE-VERIFIED (cross-franchise name collision depends on data)

### H-18 — Bill "outstanding" ignores purchase returns/debit notes → overpayment risk
- **Actual**: Bill outstanding = `amount − advanceApplied − payments` (`vendor-invoices.service.ts:124-128`; also the overpayment guard in `procurement.service.ts:1845-1853`). Return DEBITs reduce the vendor ledger but **not** the bill's outstanding, so "Make Payment" still offers the full amount.
- **Status**: CODE-VERIFIED

### H-19 — Production status can be force-set, losing consumed materials
- **Actual**: Raw materials are consumed at run start. `PATCH /api/production/:id/status` (`updateStatus`) and `POST /:id/stop` write status directly. Setting CANCELLED/STOPPED/COMPLETED this way produces no finished-goods output, no waste entry and no material restoration, so consumed inventory value disappears from all reports.
- **Evidence**: `src/modules/production/production.service.ts:431-439, 2198-2200`.
- **Status**: CODE-VERIFIED; whether stopped runs should auto-post waste is BUSINESS-CONFIRM.

### H-20 — Customer receivable is computed from different sources in different places
- **Actual**: SO-converted invoices post **no CustomerLedger SALE row** (`convertSalesOrderToSale`). The unified party statement compensates by adding such invoices as debits, but other consumers that read `CustomerLedger` directly (customer ledger summary, legacy screens) do not. Dealers have no ledger at all (derived). Franchise receivable counts only posted FranchiseLedger rows.
- **Evidence**: `src/modules/finance/party-ledger.service.ts:1-30` (design comment); `sales.service.ts:979-1116`; `customer.controller.ts` ledger-summary route.
- **Impact**: The same customer shows different balances on different screens; aging and collections are unreliable.
- **Status**: CODE-VERIFIED (exact screens with mismatches need a data comparison)

---

## 6. Detailed Issue Register — MEDIUM

| ID | Module | Issue | Evidence | Recommended fix | Status |
|---|---|---|---|---|---|
| M-01 | GRN | `cancel()` isn't transactional or locked, has no reason/user/audit; racing with `approve()` can stamp CANCELLED over COMPLETED, re-opening PO quantity for a second receipt | `grn.service.ts:771-785` | Lock the GRN row, conditional update `WHERE status='PENDING'`, audit | CODE-POTENTIAL |
| M-02 | GRN / PO | Duplicate material lines (in a PO or a GRN payload) are validated independently against the same remaining quantity → over-receipt; PO status per material can show RECEIVED early | `grn.service.ts:271-296, 456-466, 731-735`; no dedupe in `createPurchaseOrder` | Reject duplicate materials or aggregate per material before validating | CODE-VERIFIED |
| M-03 | GRN / QC | GRN approval marks accepted lines APPROVED and lots usable immediately; the line `qcStatus` entered at receipt is ignored; audit log records `inventoryState:'QC_HOLD'` and `performedBy:'SYSTEM'` | `grn.service.ts:513-517, 612-637, 757-765` | Honour QC_HOLD for QC-required categories; log the real user | CODE-VERIFIED |
| M-04 | PO | No short-close / "cancel undelivered balance"; partially received POs stay PARTIALLY_RECEIVED forever (and C-05 makes cancel dangerous) | `procurement.service.ts:1534` | Add short-close with reason, releasing advance | CODE-VERIFIED |
| M-05 | GRN | Over-delivery is hard-blocked; no tolerance or approval path | `grn.service.ts:293-296` | Configurable tolerance plus approval | BUSINESS-CONFIRM |
| M-06 | GRN / Costing | GRN freight/unloading costs aren't capitalized into lot cost (landed cost) | `grn.service.ts:373-381, 550-551` | Allocate landed cost to lots | BUSINESS-CONFIRM |
| M-07 | GRN / Bills / GST | No persisted GRN number (UI derives one from UUID via `formatERPNumber`); GRN date and bill date = server now; auto-bill number is internal (`BILL-PO…`); the vendor's real invoice number/date isn't captured; `VendorInvoice.invoiceNumber` is globally unique across vendors | `grn.service.ts:505-506, 689, 700`; schema `VendorInvoice` | Persist GRN numbers; capture vendor invoice no/date; unique on `(vendorId, invoiceNumber)` | CODE-VERIFIED |
| M-08 | GRN (frontend) | GRN create → approve → return runs as three separate client calls; failure leaves orphan PENDING GRNs or rejections without a return document | `src/app/purchases/grn/page.tsx:671-700` | Single server endpoint doing all three atomically | CODE-VERIFIED |
| M-09 | Numbering | Count-based or timestamp numbers: purchase return `PR-YYYY-…` and purchase request `PR-YYYY-…` share a prefix; RFQ, PR, payment-number preview, `DPO-${Date.now()%1e6}`, `BILL-${Date.now()%1e6}` → collisions and unique-constraint failures under load | `purchase.service.ts:21-35`; `purchase-request.service.ts:35-37`; `vendor-invoices.service.ts:168, 295`; `procurement.service.ts:2047-2067` | Use `NumberSequence` (already used for PO/GRN lots) | CODE-VERIFIED |
| M-10 | Inventory | Non-strict outbound movements succeed when lots are insufficient: ledger decreases, lots don't → negative stock allowed; expired lots are excluded from FIFO but remain in ledger stock and valuation; ledger, cache and lots drift | `inventory.service.ts:872-907, 997` | Policy for negative stock; expiry write-off job; periodic reconciliation report | CODE-VERIFIED |
| M-11 | Warehouse | Warehouse-wise balances are incomplete: many movements carry no `warehouseId` (transfers, POS, QC path, stockIn/Out); HQ-scoped items without a franchise primary warehouse are unattributed; `Warehouse` has no owner column | `inventory.service.ts:117-134`; schema `Warehouse` | Make warehouse mandatory on every movement | CODE-VERIFIED |
| M-12 | Inventory | Adjustments: no reason codes, no approval, no P&L variance posting; reconciliation applies items one by one (non-atomic) and per item, not per warehouse; concurrent adjustment race | `inventory.service.ts:702-782` | Count document with approval; per-warehouse; atomic | CODE-VERIFIED |
| M-13 | Inventory | `stockIn`/`stockOut` accept any `type` from the client (e.g. `SALES_OUT`, `PURCHASE_IN`), distorting movement reports; stock-in creates ledger-only stock with no lot | `inventory.controller.ts:56-88` | Allow-list types; require lot data | CODE-VERIFIED |
| M-14 | DB integrity | `@@unique([sku, franchiseId])` is a plain Postgres unique index, where NULLs are distinct → duplicate SKUs allowed for HQ-scoped (null franchise) items | `migration.sql:2415` | `NULLS NOT DISTINCT` or partial unique index; dedupe data | CODE-VERIFIED |
| M-15 | DB integrity | `ON DELETE CASCADE` from InventoryItem to StockMovement, ProcurementOrderItem, GoodsReceiptItem, ProductionItem, etc.; only `deleteItem()` guards it | migration FKs; `inventory.service.ts:595-652` | Change to RESTRICT; soft-delete only | CODE-VERIFIED |
| M-16 | Waste | Waste creation doesn't verify the item/warehouse belongs to the caller's franchise | `waste.controller.ts:37-47`; `waste.service.ts:58-125` | Ownership check | CODE-POTENTIAL |
| M-17 | Approvals | WorkflowRequest is a free-form tracker with no FK to PO/expense/production; approving it changes nothing; no reject; initiator can approve every stage of their own request | `workflow-approvals.service.ts:33-150`; `stage-config.ts` | Link approvals to documents; segregation of duties | CODE-VERIFIED |
| M-18 | Purchase Requests | PR status is free-form (any string, incl. `CONVERTED_TO_PO`) with no PO created and no PR→PO link; `POST /api/purchase/requisitions` (FA) creates a number-less PO with no lines and null franchise | `purchase-request.service.ts:59-71`; `purchase.service.ts:695-711` | PR→PO conversion with FK; remove the legacy requisition | CODE-VERIFIED |
| M-19 | Vendor ledger | `balanceAfterTransaction` is computed from the last row without a lock; rows posted with 0 (C-05) corrupt it; `recordAdjustment` computes the balance in one tx and writes in another; manual adjustments have no validation, approval or audit | `procurement.service.ts:1779-1786, 1984-2001`; `vendor-invoices.service.ts:389-394` | Derive running balance at read time; lock per vendor; approval for adjustments | CODE-VERIFIED |
| M-20 | DB / finance | All money and quantities are `Float` (only a few Decimal columns) → rounding drift in totals, GST and ledgers | schema | Migrate money to `Decimal(14,2)` | CODE-VERIFIED |
| M-21 | Accounts | Account balance check-then-update without a lock → concurrent outflows can overdraw | `finance.service.ts:1677-1683, 1957-1964`; `account.service.ts adjustBalance` | Conditional update (`balance >= amount`) | CODE-POTENTIAL |
| M-22 | POS | No idempotency key on `/api/pos/checkout` → a double tap creates two bills and two stock deductions | `pos.service.ts:478-870` | Client-generated idempotency key | CODE-POTENTIAL (frontend guard not traced) |
| M-23 | Franchise orders | Dispatch idempotency check has no row lock → concurrent dispatch can deduct twice | `franchise-order.service.ts:776-827` | `SELECT … FOR UPDATE` | CODE-POTENTIAL |
| M-24 | Logistics | Stock request approval has no status guard and doesn't create a transfer (dead-end workflow) | `logistics.service.ts:32-57` | Guarded transitions; auto-create transfer | CODE-VERIFIED |
| M-25 | Bills | A "direct" bill (no PO) auto-creates a `RECEIVED` PO with no GRN, no stock movement and no franchise → purchase in finance with no inventory | `vendor-invoices.service.ts:158-209` | Confirm intent; require a stock or expense classification | BUSINESS-CONFIRM |
| M-26 | Deployment | The backend working tree deletes two committed migrations and adds an uncommitted squashed baseline (`20261121120622`, 3,327 lines); deploying it against an existing DB will conflict or require reset | `git status` of backend `prisma/migrations` | Resolve before any deploy; never reset prod | CODE-VERIFIED |
| M-27 | Franchise / GST | Franchise-order GST invoice takes `interState` from a query parameter (IGST vs CGST/SGST chosen by the caller) | `app.ts:846-852` | Derive from states | CODE-VERIFIED |
| M-28 | Routing | `GET /api/franchise/product-requests` is declared **after** `GET /api/franchise/:id`, so Express routes it to `getOne(id='product-requests')` | `app.ts:574` vs `:580` | Reorder routes | CODE-VERIFIED (frontend usage not traced) |
| M-29 | Security | `cors()` allows all origins (`CORS_ORIGIN` env is ignored); full request/response bodies, including financial and party data, go to the console log (only listed keys are redacted); RBAC logs every request | `app.ts:70, 112-148`; `rbac.middleware.ts:28` | Configure origin allow-list; reduce body logging | CODE-VERIFIED |
| M-30 | GRN | FRANCHISE_ADMIN can create (not approve) GRNs on any HQ PO: no PO ownership check, and warehouse scope only checked when a warehouse is given | `app.ts:545`; `grn.service.ts:222-278` | Ownership check | CODE-VERIFIED |

---

## 7. Detailed Issue Register — LOW

| ID | Issue | Evidence | Status |
|---|---|---|---|
| L-01 | Two audit tables (`AuditLog`, `ActivityLog`), with many financial mutations unaudited (PO cancel/delete, payment cancel, vendor adjustment, stock adjustment, invoice status changes); `performedBy` often `'SYSTEM'` | grep of `auditLog.create` | CODE-VERIFIED |
| L-02 | Placeholder pages in navigation (vouchers, groups, chart of accounts, hire-vendors) imply features that don't exist | `src/app/accounting/{vouchers,groups,chart}/page.tsx` | CODE-VERIFIED |
| L-03 | A `.bak` source file is committed in the frontend | `src/app/sales/returns/page.tsx.bak` | CODE-VERIFIED |
| L-04 | SO→invoice conversion creates a new `Product` for each free-text line (master pollution) and loads the entire product table on every conversion | `sales.service.ts:1015, 1029-1039` | CODE-VERIFIED |
| L-05 | B2B invoices are stored with `orderType: 'DINE_IN'` | `sales.service.ts:1061` | CODE-VERIFIED |
| L-06 | Inconsistent status vocabularies: `PARTIAL` vs `PARTIALLY_PAID`, `PENDING` vs `UNPAID`; many status columns are free `String`s (Invoice, Payment, DeliveryChallan, PurchaseReturn, Payroll) | schema | CODE-VERIFIED |
| L-07 | Duplicate route aliases enlarge the attack/maintenance surface (`/api/suppliers`, `/api/procurement/po`, `/api/estimates/*`, PUT+PATCH pairs) | `app.ts` | CODE-VERIFIED |
| L-08 | Advance payment at PO creation is recorded with method `CASH` regardless of the account type | `procurement.service.ts:941` | CODE-VERIFIED |

---

## 8. Missing Feature Register

| ID | Missing feature | Needed by workflow | Risk if absent | Severity |
|---|---|---|---|---|
| F-01 | General ledger with journal vouchers, chart of accounts, and debit = credit control | All finance | Postings can be missed or duplicated with no control total | HIGH |
| F-02 | Financial period close / lock date | Payments, invoices, GRN, adjustments | Backdated edits to filed GST periods | HIGH |
| F-03 | PO short-close / balance cancellation | Partial delivery (§4A, §4C) | Open POs forever, or phantom payables via cancel (C-05) | HIGH |
| F-04 | GRN reversal after approval (with stock and bill reversal) | Wrong receipts | Only workaround is a purchase return, which mis-represents the event | MEDIUM |
| F-05 | Vendor bill cancel/void and an independent debit-note document | AP corrections | Corrections done via ad-hoc ledger adjustments (M-19) | MEDIUM |
| F-06 | Partial invoicing / multiple deliveries per Sales Order | Partial fulfilment (§7) | SO = exactly one invoice (`sourceSalesOrderId @unique`) | HIGH |
| F-07 | Stock reservation for SO/proforma | Sales promise | Over-promising (H-11) | HIGH |
| F-08 | Credit-limit enforcement and credit hold | Sales, franchise orders | Unbounded receivables (H-12) | HIGH |
| F-09 | Transfer cancel, short receipt, in-transit loss | Inter-branch transfers | Stuck SHIPPED transfers (H-15) | MEDIUM |
| F-10 | Approval matrix linked to documents (PO value, expense, adjustment, discount) | All approvals | Approvals are decorative (M-17, H-06) | HIGH |
| F-11 | Granular roles and action-level permissions (purchase, warehouse, sales, finance, HR, approver) and warehouse-level access | RBAC (§11) | Segregation of duties impossible | HIGH |
| F-12 | Landed-cost allocation | Inventory valuation | Under-valued lots (M-06) | MEDIUM |
| F-13 | Over-delivery tolerance with approval | Receiving | Operational friction (M-05) | LOW |
| F-14 | QC-hold stage for purchased goods before stock is usable | QC | Unchecked goods consumable (M-03, C-06) | MEDIUM |
| F-15 | PR → RFQ → PO traceability (FKs) | Procurement | No audit trail from need to PO (M-18, H-05) | MEDIUM |
| F-16 | Expiry write-off job (expired lots → WASTE) | Inventory | Expired stock stays in valuation (M-10) | MEDIUM |
| F-17 | Bank statement reconciliation | Cash management | Cash book vs bank never reconciled | MEDIUM |
| F-18 | Serial-number tracking | Only if the business sells serialised goods | — | BUSINESS-CONFIRM |

---

## 9. Cross-Module Connection Matrix

| Source | Related module | Expected connection | Actual connection | Missing / incorrect behaviour | Issue |
|---|---|---|---|---|---|
| Purchase Request | PO | PR approved → PO with PR reference | None (no FK, free status) | No traceability | M-18 |
| RFQ / Quotation | PO | Accepted quote → PO | Route missing; convert throws | Broken | H-05 |
| PO | Approval | Threshold approval before sending | Auto-approved; Workflow module unlinked | Bypass | H-06, M-17 |
| PO | Vendor ledger | No entry until bill; reversal only of real entries | Cancel/delete posts CREDIT of full PO | Phantom payable | C-05 |
| PO | Cash / bank | Advance moves money | Create: correct. `/advance`: ledger only | Cash overstated | H-04 |
| PO | GRN | Remaining qty per line; status update | Implemented with locks | Duplicate-line hole; cancel race | M-02, M-01 |
| GRN | Inventory | Lot + movement + cost | Implemented | Landed cost missing; QC bypassed | M-06, M-03 |
| GRN | QC | Hold → inspect → release | Separate endpoint, wrong lot lookup | Corruption | C-06 |
| GRN | Vendor bill | Auto bill for accepted qty | Implemented | Manual bill can duplicate | H-01 |
| GRN rejection | Purchase return | Server-generated, bounded by rejected qty | Client-generated, unbounded | Payable manipulation | C-04 |
| Purchase return | Vendor ledger | DEBIT | Implemented | Bill outstanding not reduced | H-18 |
| Purchase return | Inventory | Deplete exact lot | Implemented for lot lines; name-based legacy | Wrong item possible | H-17 |
| Vendor bill | 3-way match → payment gate | Match blocks payment | Match ignored | No control | H-03 |
| Vendor payment | Bill / PO status | Recompute on pay **and** on cancel | Pay: yes. Cancel: no | Stale PAID | C-07 |
| Sales Order | Inventory reservation | Reserve on confirm | None | Over-promise | H-11 |
| Sales Order | Delivery / invoice | Status driven by documents | Status settable by PATCH | Phantom shipments | H-10 |
| Sales Order | Customer credit | Limit check | None | — | H-12 |
| Sales invoice | Customer ledger | SALE debit | Direct invoice: yes. SO-converted: no | Inconsistent AR | H-20 |
| Sales invoice cancel | Inventory | Restore SALES_OUT | Not restored | Stock loss | H-07 |
| Sales invoice cancel | E-way bill | Cancel EWB | Not linked | Compliance | H-07 |
| Customer payment | Invoice status | Recompute on pay and cancel | Pay: yes. Cancel: no | Stale PAID | C-07 |
| POS order status | Invoice / ledger / stock | Guarded lifecycle | Free status, repeat postings | Duplicates | H-08 |
| Franchise order | HQ inventory / franchise inventory | HQ-only dispatch, franchise receipt | Franchise can do everything | Stock duplication | C-03 |
| Franchise order | Franchise ledger | Debit on order, reverse on cancel | Debit only | AR overstated | C-03 |
| Transfer | Destination lots | Lot with cost/expiry | Ledger only | FIFO / recall break | H-15 |
| Production | Inventory / waste | Consumption ↔ output or waste | Status force-settable | Value vanishes | H-19 |
| Payroll | Employees / accounts | Per-franchise run | Global run by any FA | Cross-franchise | H-16 |
| Stock adjustment | P&L | Variance posting | None | Hidden shrinkage | M-12 |
| Approvals | Any document | Gate | None | Decorative | M-17 |
| All modules | Audit log | Every financial mutation | Partial | Weak trail | L-01 |

---

## 10. Business Workflow Audit Matrix

| Workflow | Start | Intermediate | End | Partial handling | Cancellation | Reversal | Approval | Cross-module integration | Audit status |
|---|---|---|---|---|---|---|---|---|---|
| Purchase Request | PR create | status update | "Converted" (label only) | n/a | delete DRAFT/PENDING | none | free status | none to PO | ❌ Broken linkage (M-18) |
| RFQ → PO | RFQ | vendor quotes | PO | n/a | RFQ status | none | none | quotes route missing | ❌ Broken (H-05) |
| PO lifecycle | PO create (auto-approved) | GRN(s) | RECEIVED → CLOSED via payments | ✅ remaining qty tracked (accepted + completed rejection returns) | ⚠️ dangerous (C-05) | none | ❌ bypassed (H-06) | ledger, cash partly | ⚠️ |
| Partial delivery 60/40 (§4A) | PO 100 | GRN 60 → PARTIALLY_RECEIVED; GRN 40 | RECEIVED | ✅ second GRN capped at remaining 40; history kept per GRN; bills per GRN | — | — | — | ⚠️ duplicate-bill path (H-01); duplicate-line hole (M-02) | ✅ core works |
| Over-delivery 110/100 (§4B) | GRN | — | blocked | — | — | — | no tolerance | — | ✅ blocked, ⚠️ no tolerance (M-05) |
| Under-delivery 70/100 (§4C) | GRN 70 | PO stays PARTIALLY_RECEIVED | never | ✅ pending 30 visible in GRN screen | ❌ no short-close | — | — | no overdue follow-up alerting traced | ⚠️ (M-04, F-03) |
| GRN approve | PENDING GRN | lots, movements, bill, liability | COMPLETED | ✅ | ⚠️ PENDING only, unlocked (M-01) | ❌ no post-approval reversal (F-04) | SA only | ✅ | ✅ strongest area |
| QC | GRN item | inspect | lot status | — | — | — | — | ❌ corrupts lots | ❌ (C-06) |
| Purchase return | manual or GRN-rejection | COMPLETED | debit note | ✅ manual qty capped by returnable | CANCELLED while pending | none after completion | none | ledger ✅, bill outstanding ❌ | ❌ GRN path (C-04) |
| Vendor bill → payment | bill (auto) | payment(s) | PAID | ✅ partial payments | ❌ no void | ❌ payment cancel broken | match ignored | — | ❌ (C-07, H-01..H-03) |
| Quotation → SO → Proforma → Invoice | quotation | SO, proforma | invoice | ❌ SO = one invoice | SO cancel before invoice | invoice cancel misses stock | none | stock ✅ at invoice; ledger ⚠️ | ⚠️ (H-07, H-10, H-20) |
| Direct sales invoice | invoice | payment(s), DC dispatch (deferred fulfilment) | PAID | ✅ deferred fulfilment via DC, remaining qty per invoice | cancel guarded by payments/dispatches | stock not restored | none | ledger ✅ | ⚠️ |
| Delivery challan | DC | IN_TRANSIT → delivered → convert | sale | ✅ returns per challan line | delete/update | reverseChallanStock exists | none | ✅ | ✅ (lightly audited) |
| Sales return / refund | return | approve, refund | COMPLETED | ✅ FIFO costed | — | — | approve role = FA/SA | stock restore ✅ | ✅ (lightly audited, heavily tested in repo) |
| POS sale | checkout | payment | COMPLETED | — | legacy status endpoint | ❌ | none | settlement lock ✅ | ⚠️ (H-08, M-22) |
| Franchise order | order | approve/reserve → dispatch → deliver | DELIVERED, paid | — | ❌ any time | ❌ | ❌ franchise self-approval | reservation ✅ | ❌ (C-03) |
| Inter-branch transfer | transfer | dispatch | completed | ❌ no short receipt | ❌ none | ❌ | none | lots ❌ at destination | ❌ (H-15) |
| Production run | start (consume) | stages, QC, packaging | FG lots | packaging partial ✅ | stop/status force | ❌ | SA | ⚠️ | ⚠️ (H-19) |
| Payroll | payroll run | process | payslips paid | — | — | — | none | payment ✅ | ❌ scoping (H-16) |

---

## 11. Status Transition Matrix

| Entity | Statuses (actual) | Enforced transitions | Invalid / missing transitions found | Issue |
|---|---|---|---|---|
| ProcurementOrder | DRAFT, PENDING_APPROVAL, APPROVED, ORDERED, SENT, PARTIALLY_RECEIVED, RECEIVED, INVOICED, PAID, CLOSED, CANCELLED | Edit only in DRAFT/PENDING_APPROVAL/APPROVED without GRN or bill; receipt-eligible set; RECEIVED → CLOSED via payments | Create accepts any client status; PENDING_APPROVAL auto → APPROVED; cancel from PARTIALLY_RECEIVED/INVOICED/PAID/CLOSED; ORDERED/SENT/INVOICED never set by code; no short-close; delete in most states | H-06, C-05, M-04 |
| GoodsReceipt | PENDING, COMPLETED, REJECTED, CANCELLED | Approve PENDING only (locked); cancel PENDING only | Cancel unlocked (race to COMPLETED → CANCELLED); no reversal of COMPLETED | M-01, F-04 |
| GoodsReceiptItem.qcStatus | PENDING, APPROVED, HOLD, REJECTED | Set APPROVED at GRN approval | HOLD entered at receipt is ignored | M-03 |
| VendorInvoice | PENDING, MATCHED, MISMATCH, APPROVED, PAID | PAID via payment/advance | Free status endpoint; match overwrites PAID; no CANCELLED/VOID; not reverted on payment cancel | H-02, C-07 |
| PurchaseReturn | PENDING, COMPLETED, CANCELLED (string) | PENDING → COMPLETED/CANCELLED, atomic claim | Can be **created** COMPLETED by the client | C-04 |
| PurchaseRequest | DRAFT … CONVERTED_TO_PO | none (any string) | Status without an underlying PO | M-18 |
| SalesOrder | DRAFT, PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED | Table-driven (`SALES_ORDER_TRANSITIONS`), row-locked | SHIPPED/DELIVERED without documents; manual DELIVERED blocks invoicing; CANCELLED from PROCESSING with no reservation logic | H-10 |
| ProformaInvoice | DRAFT, SENT, CONVERTED, CANCELLED | Table-driven | — | ✅ |
| Order (sale/POS) | PENDING, PREPARING, READY, COMPLETED, CANCELLED, REFUNDED | Legacy endpoint: none | Any → any; repeated COMPLETED double-posts | H-08 |
| Invoice.status (string) | PENDING/UNPAID, PARTIAL, PAID, CANCELLED | Recomputed on payment | Not recomputed on payment cancel | C-07 |
| Payment | status string + isCancelled | Cancel once | Wrong direction reversal; no sub-ledger reversal | C-07 |
| FranchiseOrder | PENDING, APPROVED, IN_PRODUCTION, DISPATCHED, DELIVERED, CANCELLED | DELIVERED only from DISPATCHED; DISPATCHED not from CANCELLED/DELIVERED | No table; FA can set all; APPROVED from DISPATCHED/DELIVERED; CANCELLED from anything | C-03 |
| InventoryReservation | ACTIVE, CONSUMED, RELEASED, PARTIAL | release only ACTIVE | Cancel after consumption silently no-ops | C-03 |
| StockTransfer | PENDING, APPROVED, SHIPPED, COMPLETED, CANCELLED | PENDING → SHIPPED → COMPLETED | APPROVED/CANCELLED unreachable; no cancel | H-15 |
| StockRequest | PENDING, APPROVED, REJECTED, COMPLETED | none | Re-approve any state; never COMPLETED | M-24 |
| Production | PENDING, IN_PROGRESS, COMPLETED, CANCELLED, STOPPED | approve from STOPPED/IN_PROGRESS | Raw `updateStatus` to any value | H-19 |
| Payroll | DRAFT, PROCESSED (string) | none | Re-process PROCESSED | H-16 |
| WorkflowRequest | stage keys | forward only, one stage at a time | No reject; self-approval; unlinked | M-17 |

---

## 12. Data Integrity Findings (summary)

1. **Transaction atomicity**: core financial paths (GRN approve, payment create, returns, invoice create, franchise dispatch/deliver) are transactional. Non-atomic paths: GRN cancel (M-01), legacy POS status (H-08), RFQ conversion (H-05), payroll processing (H-16), stock reconciliation (M-12), the frontend GRN orchestration (M-08) and `recordAdjustment` (M-19).
2. **Concurrency**: good row-lock coverage on GRN/PO, lots (FIFO `FOR UPDATE`), sales-order PATCH, and challan returns. Missing on franchise dispatch (M-23), transfer dispatch (H-15), account balances (M-21), vendor running balance (M-19) and GRN cancel (M-01).
3. **Idempotency**: present on Payment, SalesOrder, DeliveryChallan, DC return, ReturnOrder. Absent on PO (H-06), POS checkout (M-22), purchase return MANUAL, vendor bill manual create (H-01), franchise order create, and legacy POS status (H-08).
4. **Constraints**: HQ SKU uniqueness hole (M-14); vendor invoice number unique globally rather than per vendor (M-07); no unique bill per GRN (H-01); cascade deletes on stock history (M-15).
5. **Referential gaps**: PR↔PO, RFQ↔PR items (name-matched), approvals↔documents, purchase-return items↔GRN lines (name-matched), WasteEntry for production.
6. **Running balances**: `VendorLedger.balanceAfterTransaction` and `FranchiseLedger.balanceAfter` are stored, not derived, and can be corrupted (M-19).
7. **Numeric types**: Float money (M-20).
8. **Migrations**: uncommitted squash in the backend working tree (M-26).
9. **Repair scripts**: the backend contains many one-off backfill and fix scripts (`scripts/backfill-*`, `fix-vendor-ledger.ts`, `repair-missing-invoice-stock.ts`, `prisma/live_cleanup.ts`). They show historic data corruption from defects of the kinds listed here. Existing data should be reconciled after fixes (see §17).

## 13. Financial Integrity Findings (summary)

| Area | Finding | Issue |
|---|---|---|
| Payables | Phantom CREDIT on PO cancel/delete | C-05 |
| Payables | Arbitrary DEBIT via GRN-rejection return | C-04 |
| Payables | Double bill per PO | H-01 |
| Payables | Advance without cash | H-04 |
| Payables | Bill outstanding ignores returns | H-18 |
| Payables | Manual ledger adjustments without control | M-19 |
| Payments | Cancel reverses wrong direction; no sub-ledger reversal; stale statuses | C-07 |
| Payments | Cross-party single-invoice payment; backdating; no period lock | H-14, F-02 |
| Cash/bank | Negative-amount transfer, IDOR, overdraw race | H-13, M-21 |
| Receivables | Inconsistent AR sources; SO invoices without ledger | H-20 |
| Receivables | Duplicate SALE debits via legacy POS status | H-08 |
| Receivables | Franchise order cancel doesn't reverse ledger | C-03 |
| Tax | Interstate flag from query param on franchise invoice | M-27 |
| Tax | Vendor invoice number/date not captured (ITC reconciliation) | M-07 |
| Tax | Client-supplied sales invoice number accepted (`data.invoiceNumber`) breaks sequential numbering | `finance.service.ts` createInvoice (~line 2620) — CODE-VERIFIED, folded into M-09 |
| Valuation | No landed cost; expired stock valued; adjustments not expensed | M-06, M-10, M-12 |
| Controls | No GL / no debit = credit check / no period close | F-01, F-02 |

GST report logic (GSTR-1/2/3B/9, HSN, TDS/TCS) was **not** audited in depth. The repo contains dedicated regression scripts for these, which suggests prior attention, but they were not executed.

## 14. Inventory Integrity Findings (summary)

| Quantity type | Supported? | Notes |
|---|---|---|
| Physical (ledger) | ✅ | `StockMovement` sum |
| Available | ⚠️ | computed ad hoc: currentStock − blocked lots; ignores SO commitments |
| Reserved | ⚠️ | franchise orders only (H-11) |
| Allocated | ❌ | no concept beyond reservation |
| In-transit | ✅ | SHIPPED transfers / IN_TRANSIT challans have screens; no loss handling (H-15) |
| Damaged / quarantined | ✅ | lot statuses BLOCKED/RETURNED/REJECTED/QC_HOLD; recall quarantine |
| Pending (on order) | ✅ | PO remaining per line (GRN screen) |
| Warehouse-wise | ⚠️ | incomplete attribution (M-11) |
| Batch-wise | ✅ | strong for GRN/production lots; missing for transfers, adjustments-out, QC path |
| Valuation | ⚠️ | FIFO lot cost plus moving average; no landed cost; expired lots included |

Cases where one module changes stock and another doesn't reflect it: transfer receipt (lots, H-15), invoice cancel (H-07), production force-status (H-19), QC inspection (C-06), legacy POS cancel (H-08), stock-in without lots (M-13), franchise order cancel after dispatch (C-03).

## 15. Authorization Findings (summary)

| Finding | Issue |
|---|---|
| Public SUPER_ADMIN registration | C-01 |
| Forgeable JWT (fallback secrets) | C-02 |
| Only two roles; SUPER_ADMIN bypasses all checks; no action-level or warehouse-level permissions | F-11 |
| Franchise self-approval/dispatch/delivery | C-03 |
| Inventory adjustment / item read IDOR | C-08 |
| Payment/invoice/expense cancel, fund transfer IDOR | H-13 |
| Sales documents unscoped; seller franchise client-chosen | H-09 |
| Payroll global for any FA | H-16 |
| Purchase returns usable by FA on HQ vendors; unscoped lists | H-17 |
| GRN creation on any PO | M-30 |
| Waste on any item | M-16 |
| Workflow self-approval | M-17 |
| `/api/workflow-approvals` GET/approve and `/api/products/bulk-names`, `/api/drafts`, `/api/gst/verify` need only authentication (any role) | `app.ts:203-206, 266, 386-388, 498` — acceptable if intended, BUSINESS-CONFIRM |
| Open CORS; verbose body logging | M-29 |
| Note: frontend navigation gating (`/api/me/navigation`) was **not** relied upon; all findings above are backend-level | — |

## 16. Reports & Dashboard Gaps

1. **Trial balance / balance sheet are derived views** (from account balances, ledgers and orders), so they can't reveal posting errors. There's no reconciliation report between `Account.balance` and Σ `Payment` rows, between `currentStock`, the ledger sum and Σ lot `currentQty`, or between VendorLedger and bills/payments. *Recommended*: add these three reconciliation reports first; they detect most issues in this report.
2. **PO status reports** will show PARTIALLY_RECEIVED indefinitely (no short-close) and can show INVOICED/PAID/ORDERED/SENT states that code never sets.
3. **Customer balances** differ by screen (H-20).
4. **Vendor aging** uses a FIFO over the raw ledger, so phantom credits (C-05) and corrupted rows feed it directly.
5. **Approval status** dashboards (`/admin/approvals`) don't reflect real document approvals (M-17).
6. **Pending PO quantity vs expected delivery date**: no overdue-delivery report or alert was found in the alerts module (CODE-POTENTIAL; alerts module only lightly reviewed).
7. **GRN number** isn't searchable server-side (display-only, M-07).
8. **Placeholder accounting pages** (L-02).
9. ~60 report endpoints exist in `finance.service.ts`; their arithmetic wasn't individually audited.

## 17. Edge Case Findings

| Scenario (§13 of the brief) | Behaviour found | Issue |
|---|---|---|
| Double-click Submit | Protected: payments, SO, DC, GRN approve (lock), returns. **Not**: PO create, POS checkout, manual bill, franchise order create | H-06, M-22, H-01 |
| Refresh / API failure midway | GRN flow is three calls (M-08); legacy POS status partially posts (H-08) | M-08, H-08 |
| Two users receive the same PO line | Serialized by PO row lock ✅ | — |
| Two users sell the same lot | FIFO `FOR UPDATE` ✅; SO commitments not reserved | H-11 |
| Payment callback twice | No payment-gateway integration found; idempotency key covers retries | — |
| Invoice created but stock update fails | Same transaction ✅ (convert and createInvoice) | — |
| Cancel after downstream consumption | Franchise order (C-03), PO (C-05), invoice (H-07) handled incorrectly | C-03, C-05, H-07 |
| Change after approval | PO editable while APPROVED without GRN (acceptable); SO editable until DELIVERED | H-10 |
| Delete completed transaction | PO delete in most states; GRN delete via PO delete (blocked by FK when items exist) | C-05 |
| Backdated transaction | PO/GRN dates are server-fixed (good); payments/ledger `createdAt` client-settable | H-14 |
| Closed accounting period | No concept | F-02 |
| Vendor becomes inactive | New POs blocked ✅; existing open POs still receivable (BUSINESS-CONFIRM) | — |
| Warehouse inactive | GRN rejects inactive warehouse ✅ | — |
| Product inactive | Franchise order rejects inactive products ✅; others not traced | — |
| Item unit changes | Conversions are validated at PO/GRN; historic movements store `baseQty` ✅ | — |
| Tax rate change | PO snapshot GST used for bills/returns ✅ | — |
| Partial then cancel | PO: phantom liability (C-05); franchise order: no reversal (C-03) | C-05, C-03 |
| Repeated retries | Legacy POS COMPLETED duplicates ledger (H-08) | H-08 |

---

## 18. Risk Prioritization (all issues)

| Severity | Issues |
|---|---|
| **CRITICAL** | C-01, C-02, C-03, C-04, C-05, C-06, C-07, C-08 |
| **HIGH** | H-01 … H-20 |
| **MEDIUM** | M-01 … M-30 |
| **LOW** | L-01 … L-08 |
| **FEATURE GAP** | F-01 … F-18 (severity in §8) |

---

## 19. Recommended Remediation Roadmap

**Phase 1 — Critical security, financial and operational risks (immediately)**
1. Close `/api/auth/register` (C-01); fix JWT secret configuration and rotate (C-02); audit existing SUPER_ADMIN accounts.
2. Franchise-order transition table plus role-per-transition (C-03).
3. Server-generate GRN-rejection returns; forbid client `status` on create (C-04).
4. Remove the ledger write from PO cancel/delete; restrict cancel (C-05). Run a **read-only** query to list existing "PO Cancelled/Deleted — Reversal" vendor-ledger rows for accounting review.
5. Disable `/api/qc/inspect` until it is redesigned (C-06).
6. Store payment flow; rewrite `cancelPayment` reversal (C-07).
7. Ownership checks on adjustment/items (C-08) and on finance cancel/transfer (H-13).

**Phase 2 — High-priority business logic**
H-01 (bill per GRN only), H-02/H-03 (derived bill status, real 3-way match as payment gate), H-04 (advance through createPayment), H-06 (real PO approval and idempotency), H-07 (invoice cancel restores stock and frees SO), H-08 (retire the legacy POS status route), H-09/H-10 (SO franchise column and PATCH whitelist), H-14 (party guard and period lock), H-16 (payroll scoping), H-17/H-18, H-19, H-20 (single AR source).

**Phase 3 — Cross-module integration and feature gaps**
F-03 short-close, F-06 partial SO invoicing, F-07 SO reservation, F-08 credit limits, H-15 / F-09 transfer lots, cancel and short receipt, H-05 / F-15 PR→RFQ→PO, M-17 / F-10 approvals linked to documents, F-11 role model, F-04/F-05 GRN and bill reversal.

**Phase 4 — Reports, dashboards and validations**
Reconciliation reports (§16.1), M-07 numbering and vendor invoice capture, M-09 sequences, M-11 warehouse attribution, M-12 count documents, M-13 movement type allow-list, M-14/M-15 constraints, L-01 audit coverage.

**Phase 5 — Optimizations and improvements**
M-20 Decimal money, M-29 logging/CORS, L-02…L-08 cleanup, F-01 general ledger (strategic), F-12 landed cost, F-16 expiry job, F-17 bank reconciliation.

> **Data remediation**: after Phases 1–2, existing data will still contain the effects of these defects. Plan a read-only reconciliation (ledger vs documents, stock ledger vs lots, account balance vs payments) on a copy of production, then post **append-only correcting entries** after accounting sign-off. Do not edit historical rows in place.

---

## 20. Regression Testing Plan

**Pre-condition**: a dedicated test database restored from an anonymized production copy. The existing backend scripts (`src/tests/**`, `tests/**`, the `with-rollback.ts` helper) must be pointed at that database explicitly; they currently read the default `DATABASE_URL`.

| Suite | Scenarios (each asserts stock ledger, lots, sub-ledgers, account balances and document statuses) |
|---|---|
| **Auth / RBAC** | Register disabled; forged token rejected; FA denied on every HQ-only action listed in §15; FA cannot touch another franchise's IDs (parameterized over all `:id` routes) |
| **Purchase** | PO 100 → GRN 60 → GRN 40 → RECEIVED; GRN 110 blocked; duplicate-line payload rejected; GRN partial reject → return bounded by rejectedQty; PO cancel with/without GRN (no ledger change); short-close; bill per GRN only; 3-way match per line; advance create/apply/record; payment, then cancel payment (ledger, account, bill, PO all restored) |
| **QC** | Hold → inspect → release affects only its own lot |
| **Inventory** | Adjustment by owner/non-owner; reconciliation atomic; stock-in type allow-list; negative-stock policy; expiry write-off; transfer dispatch/receive creates destination lot; transfer cancel; warehouse attribution present on every movement |
| **Sales** | SO create/confirm/reserve; partial invoice; SO cancel releases reservation; invoice cancel restores stock and frees SO; credit-limit block; cross-franchise conversion denied; PATCH cannot set paymentStatus/orderNumber |
| **POS** | Checkout idempotency; settlement lock; legacy status route removed or guarded |
| **Franchise** | Full lifecycle by the correct roles; FA cannot dispatch; cancel after dispatch rejected; repeat-dispatch impossible; concurrent dispatch (two parallel requests) deducts once |
| **Finance** | Each payment type × cancel; transfer validation; backdating blocked by period lock; single-invoice party guard |
| **Production / Payroll** | Force-status blocked; stop posts waste; payroll per franchise, re-process blocked |
| **Concurrency** | Parallel requests (k6/Artillery) on GRN approve, franchise dispatch, account outflow, adjustment |
| **Reconciliation invariants** (run after every suite) | Σ movements = currentStock = Σ lot qty (tracked items); Σ vendor ledger = Σ bills − Σ payments − Σ returns ± adjustments; account balance = Σ payment flows; customer balance identical across all report endpoints |
| **Existing repo suites to keep green** | `src/tests/finance/*` (GST regressions, returns FIFO costing, payment validation, party ledger), `src/tests/procurement/*`, `src/tests/production/*`, `src/tests/franchise/*`, `src/tests/sales/*`; frontend `vitest` and `e2e/erp-routes.smoke.spec.ts` |

---

## 21. Final ERP Health Assessment

| Dimension | Rating | Rationale |
|---|---|---|
| Business logic maturity | **Medium** | Forward paths (GRN, invoicing, FIFO, returns costing, lot pricing) are thoughtfully built and visibly iterated. Reverse paths (cancel/void/reverse) are immature. |
| Workflow completeness | **Medium-Low** | Partial delivery works; short-close, partial SO invoicing, SO reservation, approvals, PR/RFQ linkage, transfer cancel and GRN/bill reversal are missing or broken. |
| Cross-module integration | **Medium-Low** | Purchase ↔ inventory ↔ AP is integrated. Approvals, PR/RFQ, receivables source, transfers ↔ lots and payroll ↔ franchise are not. |
| Data integrity | **Medium-Low** | Good locking in core paths, but Float money, stored running balances, NULL-unique hole, cascades, and many historic repair scripts. |
| Financial integrity | **Low** | No GL or control totals; multiple confirmed paths create phantom or missing postings (C-04, C-05, C-07, H-01, H-04, H-08). |
| Inventory integrity | **Medium-Low** | Lot/FIFO engine is solid; transfers, QC, adjustments, invoice cancel and franchise orders break consistency. |
| Authorization controls | **Critical / Low** | Public super-admin registration, forgeable tokens, a two-role model and widespread IDOR. |
| Operational readiness | **Not ready for production financial use until Phase 1 is complete.** After Phases 1–2 the system would be suitable for controlled use with the reconciliation reports in §16 monitoring it. |

---

## 22. Areas Requiring Business-Owner Confirmation

1. Should POs be auto-approved, or require approval above a value threshold? (H-06)
2. Is any over-delivery tolerance acceptable, and who approves it? (M-05)
3. Should purchased goods sit in QC hold before use, and for which categories? (M-03, F-14)
4. Is an expiry date mandatory for all purchased categories (equipment, packaging)? (`grn.service.ts:487-489` currently requires it for every accepted line)
5. Should freight/unloading be capitalized into stock cost? (M-06)
6. Are direct bills without PO/GRN allowed, and should they create stock? (M-25)
7. Should Sales Orders reserve stock, and support multiple invoices? (H-11, F-06)
8. What happens to raw materials of a stopped or cancelled production run: waste, or return to stock? (H-19)
9. Should franchise admins ever be able to raise purchase returns, GRNs, or run payroll? (H-16, H-17, M-30)
10. Which environments use which JWT secret variable names? (C-02)
11. Is the uncommitted migration squash in the backend intended for deployment? (M-26)

---

## Appendix A — Evidence Index (primary files)

| File | Relevant lines |
|---|---|
| `kiddosfood-erp-backend/src/app.ts` | 70 (CORS), 112-148 (logging), 180 (register), 203-206, 234, 252, 526-551, 574/580, 707-723, 826-830, 846-852 |
| `src/middleware/rbac.middleware.ts` | SA bypass, logging |
| `src/lib/jwt.util.ts` | 5-6 |
| `src/modules/auth/auth.validation.ts`, `auth.service.ts` | register |
| `src/modules/procurement/procurement.service.ts` | 637-681, 683-983, 993-1220, 1234-1314, 1534-1596, 1779-2001 |
| `src/modules/procurement/po-receipt-status.ts`, `purchase-tax.ts`, `purchase-dates.ts` | whole files |
| `src/modules/grn/grn.service.ts` | 85-145, 222-388, 390-769, 771-785 |
| `src/modules/grn/inspection.service.ts` | 19-172 |
| `src/modules/vendor-invoices/vendor-invoices.service.ts` | 21-103, 124-128, 131-318, 325-352, 376-451, 477-483 |
| `src/modules/purchase/purchase.service.ts` | 21-35, 87-189, 193-208, 271-337, 339-526, 533-571, 573-693, 695-711 |
| `src/modules/purchase-requests/purchase-request.service.ts` | 29-71 |
| `src/modules/inventory/inventory.service.ts` | 101-134, 595-652, 669-782, 785-966, 975-1058 |
| `src/modules/inventory/inventory.controller.ts` | 13-130 |
| `src/modules/inventory/inventory-reservation.service.ts` | 246-278 |
| `src/modules/logistics/logistics.service.ts` | 32-57, 68-339 |
| `src/modules/sales/sales.service.ts` | 298-307, 916-976, 979-1116, 1814-2078 |
| `src/modules/sales/sales.controller.ts` | 101-170 |
| `src/modules/finance/finance.service.ts` | 1019-1099, 1584-2118, createInvoice ~2198-2889 |
| `src/modules/finance/finance.controller.ts` | 327-499 |
| `src/modules/finance/party-ledger.service.ts` | 1-30 |
| `src/modules/franchise/franchise-order.controller.ts` | 53-95 |
| `src/modules/franchise/franchise-order.service.ts` | 652-1000 |
| `src/modules/pos/pos.service.ts` | 148-262, 478-870 |
| `src/modules/production/production.service.ts` | 340-380, 431-439, 2198-2200 |
| `src/modules/payroll/payroll.service.ts` | 73-250 |
| `src/modules/waste/waste.controller.ts` / `waste.service.ts` | 37-47 / 58-125 |
| `src/modules/workflow-approvals/*` | whole module |
| `prisma/schema.prisma` | models User, ProcurementOrder, GoodsReceipt(Item), VendorInvoice, InventoryItem, InventoryBatch, StockMovement, SalesOrder, Order, Payment, Payroll |
| `prisma/migrations/20261121120622/migration.sql` | 2415 (unique index), FK definitions |
| `kiddosfood-erp-frontend/src/app/purchases/grn/page.tsx` | 640-725 |
| `kiddosfood-erp-frontend/src/app/purchases/rfq/page.tsx` | 36-78 |
| `kiddosfood-erp-frontend/src/app/accounting/{vouchers,groups,chart}/page.tsx` | placeholders |

## Appendix B — Audit limitations

- No runtime execution: no API calls, no DB queries, no test runs (see the note at the top).
- Lightly reviewed or not audited: GST report arithmetic, e-way bill (Fynamics), recall module internals, packaging costing, lot pricing, CRM, chat, loyalty, KDS, dealers, alerts, dashboard KPI formulas, AI assistant, frontend permission gating, and frontend double-submit guards outside the GRN page.
- Line numbers refer to the commits listed in the header and may drift.
- The audit report itself is the only file created; it is not committed.
