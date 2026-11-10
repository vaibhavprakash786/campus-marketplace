import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';

const app = createApp('http://localhost:3000');

describe('Stage 1 API', () => {
  it('returns the expected health response', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', message: 'College Marketplace API is running' });
  });
  it('returns JSON 404 for unknown routes', async () => {
    const response = await request(app).get('/api/unknown');
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });
  it('fails safely for missing MongoDB configuration', () => {
    expect(() => loadConfig({ PORT: '4000', NODE_ENV: 'test' })).toThrow(/MONGODB_URI/);
  });
});
