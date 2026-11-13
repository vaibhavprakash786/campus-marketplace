import { ProductImage } from './product-image';
import Link from 'next/link';
import { formatPrice, pretty, type Listing } from '../lib/api';
export function ListingCard({ listing }: { listing: Listing }) {
 return <Link href={`/marketplace/${listing._id}`} className="product-card group"><div className="product-image-wrap"><ProductImage url={listing.imageAssets?.[0]?.url} alt={listing.title} className="h-52 w-full object-cover" /><span className="product-badge">{pretty(listing.category)}</span></div><div className="p-5"><div className="flex justify-between gap-2 items-center"><span className="text-xs font-semibold text-slate-500">{pretty(listing.condition)} condition</span><span className="text-xs text-indigo-500 font-bold">View item ↗</span></div><h2 className="font-extrabold text-slate-900 mt-3 truncate group-hover:text-indigo-700">{listing.title}</h2><p className="product-price mt-2">{formatPrice(listing.pricePaise)}</p><div className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-500">⌖ &nbsp;{listing.location}</div></div></Link>;
}
