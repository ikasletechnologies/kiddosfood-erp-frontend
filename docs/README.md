# Kiddos Food ERP — Technical Documentation

This documentation describes the source code present in these sibling repositories as inspected on 2026-10-10:

- Frontend: `D:\Kiddos Food\kiddosfood-erp-frontend`
- Backend: `D:\Kiddos Food\kiddosfood-erp-backend`

No production data was accessed. Environment-variable values and credentials are intentionally omitted. Statements are based on source code; anything not established by the code is marked **Unknown**.

## Documentation map

| Document | Purpose |
|---|---|
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | Purpose, stack, architecture, entry points |
| [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) | Repository and folder map |
| [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) | Routes, components, state, API client, forms |
| [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) | Express setup, modules, middleware, services |
| [API_REFERENCE.md](API_REFERENCE.md) | Mechanically extracted endpoint inventory |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Prisma/PostgreSQL models, fields, keys and indexes |
| [ERP_MODULES.md](ERP_MODULES.md) | ERP capabilities by module |
| [BUSINESS_WORKFLOWS.md](BUSINESS_WORKFLOWS.md) | Verified workflows and Mermaid diagrams |
| [DATA_FLOW_DIAGRAMS.md](DATA_FLOW_DIAGRAMS.md) | Level 0–2 DFDs and transaction sequence diagrams |
| [SECURITY.md](SECURITY.md) | Authentication, authorization and risks |
| [SETUP_AND_DEPLOYMENT.md](SETUP_AND_DEPLOYMENT.md) | Configuration names and commands |
| [DEVELOPER_HANDOVER.md](DEVELOPER_HANDOVER.md) | New-developer operating guide |
| [ISSUES_AND_UNKNOWN_ITEMS.md](ISSUES_AND_UNKNOWN_ITEMS.md) | Confirmed issues, risks and unknowns |

## Evidence conventions

- Paths beginning `src/` without a repository label refer to the frontend unless stated otherwise.
- Backend paths are prefixed with `backend/` in prose; physically they are relative to `D:\Kiddos Food\kiddosfood-erp-backend`.
- “Protected” means the backend route uses `authenticate`, either directly or through router middleware.
- Role lists are copied from `authorizeRole(...)`; its implementation always allows `SUPER_ADMIN` as a bypass.
- Request/response shapes are reported only when directly visible. Otherwise they are **Unknown; inspect the referenced controller/service**.

## Scope limitations

Runtime behavior was not verified against a live database, external GST service, or production deployment. Existing dirty Git changes in both repositories were not modified. The backend migration directory also contained pre-existing uncommitted migration changes during inspection.
