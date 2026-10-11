# Setup and Deployment

## Prerequisites

- Node.js version: **Unknown** (no `.nvmrc`/engine constraint verified). Dependencies were installed under Node 24 during inspection, but that is not a declared support statement.
- npm (both repositories contain `package-lock.json`). A frontend `pnpm-lock.yaml` also exists; canonical package manager is **Unknown**, though observed commands use npm.
- PostgreSQL compatible with Prisma 7.

## Frontend

```powershell
cd "D:\Kiddos Food\kiddosfood-erp-frontend"
npm install
npm run dev       # Next development server
npm run build     # Production build
npm run start     # Start production Next server
npm run lint
npm test
```

Do not run install when only reading documentation; commands above describe existing scripts.

Frontend environment names (values intentionally omitted):

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_BACKEND_URL`
- `NEXT_PUBLIC_SOCKET_URL`
- `NEXT_PUBLIC_WS_URL` (present in environment file; source usage not verified)
- `DATABASE_URL`, `DIRECT_URL` exist in `.env.prisma`; frontend runtime use is **Unknown**.
- `Port` is present with nonstandard capitalization; source use is **Unknown**.

## Backend

```powershell
cd "D:\Kiddos Food\kiddosfood-erp-backend"
npm install
npm run dev
npm run build
npm run start
npm run lint
```

Database commands declared by the backend:

```powershell
npm run prisma:generate
npm run prisma:migrate   # guarded, then prisma migrate dev
npm run prisma:deploy
npm run db:push
npm run db:seed
npm run db:cleanup       # guarded destructive cleanup
```

Never use `db:push`, migration or cleanup commands against an unknown database. No migration was run while preparing these docs.

Backend environment names referenced by source:

- `PORT`
- `DATABASE_URL`
- `NODE_ENV`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `GSTVERIFY_API_KEY`
- `BUSINESS_TZ_OFFSET_MINUTES`

Names present in the inspected `.env` but not confirmed at the corresponding source usage point include `DIRECT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `SANDBOX_API_KEY`, and `SANDBOX_SECRET`. Values are not documented.

## Local database

`docker-compose.yml` defines a local PostgreSQL service. Review the file and supply non-production credentials before use. Prisma obtains its connection from configuration/environment; schema provider is PostgreSQL.

## Build/deployment configuration

- Frontend `next.config.js`: strict mode, unoptimized images, Unsplash remote pattern and watch exclusions. Static export is commented out.
- Backend TypeScript compiles to `dist`; production start is `node dist/index.js`.
- No CI workflow, container image/Dockerfile, reverse proxy, process manager, cloud manifest or verified production hosting configuration was found. Production topology is **Unknown**.
- Socket.IO must be reachable at the configured frontend socket URL.

## First run

1. Configure PostgreSQL and backend environment variables.
2. Apply reviewed migrations using the deployment-appropriate command.
3. Start backend, then frontend.
4. Authenticate as an authorized super-admin.
5. Use `/setup` to verify/create the initial HQ warehouse.
6. Verify `/health`, authenticated `/api/me`, dashboard, Socket.IO notifications and franchise isolation.
## Playwright E2E tests

The frontend includes `@playwright/test`, `playwright.config.ts`, and tests under `e2e/`.

```powershell
npm run playwright:install  # Install Chromium runtime
npm run test:e2e            # Headless Chromium
npm run test:e2e:headed     # Visible browser
npm run test:e2e:ui         # Playwright UI runner
```

The Playwright configuration starts the Next.js development server automatically and reuses an existing local server outside CI. Login API responses are mocked by the login smoke suite, so those tests do not require database credentials.
