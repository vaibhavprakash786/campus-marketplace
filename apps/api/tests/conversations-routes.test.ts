import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
const services = vi.hoisted(() => ({ startConversation: vi.fn(), listConversations: vi.fn(), getMessages: vi.fn(), sendMessage: vi.fn() }));
vi.mock('../src/modules/conversations/service.js', async importOriginal => ({ ...await importOriginal<object>(), ...services }));
vi.mock('../src/middleware/auth.middleware.js', () => ({
  requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!req.headers['x-test-user']) { res.status(401).end(); return; }
    req.principal = { id: String(req.headers['x-test-user']), role: 'student', status: 'active', verificationStatus: String(req.headers['x-test-verified'] ?? 'verified') }; next();
  },
  requireVerified(req: Request, res: Response, next: NextFunction) { if (req.principal?.verificationStatus !== 'verified') { res.status(403).end(); return; } next(); },
}));
import { createApp } from '../src/app.js';
import { ConversationError } from '../src/modules/conversations/service.js';
const id = '507f1f77bcf86cd799439013', user = '507f1f77bcf86cd799439011';
const app = createApp('http://localhost:3000');
const call = (method: 'get' | 'post', path: string) => request(app)[method](path).set('Origin', 'http://localhost:3000').set('x-test-user', user);
beforeEach(() => { vi.resetAllMocks(); services.startConversation.mockResolvedValue({ data: { _id: id }, created: true }); services.sendMessage.mockResolvedValue({ text: 'Hello', senderId: user }); services.getMessages.mockResolvedValue({ data: [] }); services.listConversations.mockResolvedValue({ data: [] }); });
describe('Messaging HTTP validation and authorization boundary (mocked services)', () => {
  it('uses authenticated buyer and returns created/existing statuses', async () => {
    expect((await call('post', '/api/conversations').send({ listingId: id })).status).toBe(201);
    expect(services.startConversation).toHaveBeenCalledWith(user, id);
    services.startConversation.mockResolvedValueOnce({ data: { _id: id }, created: false });
    expect((await call('post', '/api/conversations').send({ listingId: id })).status).toBe(200);
  });
  it.each(['get', 'post'] as const)('requires authentication and verification for %s', async method => {
    expect((await request(app)[method]('/api/conversations').set('Origin', 'http://localhost:3000')).status).toBe(401);
    expect((await call(method, '/api/conversations').set('x-test-verified', 'unverified')).status).toBe(403);
  });
  it('requires auth and verification for message reads and sends', async () => {
    for (const method of ['get', 'post'] as const) {
      expect((await request(app)[method](`/api/conversations/${id}/messages`).set('Origin', 'http://localhost:3000')).status).toBe(401);
      expect((await call(method, `/api/conversations/${id}/messages`).set('x-test-verified', 'unverified')).status).toBe(403);
    }
  });
  it.each([{ listingId: 'bad' }, { listingId: id, buyerId: user }, {}, []])('rejects invalid conversation payload %j', async body => {
    expect((await call('post', '/api/conversations').send(body)).status).toBe(400); expect(services.startConversation).not.toHaveBeenCalled();
  });
  it.each(['', ' ', 'x'.repeat(2001), null, 42])('rejects invalid text %j', async text => {
    expect((await call('post', `/api/conversations/${id}/messages`).send({ text })).status).toBe(400); expect(services.sendMessage).not.toHaveBeenCalled();
  });
  it('rejects sender impersonation and derives sender from authentication', async () => {
    expect((await call('post', `/api/conversations/${id}/messages`).send({ text: 'hello', senderId: id })).status).toBe(400);
    expect((await call('post', `/api/conversations/${id}/messages`).send({ text: '  Hello  ' })).status).toBe(201);
    expect(services.sendMessage).toHaveBeenCalledWith(id, user, 'Hello');
  });
  it('propagates membership denials without message data', async () => {
    services.getMessages.mockRejectedValueOnce(new ConversationError(404, 'Conversation not found'));
    services.sendMessage.mockRejectedValueOnce(new ConversationError(404, 'Conversation not found'));
    expect((await call('get', `/api/conversations/${id}/messages`)).status).toBe(404);
    expect((await call('post', `/api/conversations/${id}/messages`).send({ text: 'hello' })).status).toBe(404);
  });
  it('validates pagination and identifiers', async () => {
    for (const path of ['/api/conversations?page=0', '/api/conversations?limit=51', '/api/conversations?buyerId=x', '/api/conversations/bad/messages', `/api/conversations/${id}/messages?before=bad`, `/api/conversations/${id}/messages?limit=101`]) expect((await call('get', path)).status).toBe(400);
    expect((await call('get', `/api/conversations/${id}/messages?limit=2&before=${id}`)).status).toBe(200);
    expect(services.getMessages).toHaveBeenCalledWith(id, user, 2, id);
  });
  it('blocks cross-origin writes', async () => { expect((await call('post', '/api/conversations').set('Origin', 'https://evil.example').send({ listingId: id })).status).toBe(403); });
});
