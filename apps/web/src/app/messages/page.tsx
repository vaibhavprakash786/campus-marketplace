'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Protected } from '../../components/protected';
import { ProductImage } from '../../components/product-image';
import { api } from '../../lib/api';
import type { ConversationPage } from '../../lib/messages';
export default function Page() { return <Protected><Inbox /></Protected>; }
function Inbox() {
  const [result, setResult] = useState<ConversationPage | null>(null);
  const [page, setPage] = useState(1); const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    void api<ConversationPage>(`/conversations?page=${page}`, { signal: controller.signal }).then(setResult)
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load conversations'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, reload]);
  return <main className="page-wrap max-w-4xl"><div className="page-banner flex justify-between items-center gap-3"><div><p className="section-eyebrow">Stay connected</p><h1 className="section-title mt-2">Messages</h1><p className="text-slate-500 mt-2">Every great deal starts with a conversation.</p></div><button className="action" onClick={() => setReload(v => v + 1)} disabled={loading}>Refresh</button></div>
    {loading ? <p className="mt-6" role="status">Loading conversations…</p> : error ? <p className="mt-6 text-red-700" role="alert">{error}</p> : <>
      {!result?.data.length ? <div className="mt-8"><p>No conversations yet. Contact a seller from a product page to get started.</p><Link href="/" className="text-indigo-700">Browse marketplace</Link></div> : <ul className="mt-6 space-y-3">{result.data.map(c => <li key={c._id}><Link href={`/messages/${c._id}`} className="flex gap-4 rounded-2xl bg-white border border-slate-200 p-5 hover:bg-indigo-50 hover:shadow-lg"><ProductImage url={c.listing?.thumbnail ?? undefined} alt={c.listing?.title ?? 'Unavailable listing'} className="w-16 h-16 rounded-lg object-cover shrink-0" /><div className="min-w-0 flex-1"><h2 className="font-bold truncate">{c.listing?.title ?? 'Listing unavailable'}</h2><p className="text-sm">{c.otherParticipant.name}</p><p className="truncate text-slate-600">{c.lastMessage || 'No messages yet'}</p><time className="text-xs text-slate-500" dateTime={c.lastMessageAt}>{new Date(c.lastMessageAt).toLocaleString()}</time></div></Link></li>)}</ul>}
      <div className="flex gap-4 mt-6"><button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="disabled:opacity-40">Previous</button><span>Page {page}</span><button disabled={!result?.page.hasMore} onClick={() => setPage(p => p + 1)} className="disabled:opacity-40">Next</button></div>
    </>}
  </main>;
}
