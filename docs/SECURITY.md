# Security

## Authentication

- Login accepts `identifier` (email or phone) and password; login password minimum is six characters at validation time.
- Registration requires full name, valid email and password of at least eight characters; accepted roles are `SUPER_ADMIN` and `FRANCHISE_ADMIN`.
- Passwords are compared/stored with bcrypt in the auth/user services.
- Access and refresh JWTs are separate. Access lifetime is 15 minutes; refresh lifetime is 7 days.
- Protected routes expect `Authorization: Bearer <token>`.
- Refresh-token records exist in PostgreSQL and logout accepts a refresh token.

## Frontend session handling

`AuthContext.tsx` stores access token, refresh token and serialized user in `localStorage`. `base.ts` refreshes after a 401 and queues concurrent failed requests. This is vulnerable to token theft if an XSS flaw exists because local storage is readable by page JavaScript. No Content Security Policy was found in the inspected Next.js configuration.

## Authorization

`authorizeRole()` checks the JWT role and gives `SUPER_ADMIN` an unconditional bypass. Many services additionally filter by `franchiseId`. Authorization depends on both route middleware and service isolation; UI menu visibility is not a security control.

The code contains two authentication middleware files. Routes in `app.ts` primarily use `rbac.middleware.ts`. Developers should avoid introducing a third behavior or importing the wrong middleware without comparison.

## Validation and data safety

- Zod request validation is centrally applied only to login/registration.
- Other endpoints rely on controller/service checks.
- Prisma parameterization mitigates SQL injection for normal ORM calls; raw-query usage should be reviewed independently.
- Attachments use an 8 MB JSON parser and service checks around encoded size/type. Files are stored in the database model, not verified object storage.
- `errorHandler` hides stack traces outside development.
- Request logging redacts only top-level keys named `password`, `accessToken`, `refreshToken`, or `token`. Nested secrets or differently named sensitive fields may still be logged.

## Confirmed security risks

1. `backend/src/lib/jwt.util.ts` contains fallback signing secrets when environment variables are absent. Values are intentionally not reproduced here. This is a critical configuration risk: production must fail closed instead of using source defaults.
2. Backend environment-name drift exists: `.env` names include one JWT variable convention, while `jwt.util.ts` reads `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`. Correct production injection is not verified.
3. `cors()` is enabled without an explicit origin in `app.ts`; `CORS_ORIGIN` appears in the environment file but was not observed being used in server setup.
4. Tokens are persisted in browser local storage.
5. The public registration route can accept an optional `SUPER_ADMIN` role according to the Zod schema. Whether `AuthService.register` safely restricts this was not established in this review and requires immediate manual verification.
6. API logging includes request queries and redacted bodies; personally identifiable and commercial data can reach logs.

## Recommended verification checklist

- Confirm registration cannot self-assign privileged roles.
- Remove/default-deny JWT secret fallbacks and align environment names.
- Restrict CORS to intended frontend origins.
- Audit every non-super-admin service for `franchiseId` isolation.
- Add rate limiting for login, refresh and expensive report endpoints.
- Add CSP/security headers and review local-storage token design.
- Expand recursive log redaction and establish retention/access policy.
- Validate upload MIME/type/content and malware policy.

These are documentation findings; no security behavior was changed.
