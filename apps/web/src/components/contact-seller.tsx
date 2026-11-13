'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type Listing } from '../lib/api';
import { useSession } from './session';
export function ContactSeller({ listing }: { listing: Listing }) {
  const { user } = useSession(); const router = useRouter();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const own = user?.id === listing.sellerId;
  async function contact() {
    setBusy(true); setError('');
    try { const result = await api<{ data: { _id: string } }>('/conversations', { method: 'POST', body: JSON.stringify({ listingId: listing._id }) }); router.push(`/messages/${result.data._id}`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not contact seller'); setBusy(false); }
  }
  return <div className="mt-8"><button className="action disabled:opacity-50" disabled={busy || own || listing.status !== 'available'} onClick={() => void contact()}>{own ? 'This is your listing' : busy ? 'Opening conversation…' : 'Contact seller'}</button>{error && <p className="mt-3 text-red-700" role="alert">{error}</p>}</div>;
}
