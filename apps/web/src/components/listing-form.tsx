'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, CATEGORIES, CONDITIONS, pretty, type Listing, type ListingInput } from '../lib/api';
import { ListingImagesEditor } from './listing-images-editor';
export function ListingForm({ existing }: { existing?: Listing }) {
 const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
 const [listing, setListing] = useState(existing); const [files, setFiles] = useState<File[]>([]);
 const [form, setForm] = useState({ title: existing?.title ?? '', description: existing?.description ?? '', category: existing?.category ?? 'electronics', condition: existing?.condition ?? 'good', location: existing?.location ?? '', price: existing ? (existing.pricePaise / 100).toFixed(2) : '' });
 function update(key: keyof typeof form, value: string) { setForm(prev => ({ ...prev, [key]: value })); }
 async function submit(e: FormEvent) {
  e.preventDefault(); setError('');
  const price = Number(form.price); const paise = Math.round(price * 100);
  if (!Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(paise) || Math.abs(price * 100 - paise) > 1e-7) { setError('Enter a valid positive price with at most two decimal places.'); return; }
  if (form.title.trim().length < 3 || form.description.trim().length < 5 || form.location.trim().length < 2) { setError('Title needs 3 characters, description 5, and location 2.'); return; }
  const payload: ListingInput = { title: form.title.trim(), description: form.description.trim(), category: form.category, condition: form.condition, location: form.location.trim(), pricePaise: paise };
  setBusy(true);
  try {
   const result = await api<{data: Listing}>(existing ? `/listings/${existing._id}` : '/listings', { method: existing ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
   setListing(result.data);
   if (!existing && files.length) {
    const body = new FormData(); files.forEach(file => body.append('images', file));
    try { await api(`/listings/${result.data._id}/images`, { method: 'POST', body }); }
    catch (uploadError) { setError(`Listing created, but images were not uploaded: ${uploadError instanceof Error ? uploadError.message : 'Upload failed'}. Use the edit page to retry.`); router.replace(`/my-listings/${result.data._id}/edit`); return; }
   }
   router.push('/my-listings?success=' + (existing ? 'updated' : 'created')); router.refresh();
  } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save listing'); } finally { setBusy(false); }
 }
 return <form onSubmit={e => void submit(e)} className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-5 max-w-2xl"><div><label htmlFor="title" className="field-label">Product title</label><input id="title" required minLength={3} maxLength={120} className="field" value={form.title} onChange={e => update('title', e.target.value)} /></div><div><label htmlFor="description" className="field-label">Description</label><textarea id="description" required minLength={5} maxLength={5000} rows={5} className="field" value={form.description} onChange={e => update('description', e.target.value)} /></div><div className="grid md:grid-cols-2 gap-5"><div><label htmlFor="category" className="field-label">Category</label><select id="category" className="field" value={form.category} onChange={e => update('category', e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{pretty(c)}</option>)}</select></div><div><label htmlFor="condition" className="field-label">Condition</label><select id="condition" className="field" value={form.condition} onChange={e => update('condition', e.target.value)}>{CONDITIONS.map(c => <option key={c} value={c}>{pretty(c)}</option>)}</select></div></div><div className="grid md:grid-cols-2 gap-5"><div><label htmlFor="price" className="field-label">Price (₹)</label><input id="price" required type="number" min="0.01" step="0.01" className="field" value={form.price} onChange={e => update('price', e.target.value)} /></div><div><label htmlFor="location" className="field-label">Campus location</label><input id="location" required minLength={2} maxLength={120} className="field" value={form.location} onChange={e => update('location', e.target.value)} /></div></div><ListingImagesEditor listing={listing} onChange={setListing} onFilesChange={setFiles} />{error && <p role="alert" className="text-red-700">{error}</p>}<button className="action disabled:opacity-50" disabled={busy} type="submit">{busy ? 'Saving…' : existing ? 'Save changes' : 'Publish listing'}</button></form>;
}
