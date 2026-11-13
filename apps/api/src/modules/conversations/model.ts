import mongoose, { Schema } from 'mongoose';

export const MAX_MESSAGE_LENGTH = 2000;
const conversationSchema = new Schema({
  buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, immutable: true },
  lastMessage: { type: String, default: '', maxlength: MAX_MESSAGE_LENGTH },
  lastMessageAt: { type: Date, default: Date.now },
  lastMessageId: { type: Schema.Types.ObjectId },
}, { timestamps: true });
conversationSchema.pre('validate', function () {
  if (String(this.buyerId) === String(this.sellerId)) this.invalidate('sellerId', 'Cannot contact yourself');
});
conversationSchema.index({ buyerId: 1, listingId: 1 }, { unique: true });
conversationSchema.index({ buyerId: 1, lastMessageAt: -1, _id: -1 });
conversationSchema.index({ sellerId: 1, lastMessageAt: -1, _id: -1 });

const messageSchema = new Schema({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, immutable: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  text: { type: String, required: true, trim: true, minlength: 1, maxlength: MAX_MESSAGE_LENGTH },
  deliveredAt: { type: Date, default: null },
  readAt: { type: Date, default: null },
}, { timestamps: true });
messageSchema.index({ conversationId: 1, createdAt: -1, _id: -1 });
export const Conversation = mongoose.model('Conversation', conversationSchema);
export const Message = mongoose.model('Message', messageSchema);

export const OFFER_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'WITHDRAWN', 'EXPIRED'] as const;
const offerSchema = new Schema({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, immutable: true },
  listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, immutable: true },
  buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  offeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  amountPaise: { type: Number, required: true, min: 1 },
  status: { type: String, enum: OFFER_STATUSES, default: 'PENDING' },
  previousOfferId: { type: Schema.Types.ObjectId, ref: 'Offer', default: null },
  respondedAt: { type: Date, default: null },
}, { timestamps: true });
offerSchema.index({ conversationId: 1, createdAt: 1, _id: 1 });
offerSchema.index({ previousOfferId: 1 }, { unique: true, partialFilterExpression: { previousOfferId: { $type: 'objectId' } } });
export const Offer = mongoose.model('Offer', offerSchema);
