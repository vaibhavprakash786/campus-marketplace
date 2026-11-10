# Current state — Stage 1 implementation (verification pending)

## Scope and approval
Stage 0 was approved by the developer. Stage 1 is the only implementation stage authorized. No Stage 2 work has started.

## Workspace / repository limitations
The provided workspace contained Stage 0 documents and archives, but no `.git` directory or existing application. The revised Stage 0 package was used as the source of truth and its nine documents were preserved. No existing repository's Git status/diff could be inspected. Apply this scaffold to the real repository only after reviewing its status and existing changes.

## Stage 1 changes
- Added npm workspaces and a root `.gitignore`.
- Added minimal Next.js/TypeScript/Tailwind welcome page with health polling, loading/error/unconfigured states.
- Added Express/TypeScript app factory, health route/controller, 404/error handlers, CORS and MongoDB connection during startup.
- Added environment examples, API tests for health/404/missing configuration, TypeScript/lint/build scripts.
- Updated README local setup instructions; no other Stage 0 design document was changed.

## Validation and outstanding work
- Confirmed all required Stage 0 source documents were read.
- Attempted `npm view express version`: failed with `EAI_AGAIN` (npm registry DNS unavailable).
- Attempted `npm install --offline`: failed with `ENOTCACHED` (missing package metadata).
- As a result dependencies were **declared but not installed**. Development servers, health endpoint, database connection, frontend-backend communication, automated tests, lint/typecheck and production builds could not be executed in this environment. These are **not** claimed as passing.
- MongoDB server executable and actual connection configuration were not available.
- Git status/diff checks remain blocked because the workspace has no `.git` directory.

## Unresolved college-specific decisions
Verification eligibility/method, reviewer authority, evidence retention, hosting/cookie/CSRF policy, MongoDB replica-set hosting, reservation and dispute policies, audit access/retention remain as recorded in `docs/decisions.md`. Stage 1 does not resolve them.

## Acceptance status
**Stage 1 scaffold implemented, but Stage 1 is not yet fully verified or ready to declare complete.** Run the commands documented in README in an environment with npm access and MongoDB, review the real repository diff, and resolve any discovered errors. Stop here; do not start Stage 2 without explicit approval.

## Stage 2 implementation candidate (not fully accepted)
Registration, login, opaque cookie sessions, logout, self-profile read/update and unconfigured verification boundary are implemented in the provided scaffold. Institution verification remains disabled, so no users are automatically verified. Full Stage 2 acceptance is blocked on institution verification choice, email/SSO/manual infrastructure, and end-to-end validation. Password reset is deferred pending approved email infrastructure. No Stage 3 work has begun.

Stage 2 uses bcrypt password hashes, opaque HttpOnly cookies, and database-backed sessions. API prefix is `/api/auth` (the OpenAPI server prefix has been aligned to `/api`). Unselected verification adapter intentionally returns 503; no OTP is generated or delivered. Runtime tests and full build verification must be executed on the developer machine with dependencies and MongoDB available.


## Stage 2 college email OTP addition
Added hashed six-digit OTP challenges, 10-minute expiry, five-attempt cap, 60-second resend cooldown, single-use claim, development-only console delivery and a Resend HTTPS adapter. Registration restricts to configurable `COLLEGE_EMAIL_DOMAIN` (currently `lnmiit.ac.in`). No SMTP adapter or password reset until configured. The user must verify institutional approval and enrollment eligibility separately. No tests/builds are claimed as passing in this environment.

## Stage 3 — listing backend implementation candidate
Added Mongoose Listing model, strict create/patch validation, verified-session-only listing routes, seller ownership checks, available-only public browse/detail, owner listing history, bounded page/limit pagination, soft archive and indexes. Stage 3 does not implement uploads, category filters, search, chat, reservations or frontend marketplace. API spec and database documentation updated. Source ZIP omitted `.git`, so repository status/diff cannot be inspected in this environment. Runtime test/check results are recorded in the Stage 3 handoff; developer must run full validation with installed dependencies and MongoDB before approving.
