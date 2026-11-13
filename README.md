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

## Stage 3 — listing backend
The Express API now provides verified-session-only listing routes: `POST /api/listings`, `GET /api/listings`, `GET /api/listings/` (same handler), `GET /api/listings/my-listings`, `GET /api/listings/:listingId`, `PATCH /api/listings/:listingId`, and `DELETE /api/listings/:listingId`. Auth uses the existing `campus_session` cookie and origin check; mutations require `Origin: http://localhost:3000` in local development. Request fields: `title`, `description`, `category`, `condition`, `pricePaise` (integer paise), `location`; patch accepts a nonempty subset. Server assigns `sellerId`, `status=available`, `imageAssets=[]`. No image references may be submitted until Stage 5.

`GET /api/listings?page=1&limit=20` returns only available listings; `GET /api/listings/my-listings` includes the seller's archived listings. Both return `{ "data": [...], "page": { "page": 1, "limit": 20, "total": 0, "hasMore": false } }`; maximum limit is 50. Single-listing reads and writes return `{ "data": { ... } }`; successful archive returns HTTP 204. Invalid input returns 400, missing/other-owned listings 404, and conflicting status changes 409. Listing reads require a verified active session; suspended/unverified accounts cannot use listing routes. Categories are currently free-form bounded strings (taxonomy not approved). No marketplace frontend or upload implementation is included.


## Stage 4 marketplace frontend
Start MongoDB, then run `npm run dev:api` and `npm run dev:web` in separate terminals. Visit `http://localhost:3000`, log in with a verified active account, and browse the marketplace. Use `/sell` to create a listing, `/my-listings` to edit or archive it, and `/marketplace/<id>` to see details. The browser uses `NEXT_PUBLIC_API_URL` for cookie-authenticated requests. Search, category, sorting and pagination use real backend queries.

**Local verification:** `npm ci`, `npm run typecheck`, `npm run test`, `npm run lint`, `npm run build`. Tests and builds must be executed locally before calling Stage 4 complete. Do not upload `.env` files or `node_modules`.

## Stage 5: Product photos (Cloudinary)
Install dependencies from the project root using `npm install` (this also updates `package-lock.json`). Configure the following **in the backend environment only** (`apps/api/.env` if that is where your existing API loads environment variables):

```dotenv
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Do not use `NEXT_PUBLIC_` prefixes for Cloudinary secrets. The API must have access to these variables in the process environment. Uploads are server-side using `multipart/form-data` with field name `images`, maximum 5 files per request, maximum 5 images per listing, and maximum 5 MB per image. Supported content signatures: JPEG, PNG, WebP. Existing empty image arrays remain valid. Images are stored in `college-marketplace/listings/<listing-id>` on Cloudinary. `imageAssets[0]` is primary.

API endpoints (require verified student session and ownership):
- `POST /api/listings/:listingId/images` (multipart field `images`)
- `DELETE /api/listings/:listingId/images/:imageId`
- `PATCH /api/listings/:listingId/images/:imageId/primary`

After installing dependencies, run `npm run typecheck`, `npm run test`, `npm run lint`, `npm run build`, then test with both `npm run dev:api` and `npm run dev:web` in separate terminals. Do not commit `.env` files. Existing listings remain supported.

**Consistency limits:** failed multi-file uploads attempt to delete earlier Cloudinary assets; failed cleanup is logged and requires operator retry. A Cloudinary deletion failure after metadata removal requires operator cleanup. Browser interruption after Cloudinary receives a file but before metadata persistence can leave an orphan. The application has no background reconciliation job yet. Concurrent image reordering and deletion should be exercised under load before production deployment.

## Stage 6 — buyer/seller messaging
Verified members can use **Contact seller**, **Messages**, and individual chat pages.
See [messaging documentation](docs/messaging.md) for API contracts, persistence,
availability rules and test commands. See [Stage 6 report](docs/stage-6-test-report.md)
for actual verification results and remaining blockers. No sockets or Stage 7 features
are included. No new application environment variables are required.
