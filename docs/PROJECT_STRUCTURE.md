# Project Structure

## Frontend repository

```text
kiddosfood-erp-frontend/
├── public/                  # Logos, favicons and feature images
├── scripts/                 # Repository utility scripts
├── src/
│   ├── app/                 # Next.js App Router pages and global layout/CSS
│   │   ├── accounting/      # Ledgers, reports, expenses, payments and statements
│   │   ├── admin/           # User and approval screens
│   │   ├── franchise/       # Branch dashboard, partners, stock, transfers/payments
│   │   ├── hr/              # Employees, attendance, leave, shift and payroll UI
│   │   ├── inventory/       # Inventory dashboards, stock, batches and reconciliation
│   │   ├── packaging/       # Cartons, queue, verification and labels
│   │   ├── pos/             # Counter billing, invoice list, cheques and settlement
│   │   ├── production/      # Planning, batches, recipes, waste and recall
│   │   ├── purchases/       # PO, GRN, QC, bills, returns, RFQ and requests
│   │   ├── reports/         # Report catalog and GST report routes
│   │   ├── sales/           # Estimates, orders, invoices, returns, DC and E-Way Bill
│   │   ├── settings/        # Company and user configuration
│   │   ├── setup/           # First-run HQ warehouse wizard
│   │   ├── layout.tsx       # Global providers and metadata
│   │   ├── page.tsx         # HQ executive dashboard
│   │   └── globals.css      # Design tokens, utilities and print rules
│   ├── components/
│   │   ├── common/          # Attachments and barcodes
│   │   ├── dashboard/       # Dashboard widgets
│   │   ├── documents/       # Reusable transaction-document rendering
│   │   ├── layout/          # AppShell, Sidebar, Header
│   │   ├── modals/          # Account/party/vendor/warehouse dialogs
│   │   ├── modules/         # Feature-level client components
│   │   ├── profile/         # Profile presentation
│   │   ├── sales/           # Shared sales document sections
│   │   └── ui/              # UI primitives
│   ├── config/navigation.ts # Role-specific navigation source of truth
│   ├── context/             # React Context providers
│   └── lib/                 # API clients, exports, units and domain helpers
├── package.json             # Scripts/dependencies
├── next.config.js           # Next settings
├── tailwind.config.js       # Theme/token mapping
├── tsconfig.json            # TypeScript configuration
└── vitest.config.ts         # Test configuration
```

Generated `.next/`, `node_modules/`, environment files and lockfiles are not application modules.

## Backend repository

```text
kiddosfood-erp-backend/
├── prisma/
│   ├── schema.prisma        # PostgreSQL data model
│   ├── migrations/          # SQL migrations
│   ├── seed.ts              # Main seed entry
│   └── *.ts                 # Data inspection/maintenance scripts
├── scripts/                 # Operational checks, backfills and guarded cleanup
├── src/
│   ├── app.ts               # Express application and primary route registry
│   ├── index.ts             # HTTP/Socket.IO server startup
│   ├── lib/                 # Prisma, JWT, socket and conversion helpers
│   ├── middleware/          # Auth/RBAC, validation and errors
│   ├── modules/             # Controllers and services by ERP domain
│   ├── tests/               # Integration/regression/acceptance scripts
│   ├── types/request.ts     # Request type extensions
│   └── utils/               # Errors, GST and tenancy/isolation utilities
├── tests/                   # Additional reconciliation test scripts
├── docker-compose.yml       # Local PostgreSQL service
├── package.json             # Scripts/dependencies
├── prisma.config.ts         # Prisma configuration
└── tsconfig.json            # TypeScript build settings
```

## Important relationships

- Frontend route pages import clients from `src/lib/api` and feature components from `src/components/modules`.
- Frontend API paths map to routes in backend `src/app.ts` or its mounted routers.
- Backend controllers call same-domain services; services share Prisma and sometimes call inventory/finance services.
- Prisma relations connect franchises, users, warehouses, stock, orders, payments and document lifecycles. See [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).
- `src/config/navigation.ts` describes discoverable UI routes; it is not exhaustive because direct/deep routes also exist.

## Full page-file inventory

Run this read-only command in the frontend repository for the authoritative list:

```powershell
rg --files src/app | Where-Object { $_ -match 'page\.tsx$' } | Sort-Object
```

The inspected source contained 120+ page entries. Dynamic segments include banking account details, product edit, purchase edit and payslip views.
