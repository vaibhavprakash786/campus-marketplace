# Frontend redesign (Stage 7 baseline)

Visual-only refresh of existing College Marketplace application. Updated global design tokens, navigation, hero, listing cards, search/filter surface, auth, profile, verification, sell, listings, inbox, and conversation/offer styling. Added shared footer and responsive/mobile/reduced-motion CSS.

No API, database, authentication, Socket.IO event, or negotiation business logic intentionally modified. Existing Stage 7 draft issues (including offer concurrency) remain outstanding.

Verification: All 22 TSX files parsed successfully using TypeScript syntax parser (0 syntax errors). Dependency installation and complete typecheck/test/lint/build could not be run in the isolated environment because npm offline cache lacks yocto-queue@0.1.0. Run npm install, npm run typecheck, npm run test, npm run lint, npm run build locally. Live browser visual checks remain pending.

Deployment: Back up existing C:\Projects\college-marketplace before overlaying this ZIP. Excludes .env files, .git, build outputs, and node_modules.
