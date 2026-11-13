import { Types } from 'mongoose';
import { Message, Offer } from './model.js';
import { ConversationError, getConversation } from './service.js';
import { Listing } from '../listings/model.js';
import { User } from '../../models/user.model.js';

export const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);
export function validAmount(amount: unknown): amount is number {
  return typeof amount === 'number' && Number.isSafeInteger(amount) && amount > 0 && amount <= 100_000_000_00;
}
export async function assertNegotiable(id: string, userId: string) {
  const c = await getConversation(id, userId);
  const [listing, other] = await Promise.all([
    Listing.exists({ _id: c.listingId, sellerId: c.sellerId, status: 'available' }),
    User.exists({ _id: String(c.buyerId) === userId ? c.sellerId : c.buyerId, status: 'active', verificationStatus: 'verified' }),
  ]);
  if (!listing || !other) throw new ConversationError(409, 'Negotiation is unavailable');
  return c;
}
export async function listOffers(id: string, userId: string) {
  await getConversation(id, userId);
  return Offer.find({ conversationId: id }).sort({ createdAt: 1, _id: 1 }).lean();
}
export async function makeOffer(id: string, userId: string, amountPaise: number, previousOfferId?: string) {
  if (!validAmount(amountPaise)) throw new ConversationError(400, 'Invalid offer amount in paise');
  const c = await assertNegotiable(id, userId);
  const identity = { conversationId: c._id, listingId: c.listingId, buyerId: c.buyerId, sellerId: c.sellerId };
  if (previousOfferId) {
    if (!validId(previousOfferId)) throw new ConversationError(400, 'Invalid previous offer');
    const previous = await Offer.findOneAndUpdate({ _id: previousOfferId, conversationId: id, status: 'PENDING', offeredBy: { $ne: new Types.ObjectId(userId) } }, { $set: { status: 'COUNTERED', respondedAt: new Date() } }, { new: false });
    if (!previous) throw new ConversationError(409, 'Offer cannot be countered');
    try {
      return await Offer.create({ ...identity, offeredBy: userId, amountPaise, previousOfferId });
    } catch (error) {
      await Offer.updateOne({ _id: previous._id, status: 'COUNTERED' }, { $set: { status: 'PENDING', respondedAt: null } });
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) throw new ConversationError(409, 'Already countered');
      throw error;
    }
  }
  if (String(c.buyerId) !== userId) throw new ConversationError(403, 'Only the buyer can initiate an offer');
  if (await Offer.exists({ conversationId: id, status: 'PENDING' })) throw new ConversationError(409, 'Respond to the pending offer first');
  return Offer.create({ ...identity, offeredBy: userId, amountPaise });
}
export async function respondOffer(id: string, offerId: string, userId: string, action: 'ACCEPTED' | 'REJECTED') {
  await assertNegotiable(id, userId);
  const offer = await Offer.findOneAndUpdate({ _id: offerId, conversationId: id, status: 'PENDING', offeredBy: { $ne: new Types.ObjectId(userId) } }, { $set: { status: action, respondedAt: new Date() } }, { new: true });
  if (!offer) throw new ConversationError(409, 'Offer not found, already resolved, or not addressed to you');
  return offer;
}
export async function markRead(id: string, userId: string) {
  await getConversation(id, userId);
  const now = new Date();
  await Message.updateMany({ conversationId: id, senderId: { $ne: new Types.ObjectId(userId) }, readAt: null }, { $set: { readAt: now, deliveredAt: now } });
  return { readAt: now };
}


