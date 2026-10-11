# Backend Architecture

## Server composition

`backend/src/index.ts` loads `.env`, creates an HTTP server around the default export from `backend/src/app.ts`, initializes Socket.IO and listens on `process.env.PORT || 5000`.

`backend/src/app.ts` performs, in order:

1. CORS middleware with default `cors()` behavior.
2. An 8 MB JSON parser scoped to `/api/attachments`, then the normal JSON parser.
3. Request/response console logging with top-level redaction for password/token fields and response truncation.
4. Health/root routes and all domain routes.
5. `errorHandler` as the final middleware.

## Layering

- Routes: mostly declared directly in `src/app.ts`; Alerts, Attachments, E-Way Bill, Setup and Warehouse use dedicated routers.
- Controllers: parse request fields, call a service and send a response or forward an error.
- Services: business logic and Prisma access. Cross-module calls are common for inventory, finance and workflow behavior.
- Persistence: Prisma client singleton from `src/lib/prisma.ts` using PostgreSQL.
- Shared utilities: JWT, unit conversion, GST tax/isolation helpers, sockets and error classes.

## Middleware

- `src/middleware/rbac.middleware.ts`: extracts the Bearer token, verifies access JWT and attaches its payload to `req.user`; `authorizeRole` checks roles and always lets `SUPER_ADMIN` pass.
- `src/middleware/validate.middleware.ts`: applies Zod schemas and returns validation failures.
- `src/middleware/error.middleware.ts`: normalizes `AppError` and unexpected errors; stack exposure depends on `NODE_ENV`.
- `src/middleware/auth.middleware.ts`: a second auth middleware file exists; the primary routes in `app.ts` import from `rbac.middleware.ts`.

## Modules

Controller/service modules under `backend/src/modules` include alerts, analytics, attachments, audit, auth, business partners, CRM, customers, dashboard, dealers, delivery, drafts, employees, E-Way Bill, finance/accounts/cheques, franchise and franchise orders, GRN/inspection, GST, inventory/raw materials/reservations, KDS, logistics, loyalty, payroll, POS/orders, procurement, products, production/cartons/recall, purchase returns/RFQ, purchase requests, recipes, sales, settings, setup, users/navigation, vendor invoices, warehouse, waste and workflow approvals.

## Error and transaction behavior

Services use both `AppError` and plain `Error`. The centralized middleware maps known errors to their status code and unexpected errors to a server error. Multi-record inventory, production, POS, finance and procurement operations frequently use `prisma.$transaction`, which is the main atomicity mechanism.

## Validation

`auth.validation.ts` provides Zod validation for login and registration. Most other validation is manual in services. E-Way Bill validation is especially extensive in `ewaybill.service.ts`. Because validation is not uniformly declarative, each controller/service must be reviewed when changing a payload.

## Background jobs

No scheduler, worker queue or cron runner is registered in the inspected server entry. Maintenance and reconciliation behavior appears in manually invoked scripts under `scripts/`, `src/scripts/` and test/diagnostic files. Automated production scheduling is **Unknown**.

## External integrations

- PostgreSQL through Prisma/`pg`.
- Socket.IO for live frontend notifications.
- GST verification service using Axios and `GSTVERIFY_API_KEY` in `src/modules/gst/gst.service.ts`.
- E-Way Bill generation is recorded/exported in application code; a direct NIC submission integration was not verified and is **Unknown**.
