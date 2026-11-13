'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Protected } from '../../../components/protected';
import { ProductImage } from '../../../components/product-image';
import { useSession } from '../../../components/session';
import { api, API_BASE, formatPrice } from '../../../lib/api';
import { io, type Socket } from 'socket.io-client';
import { mergeMessages, type ConversationSummary, type Message, type MessagePage, type Offer } from '../../../lib/messages';
export default function Page() { const { conversationId } = useParams<{ conversationId: string }>(); return <Protected><Chat key={conversationId} id={conversationId} /></Protected>; }
function Chat({ id }: { id: string }) {
  const { user } = useSession();
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]); const [before, setBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [olderBusy, setOlderBusy] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerAmount, setOfferAmount] = useState(''); const [counterFor, setCounterFor] = useState<string | null>(null);
  const [typing, setTyping] = useState(false); const socketRef = useRef<Socket | null>(null);
  const [text, setText] = useState(''); const [sending, setSending] = useState(false);
  const [error, setError] = useState(''); const [sendError, setSendError] = useState('');
  const inFlight = useRef(false); const end = useRef<HTMLDivElement>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      if (!/^[a-f0-9]{24}$/i.test(id)) throw new Error('Invalid conversation ID');
      const r = await api<MessagePage>(`/conversations/${id}/messages`, { signal });
      if (signal?.aborted) return;
      setConversation(r.conversation); setMessages(r.data); setBefore(r.page.nextBefore);
      setError('');
    } catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Could not load messages'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [id]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const refreshOffers = useCallback(async () => {
    try { const r = await api<{ data: Offer[] }>(`/conversations/${id}/offers`); setOffers(r.data); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load offers'); }
  }, [id]);
  useEffect(() => { void refreshOffers(); }, [refreshOffers]);
  useEffect(() => {
    if (!API_BASE || !user?.id || !conversation) return;
    const socket = io(API_BASE, { withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    const join = () => { socket.emit('conversation:join', id); void load(); void refreshOffers(); };
    socket.on('connect', join);
    socket.on('message:new', (m: Message) => { if (m.conversationId === id) { setMessages(old => mergeMessages(old, [m])); if (m.senderId !== user.id) socket.emit('message:read', id); } });
    socket.on('typing:update', (e: { conversationId: string; userId: string; typing: boolean }) => { if (e.conversationId === id && e.userId !== user.id) setTyping(e.typing); });
    socket.on('offer:update', () => void refreshOffers());
    socket.on('message:read:update', () => void load());
    socket.on('message:delivery:update', () => void load());
    socket.on('connect_error', () => setTyping(false));
    return () => { socket.emit('conversation:leave', id); socket.disconnect(); socketRef.current = null; };
  }, [id, user?.id, conversation?._id, load, refreshOffers]);
  useEffect(() => {
    if (!conversation || !user?.id) return;
    void api(`/conversations/${id}/read`, { method: 'POST' }).catch(() => {});
  }, [id, conversation?._id, user?.id]);
  async function submitOffer(event: FormEvent) {
    event.preventDefault();
    const amountPaise = Math.round(Number(offerAmount) * 100);
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) { setSendError('Enter a valid positive price'); return; }
    setSending(true); setSendError('');
    try {
      await api(`/conversations/${id}/offers`, { method: 'POST', body: JSON.stringify({ amountPaise, ...(counterFor ? { previousOfferId: counterFor } : {}) }) });
      setOfferAmount(''); setCounterFor(null); await refreshOffers();
    } catch (e) { setSendError(e instanceof Error ? e.message : 'Offer failed'); }
    finally { setSending(false); }
  }
  async function respond(offerId: string, action: 'ACCEPTED' | 'REJECTED') {
    try { await api(`/conversations/${id}/offers/${offerId}`, { method: 'PATCH', body: JSON.stringify({ action }) }); await refreshOffers(); }
    catch (e) { setSendError(e instanceof Error ? e.message : 'Response failed'); }
  }
  const lastMessageId = messages[messages.length - 1]?._id;
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [lastMessageId]);
  async function older() {
    if (!before || olderBusy) return; setOlderBusy(true);
    try { const r = await api<MessagePage>(`/conversations/${id}/messages?before=${before}`); setMessages(current => mergeMessages(current, r.data)); setBefore(r.page.nextBefore); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load older messages'); }
    finally { setOlderBusy(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault(); if (!text.trim() || text.length > 2000 || inFlight.current || !conversation?.canSend) return;
    inFlight.current = true; setSending(true); setSendError('');
    try {
      const r = await api<{ data: Message }>(`/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ text: text.trim() }) });
      setMessages(current => mergeMessages(current, [r.data])); setText(''); socketRef.current?.emit('typing:stop', id);
      await load();
    } catch (e) { setSendError(e instanceof Error ? e.message : 'Message could not be sent. Your draft has been kept.'); }
    finally { inFlight.current = false; setSending(false); }
  }
  return <main className="page-wrap max-w-4xl"><Link href="/messages" className="text-indigo-700">← All messages</Link>
    {loading && <p role="status" className="mt-6">Loading messages…</p>}
    {error && <div className="mt-4"><p role="alert" className="text-red-700">{error}</p><button className="text-indigo-700" onClick={() => void load()}>Retry</button></div>}
    {conversation && <><header className="surface-panel flex gap-4 items-center my-6"><ProductImage url={conversation.listing?.thumbnail ?? undefined} alt={conversation.listing?.title ?? 'Unavailable listing'} className="w-16 h-16 rounded-lg object-cover" /><div className="min-w-0 flex-1"><h1 className="text-xl font-bold break-words">{conversation.listing ? <Link href={`/marketplace/${conversation.listing._id}`}>{conversation.listing.title}</Link> : 'Listing unavailable'}</h1><p>{conversation.otherParticipant.name}</p></div><button className="text-indigo-700" onClick={() => void load()}>Refresh</button></header>
      <section aria-label="Message history" className="rounded-3xl border border-slate-200 bg-white shadow-sm p-4 sm:p-6 h-[50dvh] min-h-64 overflow-y-auto">
        {before && <button className="block mx-auto text-indigo-700 mb-4" disabled={olderBusy} onClick={() => void older()}>{olderBusy ? 'Loading…' : 'Load older messages'}</button>}
        {!messages.length && <p className="text-slate-600">No messages yet. Start the conversation.</p>}
        <ol className="space-y-3">{messages.map(message => { const own = message.senderId === user?.id; return <li key={message._id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-xl p-3 ${own ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-md' : 'bg-slate-100 text-slate-900'}`}><p className="text-xs font-semibold mb-1">{own ? 'You' : conversation.otherParticipant.name}</p><p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.text}</p><time className="text-xs opacity-80" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>{own && <span className="text-xs ml-2">{message.readAt ? 'Seen' : message.deliveredAt ? 'Delivered' : 'Sent'}</span>}</div></li>; })}</ol><div ref={end} />
      </section>
      {typing && <p role="status" className="text-sm text-indigo-700 mt-2">{conversation.otherParticipant.name} is typing…</p>}
      <section className="mt-5 surface-panel" aria-label="Price negotiation">
        <h2 className="font-bold text-lg">Price negotiation</h2>
        <ol className="space-y-3 mt-3">{offers.map(o => <li key={o._id} className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
          <p>{o.offeredBy === user?.id ? 'You offered' : `${conversation.otherParticipant.name} offered`} <strong>{formatPrice(o.amountPaise)}</strong></p>
          <p className="text-sm">{o.status}</p>
          {o.status === 'PENDING' && o.offeredBy !== user?.id && conversation.canSend && <div className="flex gap-3 mt-2"><button className="action" onClick={() => void respond(o._id, 'ACCEPTED')}>Accept</button><button className="text-red-700" onClick={() => void respond(o._id, 'REJECTED')}>Reject</button><button className="text-indigo-700" onClick={() => { setCounterFor(o._id); setOfferAmount(''); }}>Counter offer</button></div>}
        </li>)}</ol>
        {conversation.canSend && <form className="mt-3" onSubmit={e => void submitOffer(e)}><label className="block" htmlFor="offerAmount">{counterFor ? 'Counter offer (₹)' : 'Make an offer (₹)'}</label><input id="offerAmount" className="field mt-1" type="number" min="0.01" step="0.01" value={offerAmount} onChange={e => setOfferAmount(e.target.value)} required /><button className="action ml-2" disabled={sending}>{counterFor ? 'Send counteroffer' : 'Make an offer'}</button>{counterFor && <button type="button" className="ml-2" onClick={() => setCounterFor(null)}>Cancel</button>}</form>}
      </section>
      {!conversation.canSend && <p className="my-3">This conversation is read-only because the listing or participant is unavailable.</p>}
      <form onSubmit={e => void send(e)} className="mt-4 surface-panel"><label htmlFor="message" className="font-semibold">Message</label><textarea id="message" className="field mt-2 w-full" rows={3} maxLength={2000} disabled={sending || !conversation.canSend} value={text} onChange={e => { setText(e.target.value); socketRef.current?.emit(e.target.value ? 'typing:start' : 'typing:stop', id); }} placeholder="Ask about the item…" /><div className="flex justify-between items-center mt-2"><span className="text-sm text-slate-500">{text.length}/2000</span><button className="action disabled:opacity-50" disabled={sending || !text.trim() || !conversation.canSend}>{sending ? 'Sending…' : 'Send'}</button></div>{sendError && <p role="alert" className="text-red-700 mt-3">{sendError}</p>}</form>
    </>}
  </main>;
}
