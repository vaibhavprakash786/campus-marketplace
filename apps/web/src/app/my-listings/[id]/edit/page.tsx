'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, type Listing } from '../../../../lib/api';
import { useSession } from '../../../../components/session';
import { Protected } from '../../../../components/protected';
import { ListingForm } from '../../../../components/listing-form';
export default function Page() { return <Protected><Edit /></Protected>; }
function Edit() {
 const { id } = useParams<{ id: string }>(); const { user } = useSession(); const [item, setItem] = useState<Listing|null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
 useEffect(() => { if (!user) return; if (!/^[0-9a-f]{24}$/i.test(id)) { setError('Invalid listing ID'); setLoading(false); return; } const controller = new AbortController(); void api<{ data: Listing }>(`/listings/my-listings/${id}`, { signal: controller.signal }).then(r => { const own = r.data; if (own.sellerId !== user.id) throw new Error('Not your listing'); if (own.status !== 'available') throw new Error('Only available listings can be edited'); setItem(own); }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [id, user]);
 return <main className="page-wrap"><h1 className="text-3xl font-extrabold mb-7">Edit listing</h1>{loading ? <p role="status">Loading listing…</p> : error ? <p role="alert" className="text-red-700">{error}</p> : item && <ListingForm existing={item} />}</main>;
}
