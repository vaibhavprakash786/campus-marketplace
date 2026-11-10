import type { Request, Response, NextFunction } from 'express';
import { Session } from '../models/session.model.js';
import { User } from '../models/user.model.js';
import { hashToken } from '../utils/auth.js';
export type Principal = { id: string; role: 'student'|'admin'; verificationStatus: string; status: string };
declare global { namespace Express { interface Request { principal?: Principal; sessionTokenHash?: string } } }
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
 try {
  const token = req.cookies?.campus_session as string | undefined;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) { res.status(401).json({ error: 'Authentication required' }); return; }
  const tokenHash = hashToken(token);
  const session = await Session.findOne({ tokenHash, expiresAt: { $gt: new Date() } });
  if (!session) { res.status(401).json({ error: 'Session expired or invalid' }); return; }
  const user = await User.findById(session.userId);
  if (!user || user.status === 'suspended') { res.status(403).json({ error: 'Account unavailable' }); return; }
  req.principal = { id: String(user.id), role: user.role as 'student' | 'admin', verificationStatus: user.verificationStatus, status: user.status };
  req.sessionTokenHash = tokenHash;
  next();
 } catch (err) { next(err); }
}
export function requireVerified(req: Request, res: Response, next: NextFunction) {
 if (req.principal?.verificationStatus !== 'verified') { res.status(403).json({ error: 'College verification required' }); return; }
 next();
}
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
 if (req.principal?.role !== 'admin') { res.status(403).json({ error: 'Administrator permission required' }); return; }
 next();
}
