import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const createToken = () => randomBytes(32).toString('hex');
export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const checkPassword = (password: string, hash: string) => bcrypt.compare(password, hash);
