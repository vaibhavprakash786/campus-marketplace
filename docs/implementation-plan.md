# Incremental implementation plan

Every stage requires explicit approval; run automated tests and manual checks, inspect `git diff`, report changed files and blockers, then stop. Paths below are **expected future paths**, not files to create during Stage 0.

## Stage 0 — Planning (current)
- Scope: requirements, architecture, data design, OpenAPI, roadmap, rules and decisions.
- Dependencies: project specification; repository inspection where accessible.
- Files: `AGENT_RULES.md`, `README.md`, `docs/{requirements,architecture,database-design,implementation-plan,decisions,current-state}.md`, `docs/api-spec.yaml`.
- Acceptance: all nine planning documents, consistent lifecycle, authorization and data contracts; no application code.
- Automated checks: YAML parse/OpenAPI validator if installed, document/link checks; manual: cross-review diagrams, statuses and scope.
- Exclusions: application code, dependency installation, deployment.
- Done when: documents verified and outstanding questions recorded; Stage 1 awaits approval.

## Stage 1 — Project foundation
- Scope: workspace scaffolding, env examples, health/readiness endpoints, lint/format/test scripts, MongoDB connectivity checks.
- Dependencies: Stage 0 sign-off; repository access and hosting assumptions.
- Expected modules: `apps/web`, `apps/api/src/app.ts`, `apps/api/src/routes/health.ts`, `.env.example`, test/config files.
- Acceptance: web/API boot locally, health works, missing configuration fails safely.
- Automated: health API tests, lint/typecheck; manual: start both services, simulate database down, verify no secrets committed.
- Exclusions: accounts, listings, chat, payments.
- Done when: checks pass, diff reviewed, reproducible setup documented.

## Stage 2 — Authentication and verification
- Scope: registration/login/logout, session management, verification workflow, profile, route guards.
- Dependencies: Stage 1; confirmed verification method and session deployment policy.
- Expected modules: `api/src/modules/auth`, `api/src/modules/users`, `web/app/(auth)`, session middleware.
- Acceptance: unverified users cannot access marketplace; self-service cannot grant admin/verified roles; private fields hidden.
- Automated: hash/session tests, unauthorized/CSRF/rate-limit tests, verification state tests; manual: register, login, verify, logout, inspect cookies.
- Exclusions: listings and messaging.
- Done when: auth threat cases pass and verification reviewer flow works.

### Stage 2 verification-specific acceptance
- Implement only the institution-approved method, including submission/challenge or reviewer workflow, status checks, expiry/replay prevention, rejection/resubmission and admin revocation. Provide admin verification queue/decision routes when manual review is selected; approval/rejection/revocation always require privileged access and an audit entry.
- Test unverified/rejected/pending access denial, reviewer-only evidence, invalid/expired token or SSO claims where applicable, decision races, revocation and private-field redaction. Evidence retention and account provisioning must be approved before deployment.
- Audit log schema and privileged write path are required for Stage 2 verification decisions; Stage 9 adds remaining moderation actions and audit review tooling.

## Stage 3 — Listings backend
- Scope: CRUD, ownership checks, validation, search/filter/sort/cursor pagination, state guardrails.
- Dependencies: Stage 2.
- Expected modules: `api/src/modules/listings/{model,service,routes,validators}`, API tests.
- Acceptance: verified sellers can manage own available listings; other students cannot edit; pagination bounded.
- Automated: CRUD, search/filter, validation, forbidden access and state tests; manual: REST requests from two accounts.
- Exclusions: frontend marketplace and image uploads.
- Done when: contract and authorization tests pass.

## Stage 4 — Marketplace UI
- Scope: browse/search/filter pages, listing details, create/edit forms, responsive states.
- Dependencies: Stage 3.
- Expected modules: `web/app/listings`, `web/components/listings`, typed API client.
- Acceptance: mobile browsing and listing creation usable with loading/empty/error feedback.
- Automated: UI component tests and Playwright listing journey; manual: keyboard and mobile viewport checks.
- Exclusions: image upload, chat and offers.
- Done when: listing flows work end-to-end without images.

## Stage 5 — Images
- Scope: signed upload intent, Cloudinary association, ownership/MIME/size/count validation, cleanup policy.
- Dependencies: Stage 4; Cloudinary account/config.
- Expected modules: `api/src/modules/uploads`, listing image UI, integration tests.
- Acceptance: only owner attaches validated images; secrets never reach browser; rejected uploads do not attach.
- Automated: invalid MIME/size, tampering, ownership and finalize tests; manual: upload/delete image and test failure recovery.
- Exclusions: image recognition and moderation AI.
- Done when: happy and failure paths verified.

## Stage 6 — Persistent chat
- Scope: unique conversation creation, messages persisted and paginated, participant-only access.
- Dependencies: Stage 3 and Stage 2.
- Expected modules: `api/src/modules/conversations`, `api/src/modules/messages`, chat UI.
- Acceptance: duplicate concurrent starts produce one conversation; unauthorized users cannot read/write.
- Automated: uniqueness, participant authorization, cursor pagination; manual: two-user chat with page refresh.
- Exclusions: sockets, offers and read receipts.
- Done when: persistence and access tests pass.

## Stage 7 — Live messaging and offers
- Scope: authenticated Socket.IO rooms/notifications, immutable offer/counter history, accept/reject endpoints integrated with Stage 8 reservation service later.
- Dependencies: Stage 6; agreed negotiation semantics.
- Expected modules: `api/src/realtime`, `api/src/modules/offers`, offer UI.
- Acceptance: message notifications follow persistence; offers/counters immutable; acceptance **not enabled until Stage 8 atomic reservation path exists**.
- Automated: socket authorization/reconnect, offer transition tests, duplicate pending offer conflicts; manual: two browsers, offline/reconnect.
- Exclusions: reservation acceptance and handover completion until Stage 8.
- Done when: offer create/counter/reject works and acceptance safely returns not-available until Stage 8.

### Stage 7 negotiation-specific acceptance
- Only buyer may initiate; recipient alone may accept/reject/counter; proposer alone may withdraw. Counters alternate, link predecessor, and atomically close it. Verify unique pending offer per conversation and preserve historical records.
- Until Stage 8, `accept` must be disabled (e.g. `409 FEATURE_NOT_READY`), never change an offer to accepted without creating the reservation. Test this explicitly.

## Stage 8 — Reservations and handover
- Scope: atomic offer acceptance/reservation, expiry/cancel, dual confirmation, dispute state, concurrent buyer protection.
- Dependencies: Stage 7; MongoDB replica set and approved reservation/dispute policy.
- Expected modules: `api/src/modules/transactions`, reservation reconciliation job, handover UI.
- Acceptance: one winner per listing, loser gets conflict, expiry releases stock, completion requires both parties.
- Automated: concurrent acceptance integration tests against replica set, retry/idempotency, expiry, cancellation and confirmation; manual: race two buyers, expiry, dispute scenario.
- Exclusions: payments, escrow, delivery.
- Done when: invariants hold under simulated races and state reconciliation.

### Stage 8 consistency-specific acceptance
- In one database transaction, accept pending offer, reserve available listing, create transaction and expire competing pending offers; unique indexes and idempotent retries prevent double selling. Verify cancellation, expiry, dual handover confirmation and disputed-state rules across API, DB and socket notifications.

## Stage 9 — Safety and pilot
- Scope: reports, admin moderation, audit, security/accessibility checks, deployment, monitoring, backup/restore runbook, pilot documentation.
- Dependencies: Stages 1–8; admin and privacy policies.
- Expected modules: `api/src/modules/reports`, `api/src/modules/admin`, admin UI, deploy/runbook docs.
- Acceptance: report review and suspension work; secure HTTPS deployment; backup restore rehearsed; campus pilot checklist complete.
- Automated: admin authorization, abuse/rate-limit tests, Playwright critical journeys, regression suite; manual: security/privacy/accessibility review, backup restore and pilot dry run.
- Exclusions: multi-college, shipping, payments, recommendation engine.
- Done when: release checklist signed, issues logged, tests actually executed and results reported.
