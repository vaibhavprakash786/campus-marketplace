import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth, requireVerified } from '../../middleware/auth.middleware.js';
import { ConversationError, startConversation, listConversations, getMessages, sendMessage, getUnreadCount, getConversation } from './service.js';
import { makeOffer, listOffers, respondOffer, markRead, validAmount } from './offers.js';
import { publishConversation, publishUser } from './realtime.js';
import { MAX_MESSAGE_LENGTH } from './model.js';

const router = Router();
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
const safe = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => {
  void fn(req, res).catch(error => { if (error instanceof ConversationError) res.status(error.status).json({ error: error.message }); else next(error); });
};
function oneField(body: unknown, field: string): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !(field in body)) throw new ConversationError(400, `Only ${field} is accepted`);
  return (body as Record<string, unknown>)[field];
}
function number(value: unknown, fallback: number, max: number) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) throw new ConversationError(400, 'Invalid pagination');
  return Number(value);
}
router.use(requireAuth, requireVerified);
router.post('/', safe(async (req, res) => {
  const listingId = oneField(req.body, 'listingId');
  if (!validId(listingId)) throw new ConversationError(400, 'Invalid listing ID');
  const result = await startConversation(req.principal!.id, listingId.toLowerCase());
  res.status(result.created ? 201 : 200).json({ data: result.data });
}));
router.get('/', safe(async (req, res) => {
  if (Object.keys(req.query).some(key => !['page', 'limit'].includes(key))) throw new ConversationError(400, 'Invalid pagination');
  res.json(await listConversations(req.principal!.id, number(req.query.page, 1, 100000), number(req.query.limit, 20, 50)));
}));
router.get('/unread-count', safe(async (req, res) => {
  const count = await getUnreadCount(req.principal!.id);
  res.json({ unreadCount: count });
}));
router.use('/:conversationId/messages', (req, res, next) => {
  if (!validId(req.params.conversationId)) { res.status(400).json({ error: 'Invalid conversation ID' }); return; }
  next();
});
router.get('/:conversationId/messages', safe(async (req, res) => {
  if (Object.keys(req.query).some(key => !['before', 'limit'].includes(key)) || (req.query.before !== undefined && !validId(req.query.before))) throw new ConversationError(400, 'Invalid pagination');
  res.json(await getMessages(req.params.conversationId, req.principal!.id, number(req.query.limit, 30, 100), req.query.before as string | undefined));
}));
router.post('/:conversationId/messages', safe(async (req, res) => {
  const text = oneField(req.body, 'text');
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_MESSAGE_LENGTH) throw new ConversationError(400, `Message must contain 1–${MAX_MESSAGE_LENGTH} characters`);
  const message = await sendMessage(req.params.conversationId, req.principal!.id, text.trim());
  publishConversation(req.params.conversationId, 'message:new', message);
  const conversation = await getConversation(req.params.conversationId, req.principal!.id);
  const recipientId = String(conversation.buyerId) === req.principal!.id ? String(conversation.sellerId) : String(conversation.buyerId);
  publishUser(recipientId, 'notification:message', { conversationId: req.params.conversationId, message });
  res.status(201).json({ data: message });
}));
router.get('/:conversationId/offers', safe(async (req, res) => {
  if (!validId(req.params.conversationId)) throw new ConversationError(400, 'Invalid conversation');
  res.json({ data: await listOffers(req.params.conversationId, req.principal!.id) });
}));
router.post('/:conversationId/offers', safe(async (req, res) => {
  const { amountPaise, previousOfferId } = req.body ?? {};
  if (!validId(req.params.conversationId) || !validAmount(amountPaise) || (previousOfferId !== undefined && !validId(previousOfferId))) throw new ConversationError(400, 'Invalid offer');
  if (Object.keys(req.body).some(k => !['amountPaise', 'previousOfferId'].includes(k))) throw new ConversationError(400, 'Invalid offer fields');
  const offer = await makeOffer(req.params.conversationId, req.principal!.id, amountPaise, previousOfferId);
  publishConversation(req.params.conversationId, 'offer:update', offer);
  res.status(201).json({ data: offer });
}));
router.patch('/:conversationId/offers/:offerId', safe(async (req, res) => {
  const { action } = req.body ?? {};
  if (!validId(req.params.conversationId) || !validId(req.params.offerId) || !['ACCEPTED', 'REJECTED'].includes(action) || Object.keys(req.body).length !== 1) throw new ConversationError(400, 'Invalid offer response');
  const offer = await respondOffer(req.params.conversationId, req.params.offerId, req.principal!.id, action);
  publishConversation(req.params.conversationId, 'offer:update', offer);
  res.json({ data: offer });
}));
router.post('/:conversationId/read', safe(async (req, res) => {
  if (!validId(req.params.conversationId)) throw new ConversationError(400, 'Invalid conversation');
  const result = await markRead(req.params.conversationId, req.principal!.id);
  publishConversation(req.params.conversationId, 'message:read:update', { conversationId: req.params.conversationId, userId: req.principal!.id, ...result });
  publishUser(req.principal!.id, 'notification:read', { conversationId: req.params.conversationId });
  res.json({ data: result });
}));
export const conversationsRouter = router;
