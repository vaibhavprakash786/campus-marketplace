# Architectural decisions and open questions

| ID | Decision | Alternatives and rationale | State |
|---|---|---|---|
| ADR-01 | Separate Next.js UI + single Express REST/Socket.IO API | Next.js-only server simpler to deploy, but separation demonstrates backend architecture and socket ownership | Proposed |
| ADR-02 | MongoDB/Mongoose, replica-set transactions | Standalone DB lacks required multi-document transaction semantics | Proposed |
| ADR-03 | REST authoritative; Socket.IO notifications | Socket-based writes complicate retry/consistency | Proposed |
| ADR-04 | Cloudinary signed direct upload | Backend proxy increases bandwidth; direct upload requires server-side ownership validation | Proposed |
| ADR-05 | Cookie sessions, HttpOnly/Secure, CSRF strategy | Bearer tokens easier for mobile but risk browser token leakage | Proposed |
| ADR-06 | Prices in integer paise | Floating-point rupees introduce rounding errors | Proposed |
| ADR-07 | 48-hour reservation timeout and dual confirmation | Duration and dispute handling need pilot feedback | Configurable proposal |
| ADR-08 | No mandatory online payment/delivery | Out of MVP scope | Fixed scope |

| ADR-09 | Configurable student verification adapter; selected method requires institutional approval | Email proves mailbox control but not necessarily enrollment; manual review requires restricted evidence handling; SSO needs provider and eligibility claims | Method unresolved before Stage 2 |
| ADR-10 | Append-only `audit_logs` collection in MVP | Structured logs alone are insufficient for accountable privileged decisions; keep sanitized metadata and restricted access | Proposed |
| ADR-11 | Recipient-controlled offer decisions and atomic acceptance/reservation | Prevent self-acceptance, stale counters and double reservations | Proposed |

## Architecture blockers before implementing relevant stage
1. **Student verification (Stage 2):** does the college have a controlled student email domain, SSO, or an approved manual review method? Who can review evidence and how is it deleted?
2. **Session/deployment topology (Stage 1–2):** frontend and API hostnames, cookie domain/SameSite settings and CSRF strategy must match actual hosting.
3. **MongoDB hosting (Stage 1/8):** must support replica-set transactions before reservation logic is deployed.
4. **Handover dispute authority (Stage 8/9):** who resolves disputed or abandoned handovers and can reverse an incorrect confirmation?

## Configurable without blocking documentation
- Reservation expiry (initial proposal 48h), reminder cadence, listing image max size/count, search page size, allowed categories, department list, graduation-year bounds, report reasons, rate-limit thresholds, log retention and backup cadence.

## Assumptions to validate
- One college and INR only; students can be both buyer and seller.
- Public marketplace data is visible only to verified members; administrator access is explicitly scoped.
- Reservation starts only on accepted offer; listing price is not itself an automatic sale.
- No third-party delivery or mandatory payment integration.
- Seller can only accept buyer offer; buyer can accept seller counteroffer; each counter creates a new offer document.
