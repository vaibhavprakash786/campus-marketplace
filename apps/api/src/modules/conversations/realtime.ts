import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { Session } from '../../models/session.model.js';
import { User } from '../../models/user.model.js';
import { hashToken } from '../../utils/auth.js';
import { getConversation, sendMessage } from './service.js';
import { Message } from './model.js';
import { markRead, validId } from './offers.js';

let io: Server | undefined;
const room = (id: string) => `conversation:${id}`;
const userRoom = (uid: string) => `user:${uid}`;
export function publishConversation(id: string, event: string, data: unknown) { io?.to(room(id)).emit(event, data); }
export function publishUser(userId: string, event: string, data: unknown) { io?.to(userRoom(userId)).emit(event, data); }
export function attachRealtime(server: HttpServer, origin: string) {
  io = new Server(server, { cors: { origin, credentials: true }, maxHttpBufferSize: 20_000 });
  io.use(async (socket, next) => {
    try {
      if (socket.handshake.headers.origin !== origin) return next(new Error('Invalid origin'));
      const token = (socket.handshake.headers.cookie ?? '').split(';').map(c => c.trim()).find(c => c.startsWith('campus_session='))?.slice('campus_session='.length);
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return next(new Error('Authentication required'));
      const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
      if (!session) return next(new Error('Invalid session'));
      const user = await User.findById(session.userId);
      if (!user || user.status !== 'active' || user.verificationStatus !== 'verified') return next(new Error('Verified account required'));
      socket.data.userId = String(user._id);
      next();
    } catch { next(new Error('Authentication failed')); }
  });
  io.on('connection', socket => {
    const userId = socket.data.userId as string;
    void socket.join(userRoom(userId));
    const joined = new Set<string>();
    const lastTyping = new Map<string, ReturnType<typeof setTimeout>>();
    const fail = (e: unknown) => socket.emit('message:error', { error: e instanceof Error ? e.message : 'Request failed' });
    const authorized = async (id: unknown) => {
      if (!validId(id)) throw new Error('Invalid conversation');
      const user = await User.findById(userId);
      if (!user || user.status !== 'active' || user.verificationStatus !== 'verified') throw new Error('Account unavailable');
      return getConversation(id, userId);
    };
    const stopTyping = (id: string) => { const t = lastTyping.get(id); if (t) clearTimeout(t); lastTyping.delete(id); socket.to(room(id)).emit('typing:update', { conversationId: id, userId, typing: false }); };
    socket.on('conversation:join', async (id: unknown, ack?: (r: unknown) => void) => {
      try { const c = await authorized(id); const cid = String(c._id); await socket.join(room(cid)); joined.add(cid); const now = new Date(); const result = await Message.updateMany({ conversationId: cid, senderId: { $ne: userId }, deliveredAt: null }, { $set: { deliveredAt: now } }); if (result.modifiedCount) publishConversation(cid, 'message:delivery:update', { conversationId: cid, deliveredAt: now }); ack?.({ ok: true }); }
      catch (e) { fail(e); ack?.({ ok: false }); }
    });
    socket.on('conversation:leave', (id: unknown) => { if (typeof id === 'string' && joined.has(id)) { stopTyping(id); socket.leave(room(id)); joined.delete(id); } });
    socket.on('message:send', async (payload: { conversationId?: string; text?: string }, ack?: (r: unknown) => void) => {
      try {
        const c = await authorized(payload?.conversationId);
        const id = String(c._id);
        if (typeof payload?.text !== 'string' || !payload.text.trim() || payload.text.length > 2000) throw new Error('Invalid message');
        const message = await sendMessage(id, userId, payload.text.trim());
        publishConversation(id, 'message:new', message);
        const recipientId = String(c.buyerId) === userId ? String(c.sellerId) : String(c.buyerId);
        publishUser(recipientId, 'notification:message', { conversationId: id, message });
        ack?.({ ok: true, data: message });
      } catch (e) { fail(e); ack?.({ ok: false }); }
    });
    for (const event of ['typing:start', 'typing:stop'] as const) socket.on(event, async (id: unknown) => {
      try {
        const c = await authorized(id);
        const cid = String(c._id);
        if (!joined.has(cid)) throw new Error('Join conversation first');
        stopTyping(cid);
        if (event === 'typing:start') {
          socket.to(room(cid)).emit('typing:update', { conversationId: cid, userId, typing: true });
          lastTyping.set(cid, setTimeout(() => stopTyping(cid), 4000));
        }
      } catch (e) { fail(e); }
    });
    socket.on('message:read', async (id: unknown) => {
      try { const c = await authorized(id); const cid = String(c._id); const result = await markRead(cid, userId); publishConversation(cid, 'message:read:update', { conversationId: cid, userId, ...result }); publishUser(userId, 'notification:read', { conversationId: cid }); }
      catch (e) { fail(e); }
    });
    socket.on('disconnect', () => { for (const id of joined) stopTyping(id); for (const timer of lastTyping.values()) clearTimeout(timer); });
  });
  return io;
}
