
import type { SortOrder } from 'mongoose';
import { Types } from 'mongoose';
import { Listing } from './model.js';
import type { ListingInput } from './validators.js';

const publicFields =
  '_id sellerId title description category pricePaise condition location status imageAssets createdAt updatedAt';

export function isListingId(id: string) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

export function createListing(
  sellerId: string,
  data: Partial<ListingInput>
) {
  return Listing.create({
    ...data,
    sellerId: new Types.ObjectId(sellerId),
    status: 'available',
    imageAssets: [],
  });
}

export async function listListings(
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  options: {
    search?: string;
    category?: string;
    sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc';
  } = {}
) {
  const conditions: Record<string, unknown> = { ...filter };

  if (options.category) {
    conditions.category = options.category;
  }

  const escapedSearch = options.search?.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  if (escapedSearch) {
    conditions.$or = [
      {
        title: {
          $regex: escapedSearch,
          $options: 'i',
        },
      },
      {
        description: {
          $regex: escapedSearch,
          $options: 'i',
        },
      },
    ];
  }

  const sort: Record<string, SortOrder> =
    options.sort === 'price_asc'
      ? { pricePaise: 1, _id: -1 }
      : options.sort === 'price_desc'
        ? { pricePaise: -1, _id: -1 }
        : options.sort === 'oldest'
          ? { createdAt: 1, _id: 1 }
          : { createdAt: -1, _id: -1 };

  const [items, total] = await Promise.all([
    Listing.find(conditions)
      .select(publicFields)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    Listing.countDocuments(conditions),
  ]);

  return {
    data: items,
    page: {
      page,
      limit,
      total,
      hasMore: page * limit < total,
    },
  };
}

export function getListing(id: string) {
  return Listing.findOne({
    _id: id,
    status: 'available',
  })
    .select(publicFields)
    .lean();
}

export function getOwnedListing(
  id: string,
  sellerId: string
) {
  return Listing.findOne({
    _id: id,
    sellerId,
  })
    .select(publicFields)
    .lean();
}

export function updateListing(
  id: string,
  sellerId: string,
  data: Partial<ListingInput>
) {
  return Listing.findOneAndUpdate(
    {
      _id: id,
      sellerId,
      status: 'available',
    },
    {
      $set: data,
    },
    {
      new: true,
      runValidators: true,
    }
  )
    .select(publicFields)
    .lean();
}

export function archiveListing(
  id: string,
  sellerId: string
) {
  return Listing.findOneAndUpdate(
    {
      _id: id,
      sellerId,
      status: 'available',
    },
    {
      $set: {
        status: 'removed',
      },
    },
    {
      new: true,
    }
  )
    .select(publicFields)
    .lean();
}
