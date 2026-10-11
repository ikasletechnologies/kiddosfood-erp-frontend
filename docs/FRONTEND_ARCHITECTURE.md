# Frontend Architecture

## Application shell and routing

The frontend uses Next.js App Router. Each `src/app/**/page.tsx` is a route. `src/app/layout.tsx` is the global layout. `src/components/layout/AppShell.tsx` is the authenticated shell.

Public path: `/login`. Setup path: `/setup`. Other routes require a user in `AuthContext`; unauthenticated users are redirected to `/login`. `FRANCHISE_ADMIN` users visiting `/` are redirected to `/franchise/dashboard`. A `SUPER_ADMIN` with incomplete setup is redirected to `/setup`.

Navigation definitions are centralized in `src/config/navigation.ts` as `SUPER_ADMIN_SIDEBAR` and `franchiseMenuSections`. This controls sidebar visibility, but backend RBAC remains the security boundary.

## Provider hierarchy

```text
ThemeProvider
└── AuthProvider
    └── ToastProvider
        └── NotificationProvider
            └── AppShell
                ├── SidebarProvider
                ├── Sidebar
                ├── RefrensHeader
                └── routed page
```

- `AuthContext.tsx`: local user/session state, token persistence, setup status and logout.
- `NotificationContext.tsx`: alert state and Socket.IO event handling.
- `PurchaseOrderContext.tsx`: large purchase-order create/edit form state and derived totals.
- `SidebarContext.tsx`: desktop collapse and mobile drawer state.
- `ThemeContext.tsx`: class-based light/dark mode.
- `ToastContext.tsx`: application toast state; root also mounts `react-hot-toast`.

## HTTP integration

`src/lib/api/base.ts`:

- Resolves base URL from `NEXT_PUBLIC_API_URL`, then `NEXT_PUBLIC_BACKEND_URL`, then `http://localhost:5000`.
- Strips a trailing `/api` to keep call sites consistent.
- Adds `Authorization: Bearer <access_token>` from browser local storage.
- On one 401 response, coordinates a single refresh request to `/api/auth/refresh`, queues concurrent failures, stores rotated tokens and retries the original request.
- Clears local session state and navigates to `/login` if refresh fails.
- Logs redacted request/response data only outside production.

Typed/grouped clients live in `src/lib/api/*.api.ts`: accounting, alerts, attachments, auth, dashboard, E-Way Bill, franchise, GST, inventory, procurement, sales, setup, users and warehouses. `src/lib/api.ts` also contains a broad legacy API surface used by many pages.

## Component organization

- `src/components/layout`: application shell, sidebar and header.
- `src/components/ui`: reusable button, card, input, table, modal, slide-over, badge, progress, toast and empty state primitives.
- `src/components/documents`: invoice/document headers, line items, summaries and printable GST/statement components.
- `src/components/modules`: feature clients and complex forms for admin, banking, CRM, franchise, HR, inventory, production, products, purchases, sales, settings and vendors.
- `src/components/dashboard`: dashboard cards, chart composition, date filter, skeleton and drill-down drawer.
- `src/components/common`: attachments and barcode utilities.
- `src/components/profile`, `clients`, `contacts`, `sales`: domain-specific shared presentation.

## Forms and validation

Forms are predominantly controlled React state inside pages/components. The frontend does not use a common schema form library. Validation is therefore feature-local and must not be assumed uniform. Authoritative backend schema validation is explicit only for login and registration through Zod; other server validation is implemented manually in controllers/services.

Notable complex form clients:

- `src/components/modules/purchases/PurchaseFormContent.tsx`
- `src/context/PurchaseOrderContext.tsx`
- `src/components/modules/sales/NewInvoiceClient.tsx`
- `src/components/modules/products/AddProductClient.tsx`
- `src/app/sales/eway-bill/EWayBillForm.tsx`

## Utilities

- `src/lib/unitConversion.ts`, `recipe-units.ts`, `recipe-export.ts`: unit and recipe operations.
- `src/lib/export/exportHelpers.ts`, `excelExport.ts`: export helpers.
- `src/lib/code128.ts` and `Code128Barcode.tsx`: barcode rendering.
- `src/lib/party-form.tsx`: shared party form behavior.
- `src/lib/sales-ui.ts`: sales UI helpers.
- `src/lib/data/hsn_all.json`: local HSN reference data.

## Route catalog

The project contains 120+ `page.tsx` routes. Major route families are `/accounting`, `/admin`, `/alerts`, `/audit`, `/banking`, `/customers`, `/delivery`, `/dispatch`, `/franchise`, `/hr`, `/inventory`, `/packaging`, `/pos`, `/production`, `/products`, `/purchases`, `/reports`, `/sales`, `/settings`, `/setup`, `/vendors`, and `/warehouse`. The functional mapping is in [ERP_MODULES.md](ERP_MODULES.md); source files are inventoried in [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).

## Testing

Frontend tests currently cover dashboard CSV encoding, sales invoice draft payloads and alerts-page behavior. During documentation work, the first two passed; all 15 alerts tests failed because tests expect `ALERT SUMMARY` while the rendered page does not contain it. See [ISSUES_AND_UNKNOWN_ITEMS.md](ISSUES_AND_UNKNOWN_ITEMS.md).
