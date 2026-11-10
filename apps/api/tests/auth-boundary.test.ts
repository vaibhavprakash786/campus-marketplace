import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createToken, hashToken, hashPassword, checkPassword } from '../src/utils/auth.js';
const app = createApp('http://localhost:3000');
describe('Stage 2 security boundary', () => {
 it('uses unpredictable opaque tokens and deterministic token hashes', () => {
  const a=createToken(), b=createToken();
  expect(a).toMatch(/^[a-f0-9]{64}$/); expect(a).not.toBe(b);
  expect(hashToken(a)).toBe(hashToken(a)); expect(hashToken(a)).not.toBe(a);
 });
 it('hashes passwords and rejects incorrect passwords', async () => {
  const hash=await hashPassword('StrongPassword1!');
  expect(hash).not.toContain('StrongPassword1!');
  expect(await checkPassword('StrongPassword1!',hash)).toBe(true);
  expect(await checkPassword('IncorrectPassword1!',hash)).toBe(false);
 });
 it('rejects unauthenticated profile access', async () => {
  const r=await request(app).get('/api/auth/me'); expect(r.status).toBe(401);
 });
 it('rejects invalid registration data before database access', async () => {
  const r=await request(app).post('/api/auth/register').set('Origin','http://localhost:3000').send({ email:'bad', password:'weak' });
  expect(r.status).toBe(400);
 });
 it('blocks cross-origin mutations' , async () => {
  const r=await request(app).post('/api/auth/register').set('Origin','https://untrusted.example').send({});
  expect(r.status).toBe(403);
 });
});
