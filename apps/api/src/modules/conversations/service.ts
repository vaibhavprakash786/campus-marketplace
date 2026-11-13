import { Types } from 'mongoose';
import { Conversation, Message } from './model.js';
import { Listing } from '../listings/model.js';
import { User } from '../../models/user.model.js';

export class ConversationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const membership = (userId: string) => ({ $or: [{ buyerId: userId }, { sellerId: userId }] });
export async function startConversation(userId: string, listingId: string) {
  const listing = await Listing.findOne({ _id: listingId, status: 'available' });
  if (!listing) throw new ConversationError(404, 'Available listing not found');
  if (String(listing.sellerId) === userId) throw new ConversationError(400, 'You cannot contact yourself');
  if (!await User.exists({ _id: listing.sellerId, status: 'active', verificationStatus: 'verified' })) {
    throw new ConversationError(409, 'Seller is unavailable');
  }
  const key = { buyerId: userId, listingId };
  let conversation = await Conversation.findOne(key);
  if (conversation) return { data: { _id: String(conversation._id) }, created: false };
  try {
    conversation = await Conversation.create({ ...key, sellerId: listing.sellerId });
    return { data: { _id: String(conversation._id) }, created: true };
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error;
    conversation = await Conversation.findOne(key);
    if (!conversation) throw error;
    return { data: { _id: String(conversation._id) }, created: false };
  }
}
export async function getConversation(id: string, userId: string) {
  const conversation = await Conversation.findOne({ _id: id, ...membership(userId) });
  if (!conversation) throw new ConversationError(404, 'Conversation not found');
  return conversation;
}
type ConversationRecord = Awaited<ReturnType<typeof getConversation>>;
export async function conversationSummary(conversation: ConversationRecord, userId: string) {
  const otherId = String(conversation.buyerId) === userId ? conversation.sellerId : conversation.buyerId;
  const [listing, other, latest] = await Promise.all([
    Listing.findById(conversation.listingId).select('title status imageAssets').lean(),
    User.findById(otherId).select('name status verificationStatus').lean(),
    Message.findOne({ conversationId: conversation._id }).sort({ createdAt: -1, _id: -1 }).lean(),
  ]);
  const available = listing?.status === 'available';
  return {
    _id: String(conversation._id),
    listing: available ? { _id: String(listing._id), title: listing.title, thumbnail: listing.imageAssets[0]?.url ?? null } : null,
    otherParticipant: { _id: String(otherId), name: other?.name ?? 'Unavailable account' },
    canSend: Boolean(available && other?.status === 'active' && other.verificationStatus === 'verified'),
    // Message records are authoritative if a summary cache write failed.
    lastMessage: latest?.text ?? '', lastMessageAt: latest?.createdAt ?? conversation.createdAt,
    createdAt: conversation.createdAt,
  };
}
export async function listConversations(userId: string, page: number, limit: number) {
  // Lookup before sorting keeps inbox order correct even after a failed cache update.
  const rows = await Conversation.aggregate([
    { $match: { $or: [{ buyerId: new Types.ObjectId(userId) }, { sellerId: new Types.ObjectId(userId) }] } },
    { $lookup: { from: Message.collection.name, localField: '_id', foreignField: 'conversationId', pipeline: [{ $sort: { createdAt: -1, _id: -1 } }, { $limit: 1 }], as: 'latest' } },
    { $addFields: { activityAt: { $ifNull: [{ $arrayElemAt: ['$latest.createdAt', 0] }, '$createdAt'] } } },
    { $sort: { activityAt: -1, _id: -1 } },
    { $skip: (page - 1) * limit }, { $limit: limit + 1 },
    { $project: { latest: 0, activityAt: 0 } },
  ]);
  return { data: await Promise.all(rows.slice(0, limit).map(row => conversationSummary(Conversation.hydrate(row), userId))), page: { page, limit, hasMore: rows.length > limit } };
}
export async function getMessages(id: string, userId: string, limit: number, before?: string) {
  const conversation = await getConversation(id, userId);
  let cursorFilter = {};
  if (before) {
    const cursor = await Message.findOne({ _id: before, conversationId: id }).select('createdAt').lean();
    if (!cursor) throw new ConversationError(400, 'Invalid history cursor');
    cursorFilter = { $or: [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: before } }] };
  }
  const messages = await Message.find({ conversationId: id, ...cursorFilter })
    .select('_id conversationId senderId text deliveredAt readAt createdAt updatedAt').sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();
  const hasMore = messages.length > limit;
  const data = messages.slice(0, limit).reverse();
  return { data, conversation: await conversationSummary(conversation, userId), page: { hasMore, nextBefore: hasMore ? String(data[0]._id) : null } };
}
export async function sendMessage(id: string, userId: string, text: string) {
  const conversation = await getConversation(id, userId);
  const otherId = String(conversation.buyerId) === userId ? conversation.sellerId : conversation.buyerId;
  const [listing, other] = await Promise.all([
    Listing.exists({ _id: conversation.listingId, sellerId: conversation.sellerId, status: 'available' }),
    User.exists({ _id: otherId, status: 'active', verificationStatus: 'verified' }),
  ]);
  if (!listing || !other) throw new ConversationError(409, 'This conversation is read-only because the listing or participant is unavailable');
  const message = await Message.create({ conversationId: id, senderId: userId, text });
  try {
    await Conversation.updateOne({ _id: id, $or: [{ lastMessageId: { $exists: false } }, { lastMessageAt: { $lt: message.createdAt } }, { lastMessageAt: message.createdAt, lastMessageId: { $lt: message._id } }] },
      { $set: { lastMessage: message.text, lastMessageAt: message.createdAt, lastMessageId: message._id } });
  } catch {
    // A persisted message must not become a false send failure; reads derive the summary.
    console.error('Conversation summary update failed', String(conversation._id));
  }
  return { _id: message._id, conversationId: message.conversationId, senderId: message.senderId, text: message.text, createdAt: message.createdAt, updatedAt: message.updatedAt, deliveredAt: message.deliveredAt, readAt: message.readAt };
}
export async function getUnreadCount(userId: string): Promise<number> {
  const userObjectId = new Types.ObjectId(userId);
  const userConversations = await Conversation.find({
    $or: [{ buyerId: userObjectId }, { sellerId: userObjectId }]
  }).select('_id').lean();
  if (!userConversations.length) return 0;
  const conversationIds = userConversations.map(c => c._id);
  return Message.countDocuments({
    conversationId: { $in: conversationIds },
    senderId: { $ne: userObjectId },
    readAt: null
  });
}
