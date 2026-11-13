import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const base = process.env.TEST_WEB_URL || 'http://localhost:3000';
const buyer = '507f1f77bcf86cd799439011', seller = '507f1f77bcf86cd799439012', listingId = '507f1f77bcf86cd799439013', id = '507f1f77bcf86cd799439014';
const date = '2026-11-11T08:00:00.000Z';
const listing = { _id: listingId, sellerId: seller, title: 'Calculus book', description: 'A clean textbook', category: 'books', pricePaise: 10000, condition: 'good', location: 'Campus', status: 'available', createdAt: date, imageAssets: [] };
const summary = { _id: id, listing: { _id: listingId, title: listing.title, thumbnail: null }, otherParticipant: { _id: seller, name: 'Seller Student' }, canSend: true, lastMessage: 'Hello buyer', lastMessageAt: date, createdAt: date };
let checks = 0;
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport }); const page = await context.newPage();
    let messages = [{ _id: '507f1f77bcf86cd799439020', conversationId: id, senderId: seller, text: 'Hello buyer', createdAt: date, updatedAt: date }];
    let empty = false, failure = false, sendFailure = false, currentUser = buyer, starts = 0;
    const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
    await context.route('**/api/**', async route => {
      const req = route.request(), url = new URL(req.url());
      let body = {}, status = 200;
      if (req.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } }); return; }
      if (url.pathname === '/api/auth/me') body = { user: { id: currentUser, name: 'Buyer', email: 'buyer@lnmiit.ac.in', status: 'active', verificationStatus: 'verified' } };
      else if (url.pathname === `/api/listings/${listingId}`) body = { data: listing };
      else if (url.pathname === '/api/conversations' && req.method() === 'POST') { assert.deepEqual(req.postDataJSON(), { listingId }); starts++; body = { data: { _id: id } }; }
      else if (url.pathname === '/api/conversations') { body = failure ? { error: 'Inbox unavailable' } : { data: empty ? [] : [summary], page: { page: 1, limit: 20, hasMore: false } }; status = failure ? 503 : 200; }
      else if (url.pathname === `/api/conversations/${id}/messages`) {
        if (req.method() === 'POST') {
          assert.deepEqual(Object.keys(req.postDataJSON()), ['text']);
          if (sendFailure) { body = { error: 'Send failed, retry' }; status = 503; }
          else { const message = { _id: `507f1f77bcf86cd7994390${21 + messages.length}`, conversationId: id, senderId: buyer, text: req.postDataJSON().text, createdAt: date, updatedAt: date }; messages.push(message); body = { data: message }; status = 201; }
        } else body = { data: messages, conversation: summary, page: { hasMore: false, nextBefore: null } };
      } else { status = 404; body = { error: 'Unmocked endpoint' }; }
      await route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Credentials': 'true' }, body: JSON.stringify(body) });
    });
    await page.goto(`${base}/messages`); await page.getByText('Calculus book').waitFor(); checks++;
    await page.getByRole('link', { name: /Calculus book/ }).click(); await page.getByText('Hello buyer', { exact: true }).waitFor(); checks++;
    assert.equal(await page.getByRole('button', { name: 'Send', exact: true }).isDisabled(), true); checks++;
    await page.getByLabel('Message', { exact: true }).fill('Is the book available?'); await page.getByRole('button', { name: 'Send', exact: true }).click(); await page.getByText('Is the book available?', { exact: true }).waitFor(); checks++;
    await page.reload(); await page.getByText('Is the book available?', { exact: true }).waitFor(); checks++;
    sendFailure = true; await page.getByLabel('Message', { exact: true }).fill('Keep my draft'); await page.getByRole('button', { name: 'Send', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'Send failed' }).waitFor(); assert.equal(await page.getByLabel('Message', { exact: true }).inputValue(), 'Keep my draft'); checks++;
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true); checks++;
    await page.goto(`${base}/marketplace/${listingId}`); await page.getByRole('button', { name: 'Contact seller', exact: true }).click(); await page.waitForURL(`**/messages/${id}`); assert.equal(starts, 1); checks++;
    currentUser = seller; await page.goto(`${base}/marketplace/${listingId}`); assert.equal(await page.getByRole('button', { name: 'This is your listing' }).isDisabled(), true); checks++;
    currentUser = buyer; empty = true; await page.goto(`${base}/messages`); await page.getByText(/No conversations yet/).waitFor(); checks++;
    failure = true; await page.getByRole('button', { name: 'Refresh' }).click(); await page.getByRole('alert').filter({ hasText: 'Inbox unavailable' }).waitFor(); checks++;
    messages = []; await page.goto(`${base}/messages/${id}`); await page.getByText('No messages yet. Start the conversation.').waitFor(); checks++;
    assert.deepEqual(pageErrors, []); checks++;
    console.log(`PASS ${viewport.width}px: inbox, history, send, reload, errors, draft preservation, contact, self-contact, empty states, overflow, no runtime errors`);
    await context.close();
  }
  console.log(`PASS ${checks} browser assertions (controlled API fixtures; not database E2E)`);
} finally { await browser.close(); }
