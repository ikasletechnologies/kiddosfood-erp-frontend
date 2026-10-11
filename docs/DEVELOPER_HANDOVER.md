# Developer Handover Guide

## Recommended reading order

1. `docs/PROJECT_OVERVIEW.md`
2. Frontend `src/app/layout.tsx`, `src/components/layout/AppShell.tsx`, `src/config/navigation.ts`
3. Frontend `src/lib/api/base.ts` and the relevant feature API client
4. Backend `src/index.ts`, `src/app.ts`, middleware
5. Relevant controller/service pair
6. Relevant Prisma models and migration SQL
7. Existing tests for the feature

## Tracing a feature

For a UI action, start at the route page, follow imported feature components and locate the API client call. Match its method/path in [API_REFERENCE.md](API_REFERENCE.md), then inspect the controller, service and Prisma entities. Search for the entity/status in tests to discover regression expectations.

Example trace:

```text
src/app/production/batches/page.tsx
→ src/lib/api/inventory.api.ts
→ POST /api/production/batches/:id/qc
→ ProductionController.inspectBatch
→ ProductionService.inspectBatch (production.service.ts)
→ ProductBatch + InventoryItem + StockMovement transaction
```

## Safe maintenance practices

- Treat inventory and finance services as shared infrastructure; changes can affect POS, procurement, production, returns and reporting.
- Preserve transactions and idempotency guards around stock/ledger mutation.
- Do not trust frontend monetary totals; server services intentionally recalculate many values.
- Keep route RBAC and service-level franchise isolation aligned.
- When adding fields, update Prisma schema/migration, service selections, controller payload, frontend types/forms, exports and tests.
- When adding routes, update the navigation only if it should be discoverable; navigation is separate from authorization.
- Use the shared unit package and conversion helpers rather than ad hoc arithmetic.

## Testing strategy visible in the repository

The backend contains many executable integration/acceptance scripts rather than a single declared test runner script. Areas with tests include finance/GST, FIFO returns, procurement, production, franchise isolation, inventory integrity, POS and RBAC. Determine whether a script mutates data before running it. Prefer a disposable database.

Frontend uses Vitest. Existing tests are limited and do not represent complete UI coverage.

## Operational checks

- `/health` confirms process availability only; it does not prove database connectivity.
- Review server logs carefully because request bodies and responses are logged in development/server output.
- Run reconciliation scripts only after reading them and confirming database target.
- Keep `.env` files out of documentation, tickets and commits.

## Change checklist

1. Confirm repository and working tree state.
2. Locate all frontend/backend references with `rg`.
3. Write or update a regression test.
4. Make the smallest domain-layer change.
5. Run TypeScript/build checks.
6. Test role and franchise isolation.
7. Test rollback/error path and duplicate submission.
8. Verify monetary rounding and unit conversion.
9. Update these docs if externally visible behavior changed.

## Ownership unknowns

Original module owners, deployment operator, production support contacts, SLA, backup/RPO/RTO, release process and incident response are **Unknown**.
