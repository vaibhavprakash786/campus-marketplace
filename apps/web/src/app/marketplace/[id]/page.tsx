'use client';
import { ProductGallery } from '../../../components/product-gallery';
import { ContactSeller } from '../../../components/contact-seller';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, formatPrice, pretty, type Listing } from '../../../lib/api';
import { Protected } from '../../../components/protected';
export default function Page() { return <Protected><Details /></Protected>; }
function Details() {
 const { id } = useParams<{ id: string }>(); const [listing, setListing] = useState<Listing|null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
 useEffect(() => { if (!/^[0-9a-f]{24}$/i.test(id)) { setError('Invalid listing ID'); setLoading(false); return; } const controller = new AbortController(); void api<{ data: Listing }>(`/listings/${id}`, { signal: controller.signal }).then(r => setListing(r.data)).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Listing unavailable'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [id]);
 return <main className="page-wrap"><Link className="text-indigo-700 font-semibold" href="/">← Back to marketplace</Link>{loading ? <p className="mt-8" role="status">Loading product…</p> : error ? <p role="alert" className="mt-8 text-red-700">{error}</p> : listing && <div className="grid md:grid-cols-2 gap-10 mt-8"><ProductGallery images={listing.imageAssets ?? []} title={listing.title} /><section><p className="text-indigo-700 font-bold uppercase text-sm">{pretty(listing.category)} · {pretty(listing.condition)}</p><h1 className="text-4xl font-extrabold mt-3">{listing.title}</h1><p className="text-4xl font-extrabold text-indigo-700 mt-5">{formatPrice(listing.pricePaise)}</p><p className="mt-6 text-slate-700 whitespace-pre-wrap">{listing.description}</p><dl className="mt-7 space-y-3 text-sm"><div><dt className="font-bold">Location</dt><dd>{listing.location}</dd></div><div><dt className="font-bold">Listed on</dt><dd>{new Date(listing.createdAt).toLocaleDateString('en-IN')}</dd></div><div><dt className="font-bold">Seller</dt><dd>Verified campus student</dd></div></dl><ContactSeller listing={listing} /></section></div>}</main>;
}
