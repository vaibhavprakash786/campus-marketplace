import { Types } from 'mongoose';
import { Listing } from './model.js';
import type { ListingInput } from './validators.js';

const publicFields = '_id sellerId title description category pricePaise condition location status imageAssets createdAt updatedAt';
export function isListingId(id: string) { return /^[0-9a-fA-F]{24}$/.test(id); }
export function createListing(sellerId: string, data: Partial<ListingInput>) {
  return Listing.create({ ...data, sellerId: new Types.ObjectId(sellerId), status: 'available', imageAssets: [] });
}
export async function listListings(filter: Record<string, unknown>, page: number, limit: number) {
  const [items, total] = await Promise.all([
    Listing.find(filter).select(publicFields).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Listing.countDocuments(filter),
  ]);
  return { data: items, page: { page, limit, total, hasMore: page * limit < total } };
}
export function getListing(id: string) { return Listing.findOne({ _id: id, status: 'available' }).select(publicFields).lean(); }
export function getOwnedListing(id: string, sellerId: string) { return Listing.findOne({ _id: id, sellerId }).select(publicFields).lean(); }
export function updateListing(id: string, sellerId: string, data: Partial<ListingInput>) {
  return Listing.findOneAndUpdate({ _id: id, sellerId, status: 'available' }, { $set: data }, { new: true, runValidators: true }).select(publicFields).lean();
}
export function archiveListing(id: string, sellerId: string) {
  return Listing.findOneAndUpdate({ _id: id, sellerId, status: 'available' }, { $set: { status: 'removed' } }, { new: true }).select(publicFields).lean();
}
