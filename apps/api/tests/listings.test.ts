import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';

const seller = '507f1f77bcf86cd799439011';
const other = '507f1f77bcf86cd799439012';
const listingId = '507f1f77bcf86cd799439013';
const record = { _id: listingId, sellerId: seller, title: 'Calculus book', description: 'Clean textbook', category: 'books', pricePaise: 25000, condition: 'good', location: 'Campus', status: 'available', imageAssets: [] };
const db = vi.hoisted(() => ({ createListing: vi.fn(), listListings: vi.fn(), getListing: vi.fn(), getOwnedListing: vi.fn(), updateListing: vi.fn(), archiveListing: vi.fn() }));
vi.mock('../src/modules/listings/service.js', () => ({ ...db, isListingId: (id: string) => /^[a-f0-9]{24}$/i.test(id) }));
vi.mock('../src/middleware/auth.middleware.js', () => ({
  requireAuth: (req: Request, res: Response, next: NextFunction) => {
    const id = req.headers['x-test-user'];
    if (!id) { res.status(401).json({ error: 'Authentication required' }); return; }
    if (req.headers['x-test-status'] === 'suspended') { res.status(403).json({ error: 'Account unavailable' }); return; }
    req.principal = { id: String(id), role: 'student', status: 'active', verificationStatus: String(req.headers['x-test-verification'] || 'verified') };
    next();
  },
  requireVerified: (req: Request, res: Response, next: NextFunction) => {
    if (req.principal?.verificationStatus !== 'verified') { res.status(403).json({ error: 'College verification required' }); return; }
    next();
  },
}));
import { createApp } from '../src/app.js';
const app = createApp('http://localhost:3000');
const payload = { title: 'Calculus book', description: 'Clean textbook', category: 'books', pricePaise: 25000, condition: 'good', location: 'Campus' };
const authenticated = (method: 'get' | 'post' | 'patch' | 'delete', path: string, id = seller) => request(app)[method](path).set('x-test-user', id).set('Origin', 'http://localhost:3000');

beforeEach(() => { vi.clearAllMocks(); db.createListing.mockResolvedValue(record); db.listListings.mockResolvedValue({ data: [record], page: { page: 1, limit: 20, total: 1, hasMore: false } }); db.getListing.mockResolvedValue(record); db.getOwnedListing.mockResolvedValue(record); db.updateListing.mockResolvedValue({ ...record, title: 'Updated title' }); db.archiveListing.mockResolvedValue({ ...record, status: 'removed' }); });
describe('Stage 3 listing routes', () => {
  it('creates listing from authenticated principal, not client sellerId', async () => {
    const r = await authenticated('post', '/api/listings').send(payload);
    expect(r.status).toBe(201); expect(db.createListing).toHaveBeenCalledWith(seller, payload);
  });
  it.each([
    [{ ...payload, pricePaise: -1 }], [{ ...payload, pricePaise: 2.5 }],
    [{ ...payload, pricePaise: '100' }], [{ ...payload, title: '' }],
    [{ ...payload, category: '' }], [{ ...payload, condition: 'broken' }],
    [{ ...payload, location: '' }], [{ ...payload, sellerId: other }],
    [{ ...payload, imageAssets: [{ url: 'https://evil.test' }] }],
    [{ ...payload, status: 'sold' }],
    [{ title: 'Book' }],
  ])('rejects invalid or missing listing data: %j', async (body) => {
    const r = await authenticated('post', '/api/listings').send(body);
    expect(r.status).toBe(400); expect(db.createListing).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated creation', async () => {
    expect((await request(app).post('/api/listings').set('Origin', 'http://localhost:3000').send(payload)).status).toBe(401);
  });
  it('rejects unverified and suspended creation', async () => {
    expect((await authenticated('post', '/api/listings').set('x-test-verification', 'unverified').send(payload)).status).toBe(403);
    expect((await authenticated('post', '/api/listings').set('x-test-status', 'suspended').send(payload)).status).toBe(403);
  });
  it('retrieves active listings and supports trailing slash', async () => {
    expect((await authenticated('get', '/api/listings')).status).toBe(200);
    expect((await authenticated('get', '/api/listings/')).status).toBe(200);
    expect(db.listListings).toHaveBeenCalledWith({ status: 'available' }, 1, 20, { search: undefined, category: undefined, sort: 'newest' });
  });
  it('retrieves an individual active listing and rejects invalid/missing IDs', async () => {
    expect((await authenticated('get', `/api/listings/${listingId}`)).body.data._id).toBe(listingId);
    expect((await authenticated('get', '/api/listings/invalid')).status).toBe(400);
    db.getListing.mockResolvedValueOnce(null);
    expect((await authenticated('get', `/api/listings/${listingId}`)).status).toBe(404);
  });
  it('returns only own listings from /my-listings', async () => {
    expect((await authenticated('get', '/api/listings/my-listings')).status).toBe(200);
    expect(db.listListings).toHaveBeenCalledWith({ sellerId: seller }, 1, 20);
  });
  it('updates owned listing partially', async () => {
    expect((await authenticated('patch', `/api/listings/${listingId}`).send({ title: 'Updated title' })).status).toBe(200);
    expect(db.updateListing).toHaveBeenCalledWith(listingId, seller, { title: 'Updated title' });
  });
  it('blocks protected updates and updates by another seller', async () => {
    expect((await authenticated('patch', `/api/listings/${listingId}`).send({ sellerId: other })).status).toBe(400);
    db.getOwnedListing.mockResolvedValueOnce(null);
    expect((await authenticated('patch', `/api/listings/${listingId}`, other).send({ title: 'Stolen title' })).status).toBe(404);
    expect(db.updateListing).not.toHaveBeenCalled();
  });
  it('archives an owned available listing without hard deleting', async () => {
    expect((await authenticated('delete', `/api/listings/${listingId}`)).status).toBe(204);
    expect(db.archiveListing).toHaveBeenCalledWith(listingId, seller);
  });
  it('blocks archive by another seller and on reserved listings', async () => {
    db.getOwnedListing.mockResolvedValueOnce(null);
    expect((await authenticated('delete', `/api/listings/${listingId}`, other)).status).toBe(404);
    db.getOwnedListing.mockResolvedValueOnce({ ...record, status: 'reserved' });
    expect((await authenticated('delete', `/api/listings/${listingId}`)).status).toBe(409);
  });
  it('excludes archived listings via status filter and blocks archived detail', async () => {
    await authenticated('get', '/api/listings');
    expect(db.listListings).toHaveBeenCalledWith({ status: 'available' }, 1, 20, { search: undefined, category: undefined, sort: 'newest' });
    db.getListing.mockResolvedValueOnce(null);
    expect((await authenticated('get', `/api/listings/${listingId}`)).status).toBe(404);
  });
  it('paginates and rejects invalid or unsupported query parameters', async () => {
    expect((await authenticated('get', '/api/listings?page=2&limit=5')).status).toBe(200);
    expect(db.listListings).toHaveBeenCalledWith(
      { status: 'available' },
      2,
      5,
      {
        search: undefined,
        category: undefined,
        sort: 'newest',
      }
    );
    expect((await authenticated('get', '/api/listings?limit=100')).status).toBe(400);
    expect((await authenticated('get', '/api/listings?q=book')).status).toBe(400);
  });
});

describe('Stage 4 listing browse endpoints', () => {
  it('accepts search, category and sorting', async () => {
    const response = await authenticated('get', '/api/listings?search=calculator&category=electronics&sort=price_asc&page=2');
    expect(response.status).toBe(200);
    expect(db.listListings).toHaveBeenCalledWith({ status: 'available' }, 2, 20, { search: 'calculator', category: 'electronics', sort: 'price_asc' });
  });
  it('rejects invalid filters', async () => {
    expect((await authenticated('get', '/api/listings?sort=invalid')).status).toBe(400);
    expect((await authenticated('get', '/api/listings?category=invalid')).status).toBe(400);
  });
  it('retrieves one owned listing for editing', async () => {
    const response = await authenticated('get', `/api/listings/my-listings/${listingId}`);
    expect(response.status).toBe(200);
    expect(db.getOwnedListing).toHaveBeenCalledWith(listingId, seller);
    db.getOwnedListing.mockResolvedValueOnce(null);
    expect((await authenticated('get', `/api/listings/my-listings/${listingId}`)).status).toBe(404);
  });
});
