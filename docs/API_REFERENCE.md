# API Reference

Generated from the backend route registry and mounted router files. **450 route declarations** were found. This inventory documents declared routes; it does not claim that every route has complete runtime test coverage.

## Conventions

- Base development URL defaults to `http://localhost:5000`. Paths below are absolute API paths.
- Protected routes use `Authorization: Bearer <access-token>`.
- JSON is the default request/response format. `GET /api/attachments/:id/file` returns bytes with stored MIME type.
- Success response shapes are controller/service-specific Prisma objects, arrays or aggregates. Where no explicit DTO/schema exists, the exact stable contract is **Unknown** and the handler reference is authoritative.
- Known errors use `{ error: string }` or the centralized error shape and relevant 4xx/5xx status. The code is not fully uniform.
- `SUPER_ADMIN` bypasses role lists inside `authorizeRole`; listed roles show the declaration.

## Authentication payloads

- `POST /api/auth/login`: body `{ identifier: string, password: string(min 6) }`; response includes access token, refresh token and user according to `AuthController.login`.
- `POST /api/auth/register`: body `{ fullName(min 2), email, phone?, password(min 8), role? }`; role enum is `SUPER_ADMIN | FRANCHISE_ADMIN`.
- `POST /api/auth/refresh`: body `{ refreshToken }`; response supplies rotated token data.

## Endpoint inventory

| Method | Path | Authentication | Declared roles | Handler | Input evidence | Source |
|---|---|---|---|---|---|---|
| GET | / | Public | None | Inline/anonymous | Path/query parameters; exact schema: controller/service | src\app.ts:132 |
| GET | /health | Public | None | Inline/anonymous | Path/query parameters; exact schema: controller/service | src\app.ts:148 |
| GET | /api/warehouses/next-code | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | InventoryController.getNextWarehouseCode | Path/query parameters; exact schema: controller/service | src\app.ts:153 |
| GET | /api/warehouses | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | InventoryController.getWarehouses | Path/query parameters; exact schema: controller/service | src\app.ts:154 |
| POST | /api/warehouses | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | InventoryController.createWarehouse | Path/query plus JSON body; exact schema: controller/service | src\app.ts:155 |
| GET | /api/warehouses/:id/stock | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | InventoryController.getWarehouseStock | Path/query parameters; exact schema: controller/service | src\app.ts:156 |
| PATCH | /api/warehouses/:id | Bearer JWT | SUPER_ADMIN | InventoryController.updateWarehouse | Path/query plus JSON body; exact schema: controller/service | src\app.ts:157 |
| DELETE | /api/warehouses/:id | Bearer JWT | SUPER_ADMIN | InventoryController.deleteWarehouse | Path parameters; body: Unknown | src\app.ts:158 |
| POST | /api/auth/register | Public | None | AuthController.register | Path/query plus JSON body; exact schema: controller/service | src\app.ts:161 |
| POST | /api/auth/login | Public | None | AuthController.login | Path/query plus JSON body; exact schema: controller/service | src\app.ts:162 |
| POST | /api/auth/refresh | Public | None | AuthController.refresh | Path/query plus JSON body; exact schema: controller/service | src\app.ts:163 |
| POST | /api/auth/logout | Public | None | AuthController.logout | Path/query plus JSON body; exact schema: controller/service | src\app.ts:164 |
| GET | /api/me | Bearer JWT | Any authenticated role | UserController.getMe | Path/query parameters; exact schema: controller/service | src\app.ts:165 |
| GET | /api/me/navigation | Bearer JWT | Any authenticated role | NavController.getNavigation | Path/query parameters; exact schema: controller/service | src\app.ts:166 |
| PATCH | /api/me/password | Bearer JWT | Any authenticated role | UserController.changeOwnPassword | Path/query plus JSON body; exact schema: controller/service | src\app.ts:167 |
| PATCH | /api/me/update | Bearer JWT | Any authenticated role | UserController.updateMe | Path/query plus JSON body; exact schema: controller/service | src\app.ts:168 |
| GET | /api/users | Bearer JWT | SUPER_ADMIN | UserController.getAll | Path/query parameters; exact schema: controller/service | src\app.ts:175 |
| GET | /api/users/:id | Bearer JWT | SUPER_ADMIN | UserController.getOne | Path/query parameters; exact schema: controller/service | src\app.ts:176 |
| POST | /api/users | Bearer JWT | SUPER_ADMIN | UserController.create | Path/query plus JSON body; exact schema: controller/service | src\app.ts:177 |
| PATCH | /api/users/:id | Bearer JWT | SUPER_ADMIN | UserController.update | Path/query plus JSON body; exact schema: controller/service | src\app.ts:178 |
| DELETE | /api/users/:id | Bearer JWT | SUPER_ADMIN | UserController.delete | Path parameters; body: Unknown | src\app.ts:179 |
| GET | /api/workflow-approvals | Bearer JWT | Any authenticated role | WorkflowApprovalsController.getAll | Path/query parameters; exact schema: controller/service | src\app.ts:184 |
| GET | /api/workflow-approvals/:id | Bearer JWT | Any authenticated role | WorkflowApprovalsController.getOne | Path/query parameters; exact schema: controller/service | src\app.ts:185 |
| POST | /api/workflow-approvals | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | WorkflowApprovalsController.create | Path/query plus JSON body; exact schema: controller/service | src\app.ts:186 |
| POST | /api/workflow-approvals/:id/approve | Bearer JWT | Any authenticated role | WorkflowApprovalsController.approve | Path/query plus JSON body; exact schema: controller/service | src\app.ts:187 |
| GET | /api/inventory | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | InventoryController.getInventory | Path/query parameters; exact schema: controller/service | src\app.ts:191 |
| GET | /api/inventory/raw-materials/summary | Bearer JWT | SUPER_ADMIN | InventoryController.getRawMaterialStockSummary | Path/query parameters; exact schema: controller/service | src\app.ts:192 |
| GET | /api/inventory/raw-materials/consumption | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | InventoryController.getRawMaterialConsumption | Path/query parameters; exact schema: controller/service | src\app.ts:193 |
| GET | /api/inventory/raw-materials/ledger | Bearer JWT | SUPER_ADMIN | InventoryController.getRawMaterialLedger | Path/query parameters; exact schema: controller/service | src\app.ts:194 |
| GET | /api/inventory/items/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | InventoryController.getItem | Path/query parameters; exact schema: controller/service | src\app.ts:195 |
| POST | /api/inventory/items | Bearer JWT | SUPER_ADMIN | InventoryController.createItem | Path/query plus JSON body; exact schema: controller/service | src\app.ts:196 |
| POST | /api/inventory/stock-in | Bearer JWT | SUPER_ADMIN | InventoryController.stockIn | Path/query plus JSON body; exact schema: controller/service | src\app.ts:197 |
| POST | /api/inventory/stock-out | Bearer JWT | SUPER_ADMIN | InventoryController.stockOut | Path/query plus JSON body; exact schema: controller/service | src\app.ts:198 |
| POST | /api/inventory/adjustment | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | InventoryController.adjustment | Path/query plus JSON body; exact schema: controller/service | src\app.ts:199 |
| GET | /api/inventory/reconciliation | Bearer JWT | SUPER_ADMIN | InventoryController.getReconciliationSheet | Path/query parameters; exact schema: controller/service | src\app.ts:200 |
| POST | /api/inventory/reconciliation | Bearer JWT | SUPER_ADMIN | InventoryController.submitReconciliation | Path/query plus JSON body; exact schema: controller/service | src\app.ts:201 |
| GET | /api/inventory/movements | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | InventoryController.getMovements | Path/query parameters; exact schema: controller/service | src\app.ts:202 |
| GET | /api/raw-materials | Bearer JWT | SUPER_ADMIN | RawMaterialsController.getAll | Path/query parameters; exact schema: controller/service | src\app.ts:205 |
| GET | /api/raw-materials/:id | Bearer JWT | SUPER_ADMIN | RawMaterialsController.getById | Path/query parameters; exact schema: controller/service | src\app.ts:206 |
| POST | /api/raw-materials | Bearer JWT | SUPER_ADMIN | RawMaterialsController.create | Path/query plus JSON body; exact schema: controller/service | src\app.ts:207 |
| PATCH | /api/raw-materials/:id | Bearer JWT | SUPER_ADMIN | RawMaterialsController.update | Path/query plus JSON body; exact schema: controller/service | src\app.ts:208 |
| DELETE | /api/raw-materials/:id | Bearer JWT | SUPER_ADMIN | RawMaterialsController.delete | Path parameters; body: Unknown | src\app.ts:209 |
| PATCH | /api/raw-materials/:id/deactivate | Bearer JWT | SUPER_ADMIN | RawMaterialsController.deactivate | Path/query plus JSON body; exact schema: controller/service | src\app.ts:210 |
| PATCH | /api/raw-materials/:id/activate | Bearer JWT | SUPER_ADMIN | RawMaterialsController.activate | Path/query plus JSON body; exact schema: controller/service | src\app.ts:211 |
| POST | /api/orders | Bearer JWT | FRANCHISE_ADMIN | OrderController.createOrder | Path/query plus JSON body; exact schema: controller/service | src\app.ts:214 |
| POST | /api/orders/:id/items | Bearer JWT | FRANCHISE_ADMIN | OrderController.addItems | Path/query plus JSON body; exact schema: controller/service | src\app.ts:215 |
| PATCH | /api/orders/:id/status | Bearer JWT | FRANCHISE_ADMIN | OrderController.updateStatus | Path/query plus JSON body; exact schema: controller/service | src\app.ts:216 |
| POST | /api/orders/:id/pay | Bearer JWT | FRANCHISE_ADMIN | OrderController.addPayment | Path/query plus JSON body; exact schema: controller/service | src\app.ts:217 |
| POST | /api/orders/checkout | Bearer JWT | FRANCHISE_ADMIN | OrderController.checkout | Path/query plus JSON body; exact schema: controller/service | src\app.ts:218 |
| GET | /api/orders | Bearer JWT | FRANCHISE_ADMIN | OrderController.getAll | Path/query parameters; exact schema: controller/service | src\app.ts:221 |
| GET | /api/orders/:id | Bearer JWT | FRANCHISE_ADMIN | OrderController.getOne | Path/query parameters; exact schema: controller/service | src\app.ts:222 |
| GET | /api/invoices/:orderId | Bearer JWT | FRANCHISE_ADMIN | OrderController.getInvoice | Path/query parameters; exact schema: controller/service | src\app.ts:223 |
| GET | /api/products | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | ProductController.getAll | Path/query parameters; exact schema: controller/service | src\app.ts:226 |
| POST | /api/products | Bearer JWT | SUPER_ADMIN | ProductController.create | Path/query plus JSON body; exact schema: controller/service | src\app.ts:227 |
| POST | /api/products/bulk-import | Bearer JWT | SUPER_ADMIN | ProductController.bulkImport | Path/query plus JSON body; exact schema: controller/service | src\app.ts:228 |
| POST | /api/products/link | Bearer JWT | SUPER_ADMIN | ProductController.linkExistingProduct | Path/query plus JSON body; exact schema: controller/service | src\app.ts:229 |
| GET | /api/products/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | ProductController.getOne | Path/query parameters; exact schema: controller/service | src\app.ts:230 |
| PATCH | /api/products/:id | Bearer JWT | SUPER_ADMIN | ProductController.update | Path/query plus JSON body; exact schema: controller/service | src\app.ts:231 |
| DELETE | /api/products/:id | Bearer JWT | SUPER_ADMIN | ProductController.delete | Path parameters; body: Unknown | src\app.ts:232 |
| GET | /api/recipes | Bearer JWT | SUPER_ADMIN | RecipeController.getAll | Path/query parameters; exact schema: controller/service | src\app.ts:234 |
| POST | /api/recipes | Bearer JWT | SUPER_ADMIN | RecipeController.upsert | Path/query plus JSON body; exact schema: controller/service | src\app.ts:235 |
| GET | /api/recipe-categories | Bearer JWT | SUPER_ADMIN | RecipeController.getCategories | Path/query parameters; exact schema: controller/service | src\app.ts:236 |
| POST | /api/recipe-categories | Bearer JWT | SUPER_ADMIN | RecipeController.createCategory | Path/query plus JSON body; exact schema: controller/service | src\app.ts:237 |
| GET | /api/recipes/:id | Bearer JWT | SUPER_ADMIN | RecipeController.getOne | Path/query parameters; exact schema: controller/service | src\app.ts:238 |
| DELETE | /api/recipes/:id | Bearer JWT | SUPER_ADMIN | RecipeController.delete | Path parameters; body: Unknown | src\app.ts:239 |
| GET | /api/recipes/product/:productId | Bearer JWT | SUPER_ADMIN | RecipeController.getByProduct | Path/query parameters; exact schema: controller/service | src\app.ts:240 |
| POST | /api/recipes/:id/cost | Bearer JWT | SUPER_ADMIN | RecipeController.calculateCost | Path/query plus JSON body; exact schema: controller/service | src\app.ts:241 |
| GET | /api/production/history | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | ProductionController.getHistory | Path/query parameters; exact schema: controller/service | src\app.ts:244 |
| GET | /api/production/cartons | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | CartonController.getAll | Path/query parameters; exact schema: controller/service | src\app.ts:245 |
| POST | /api/production/cartons | Bearer JWT | SUPER_ADMIN | CartonController.create | Path/query plus JSON body; exact schema: controller/service | src\app.ts:246 |
| POST | /api/production/batch | Bearer JWT | SUPER_ADMIN | ProductionController.startBatch | Path/query plus JSON body; exact schema: controller/service | src\app.ts:247 |
| POST | /api/production/:id/stop | Bearer JWT | SUPER_ADMIN | ProductionController.stopBatch | Path/query plus JSON body; exact schema: controller/service | src\app.ts:248 |
| PATCH | /api/production/:id/stage | Bearer JWT | SUPER_ADMIN | ProductionController.advanceStage | Path/query plus JSON body; exact schema: controller/service | src\app.ts:249 |
| GET | /api/production/:id/stage-history | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | ProductionController.getStageHistory | Path/query parameters; exact schema: controller/service | src\app.ts:250 |
| POST | /api/production/:id/approve | Bearer JWT | SUPER_ADMIN | ProductionController.approveBatch | Path/query plus JSON body; exact schema: controller/service | src\app.ts:251 |
| GET | /api/production/batches | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | Inline/anonymous | Path/query parameters; exact schema: controller/service | src\app.ts:252 |
| GET | /api/production/batches-all | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | ProductionController.getAllBatches | Path/query parameters; exact schema: controller/service | src\app.ts:266 |
| GET | /api/production/batches-pending-qc | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | ProductionController.getPendingQC | Path/query parameters; exact schema: controller/service | src\app.ts:267 |
| POST | /api/production/batches/:id/qc | Bearer JWT | SUPER_ADMIN | ProductionController.inspectBatch | Path/query plus JSON body; exact schema: controller/service | src\app.ts:268 |
| POST | /api/production/batches/:id/package | Bearer JWT | SUPER_ADMIN | ProductionController.startPackaging | Path/query plus JSON body; exact schema: controller/service | src\app.ts:269 |
| POST | /api/production/batches/:id/waste-balance | Bearer JWT | SUPER_ADMIN | ProductionController.wasteBalance | Path/query plus JSON body; exact schema: controller/service | src\app.ts:270 |
| POST | /api/production/packagings/:id/confirm | Bearer JWT | SUPER_ADMIN | ProductionController.confirmPackaging | Path/query plus JSON body; exact schema: controller/service | src\app.ts:272 |
| POST | /api/production/packagings/:id/cancel | Bearer JWT | SUPER_ADMIN | ProductionController.cancelPackaging | Path/query plus JSON body; exact schema: controller/service | src\app.ts:273 |
| PUT | /api/production/packagings/:id/verify | Bearer JWT | SUPER_ADMIN | ProductionController.savePackagingVerification | Path/query plus JSON body; exact schema: controller/service | src\app.ts:274 |
| GET | /api/production/packagings | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | ProductionController.getPackagings | Path/query parameters; exact schema: controller/service | src\app.ts:275 |
| GET | /api/production/batches/:id/recall/eligibility | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | RecallController.getEligibility | Path/query parameters; exact schema: controller/service | src\app.ts:279 |
| GET | /api/production/batches/:id/recall | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | RecallController.getState | Path/query parameters; exact schema: controller/service | src\app.ts:280 |
| POST | /api/production/batches/:id/recall/initiate | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | RecallController.initiate | Path/query plus JSON body; exact schema: controller/service | src\app.ts:281 |
| POST | /api/production/batches/:id/recall/locate-distribution | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | RecallController.locateDistribution | Path/query plus JSON body; exact schema: controller/service | src\app.ts:282 |
| POST | /api/production/batches/:id/recall/block-sales | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | RecallController.blockSales | Path/query plus JSON body; exact schema: controller/service | src\app.ts:283 |
| POST | /api/production/batches/:id/recall/generate-report | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | RecallController.generateReport | Path/query plus JSON body; exact schema: controller/service | src\app.ts:284 |
| POST | /api/production/batches/:id/recall/collect-return | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | RecallController.collectReturn | Path/query plus JSON body; exact schema: controller/service | src\app.ts:285 |
| POST | /api/production/batches/:id/recall/complete | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | RecallController.complete | Path/query plus JSON body; exact schema: controller/service | src\app.ts:286 |
| POST | /api/production/batches/:id/recall/cancel | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | RecallController.cancel | Path/query plus JSON body; exact schema: controller/service | src\app.ts:287 |
| GET | /api/production/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | ProductionController.getOne | Path/query parameters; exact schema: controller/service | src\app.ts:288 |
| PATCH | /api/production/:id/status | Bearer JWT | SUPER_ADMIN | ProductionController.updateStatus | Path/query plus JSON body; exact schema: controller/service | src\app.ts:289 |
| GET | /api/logistics/requests | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | LogisticsController.getRequests | Path/query parameters; exact schema: controller/service | src\app.ts:291 |
| POST | /api/logistics/requests | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | LogisticsController.createRequest | Path/query plus JSON body; exact schema: controller/service | src\app.ts:292 |
| PATCH | /api/logistics/requests/:id/approve | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | LogisticsController.approveRequest | Path/query plus JSON body; exact schema: controller/service | src\app.ts:293 |
| GET | /api/logistics/transfers | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | LogisticsController.getTransfers | Path/query parameters; exact schema: controller/service | src\app.ts:295 |
| GET | /api/logistics/transfers/in-transit | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | LogisticsController.getInTransit | Path/query parameters; exact schema: controller/service | src\app.ts:296 |
| POST | /api/logistics/transfers | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | LogisticsController.initiateTransfer | Path/query plus JSON body; exact schema: controller/service | src\app.ts:297 |
| PATCH | /api/logistics/transfers/:id/dispatch | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | LogisticsController.dispatchTransfer | Path/query plus JSON body; exact schema: controller/service | src\app.ts:298 |
| PATCH | /api/logistics/transfers/:id/complete | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | LogisticsController.completeTransfer | Path/query plus JSON body; exact schema: controller/service | src\app.ts:299 |
| GET | /api/delivery/active | Bearer JWT | FRANCHISE_ADMIN | DeliveryController.getActive | Path/query parameters; exact schema: controller/service | src\app.ts:302 |
| POST | /api/delivery/update | Bearer JWT | FRANCHISE_ADMIN | DeliveryController.update | Path/query plus JSON body; exact schema: controller/service | src\app.ts:303 |
| POST | /api/delivery/verify | Bearer JWT | FRANCHISE_ADMIN | DeliveryController.verify | Path/query plus JSON body; exact schema: controller/service | src\app.ts:304 |
| GET | /api/finance/pl | Bearer JWT | FRANCHISE_ADMIN | FinanceController.getPL | Path/query parameters; exact schema: controller/service | src\app.ts:309 |
| POST | /api/finance/expense | Bearer JWT | FRANCHISE_ADMIN | FinanceController.addExpense | Path/query plus JSON body; exact schema: controller/service | src\app.ts:310 |
| GET | /api/finance/invoices | Bearer JWT | FRANCHISE_ADMIN | FinanceController.getInvoices | Path/query parameters; exact schema: controller/service | src\app.ts:311 |
| POST | /api/finance/invoices | Bearer JWT | FRANCHISE_ADMIN | FinanceController.createInvoice | Path/query plus JSON body; exact schema: controller/service | src\app.ts:312 |
| GET | /api/finance/cash-flow | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getCashFlow | Path/query parameters; exact schema: controller/service | src\app.ts:313 |
| GET | /api/drafts | Bearer JWT | Any authenticated role | DraftsController.getDrafts | Path/query parameters; exact schema: controller/service | src\app.ts:316 |
| POST | /api/drafts | Bearer JWT | Any authenticated role | DraftsController.saveDraft | Path/query plus JSON body; exact schema: controller/service | src\app.ts:317 |
| DELETE | /api/drafts/:id | Bearer JWT | Any authenticated role | DraftsController.deleteDraft | Path parameters; body: Unknown | src\app.ts:318 |
| GET | /api/accounting/expenses | Bearer JWT | FRANCHISE_ADMIN | FinanceController.getExpenses | Path/query parameters; exact schema: controller/service | src\app.ts:321 |
| GET | /api/accounting/expenses/:id | Bearer JWT | FRANCHISE_ADMIN | FinanceController.getExpenseDetails | Path/query parameters; exact schema: controller/service | src\app.ts:322 |
| POST | /api/accounting/expenses | Bearer JWT | FRANCHISE_ADMIN | FinanceController.addExpense | Path/query plus JSON body; exact schema: controller/service | src\app.ts:323 |
| POST | /api/accounting/expenses/:id/payment | Bearer JWT | FRANCHISE_ADMIN | FinanceController.recordExpensePayment | Path/query plus JSON body; exact schema: controller/service | src\app.ts:324 |
| DELETE | /api/accounting/expenses/:id | Bearer JWT | FRANCHISE_ADMIN | FinanceController.cancelExpense | Path parameters; body: Unknown | src\app.ts:325 |
| GET | /api/accounting/payments | Bearer JWT | FRANCHISE_ADMIN | FinanceController.getPayments | Path/query parameters; exact schema: controller/service | src\app.ts:326 |
| POST | /api/accounting/payments | Bearer JWT | FRANCHISE_ADMIN | FinanceController.recordPayment | Path/query plus JSON body; exact schema: controller/service | src\app.ts:327 |
| POST | /api/accounting/payments/:id/cancel | Bearer JWT | FRANCHISE_ADMIN | FinanceController.cancelPayment | Path/query plus JSON body; exact schema: controller/service | src\app.ts:328 |
| POST | /api/accounting/transfers | Bearer JWT | FRANCHISE_ADMIN | FinanceController.transferFunds | Path/query plus JSON body; exact schema: controller/service | src\app.ts:329 |
| GET | /api/accounting/ledger-summary | Bearer JWT | FRANCHISE_ADMIN | FinanceController.getLedgerSummary | Path/query parameters; exact schema: controller/service | src\app.ts:330 |
| GET | /api/accounts | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | AccountController.getAll | Path/query parameters; exact schema: controller/service | src\app.ts:333 |
| GET | /api/accounts/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | AccountController.getById | Path/query parameters; exact schema: controller/service | src\app.ts:334 |
| POST | /api/accounts | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | AccountController.create | Path/query plus JSON body; exact schema: controller/service | src\app.ts:335 |
| DELETE | /api/accounts/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | AccountController.delete | Path parameters; body: Unknown | src\app.ts:336 |
| GET | /api/dashboard/summary | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | DashboardController.getSummary | Path/query parameters; exact schema: controller/service | src\app.ts:339 |
| GET | /api/cheques | Bearer JWT | FRANCHISE_ADMIN | ChequeController.findAll | Path/query parameters; exact schema: controller/service | src\app.ts:342 |
| GET | /api/cheques/stats | Bearer JWT | FRANCHISE_ADMIN | ChequeController.getStats | Path/query parameters; exact schema: controller/service | src\app.ts:343 |
| POST | /api/cheques | Bearer JWT | FRANCHISE_ADMIN | ChequeController.create | Path/query plus JSON body; exact schema: controller/service | src\app.ts:344 |
| PATCH | /api/cheques/:id/status | Bearer JWT | FRANCHISE_ADMIN | ChequeController.updateStatus | Path/query plus JSON body; exact schema: controller/service | src\app.ts:345 |
| GET | /api/reports/sales | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getSalesReport | Path/query parameters; exact schema: controller/service | src\app.ts:348 |
| GET | /api/reports/purchases | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getPurchasesReport | Path/query parameters; exact schema: controller/service | src\app.ts:349 |
| GET | /api/reports/daybook | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getDayBookReport | Path/query parameters; exact schema: controller/service | src\app.ts:350 |
| GET | /api/reports/transactions | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getTransactionsReport | Path/query parameters; exact schema: controller/service | src\app.ts:351 |
| GET | /api/reports/expenses | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getExpensesReport | Path/query parameters; exact schema: controller/service | src\app.ts:352 |
| GET | /api/reports/profit | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getPL | Path/query parameters; exact schema: controller/service | src\app.ts:353 |
| GET | /api/reports/invoices | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getInvoices | Path/query parameters; exact schema: controller/service | src\app.ts:354 |
| GET | /api/reports/inventory-value | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getInventoryValue | Path/query parameters; exact schema: controller/service | src\app.ts:355 |
| GET | /api/reports/trial-balance | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getTrialBalance | Path/query parameters; exact schema: controller/service | src\app.ts:356 |
| GET | /api/reports/balance-sheet | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getBalanceSheet | Path/query parameters; exact schema: controller/service | src\app.ts:357 |
| GET | /api/reports/account-summary | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getAccountTransactionSummary | Path/query parameters; exact schema: controller/service | src\app.ts:358 |
| GET | /api/reports/bill-wise-profit | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getBillWiseProfit | Path/query parameters; exact schema: controller/service | src\app.ts:359 |
| GET | /api/reports/cash-flow | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getCashFlow | Path/query parameters; exact schema: controller/service | src\app.ts:360 |
| GET | /api/reports/party-statement | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getPartyStatement | Path/query parameters; exact schema: controller/service | src\app.ts:361 |
| GET | /api/reports/party-profit-loss | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getPartyProfitLoss | Path/query parameters; exact schema: controller/service | src\app.ts:362 |
| GET | /api/reports/party-by-item | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getPartyReportByItem | Path/query parameters; exact schema: controller/service | src\app.ts:363 |
| GET | /api/reports/sale-purchase-by-party | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getSalePurchaseByParty | Path/query parameters; exact schema: controller/service | src\app.ts:364 |
| GET | /api/reports/sale-purchase-by-party-group | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getSalePurchaseByPartyGroup | Path/query parameters; exact schema: controller/service | src\app.ts:365 |
| GET | /api/reports/all-parties | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getAllPartiesReport | Path/query parameters; exact schema: controller/service | src\app.ts:366 |
| GET | /api/reports/party-invoices | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getPartyInvoices | Path/query parameters; exact schema: controller/service | src\app.ts:367 |
| GET | /api/reports/production | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getProductionReport | Path/query parameters; exact schema: controller/service | src\app.ts:370 |
| GET | /api/reports/inventory | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getInventoryValue | Path/query parameters; exact schema: controller/service | src\app.ts:371 |
| GET | /api/reports/inventory-ledger | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getInventoryLedgerReport | Path/query parameters; exact schema: controller/service | src\app.ts:372 |
| GET | /api/reports/franchise | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getFranchiseReport | Path/query parameters; exact schema: controller/service | src\app.ts:373 |
| GET | /api/reports/item-by-party | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getItemByPartyReport | Path/query parameters; exact schema: controller/service | src\app.ts:376 |
| GET | /api/reports/item-profit-loss | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getItemProfitLossReport | Path/query parameters; exact schema: controller/service | src\app.ts:377 |
| GET | /api/reports/item-category-profit-loss | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getItemCategoryProfitLossReport | Path/query parameters; exact schema: controller/service | src\app.ts:378 |
| GET | /api/reports/low-stock-summary | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getLowStockSummaryReport | Path/query parameters; exact schema: controller/service | src\app.ts:379 |
| GET | /api/reports/stock-summary | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getStockSummaryReport | Path/query parameters; exact schema: controller/service | src\app.ts:380 |
| GET | /api/reports/item-discount | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getItemDiscountReport | Path/query parameters; exact schema: controller/service | src\app.ts:381 |
| GET | /api/reports/sale-purchase-by-category | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getSalePurchaseByCategoryReport | Path/query parameters; exact schema: controller/service | src\app.ts:382 |
| GET | /api/reports/sale-purchase-by-item | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getSalePurchaseByItemReport | Path/query parameters; exact schema: controller/service | src\app.ts:383 |
| GET | /api/reports/stock-by-category | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getStockByCategoryReport | Path/query parameters; exact schema: controller/service | src\app.ts:384 |
| GET | /api/reports/stock-summary-by-item | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getStockSummaryByItemReport | Path/query parameters; exact schema: controller/service | src\app.ts:385 |
| GET | /api/reports/stock-detail | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getStockDetailReport | Path/query parameters; exact schema: controller/service | src\app.ts:386 |
| GET | /api/reports/item-detail | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getItemDetailReport | Path/query parameters; exact schema: controller/service | src\app.ts:387 |
| GET | /api/reports/bank-statement | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getBankStatement | Path/query parameters; exact schema: controller/service | src\app.ts:388 |
| GET | /api/reports/discount-report | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getDiscountReport | Path/query parameters; exact schema: controller/service | src\app.ts:389 |
| GET | /api/reports/expense-category | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getExpenseCategoryReport | Path/query parameters; exact schema: controller/service | src\app.ts:392 |
| GET | /api/reports/expense-item | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getExpenseItemReport | Path/query parameters; exact schema: controller/service | src\app.ts:393 |
| GET | /api/reports/sale-orders | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getSaleOrdersReport | Path/query parameters; exact schema: controller/service | src\app.ts:396 |
| GET | /api/reports/sale-order-items | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getSaleOrderItemsReport | Path/query parameters; exact schema: controller/service | src\app.ts:397 |
| GET | /api/reports/loans | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getLoans | Path/query parameters; exact schema: controller/service | src\app.ts:400 |
| POST | /api/reports/loans | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.addLoan | Path/query plus JSON body; exact schema: controller/service | src\app.ts:401 |
| GET | /api/reports/loan-statement | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getLoanStatement | Path/query parameters; exact schema: controller/service | src\app.ts:402 |
| POST | /api/reports/loans/:id/transaction | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.addLoanTransaction | Path/query plus JSON body; exact schema: controller/service | src\app.ts:403 |
| GET | /api/reports/gst | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getGstReport | Path/query parameters; exact schema: controller/service | src\app.ts:406 |
| GET | /api/reports/gstr1 | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getGSTR1Report | Path/query parameters; exact schema: controller/service | src\app.ts:407 |
| GET | /api/reports/gstr2 | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getGSTR2Report | Path/query parameters; exact schema: controller/service | src\app.ts:408 |
| GET | /api/reports/gstr3b | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getGSTR3BReport | Path/query parameters; exact schema: controller/service | src\app.ts:409 |
| GET | /api/reports/gstr9 | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getGSTR9Report | Path/query parameters; exact schema: controller/service | src\app.ts:410 |
| GET | /api/reports/hsn-summary | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getHsnSummaryReport | Path/query parameters; exact schema: controller/service | src\app.ts:411 |
| GET | /api/reports/sac | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getSacReport | Path/query parameters; exact schema: controller/service | src\app.ts:412 |
| GET | /api/reports/gst-rate | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getGstRateReport | Path/query parameters; exact schema: controller/service | src\app.ts:413 |
| GET | /api/reports/form-27eq | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getForm27eq | Path/query parameters; exact schema: controller/service | src\app.ts:414 |
| GET | /api/reports/tcs-receivable | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getTcsReceivable | Path/query parameters; exact schema: controller/service | src\app.ts:415 |
| GET | /api/reports/tds-payable | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getTdsPayable | Path/query parameters; exact schema: controller/service | src\app.ts:416 |
| GET | /api/reports/tds-receivable | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getTdsReceivable | Path/query parameters; exact schema: controller/service | src\app.ts:417 |
| GET | /api/analytics/product-performance | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | AnalyticsController.getProductPerformance | Path/query parameters; exact schema: controller/service | src\app.ts:420 |
| GET | /api/analytics/payment-distribution | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | AnalyticsController.getPaymentDistribution | Path/query parameters; exact schema: controller/service | src\app.ts:421 |
| GET | /api/analytics/wastage-summary | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | AnalyticsController.getWastageSummary | Path/query parameters; exact schema: controller/service | src\app.ts:422 |
| GET | /api/analytics/daily-sales | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | AnalyticsController.getDailySalesSummary | Path/query parameters; exact schema: controller/service | src\app.ts:423 |
| GET | /api/gst/verify/:gstin | Bearer JWT | Any authenticated role | GstController.verify | Path/query parameters; exact schema: controller/service | src\app.ts:426 |
| GET | /api/vendors | Bearer JWT | SUPER_ADMIN | ProcurementController.getAllVendors | Path/query parameters; exact schema: controller/service | src\app.ts:429 |
| POST | /api/vendors | Bearer JWT | SUPER_ADMIN | ProcurementController.createVendor | Path/query plus JSON body; exact schema: controller/service | src\app.ts:430 |
| GET | /api/vendors/summary | Bearer JWT | SUPER_ADMIN | ProcurementController.getVendorSummary | Path/query parameters; exact schema: controller/service | src\app.ts:431 |
| GET | /api/vendors/filter | Bearer JWT | SUPER_ADMIN | ProcurementController.filterVendors | Path/query parameters; exact schema: controller/service | src\app.ts:432 |
| GET | /api/vendors/next-payment-number | Bearer JWT | SUPER_ADMIN | ProcurementController.getNextPaymentNumber | Path/query parameters; exact schema: controller/service | src\app.ts:433 |
| GET | /api/vendors/:id | Bearer JWT | SUPER_ADMIN | ProcurementController.getVendorById | Path/query parameters; exact schema: controller/service | src\app.ts:434 |
| PATCH | /api/vendors/:id | Bearer JWT | SUPER_ADMIN | ProcurementController.updateVendor | Path/query plus JSON body; exact schema: controller/service | src\app.ts:435 |
| DELETE | /api/vendors/:id | Bearer JWT | SUPER_ADMIN | ProcurementController.deleteVendor | Path parameters; body: Unknown | src\app.ts:436 |
| POST | /api/vendors/link-material | Bearer JWT | SUPER_ADMIN | ProcurementController.linkMaterial | Path/query plus JSON body; exact schema: controller/service | src\app.ts:437 |
| GET | /api/vendors/:id/ledger | Bearer JWT | SUPER_ADMIN | ProcurementController.getVendorLedger | Path/query parameters; exact schema: controller/service | src\app.ts:438 |
| GET | /api/vendors/:id/returnable-materials | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | ProcurementController.getVendorReturnableMaterials | Path/query parameters; exact schema: controller/service | src\app.ts:439 |
| GET | /api/vendors/:id/aging | Bearer JWT | SUPER_ADMIN | ProcurementController.getVendorAging | Path/query parameters; exact schema: controller/service | src\app.ts:440 |
| POST | /api/vendors/:id/payment | Bearer JWT | SUPER_ADMIN | ProcurementController.recordPayment | Path/query plus JSON body; exact schema: controller/service | src\app.ts:441 |
| POST | /api/vendors/:id/adjustment | Bearer JWT | SUPER_ADMIN | ProcurementController.recordAdjustment | Path/query plus JSON body; exact schema: controller/service | src\app.ts:442 |
| GET | /api/suppliers | Bearer JWT | SUPER_ADMIN | ProcurementController.getAllVendors | Path/query parameters; exact schema: controller/service | src\app.ts:443 |
| POST | /api/suppliers | Bearer JWT | SUPER_ADMIN | ProcurementController.createVendor | Path/query plus JSON body; exact schema: controller/service | src\app.ts:444 |
| GET | /api/procurement/orders | Bearer JWT | SUPER_ADMIN | ProcurementController.getPOs | Path/query parameters; exact schema: controller/service | src\app.ts:446 |
| GET | /api/procurement/orders/next-number | Bearer JWT | SUPER_ADMIN | ProcurementController.getNextPONumber | Path/query parameters; exact schema: controller/service | src\app.ts:447 |
| GET | /api/procurement/orders/:id | Bearer JWT | SUPER_ADMIN | ProcurementController.getOne | Path/query parameters; exact schema: controller/service | src\app.ts:448 |
| POST | /api/procurement/po | Bearer JWT | SUPER_ADMIN | ProcurementController.createPO | Path/query plus JSON body; exact schema: controller/service | src\app.ts:449 |
| GET | /api/purchase-orders | Bearer JWT | SUPER_ADMIN | ProcurementController.getPOs | Path/query parameters; exact schema: controller/service | src\app.ts:452 |
| GET | /api/purchase-orders/next-number | Bearer JWT | SUPER_ADMIN | ProcurementController.getNextPONumber | Path/query parameters; exact schema: controller/service | src\app.ts:453 |
| POST | /api/purchase-orders | Bearer JWT | SUPER_ADMIN | ProcurementController.createPO | Path/query plus JSON body; exact schema: controller/service | src\app.ts:454 |
| GET | /api/purchase-orders/:id | Bearer JWT | SUPER_ADMIN | ProcurementController.getOne | Path/query parameters; exact schema: controller/service | src\app.ts:455 |
| PATCH | /api/purchase-orders/:id | Bearer JWT | SUPER_ADMIN | ProcurementController.updatePO | Path/query plus JSON body; exact schema: controller/service | src\app.ts:456 |
| PATCH | /api/purchase-orders/:id/approve | Bearer JWT | SUPER_ADMIN | ProcurementController.approvePO | Path/query plus JSON body; exact schema: controller/service | src\app.ts:457 |
| PATCH | /api/purchase-orders/:id/advance | Bearer JWT | SUPER_ADMIN | ProcurementController.recordAdvance | Path/query plus JSON body; exact schema: controller/service | src\app.ts:458 |
| PATCH | /api/purchase-orders/:id/cancel | Bearer JWT | SUPER_ADMIN | ProcurementController.cancelPO | Path/query plus JSON body; exact schema: controller/service | src\app.ts:459 |
| DELETE | /api/purchase-orders/:id | Bearer JWT | SUPER_ADMIN | ProcurementController.deletePO | Path parameters; body: Unknown | src\app.ts:460 |
| POST | /api/purchase-orders/:id/apply-advance | Bearer JWT | SUPER_ADMIN | ProcurementController.applyAdvance | Path/query plus JSON body; exact schema: controller/service | src\app.ts:462 |
| POST | /api/purchase-orders/:id/receive | Bearer JWT | SUPER_ADMIN | ProcurementController.receiveGoods | Path/query plus JSON body; exact schema: controller/service | src\app.ts:464 |
| GET | /api/grn | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | GRNController.getAll | Path/query parameters; exact schema: controller/service | src\app.ts:467 |
| GET | /api/grn/generate-lot-number | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | GRNController.generateLotNumber | Path/query parameters; exact schema: controller/service | src\app.ts:470 |
| GET | /api/grn/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | GRNController.getById | Path/query parameters; exact schema: controller/service | src\app.ts:471 |
| GET | /api/grn/po/:poId/remaining | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | GRNController.getRemainingQuantities | Path/query parameters; exact schema: controller/service | src\app.ts:472 |
| POST | /api/grn/from-po/:poId | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | GRNController.createFromPO | Path/query plus JSON body; exact schema: controller/service | src\app.ts:473 |
| PATCH | /api/grn/:id/approve | Bearer JWT | SUPER_ADMIN | GRNController.approve | Path/query plus JSON body; exact schema: controller/service | src\app.ts:474 |
| PATCH | /api/grn/:id/cancel | Bearer JWT | SUPER_ADMIN | GRNController.cancel | Path/query plus JSON body; exact schema: controller/service | src\app.ts:475 |
| GET | /api/qc/pending | Bearer JWT | SUPER_ADMIN | GRNController.getPendingInspections | Path/query parameters; exact schema: controller/service | src\app.ts:478 |
| POST | /api/qc/inspect | Bearer JWT | SUPER_ADMIN | GRNController.recordInspection | Path/query plus JSON body; exact schema: controller/service | src\app.ts:479 |
| GET | /api/vendor-invoices | Bearer JWT | SUPER_ADMIN | VendorInvoiceController.getAll | Path/query parameters; exact schema: controller/service | src\app.ts:482 |
| POST | /api/vendor-invoices | Bearer JWT | SUPER_ADMIN | VendorInvoiceController.create | Path/query plus JSON body; exact schema: controller/service | src\app.ts:483 |
| POST | /api/vendor-invoices/:id/match | Bearer JWT | SUPER_ADMIN | VendorInvoiceController.match | Path/query plus JSON body; exact schema: controller/service | src\app.ts:484 |
| POST | /api/vendor-invoices/:id/approve | Bearer JWT | SUPER_ADMIN | VendorInvoiceController.approve | Path/query plus JSON body; exact schema: controller/service | src\app.ts:485 |
| PATCH | /api/vendor-invoices/:id/status | Bearer JWT | SUPER_ADMIN | VendorInvoiceController.updateStatus | Path/query plus JSON body; exact schema: controller/service | src\app.ts:486 |
| GET | /api/franchise/warehouse/status | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FranchiseController.getWarehouseStatus | Path/query parameters; exact schema: controller/service | src\app.ts:490 |
| POST | /api/franchise/warehouse/setup | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FranchiseController.setupWarehouse | Path/query plus JSON body; exact schema: controller/service | src\app.ts:491 |
| GET | /api/franchise | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FranchiseController.getAll | Path/query parameters; exact schema: controller/service | src\app.ts:493 |
| POST | /api/franchise | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FranchiseController.create | Path/query plus JSON body; exact schema: controller/service | src\app.ts:494 |
| GET | /api/franchise/requests | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FranchiseController.getRequests | Path/query parameters; exact schema: controller/service | src\app.ts:495 |
| POST | /api/franchise/requests | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FranchiseController.createRequest | Path/query plus JSON body; exact schema: controller/service | src\app.ts:496 |
| POST | /api/franchise/fulfill | Bearer JWT | SUPER_ADMIN | FranchiseController.fulfillRequest | Path/query plus JSON body; exact schema: controller/service | src\app.ts:497 |
| GET | /api/franchise/transfers | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FranchiseController.getAllTransfers | Path/query parameters; exact schema: controller/service | src\app.ts:498 |
| PATCH | /api/franchise/transfers/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FranchiseController.updateTransferStatus | Path/query plus JSON body; exact schema: controller/service | src\app.ts:499 |
| GET | /api/franchise/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FranchiseController.getOne | Path/query parameters; exact schema: controller/service | src\app.ts:500 |
| POST | /api/franchise/:id/verify-password | Bearer JWT | SUPER_ADMIN | FranchiseController.verifyDashboardPassword | Path/query plus JSON body; exact schema: controller/service | src\app.ts:501 |
| PATCH | /api/franchise/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FranchiseController.update | Path/query plus JSON body; exact schema: controller/service | src\app.ts:502 |
| DELETE | /api/franchise/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FranchiseController.deleteFranchise | Path parameters; body: Unknown | src\app.ts:503 |
| GET | /api/franchise/product-requests | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FranchiseController.getProductRequests | Path/query parameters; exact schema: controller/service | src\app.ts:506 |
| POST | /api/franchise/product-requests | Bearer JWT | FRANCHISE_ADMIN | FranchiseController.createProductRequest | Path/query plus JSON body; exact schema: controller/service | src\app.ts:507 |
| PATCH | /api/franchise/product-requests/:id | Bearer JWT | SUPER_ADMIN | FranchiseController.updateProductRequest | Path/query plus JSON body; exact schema: controller/service | src\app.ts:508 |
| DELETE | /api/franchise/product-requests/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FranchiseController.deleteProductRequest | Path parameters; body: Unknown | src\app.ts:509 |
| GET | /api/franchise/:id/users | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | UserController.getByFranchise | Path/query parameters; exact schema: controller/service | src\app.ts:512 |
| PATCH | /api/users/:id/reset-password | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | UserController.resetPassword | Path/query plus JSON body; exact schema: controller/service | src\app.ts:513 |
| GET | /api/settings | Bearer JWT | SUPER_ADMIN | SettingsController.getAll | Path/query parameters; exact schema: controller/service | src\app.ts:516 |
| POST | /api/settings | Bearer JWT | SUPER_ADMIN | SettingsController.setSetting | Path/query plus JSON body; exact schema: controller/service | src\app.ts:517 |
| GET | /api/settings/company | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SettingsController.getCompanyProfile | Path/query parameters; exact schema: controller/service | src\app.ts:518 |
| PATCH | /api/settings/company | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SettingsController.updateCompanyProfile | Path/query plus JSON body; exact schema: controller/service | src\app.ts:519 |
| GET | /api/audit/logs | Bearer JWT | SUPER_ADMIN | AuditController.getLogs | Path/query parameters; exact schema: controller/service | src\app.ts:520 |
| POST | /api/pos/checkout | Bearer JWT | FRANCHISE_ADMIN | POSController.checkout | Path/query plus JSON body; exact schema: controller/service | src\app.ts:523 |
| GET | /api/pos/orders | Bearer JWT | FRANCHISE_ADMIN | POSController.getOrders | Path/query parameters; exact schema: controller/service | src\app.ts:524 |
| GET | /api/pos/settlement/today | Bearer JWT | FRANCHISE_ADMIN | POSController.getTodaySettlement | Path/query parameters; exact schema: controller/service | src\app.ts:525 |
| GET | /api/pos/settlement/latest | Bearer JWT | FRANCHISE_ADMIN | POSController.getLatestSettlement | Path/query parameters; exact schema: controller/service | src\app.ts:526 |
| GET | /api/pos/settlement/summary | Bearer JWT | FRANCHISE_ADMIN | POSController.getDailySummary | Path/query parameters; exact schema: controller/service | src\app.ts:527 |
| POST | /api/pos/settlement/close | Bearer JWT | FRANCHISE_ADMIN | POSController.closeDay | Path/query plus JSON body; exact schema: controller/service | src\app.ts:528 |
| GET | /api/kds/orders | Bearer JWT | FRANCHISE_ADMIN | KDSController.getOrders | Path/query parameters; exact schema: controller/service | src\app.ts:531 |
| PATCH | /api/kds/orders/:id/status | Bearer JWT | FRANCHISE_ADMIN | KDSController.updateStatus | Path/query plus JSON body; exact schema: controller/service | src\app.ts:532 |
| GET | /api/customers | Bearer JWT | FRANCHISE_ADMIN | CustomerController.getAll | Path/query parameters; exact schema: controller/service | src\app.ts:536 |
| POST | /api/customers | Bearer JWT | FRANCHISE_ADMIN | CustomerController.create | Path/query plus JSON body; exact schema: controller/service | src\app.ts:537 |
| GET | /api/customers/ledger-summary | Bearer JWT | FRANCHISE_ADMIN | CustomerController.getLedgerSummary | Path/query parameters; exact schema: controller/service | src\app.ts:538 |
| GET | /api/customers/:id | Bearer JWT | FRANCHISE_ADMIN | CustomerController.getOne | Path/query parameters; exact schema: controller/service | src\app.ts:539 |
| PATCH | /api/customers/:id | Bearer JWT | FRANCHISE_ADMIN | CustomerController.update | Path/query plus JSON body; exact schema: controller/service | src\app.ts:540 |
| GET | /api/customers/:id/history | Bearer JWT | FRANCHISE_ADMIN | CustomerController.getHistory | Path/query parameters; exact schema: controller/service | src\app.ts:541 |
| GET | /api/customers/:id/items | Bearer JWT | FRANCHISE_ADMIN | CustomerController.getItemHistory | Path/query parameters; exact schema: controller/service | src\app.ts:542 |
| DELETE | /api/customers/:id | Bearer JWT | FRANCHISE_ADMIN | CustomerController.delete | Path parameters; body: Unknown | src\app.ts:543 |
| GET | /api/loyalty/:customerId | Bearer JWT | FRANCHISE_ADMIN | LoyaltyController.getLoyalty | Path/query parameters; exact schema: controller/service | src\app.ts:550 |
| POST | /api/loyalty/add-points | Bearer JWT | FRANCHISE_ADMIN | LoyaltyController.addPoints | Path/query plus JSON body; exact schema: controller/service | src\app.ts:551 |
| POST | /api/loyalty/redeem | Bearer JWT | FRANCHISE_ADMIN | LoyaltyController.redeem | Path/query plus JSON body; exact schema: controller/service | src\app.ts:552 |
| GET | /api/waste | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | WasteController.getAll | Path/query parameters; exact schema: controller/service | src\app.ts:555 |
| GET | /api/waste/summary | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | WasteController.getSummary | Path/query parameters; exact schema: controller/service | src\app.ts:556 |
| GET | /api/waste/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | WasteController.getOne | Path/query parameters; exact schema: controller/service | src\app.ts:557 |
| POST | /api/waste | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | WasteController.create | Path/query plus JSON body; exact schema: controller/service | src\app.ts:558 |
| GET | /api/inventory/alerts | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | InventoryController.getAlerts | Path/query parameters; exact schema: controller/service | src\app.ts:562 |
| GET | /api/crm/pipelines | Bearer JWT | FRANCHISE_ADMIN | CRMController.getPipelines | Path/query parameters; exact schema: controller/service | src\app.ts:577 |
| POST | /api/crm/pipelines | Bearer JWT | FRANCHISE_ADMIN | CRMController.createPipeline | Path/query plus JSON body; exact schema: controller/service | src\app.ts:578 |
| PATCH | /api/crm/pipelines/:id | Bearer JWT | FRANCHISE_ADMIN | CRMController.updatePipeline | Path/query plus JSON body; exact schema: controller/service | src\app.ts:579 |
| DELETE | /api/crm/pipelines/:id | Bearer JWT | FRANCHISE_ADMIN | CRMController.deletePipeline | Path parameters; body: Unknown | src\app.ts:580 |
| GET | /api/crm/leads | Bearer JWT | FRANCHISE_ADMIN | CRMController.getLeads | Path/query parameters; exact schema: controller/service | src\app.ts:583 |
| POST | /api/crm/leads | Bearer JWT | FRANCHISE_ADMIN | CRMController.createLead | Path/query plus JSON body; exact schema: controller/service | src\app.ts:584 |
| GET | /api/crm/leads/:id | Bearer JWT | FRANCHISE_ADMIN | CRMController.getLead | Path/query parameters; exact schema: controller/service | src\app.ts:585 |
| PATCH | /api/crm/leads/:id | Bearer JWT | FRANCHISE_ADMIN | CRMController.updateLead | Path/query plus JSON body; exact schema: controller/service | src\app.ts:586 |
| DELETE | /api/crm/leads/:id | Bearer JWT | FRANCHISE_ADMIN | CRMController.deleteLead | Path parameters; body: Unknown | src\app.ts:587 |
| GET | /api/crm/forms | Bearer JWT | FRANCHISE_ADMIN | CRMController.getForms | Path/query parameters; exact schema: controller/service | src\app.ts:590 |
| POST | /api/crm/forms | Bearer JWT | FRANCHISE_ADMIN | CRMController.createForm | Path/query plus JSON body; exact schema: controller/service | src\app.ts:591 |
| PATCH | /api/crm/forms/:id | Bearer JWT | FRANCHISE_ADMIN | CRMController.updateForm | Path/query plus JSON body; exact schema: controller/service | src\app.ts:592 |
| DELETE | /api/crm/forms/:id | Bearer JWT | FRANCHISE_ADMIN | CRMController.deleteForm | Path parameters; body: Unknown | src\app.ts:593 |
| GET | /api/crm/reports/lead-source | Bearer JWT | FRANCHISE_ADMIN | CRMController.getLeadSourceReport | Path/query parameters; exact schema: controller/service | src\app.ts:596 |
| GET | /api/crm/reports/team-sales | Bearer JWT | FRANCHISE_ADMIN | CRMController.getTeamSalesReport | Path/query parameters; exact schema: controller/service | src\app.ts:597 |
| GET | /api/crm/reports/client-performance | Bearer JWT | FRANCHISE_ADMIN | CRMController.getClientPerformanceReport | Path/query parameters; exact schema: controller/service | src\app.ts:598 |
| GET | /api/employees | Bearer JWT | FRANCHISE_ADMIN | EmployeeController.getAll | Path/query parameters; exact schema: controller/service | src\app.ts:602 |
| POST | /api/employees | Bearer JWT | FRANCHISE_ADMIN | EmployeeController.create | Path/query plus JSON body; exact schema: controller/service | src\app.ts:603 |
| GET | /api/employees/:id | Bearer JWT | FRANCHISE_ADMIN | EmployeeController.getOne | Path/query parameters; exact schema: controller/service | src\app.ts:604 |
| PATCH | /api/employees/:id | Bearer JWT | FRANCHISE_ADMIN | EmployeeController.update | Path/query plus JSON body; exact schema: controller/service | src\app.ts:605 |
| GET | /api/employees/:id/shifts | Bearer JWT | FRANCHISE_ADMIN | EmployeeController.getEmployeeShifts | Path/query parameters; exact schema: controller/service | src\app.ts:607 |
| POST | /api/employees/:id/clock-in | Bearer JWT | FRANCHISE_ADMIN | EmployeeController.clockIn | Path/query plus JSON body; exact schema: controller/service | src\app.ts:608 |
| POST | /api/employees/:id/clock-out | Bearer JWT | FRANCHISE_ADMIN | EmployeeController.clockOut | Path/query plus JSON body; exact schema: controller/service | src\app.ts:609 |
| GET | /api/attendance | Bearer JWT | FRANCHISE_ADMIN | EmployeeController.getAttendance | Path/query parameters; exact schema: controller/service | src\app.ts:610 |
| GET | /api/leave-types | Bearer JWT | FRANCHISE_ADMIN | EmployeeController.getLeaveTypes | Path/query parameters; exact schema: controller/service | src\app.ts:612 |
| POST | /api/leave-types | Bearer JWT | FRANCHISE_ADMIN | EmployeeController.createLeaveType | Path/query plus JSON body; exact schema: controller/service | src\app.ts:613 |
| PATCH | /api/leave-types/:id | Bearer JWT | FRANCHISE_ADMIN | EmployeeController.updateLeaveType | Path/query plus JSON body; exact schema: controller/service | src\app.ts:614 |
| GET | /api/leaves | Bearer JWT | FRANCHISE_ADMIN | EmployeeController.getLeaves | Path/query parameters; exact schema: controller/service | src\app.ts:616 |
| POST | /api/leaves | Bearer JWT | FRANCHISE_ADMIN | EmployeeController.applyLeave | Path/query plus JSON body; exact schema: controller/service | src\app.ts:617 |
| PATCH | /api/leaves/:id/approve | Bearer JWT | FRANCHISE_ADMIN | EmployeeController.approveLeave | Path/query plus JSON body; exact schema: controller/service | src\app.ts:618 |
| GET | /api/employees/:id/leave-balances | Bearer JWT | FRANCHISE_ADMIN | EmployeeController.getLeaveBalances | Path/query parameters; exact schema: controller/service | src\app.ts:619 |
| GET | /api/shifts | Bearer JWT | FRANCHISE_ADMIN | EmployeeController.getShifts | Path/query parameters; exact schema: controller/service | src\app.ts:621 |
| POST | /api/shifts | Bearer JWT | FRANCHISE_ADMIN | EmployeeController.createShift | Path/query plus JSON body; exact schema: controller/service | src\app.ts:622 |
| POST | /api/shifts/assign | Bearer JWT | FRANCHISE_ADMIN | EmployeeController.assignShift | Path/query plus JSON body; exact schema: controller/service | src\app.ts:623 |
| GET | /api/payroll/components | Bearer JWT | FRANCHISE_ADMIN | PayrollController.getComponents | Path/query parameters; exact schema: controller/service | src\app.ts:626 |
| POST | /api/payroll/components | Bearer JWT | FRANCHISE_ADMIN | PayrollController.createComponent | Path/query plus JSON body; exact schema: controller/service | src\app.ts:627 |
| PATCH | /api/payroll/components/:id | Bearer JWT | FRANCHISE_ADMIN | PayrollController.updateComponent | Path/query plus JSON body; exact schema: controller/service | src\app.ts:628 |
| GET | /api/payroll/structures | Bearer JWT | FRANCHISE_ADMIN | PayrollController.getStructures | Path/query parameters; exact schema: controller/service | src\app.ts:630 |
| POST | /api/payroll/structures | Bearer JWT | FRANCHISE_ADMIN | PayrollController.createStructure | Path/query plus JSON body; exact schema: controller/service | src\app.ts:631 |
| GET | /api/payroll/structures/:id | Bearer JWT | FRANCHISE_ADMIN | PayrollController.getStructure | Path/query parameters; exact schema: controller/service | src\app.ts:632 |
| PATCH | /api/payroll/structures/:id | Bearer JWT | FRANCHISE_ADMIN | PayrollController.updateStructure | Path/query plus JSON body; exact schema: controller/service | src\app.ts:633 |
| GET | /api/payroll/runs | Bearer JWT | FRANCHISE_ADMIN | PayrollController.getPayrolls | Path/query parameters; exact schema: controller/service | src\app.ts:635 |
| POST | /api/payroll/runs | Bearer JWT | FRANCHISE_ADMIN | PayrollController.createPayroll | Path/query plus JSON body; exact schema: controller/service | src\app.ts:636 |
| POST | /api/payroll/runs/:id/process | Bearer JWT | FRANCHISE_ADMIN | PayrollController.processPayroll | Path/query plus JSON body; exact schema: controller/service | src\app.ts:637 |
| GET | /api/payroll/payslips | Bearer JWT | FRANCHISE_ADMIN | PayrollController.getPayslips | Path/query parameters; exact schema: controller/service | src\app.ts:639 |
| POST | /api/payroll/payslips | Bearer JWT | FRANCHISE_ADMIN | PayrollController.createManualPayslip | Path/query plus JSON body; exact schema: controller/service | src\app.ts:640 |
| GET | /api/payroll/payslips/:id | Bearer JWT | FRANCHISE_ADMIN | PayrollController.getPayslip | Path/query parameters; exact schema: controller/service | src\app.ts:641 |
| PATCH | /api/payroll/payslips/:id/mark-paid | Bearer JWT | FRANCHISE_ADMIN | PayrollController.markPaid | Path/query plus JSON body; exact schema: controller/service | src\app.ts:642 |
| GET | /api/sales/quotations | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.getQuotations | Path/query parameters; exact schema: controller/service | src\app.ts:645 |
| POST | /api/sales/quotations | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.createQuotation | Path/query plus JSON body; exact schema: controller/service | src\app.ts:646 |
| GET | /api/sales/quotations/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.getQuotation | Path/query parameters; exact schema: controller/service | src\app.ts:647 |
| PATCH | /api/sales/quotations/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.updateQuotation | Path/query plus JSON body; exact schema: controller/service | src\app.ts:648 |
| PUT | /api/sales/quotations/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.updateQuotation | Path/query plus JSON body; exact schema: controller/service | src\app.ts:649 |
| POST | /api/sales/quotations/:id/convert | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.convertQuotation | Path/query plus JSON body; exact schema: controller/service | src\app.ts:650 |
| POST | /api/sales/quotations/:id/convert-to-sale | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.convertQuotationToSale | Path/query plus JSON body; exact schema: controller/service | src\app.ts:651 |
| POST | /api/sales/quotations/:id/convert-to-sales-order | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.convertQuotationToSalesOrder | Path/query plus JSON body; exact schema: controller/service | src\app.ts:652 |
| POST | /api/estimates/:id/convert-to-sale | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.convertQuotationToSale | Path/query plus JSON body; exact schema: controller/service | src\app.ts:653 |
| POST | /api/estimates/:id/convert-to-sales-order | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.convertQuotationToSalesOrder | Path/query plus JSON body; exact schema: controller/service | src\app.ts:654 |
| GET | /api/sales/orders | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.getSalesOrders | Path/query parameters; exact schema: controller/service | src\app.ts:656 |
| POST | /api/sales/orders | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.createSalesOrder | Path/query plus JSON body; exact schema: controller/service | src\app.ts:657 |
| GET | /api/sales/orders/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.getSalesOrder | Path/query parameters; exact schema: controller/service | src\app.ts:658 |
| PATCH | /api/sales/orders/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.updateSalesOrder | Path/query plus JSON body; exact schema: controller/service | src\app.ts:659 |
| PUT | /api/sales/orders/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.updateSalesOrder | Path/query plus JSON body; exact schema: controller/service | src\app.ts:660 |
| POST | /api/sales/orders/:id/convert | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.convertSalesOrder | Path/query plus JSON body; exact schema: controller/service | src\app.ts:661 |
| POST | /api/sales/orders/:id/convert-to-sale | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.convertSalesOrderToSale | Path/query plus JSON body; exact schema: controller/service | src\app.ts:662 |
| GET | /api/sales/proforma-invoices | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.getProformaInvoices | Path/query parameters; exact schema: controller/service | src\app.ts:664 |
| GET | /api/sales/proforma-invoices/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.getProformaInvoice | Path/query parameters; exact schema: controller/service | src\app.ts:665 |
| POST | /api/sales/proforma-invoices | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.createProformaInvoice | Path/query plus JSON body; exact schema: controller/service | src\app.ts:666 |
| PUT | /api/sales/proforma-invoices/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.updateProformaInvoice | Path/query plus JSON body; exact schema: controller/service | src\app.ts:667 |
| PATCH | /api/sales/proforma-invoices/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.updateProformaInvoice | Path/query plus JSON body; exact schema: controller/service | src\app.ts:668 |
| PUT | /api/sales/proforma-invoices/:id/status | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.updateProformaStatus | Path/query plus JSON body; exact schema: controller/service | src\app.ts:669 |
| POST | /api/sales/proforma-invoices/:id/convert | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.convertProformaInvoice | Path/query plus JSON body; exact schema: controller/service | src\app.ts:670 |
| POST | /api/sales/proforma-invoices/:id/convert-to-sales-order | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.convertProformaToSalesOrder | Path/query plus JSON body; exact schema: controller/service | src\app.ts:671 |
| GET | /api/sales/invoices | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getInvoices | Path/query parameters; exact schema: controller/service | src\app.ts:673 |
| GET | /api/sales/invoices/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.getInvoiceById | Path/query parameters; exact schema: controller/service | src\app.ts:674 |
| POST | /api/sales/invoices | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.createInvoice | Path/query plus JSON body; exact schema: controller/service | src\app.ts:675 |
| POST | /api/sales/invoices/:id/cancel | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FinanceController.cancelInvoice | Path/query plus JSON body; exact schema: controller/service | src\app.ts:676 |
| GET | /api/sales/returns | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.getReturnOrders | Path/query parameters; exact schema: controller/service | src\app.ts:678 |
| POST | /api/sales/returns | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.createReturnOrder | Path/query plus JSON body; exact schema: controller/service | src\app.ts:679 |
| PATCH | /api/sales/returns/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.updateReturnOrder | Path/query plus JSON body; exact schema: controller/service | src\app.ts:680 |
| POST | /api/sales/returns/:id/refund | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.refundReturnOrder | Path/query plus JSON body; exact schema: controller/service | src\app.ts:681 |
| GET | /api/sales/analytics | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.getAnalytics | Path/query parameters; exact schema: controller/service | src\app.ts:683 |
| GET | /api/sales/delivery-challans | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.getDeliveryChallans | Path/query parameters; exact schema: controller/service | src\app.ts:685 |
| POST | /api/sales/delivery-challans | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.createDeliveryChallan | Path/query plus JSON body; exact schema: controller/service | src\app.ts:686 |
| GET | /api/sales/delivery-challans/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.getDeliveryChallan | Path/query parameters; exact schema: controller/service | src\app.ts:687 |
| PATCH | /api/sales/delivery-challans/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.updateDeliveryChallan | Path/query plus JSON body; exact schema: controller/service | src\app.ts:688 |
| DELETE | /api/sales/delivery-challans/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.deleteDeliveryChallan | Path parameters; body: Unknown | src\app.ts:689 |
| POST | /api/sales/delivery-challans/:id/deliver | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.markDeliveryChallanDelivered | Path/query plus JSON body; exact schema: controller/service | src\app.ts:690 |
| POST | /api/sales/delivery-challans/:id/convert-to-sale | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.convertDeliveryChallanToSale | Path/query plus JSON body; exact schema: controller/service | src\app.ts:691 |
| GET | /api/sales/transit-stock | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.getTransitStock | Path/query parameters; exact schema: controller/service | src\app.ts:693 |
| GET | /api/sales/dispatch-tracking | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.getDispatchTracking | Path/query parameters; exact schema: controller/service | src\app.ts:694 |
| GET | /api/sales/delivery-challan-returns | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.getDeliveryChallanReturns | Path/query parameters; exact schema: controller/service | src\app.ts:696 |
| POST | /api/sales/delivery-challan-returns | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.createDeliveryChallanReturn | Path/query plus JSON body; exact schema: controller/service | src\app.ts:697 |
| POST | /api/sales/delivery-challan-returns/:id/receive | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | SalesController.receiveDeliveryChallanReturn | Path/query plus JSON body; exact schema: controller/service | src\app.ts:698 |
| GET | /api/purchase/rfqs | Bearer JWT | SUPER_ADMIN | PurchaseController.getRFQs | Path/query parameters; exact schema: controller/service | src\app.ts:701 |
| POST | /api/purchase/rfqs | Bearer JWT | SUPER_ADMIN | PurchaseController.createRFQ | Path/query plus JSON body; exact schema: controller/service | src\app.ts:702 |
| GET | /api/purchase/rfqs/:id | Bearer JWT | SUPER_ADMIN | PurchaseController.getRFQ | Path/query parameters; exact schema: controller/service | src\app.ts:703 |
| PATCH | /api/purchase/rfqs/:id | Bearer JWT | SUPER_ADMIN | PurchaseController.updateRFQ | Path/query plus JSON body; exact schema: controller/service | src\app.ts:704 |
| POST | /api/purchase/rfqs/:id/convert-to-po | Bearer JWT | SUPER_ADMIN | PurchaseController.convertQuotationToPO | Path/query plus JSON body; exact schema: controller/service | src\app.ts:705 |
| GET | /api/purchase/returns | Bearer JWT | FRANCHISE_ADMIN | PurchaseController.getPurchaseReturns | Path/query parameters; exact schema: controller/service | src\app.ts:707 |
| POST | /api/purchase/returns | Bearer JWT | FRANCHISE_ADMIN | PurchaseController.createPurchaseReturn | Path/query plus JSON body; exact schema: controller/service | src\app.ts:708 |
| PATCH | /api/purchase/returns/:id | Bearer JWT | FRANCHISE_ADMIN | PurchaseController.updatePurchaseReturn | Path/query plus JSON body; exact schema: controller/service | src\app.ts:709 |
| POST | /api/purchase/requisitions | Bearer JWT | FRANCHISE_ADMIN | PurchaseController.createRequisition | Path/query plus JSON body; exact schema: controller/service | src\app.ts:711 |
| GET | /api/purchase-requests | Bearer JWT | SUPER_ADMIN | PurchaseRequestController.getAll | Path/query parameters; exact schema: controller/service | src\app.ts:714 |
| GET | /api/purchase-requests/:id | Bearer JWT | SUPER_ADMIN | PurchaseRequestController.getById | Path/query parameters; exact schema: controller/service | src\app.ts:715 |
| POST | /api/purchase-requests | Bearer JWT | SUPER_ADMIN | PurchaseRequestController.create | Path/query plus JSON body; exact schema: controller/service | src\app.ts:716 |
| PATCH | /api/purchase-requests/:id/status | Bearer JWT | SUPER_ADMIN | PurchaseRequestController.updateStatus | Path/query plus JSON body; exact schema: controller/service | src\app.ts:717 |
| DELETE | /api/purchase-requests/:id | Bearer JWT | SUPER_ADMIN | PurchaseRequestController.deleteRequest | Path parameters; body: Unknown | src\app.ts:718 |
| GET | /api/franchise-orders | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FranchiseOrderController.getAll | Path/query parameters; exact schema: controller/service | src\app.ts:720 |
| POST | /api/franchise-orders | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FranchiseOrderController.create | Path/query plus JSON body; exact schema: controller/service | src\app.ts:721 |
| GET | /api/franchise-orders/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FranchiseOrderController.getById | Path/query parameters; exact schema: controller/service | src\app.ts:722 |
| PATCH | /api/franchise-orders/:id/status | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FranchiseOrderController.updateStatus | Path/query plus JSON body; exact schema: controller/service | src\app.ts:723 |
| POST | /api/franchise-orders/:id/payment | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | FranchiseOrderController.recordPayment | Path/query plus JSON body; exact schema: controller/service | src\app.ts:724 |
| GET | /api/franchise-orders/:id/invoice | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | Inline/anonymous | Path/query parameters; exact schema: controller/service | src\app.ts:727 |
| GET | /api/vendors/:id/balance | Bearer JWT | SUPER_ADMIN | Inline/anonymous | Path/query parameters; exact schema: controller/service | src\app.ts:736 |
| GET | /api/alerts/ | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | AlertController.getAlerts | Path/query parameters; exact schema: controller/service | src\modules\alerts\alert.routes.ts:10 |
| GET | /api/alerts/summary | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | AlertController.getSummary | Path/query parameters; exact schema: controller/service | src\modules\alerts\alert.routes.ts:11 |
| PATCH | /api/alerts/:id/read | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | AlertController.markAsRead | Path/query plus JSON body; exact schema: controller/service | src\modules\alerts\alert.routes.ts:12 |
| POST | /api/alerts/mark-all-read | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | AlertController.markAllAsRead | Path/query plus JSON body; exact schema: controller/service | src\modules\alerts\alert.routes.ts:13 |
| POST | /api/alerts/reconcile | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | AlertController.reconcile | Path/query plus JSON body; exact schema: controller/service | src\modules\alerts\alert.routes.ts:14 |
| GET | /api/attachments/ | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | AttachmentService.list | Path/query parameters; exact schema: controller/service | src\modules\attachments\attachment.routes.ts:20 |
| POST | /api/attachments/ | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | AttachmentService.upload | Path/query plus JSON body; exact schema: controller/service | src\modules\attachments\attachment.routes.ts:23 |
| GET | /api/attachments/:id/file | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | Inline/anonymous | Path/query parameters; exact schema: controller/service | src\modules\attachments\attachment.routes.ts:26 |
| DELETE | /api/attachments/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | AttachmentService.remove | Path parameters; body: Unknown | src\modules\attachments\attachment.routes.ts:39 |
| GET | /api/eway-bills/masters | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | EWayBillController.masters | Path/query parameters; exact schema: controller/service | src\modules\eway-bill\ewaybill.routes.ts:10 |
| GET | /api/eway-bills/stats | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | EWayBillController.stats | Path/query parameters; exact schema: controller/service | src\modules\eway-bill\ewaybill.routes.ts:11 |
| GET | /api/eway-bills/sources | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | EWayBillController.sources | Path/query parameters; exact schema: controller/service | src\modules\eway-bill\ewaybill.routes.ts:12 |
| GET | /api/eway-bills/prefill | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | EWayBillController.prefill | Path/query parameters; exact schema: controller/service | src\modules\eway-bill\ewaybill.routes.ts:13 |
| POST | /api/eway-bills/export-json | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | EWayBillController.exportJson | Path/query plus JSON body; exact schema: controller/service | src\modules\eway-bill\ewaybill.routes.ts:14 |
| GET | /api/eway-bills/ | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | EWayBillController.list | Path/query parameters; exact schema: controller/service | src\modules\eway-bill\ewaybill.routes.ts:15 |
| POST | /api/eway-bills/ | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | EWayBillController.create | Path/query plus JSON body; exact schema: controller/service | src\modules\eway-bill\ewaybill.routes.ts:16 |
| GET | /api/eway-bills/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | EWayBillController.getOne | Path/query parameters; exact schema: controller/service | src\modules\eway-bill\ewaybill.routes.ts:17 |
| PATCH | /api/eway-bills/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | EWayBillController.update | Path/query plus JSON body; exact schema: controller/service | src\modules\eway-bill\ewaybill.routes.ts:18 |
| DELETE | /api/eway-bills/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | EWayBillController.remove | Path parameters; body: Unknown | src\modules\eway-bill\ewaybill.routes.ts:19 |
| POST | /api/eway-bills/:id/generate | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | EWayBillController.generate | Path/query plus JSON body; exact schema: controller/service | src\modules\eway-bill\ewaybill.routes.ts:20 |
| POST | /api/eway-bills/:id/vehicle | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | EWayBillController.updateVehicle | Path/query plus JSON body; exact schema: controller/service | src\modules\eway-bill\ewaybill.routes.ts:21 |
| POST | /api/eway-bills/:id/extend | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | EWayBillController.extend | Path/query plus JSON body; exact schema: controller/service | src\modules\eway-bill\ewaybill.routes.ts:22 |
| POST | /api/eway-bills/:id/cancel | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | EWayBillController.cancel | Path/query plus JSON body; exact schema: controller/service | src\modules\eway-bill\ewaybill.routes.ts:23 |
| GET | /api/setup/status | Bearer JWT | Any authenticated role | SetupController.getStatus | Path/query parameters; exact schema: controller/service | src\modules\setup\setup.routes.ts:11 |
| POST | /api/setup/warehouse | Bearer JWT | SUPER_ADMIN | SetupController.createWarehouse | Path/query plus JSON body; exact schema: controller/service | src\modules\setup\setup.routes.ts:14 |
| GET | /api/warehouse/preview-code | Bearer JWT | Any authenticated role | WarehouseController.previewCode | Path/query parameters; exact schema: controller/service | src\modules\warehouse\warehouse.routes.ts:10 |
| GET | /api/warehouse/bins | Bearer JWT | Any authenticated role | WarehouseController.getAllBins | Path/query parameters; exact schema: controller/service | src\modules\warehouse\warehouse.routes.ts:11 |
| POST | /api/warehouse/bins | Bearer JWT | Any authenticated role | WarehouseController.createBinDirect | Path/query plus JSON body; exact schema: controller/service | src\modules\warehouse\warehouse.routes.ts:12 |
| PUT | /api/warehouse/bins/:binId | Bearer JWT | Any authenticated role | WarehouseController.updateBin | Path/query plus JSON body; exact schema: controller/service | src\modules\warehouse\warehouse.routes.ts:13 |
| DELETE | /api/warehouse/bins/:binId | Bearer JWT | Any authenticated role | WarehouseController.deleteBin | Path parameters; body: Unknown | src\modules\warehouse\warehouse.routes.ts:14 |
| GET | /api/warehouse/primary | Bearer JWT | Any authenticated role | WarehouseController.getPrimaryWarehouse | Path/query parameters; exact schema: controller/service | src\modules\warehouse\warehouse.routes.ts:17 |
| GET | /api/warehouse/:warehouseId/stock | Bearer JWT | Any authenticated role | WarehouseController.getWarehouseStock | Path/query parameters; exact schema: controller/service | src\modules\warehouse\warehouse.routes.ts:18 |
| GET | /api/warehouse/:warehouseId | Bearer JWT | Any authenticated role | WarehouseController.getWarehouseById | Path/query parameters; exact schema: controller/service | src\modules\warehouse\warehouse.routes.ts:19 |
| POST | /api/warehouse/:warehouseId/bins | Bearer JWT | Any authenticated role | WarehouseController.createBin | Path/query plus JSON body; exact schema: controller/service | src\modules\warehouse\warehouse.routes.ts:22 |
| POST | /api/warehouse/:warehouseId/assign-bin | Bearer JWT | Any authenticated role | WarehouseController.assignBin | Path/query plus JSON body; exact schema: controller/service | src\modules\warehouse\warehouse.routes.ts:25 |
| GET | /api/dealers/ | Bearer JWT | Any authenticated role | DealerController.getAll | Path/query parameters; exact schema: controller/service | src\modules\dealers\index.ts:7 |
| POST | /api/dealers/ | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | DealerController.create | Path/query plus JSON body; exact schema: controller/service | src\modules\dealers\index.ts:8 |
| GET | /api/dealers/:id | Bearer JWT | Any authenticated role | DealerController.getById | Path/query parameters; exact schema: controller/service | src\modules\dealers\index.ts:9 |
| PATCH | /api/dealers/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | DealerController.update | Path/query plus JSON body; exact schema: controller/service | src\modules\dealers\index.ts:10 |
| GET | /api/dealers/:id/transactions | Bearer JWT | Any authenticated role | DealerController.getTransactions | Path/query parameters; exact schema: controller/service | src\modules\dealers\index.ts:11 |
| GET | /api/dealers/:id/items | Bearer JWT | Any authenticated role | DealerController.getItemHistory | Path/query parameters; exact schema: controller/service | src\modules\dealers\index.ts:12 |
| DELETE | /api/dealers/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | DealerController.delete | Path parameters; body: Unknown | src\modules\dealers\index.ts:13 |
| GET | /api/business-partners/ | Bearer JWT | Any authenticated role | BusinessPartnerController.getAll | Path/query parameters; exact schema: controller/service | src\modules\business-partners\index.ts:7 |
| POST | /api/business-partners/ | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | BusinessPartnerController.create | Path/query plus JSON body; exact schema: controller/service | src\modules\business-partners\index.ts:8 |
| DELETE | /api/business-partners/:id | Bearer JWT | SUPER_ADMIN, FRANCHISE_ADMIN | BusinessPartnerController.delete | Path parameters; body: Unknown | src\modules\business-partners\index.ts:9 |

## Validation highlights

- Central Zod validation is registered for login and registration only.
- E-Way Bill service validates state/GSTIN/PIN/HSN/UQC, amounts, tax mode, distance, vehicle, duplicate documents and lifecycle windows.
- Monetary, stock, status and tenancy validation for other endpoints is embedded in the referenced controller/service.
- Query pagination/filter names are not standardized. Inspect the controller before integrating a new client.
