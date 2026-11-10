# Campus Marketplace (planning only)

College-exclusive second-hand marketplace: verified students list used items, negotiate privately, and arrange face-to-face campus handovers. No delivery or mandatory online payment in MVP.

## Goals
- Build a deployable, tested full-stack engineering portfolio project.
- Pilot a useful marketplace at one college.

## Planned stack
Next.js + TypeScript + Tailwind; Node.js + Express + TypeScript; MongoDB + Mongoose; Socket.IO; Cloudinary; Vitest, Supertest, Playwright. Single Express API, separate Next.js frontend.

## Documentation
- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [Database design](docs/database-design.md)
- [REST API contract](docs/api-spec.yaml)
- [Implementation roadmap](docs/implementation-plan.md)
- [Decisions and blockers](docs/decisions.md)
- [Current state](docs/current-state.md)
- [Agent rules](AGENT_RULES.md)

No application code has been generated. Stage 1 requires explicit approval.

## Stage 1 — Local development

The project is an npm-workspaces monorepo with a Next.js frontend in `apps/web` and an Express API in `apps/api`. Use **Node.js 20.9+** and npm. No user accounts, listings, chat, or other marketplace functionality is implemented yet.

1. From the repository root, run `npm install` (requires access to the npm registry).
2. Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`.
3. Start MongoDB locally and configure `MONGODB_URI` in `apps/api/.env` (example: `mongodb://127.0.0.1:27017/college_marketplace`). For future multi-document transactions, the MongoDB deployment must support replica-set transactions; Stage 1 only checks connectivity.
4. In one terminal run `npm run dev:api` and in another run `npm run dev:web`.
5. Visit `http://localhost:3000`; the welcome page checks `http://localhost:4000/api/health` using `NEXT_PUBLIC_API_URL` and displays connection status.

The backend waits for MongoDB connectivity before opening its HTTP port. A missing/invalid MongoDB URI or unreachable server causes startup to fail. CORS permits only the configured `FRONTEND_ORIGIN` (default `http://localhost:3000`). If ports change, update both environment files. Do not commit real `.env` files; `.gitignore` excludes them.

### Environment variables

| Location | Variable | Purpose |
|---|---|---|
| API | `PORT` | API HTTP port (default `4000`) |
| API | `MONGODB_URI` | Required private MongoDB connection URI |
| API | `NODE_ENV` | `development`, `test`, or `production` |
| API | `FRONTEND_ORIGIN` | Optional allowed CORS origin; default `http://localhost:3000` |
| Web | `NEXT_PUBLIC_API_URL` | Public API base URL (local example `http://localhost:4000`); **never** include secrets |

### Quality commands

From the root: `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`. The API can be checked manually with `curl http://localhost:4000/api/health`. A valid response is `{"status":"success","message":"College Marketplace API is running"}`. Backend tests use Supertest and do not need a database; startup does.

**Environment limitation of the delivered scaffold:** package installation and executable validation could not be completed in the authoring environment because npm registry DNS was unavailable and required packages were not cached. Install dependencies and run the commands above before declaring Stage 1 fully verified.

## Stage 2 authentication (configuration pending)

The new `/register`, `/login`, `/verify`, and `/profile` pages use cookie-based API sessions.
Install dependencies from the repository root with `npm install` and configure `FRONTEND_ORIGIN` and `NEXT_PUBLIC_API_URL` to match the browser origins. API session cookies are HttpOnly, SameSite=Lax and Secure in production; cross-site production deployment requires a separate reviewed CSRF/cookie policy. Do not use wildcard CORS origins.

**Verification is deliberately disabled** until an institution-approved method and enrollment-eligibility rules are selected. New users remain `unverified`; no email OTPs, SSO, manual reviewer decisions, or password-reset emails are sent. Do not treat registration or login as proof of enrollment. The `/api/auth/verification` endpoint returns HTTP 503; status can be read at `/api/auth/verification/status`. No admin credentials are seeded.

## Stage 2: local college email OTP
Set `COLLEGE_EMAIL_DOMAIN=lnmiit.ac.in`, `NODE_ENV=development`, and `EMAIL_DELIVERY_MODE=console` in `apps/api/.env`. Restart the API, register a college address, log in, visit `/verify`, request a code, and read the **backend terminal** (never the browser response) for the development-only OTP. Enter the code within 10 minutes; there are five attempts and a 60-second resend cooldown. Never deploy with console mode.

For real delivery use `EMAIL_DELIVERY_MODE=resend`, `RESEND_API_KEY` and a verified `EMAIL_FROM` sender. If unconfigured, delivery fails closed (503). SMTP is a future adapter option, not implemented. Email ownership does not guarantee current enrollment. Production requires an institutional eligibility policy, secure HTTPS deployment and proper secret handling.
