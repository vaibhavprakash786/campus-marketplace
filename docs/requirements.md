# Requirements — MVP

## Roles
- Visitor: access landing information only; marketplace data requires verification.
- Student: verified account; can buy, sell, message, offer, report, and confirm handovers.
- Administrator: moderate listings/reports/users; cannot read private messages by default.
- Unverified registered user: limited profile/verification routes, not marketplace routes.

## User stories and acceptance
| ID | Story | Acceptance |
|---|---|---|
| AUTH-1 | Register/login | Passwords hashed, generic auth failures, session protected |
| AUTH-2 | Verify college membership | Only verified accounts access marketplace; method confirmed before Stage 2 |
| AUTH-3 | Maintain profile | Name, department, graduation year; public profile excludes contact details |
| LIST-1 | Publish/edit/remove item | Owner/admin only; title, description, category, price, condition, images validated |
| LIST-2 | Find items | Search, category/condition/price filters, sorting, bounded pagination |
| LIST-3 | Track availability | available, reserved, sold, removed; invalid transitions rejected |
| CHAT-1 | Start listing conversation | One conversation per listing/buyer/seller; seller cannot contact self |
| CHAT-2 | Exchange messages | Stored, paginated, participant-only; live notification after persistence |
| OFFER-1 | Negotiate | Buyer offer; seller accept/reject/counter; immutable offer history |
| RES-1 | Reserve item | At most one active reservation per listing; expiry/cancel documented |
| TX-1 | Confirm exchange | Both buyer and seller independently confirm handover before completed |
| SAFE-1 | Report item/user | Verified reporter; admin triage and resolution; prevent self-report abuse |
| SAFE-2 | Moderate | Admin can remove listing, restrict account; actions auditable |

## Student verification workflow (MVP)
1. Register with password; create `unverified`/`active` student account. Authentication alone does not unlock marketplace resources. A suspended account cannot use verification or marketplace endpoints.
2. The server advertises **only the configured, institution-approved method**. Student requests verification; validate method-specific input, rate-limit submissions and set `pending` while proof is evaluated. Rejected users may resubmit under configured retry policy; verified users cannot self-reset their status.
3. **College email:** send a short-lived, single-use token to a confirmed institution-controlled address/domain; user proves mailbox control by redeeming token. Domain eligibility and whether mailbox control proves *current enrollment* require institutional approval. A normal email/password login is not proof of college membership.
4. **Manual review:** student supplies a private, short-lived evidence reference through an approved upload process. Only authorized verification reviewers can inspect it; reviewer approves/rejects with a reason, audit record, and evidence-retention/deletion policy. No public evidence URL or student ID in public DTOs.
5. **SSO:** redirect to approved institution identity provider with state/nonce and PKCE where applicable; backend validates signed identity response, issuer, audience, expiration and an approved current-student eligibility claim. SSO availability, protocol and claim mapping are **not assumed**. If SSO is selected, credential/account provisioning details must be finalized before Stage 2.
6. On success, transition `pending -> verified`, record method/reviewer or trusted verification event/time, and grant marketplace access on subsequent authorization checks. On failure, transition `pending -> rejected` with private reason; `unverified/rejected -> pending` only via controlled resubmission. Admin decisions require privileged routes and audit entries. Verification must be revocable by authorized admins (`verified -> unverified`), invalidating active marketplace access.
7. Status checks expose only the user's own safe status/method and next action; tokens/evidence/reviewer notes remain private. Expire tokens, prevent replay, limit attempts, and define deletion/reverification rules before pilot.

**Unresolved:** actual college domain/SSO/provider, acceptable manual evidence, reviewer authority, whether email proves active enrollment, retries, expiry, retention and re-verification policy. Only one configured workflow need be enabled for the MVP; other methods are documented alternatives, not simultaneous deliverables.

## Offer negotiation lifecycle (MVP)
- Buyer starts with a positive-priced `pending` offer on an `available` listing; only verified conversation participants can negotiate. Seller cannot make an unsolicited initial offer.
- Recipient of the **current pending offer** may `accept`, `reject`, or `counter`; proposer may `withdraw` their own pending offer. A counter creates a new immutable offer document, links `parentOfferId`, and changes predecessor `pending -> countered` atomically. Seller counters buyer; buyer counters seller. Sender cannot accept/reject/counter their own proposal.
- `pending -> accepted | rejected | countered | withdrawn | expired` are terminal transitions for that offer. New proposals after rejection/withdrawal may start a fresh chain in the same conversation while listing remains available. Only one pending offer per conversation; a counter cannot bypass the current-pending guard.
- Acceptance is **not** a standalone status edit: in one MongoDB transaction, compare-and-set pending offer and available listing, create reserved transaction, link reservation and expire competing pending offers. On conflicts, return `409`; never report acceptance without reservation. The seller accepts a buyer proposal; the buyer accepts a seller counterproposal.
- A reservation expiring or being cancelled does not rewrite an accepted offer's historical status. Listing may return to available; a new negotiation starts with a new offer. `expired` pending offers are closed by listing unavailability, policy deadline, or competing acceptance. No payment or automatic sale occurs on offer acceptance.

## MVP boundaries
Included: student verification, profiles, listings, search/filter, chat, offers, reservation, campus handover confirmation, reports, moderation. No delivery, escrow, payment gateway, shipping tracking, ratings, push notifications, recommendation engine, multi-college tenancy, or public contact directory.

## Non-functional requirements
- Security: secure password hash (Argon2id or bcrypt), HTTP-only secure session cookies, CSRF strategy for cookie auth, HTTPS, least privilege, input validation, rate limiting, file MIME/content/size checks, secret management, audit of sensitive moderation actions.
- Privacy: minimum personal data, private email/verification evidence, participants-only chat, defined retention/deletion policy before launch; avoid exposing raw student identifiers.
- Maintainability: typed layered modules, stable API contracts, lint/format checks, isolated business logic, documented migrations.
- Responsiveness/accessibility: mobile-first layouts, keyboard operation, labels, contrast and error feedback; audit before pilot, no unverified compliance claim.
- Performance: paginated endpoints, indexed queries, bounded upload sizes and query limits; benchmark with pilot workload before setting targets.
- Reliability: structured errors and logs without secrets, health/readiness endpoints, monitored deployment, tested backups and recovery procedures.
- Testability: unit/service tests, API authorization tests, concurrency tests, critical Playwright user journeys.
- Environments: local, test, production with separate credentials/databases, environment validation and deployment runbook.

## Product policies requiring approval
- Verification: institutional email allowlist if verified, admin-approved evidence, or college SSO if available. No assumed email domain/API.
- Reservation: proposed 48-hour expiry, adjustable; expiry returns listing to available unless sold/removed.
- Handover: both parties confirm; disputes go to admin, no unilateral completion.
- Pricing: nonnegative INR integer minor units (paise); UI may display rupees; no online payments.
- Moderation: admins can remove listings; private messages remain inaccessible without a separately approved policy.
