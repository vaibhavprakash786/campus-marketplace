import mongoose, { Schema } from 'mongoose';

export const LISTING_CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'] as const;
export const LISTING_STATUSES = ['available', 'reserved', 'sold', 'removed'] as const;

const listingSchema = new Schema({
  sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
  description: { type: String, required: true, trim: true, minlength: 5, maxlength: 5000 },
  category: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
  pricePaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  condition: { type: String, required: true, enum: LISTING_CONDITIONS },
  location: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  status: { type: String, required: true, enum: LISTING_STATUSES, default: 'available' },
  imageAssets: { type: [{ publicId: { type: String, required: true }, url: { type: String, required: true } }], default: [] },
  reservedTransactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
  removedReason: { type: String, maxlength: 500 },
}, { timestamps: true });

listingSchema.index({ status: 1, createdAt: -1, _id: -1 });
listingSchema.index({ sellerId: 1, createdAt: -1, _id: -1 });

export const Listing = mongoose.model('Listing', listingSchema);
