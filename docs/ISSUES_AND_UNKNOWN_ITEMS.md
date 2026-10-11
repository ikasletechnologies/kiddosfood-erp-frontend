# Issues and Unknown Items

## Confirmed issues

| Severity | Finding | Evidence |
|---|---|---|
| Critical | JWT utility has source-code fallback signing secrets | `backend/src/lib/jwt.util.ts` |
| High | JWT environment names are inconsistent between inspected `.env` names and source reads | `.env` name inventory vs `jwt.util.ts` |
| High | CORS is unrestricted and configured `CORS_ORIGIN` is not used in `app.ts` | `backend/src/app.ts` |
| High | Frontend auth client calls `/api/auth/me`, but server registers `/api/me` | `src/lib/api/auth.api.ts` vs backend `src/app.ts` |
| Medium | Request logger redaction is shallow; nested or differently named secrets/PII can be logged | backend `src/app.ts` |
| Medium | Frontend tokens are stored in local storage | `src/context/AuthContext.tsx` |
| Medium | Validation is inconsistent; only auth routes use central Zod middleware | backend route registry and validation files |
| Medium | Frontend alerts test suite is stale/broken: 15 tests expect `ALERT SUMMARY`, but current page omits it | `src/app/alerts/__tests__/page.test.tsx`; test run on 2026-10-10 |
| Medium | Backend repository had uncommitted migration changes during inspection | `prisma/migrations/migration_lock.toml`, `prisma/migrations/20261010121922/` |
| Low | Both `package-lock.json` and `pnpm-lock.yaml` exist in frontend | repository root |
| Low | Many diagnostic/patch/data scripts live at backend root and under source | backend file inventory |
| Low | Console output/source comments show encoding artifacts in several files | observed source text |

## Potential risks requiring manual verification

- Public registration schema permits optional `SUPER_ADMIN`; confirm service-level restriction before deployment.
- Confirm all franchise-scoped reads/writes enforce `franchiseId`, especially reports and shared document endpoints.
- Confirm raw SQL, if any, is parameterized and tenant-scoped.
- Confirm duplicate-payment and duplicate-document idempotency across all mutation endpoints.
- Confirm database backup, restore testing and migration rollback procedures.
- Confirm Socket.IO authentication and room isolation in `src/lib/socket.ts` and notification flows.
- Confirm attachment content validation, malware scanning and retention.
- Confirm GST/E-Way Bill legal compliance with current rules; code behavior is documented, legal correctness was not audited.

## Unknown

- Production infrastructure, domain names, TLS termination and hosting platform.
- Supported Node/PostgreSQL versions.
- CI/CD, release approvals, branch policy and observability stack.
- Production environment-variable values and secret-management mechanism.
- Data retention, deletion, privacy and audit-log retention policies.
- Whether all migrations have been applied consistently to every environment.
- Canonical package manager for the frontend.
- External E-Way Bill/NIC submission mechanism; code clearly supports local records and JSON export, but direct submission was not verified.
- Exact response schema for endpoints whose controllers return dynamic Prisma/service results; consult the referenced source.
- Whether inactive/commented screens and routes are supported product features.

## Verification status

- Frontend TypeScript check passed before documentation generation.
- Frontend production build previously exceeded the two-minute execution limit; build success is unverified.
- Frontend Vitest: two tests passed and the 15-test alerts suite failed for the confirmed heading mismatch.
- Backend build/tests were not run because the task prohibited migrations and interaction with potentially configured databases; many backend scripts appear database-connected and potentially mutating.
