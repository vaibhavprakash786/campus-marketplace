import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';
import { Session } from '../src/models/session.model.js';
import { Listing } from '../src/modules/listings/model.js';
import { Conversation, Message } from '../src/modules/conversations/model.js';
import { hashToken } from '../src/utils/auth.js';

// Supply a dedicated disposable database; never connect to the application database.
const uri = process.env.TEST_MONGODB_URI;
const suite = uri ? describe : describe.skip;
const app = createApp('http://localhost:3000');
const ids = Array.from({ length: 4 }, () => new Types.ObjectId());
const tokens = ['a', 'b', 'c', 'd'].map(c => c.repeat(64));
let listingId: string;
const call = (method: 'get' | 'post', path: string, user = 0) => request(app)[method](path).set('Origin', 'http://localhost:3000').set('Cookie', `campus_session=${tokens[user]}`);
const start = () => call('post', '/api/conversations').send({ listingId });
async function conversation() { const r = await start(); expect(r.status).toBe(201); return r.body.data._id as string; }
suite('Stage 6 real MongoDB integration with real authentication', () => {
  beforeAll(async () => {
    await mongoose.connect(uri!, { dbName: `stage6_test_${process.pid}_${Date.now()}`, serverSelectionTimeoutMS: 5000 });
    await Promise.all([Conversation.init(), Message.init(), User.init(), Session.init(), Listing.init()]);
  });
  afterAll(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  beforeEach(async () => {
    vi.restoreAllMocks();
    await Promise.all([User.deleteMany({}), Session.deleteMany({}), Listing.deleteMany({}), Conversation.deleteMany({}), Message.deleteMany({})]);
    await User.create(ids.map((_id, i) => ({ _id, email: `student${i}@lnmiit.ac.in`, passwordHash: 'not-used', name: `Student ${i}`, department: 'CSE', graduationYear: 2028, verificationStatus: i === 3 ? 'unverified' : 'verified' })));
    await Session.create(ids.map((userId, i) => ({ userId, tokenHash: hashToken(tokens[i]), expiresAt: new Date(Date.now() + 600000) })));
    const listing = await Listing.create({ sellerId: ids[1], title: 'Calculus book', description: 'A clean textbook', category: 'books', pricePaise: 10000, condition: 'good', location: 'Campus' }); listingId = String(listing._id);
  });
  it('creates and retrieves one conversation, including concurrent starts', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, start));
    expect(results.every(r => [200, 201].includes(r.status))).toBe(true);
    expect(new Set(results.map(r => r.body.data._id)).size).toBe(1);
    expect(await Conversation.countDocuments()).toBe(1);
    expect((await start()).status).toBe(200);
  });
  it('rejects self contact', async () => { expect((await call('post', '/api/conversations', 1).send({ listingId })).status).toBe(400); });
  it('rejects unauthenticated and unverified initiation', async () => {
    expect((await request(app).post('/api/conversations').set('Origin', 'http://localhost:3000').send({ listingId })).status).toBe(401);
    expect((await call('post', '/api/conversations', 3).send({ listingId })).status).toBe(403);
  });
  it('rejects nonexistent and invalid listing IDs', async () => {
    expect((await call('post', '/api/conversations').send({ listingId: String(new Types.ObjectId()) })).status).toBe(404);
    expect((await call('post', '/api/conversations').send({ listingId: 'bad' })).status).toBe(400);
  });
  it.each(['removed', 'sold', 'reserved'])('rejects %s listings', async status => {
    await Listing.updateOne({ _id: listingId }, { status }); expect((await start()).status).toBe(404);
  });
  it('rejects unavailable sellers and suspended callers', async () => {
    await User.updateOne({ _id: ids[1] }, { status: 'suspended' }); expect((await start()).status).toBe(409);
    await User.updateOne({ _id: ids[0] }, { status: 'suspended' }); expect((await start()).status).toBe(403);
  });
  it('persists messages and updates the summary; both participants can read/send', async () => {
    const id = await conversation(); const path = `/api/conversations/${id}/messages`;
    const sent = await call('post', path).send({ text: '  Is it available?  ' }); expect(sent.status).toBe(201);
    expect(String((await Message.findById(sent.body.data._id))?.senderId)).toBe(String(ids[0]));
    expect((await Conversation.findById(id))?.lastMessage).toBe('Is it available?');
    expect((await Conversation.findById(id))?.lastMessageAt).toEqual(new Date(sent.body.data.createdAt));
    expect((await call('post', path, 1).send({ text: 'Yes' })).status).toBe(201);
    expect((await call('get', path)).body.data.map((m: { text: string }) => m.text)).toEqual(['Is it available?', 'Yes']);
    // Read again through an independent HTTP request, with records fetched from MongoDB.
    expect((await call('get', path, 1)).body.data).toHaveLength(2);
  });
  it('blocks outsiders, including a verified admin', async () => {
    const id = await conversation(); await User.updateOne({ _id: ids[2] }, { role: 'admin' });
    expect((await call('get', `/api/conversations/${id}/messages`, 2)).status).toBe(404);
    expect((await call('post', `/api/conversations/${id}/messages`, 2).send({ text: 'intruder' })).status).toBe(404);
    expect((await call('get', '/api/conversations', 2)).body.data).toEqual([]);
    expect(await Message.countDocuments()).toBe(0);
  });
  it.each(['', '   ', 'x'.repeat(2001), 42, null])('rejects invalid message %j', async text => {
    const id = await conversation(); expect((await call('post', `/api/conversations/${id}/messages`).send({ text })).status).toBe(400); expect(await Message.countDocuments()).toBe(0);
  });
  it('rejects impersonation and protected fields', async () => {
    const id = await conversation(); expect((await call('post', `/api/conversations/${id}/messages`).send({ text: 'hello', senderId: String(ids[1]) })).status).toBe(400);
    expect((await call('post', '/api/conversations').send({ listingId, buyerId: String(ids[2]) })).status).toBe(400);
  });
  it('enforces authentication, verification and CSRF on sends', async () => {
    const id = await conversation(); const path = `/api/conversations/${id}/messages`;
    expect((await request(app).post(path).set('Origin', 'http://localhost:3000').send({ text: 'hello' })).status).toBe(401);
    await User.updateOne({ _id: ids[0] }, { verificationStatus: 'unverified' });
    expect((await call('post', path).send({ text: 'hello' })).status).toBe(403);
    expect((await call('get', path)).status).toBe(403);
    expect((await call('post', path, 1).set('Origin', 'https://evil.example').send({ text: 'hello' })).status).toBe(403);
  });
  it('keeps history but hides unavailable listing metadata and rejects new messages', async () => {
    const id = await conversation(); const path = `/api/conversations/${id}/messages`; await call('post', path).send({ text: 'hello' });
    await Listing.updateOne({ _id: listingId }, { status: 'removed' });
    const r = await call('get', path); expect(r.status).toBe(200); expect(r.body.data).toHaveLength(1); expect(r.body.conversation.listing).toBeNull(); expect(r.body.conversation.canSend).toBe(false);
    expect((await call('post', path).send({ text: 'again' })).status).toBe(409);
    await Listing.deleteOne({ _id: listingId }); expect((await call('post', path).send({ text: 'again' })).status).toBe(409);
  });
  it('paginates messages without overlap in chronological order', async () => {
    const id = await conversation(); const path = `/api/conversations/${id}/messages`;
    for (const text of ['first', 'second', 'third']) await call('post', path).send({ text });
    const r = await call('get', `${path}?limit=2`); expect(r.body.data.map((m: { text: string }) => m.text)).toEqual(['second', 'third']); expect(r.body.page.hasMore).toBe(true);
    const older = await call('get', `${path}?limit=2&before=${r.body.page.nextBefore}`); expect(older.body.data[0].text).toBe('first'); expect(older.body.page.hasMore).toBe(false);
    expect((await call('get', `${path}?limit=101`)).status).toBe(400); expect((await call('get', `${path}?before=invalid`)).status).toBe(400);
    expect((await call('get', '/api/conversations/bad/messages')).status).toBe(400);
  });
  it('scopes inbox and exposes only safe profiles', async () => {
    await conversation(); const r = await call('get', '/api/conversations'); expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0].otherParticipant).toEqual({ _id: String(ids[1]), name: 'Student 1' });
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|email|tokenHash/);
    expect((await call('get', '/api/conversations?page=0')).status).toBe(400);
  });
  it('returns the saved message and correct inbox after summary cache failure', async () => {
    const id = await conversation(); vi.spyOn(Conversation, 'updateOne').mockRejectedValueOnce(new Error('simulated outage'));
    const r = await call('post', `/api/conversations/${id}/messages`).send({ text: 'Saved safely' }); expect(r.status).toBe(201);
    expect(await Message.countDocuments()).toBe(1);
    expect((await call('get', '/api/conversations')).body.data[0].lastMessage).toBe('Saved safely');
  });
});
