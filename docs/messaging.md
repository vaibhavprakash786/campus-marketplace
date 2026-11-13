# Stage 6 messaging

A verified active account starts a conversation from Contact seller. The API derives
buyerId from the session and sellerId from the listing. Self-contact is rejected.
Only available listings with an active verified seller accept new conversations.
Repeated starts return the same conversation; a unique index handles concurrent starts.

All four routes use existing cookie authentication, verification and origin protection.
No administrator bypass exists. Message routes query both ID and membership. An outsider
receives 404, without learning whether the ID exists. Unknown body fields are rejected;
senderId, buyerId and sellerId supplied by clients are never trusted.

| Method | Path (under /api) | Request | Result |
|---|---|---|---|
| POST | /conversations | `{ "listingId": "24-hex-id" }` | 201 new or 200 existing, `{data:{_id}}` |
| GET | /conversations | `page=1&limit=20` (limit max 50) | `{data:[ConversationSummary],page:{page,limit,hasMore}}` |
| GET | /conversations/:id/messages | `limit=30&before=message-id` (limit max 100) | `{data:[Message],conversation:ConversationSummary,page:{hasMore,nextBefore}}` |
| POST | /conversations/:id/messages | `{ "text": "Hello" }` | 201, `{data:Message}` |

ConversationSummary contains `_id`, `listing:{_id,title,thumbnail}` or null,
`otherParticipant:{_id,name}`, `canSend`, `lastMessage`, `lastMessageAt`, `createdAt`.
Message contains `_id`, `conversationId`, `senderId`, `text`, `createdAt`, `updatedAt`.
Dates are ISO strings. No email, password, verification proof or session data is exposed.
Empty conversations use their creation time for inbox ordering.

Errors follow existing `{error:string}` validation responses: 400 invalid input or
self-contact; 401 authentication required; 403 verification/account/origin rejection;
404 absent/inaccessible resource; 409 unavailable seller or read-only conversation.
Unexpected errors use the existing global 500 handler.

## History and availability
History starts with the newest bounded page, returned oldest-first. Load older messages
passes nextBefore; results are merged by ID. Messages sort by createdAt with ObjectId as a tie-breaker. The cursor ID must belong to the same conversation.
Refresh returns the newest page and resets the older-history cursor. The inbox sorts by
latest stored message time, then conversation ID. New messages render after a successful
send; opening and Refresh load current history. There are no sockets, polling, receipts,
presence, offers, reservations or payments in this stage.

Existing participants retain message history when a listing becomes sold, reserved,
removed or deleted. Unavailable listing titles/images/links are hidden. Such conversations
are read-only. Sending also requires the other participant to remain active and verified.
Availability is checked immediately before saving; there is no transaction spanning a
concurrent listing archive and message insertion. A write already in flight can complete
at that boundary. No new reservation/state machinery was introduced.

## Persistence and consistency
Messages live in a separate collection, not an unbounded embedded array. A successful
message insert is authoritative. Summary fields update conditionally so an older insert
cannot overwrite a newer summary. If only that cache update fails, the API still returns
the saved message and logs the conversation ID. Inbox/history derive latest-message data
from persisted messages, so the cache failure does not produce stale previews or false
send failures. A subsequent send updates the cache again. No replica-set requirement or
new runtime environment variables were introduced.

A lost HTTP response after a successful insert is inherently ambiguous; manually retrying
can create another message. Client-side duplicate clicks are blocked, but there is no
cross-request idempotency key. This is a known limitation, not an exactly-once guarantee.

## Running verification
Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
The lockfile now includes the existing Stage 5 dependencies.

For real persistence/security tests, set `TEST_MONGODB_URI` to a disposable local MongoDB
server and run `npm test`. The suite creates a unique `stage6_test_*` database and drops
that database afterward. Do not supply a production credential. Without that variable,
21 database integration tests explicitly SKIP; passing unit tests is not persistence proof.
No new application environment variables are required.

The browser harness uses optional developer tooling outside application dependencies:

```sh
npm install --prefix .test-tools playwright
npx --prefix .test-tools playwright install chromium
# Run the web server in a separate terminal with NEXT_PUBLIC_API_URL=http://localhost:4000
npm run dev:web
# In another terminal, use the absolute path to your installed playwright/index.mjs:
PLAYWRIGHT_MODULE=/absolute/path/.test-tools/node_modules/playwright/index.mjs node apps/web/tests/messaging-browser.mjs
```

PowerShell users set `$env:PLAYWRIGHT_MODULE` and `$env:NEXT_PUBLIC_API_URL` separately.
Optional harness variables: TEST_WEB_URL (default http://localhost:3000), CHROMIUM_PATH.
The harness mocks API responses and checks 390px and 1280px layouts, inbox/history,
sending, reload, errors, draft preservation, self-contact and navigation. It does not
prove MongoDB persistence. Separately run a two-account real-API journey: login/verify,
upload an image, create a listing, contact its seller, exchange messages, refresh both
browsers, archive the listing, confirm read-only behavior and try a third account's URL.
