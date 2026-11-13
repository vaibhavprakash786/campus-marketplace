'use client';
import { useEffect, useState } from 'react';
import { api, type Listing } from '../lib/api';
import { ProductImage } from './product-image';
const MAX = 5;
export function ListingImagesEditor({ listing, onChange, onFilesChange }: { listing?: Listing; onChange?: (listing: Listing) => void; onFilesChange?: (files: File[]) => void }) {
 const [files, setFiles] = useState<File[]>([]); const [previews, setPreviews] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(''); const [error, setError] = useState('');
 const images = listing?.imageAssets ?? [];
 useEffect(() => { const urls = files.map(file => URL.createObjectURL(file)); setPreviews(urls); return () => urls.forEach(url => URL.revokeObjectURL(url)); }, [files]);
 function select(selected: FileList | null) {
  if (!selected) return;
  const incoming = Array.from(selected); const next = [...files, ...incoming];
  if (next.length + images.length > MAX) { setError('Maximum five images per listing'); return; }
  if (incoming.some(file => !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024)) { setError('Choose nonempty JPEG, PNG or WebP files up to 5 MB'); return; }
  setError(''); setFiles(next); onFilesChange?.(next);
 }
 function removeSelected(i: number) { const next = files.filter((_, j) => i !== j); setFiles(next); onFilesChange?.(next); }
 async function upload() {
  if (!listing || !files.length) return;
  setBusy(true); setError(''); setProgress('Uploading images…');
  const body = new FormData(); files.forEach(file => body.append('images', file));
  try { const result = await api<{data: Listing}>(`/listings/${listing._id}/images`, { method: 'POST', body }); onChange?.(result.data); setFiles([]); onFilesChange?.([]); setProgress('Images uploaded successfully'); }
  catch (e) { setError(e instanceof Error ? e.message : 'Upload failed'); setProgress(''); }
  finally { setBusy(false); }
 }
 async function action(imageId: string, operation: 'DELETE' | 'PATCH') {
  if (!listing) return;
  setBusy(true); setError('');
  try { const result = await api<{data: Listing}>(`/listings/${listing._id}/images/${imageId}${operation === 'PATCH' ? '/primary' : ''}`, { method: operation }); onChange?.(result.data); }
  catch (e) { setError(e instanceof Error ? e.message : 'Image operation failed'); }
  finally { setBusy(false); }
 }
 return <section className="space-y-3"><label htmlFor="listing-images" className="field-label">Product images ({images.length + files.length}/{MAX})</label><input id="listing-images" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || images.length + files.length >= MAX} onChange={e => { select(e.target.files); e.target.value = ''; }} className="block w-full text-sm" /><p className="text-sm text-slate-500">Up to 5 images, 5 MB each. JPEG, PNG or WebP. First image is primary.</p><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{images.map((image, i) => <div key={image._id} className="space-y-1"><ProductImage url={image.url} alt={`Existing image ${i + 1}`} className="h-28 w-full object-cover rounded-lg" /><p className="text-xs">{i === 0 ? 'Primary image' : `Image ${i + 1}`}</p><button type="button" disabled={busy} className="text-indigo-700 text-sm underline" onClick={() => void action(image._id, 'PATCH')}>Set primary</button>{' · '}<button type="button" disabled={busy} className="text-red-700 text-sm underline" onClick={() => void action(image._id, 'DELETE')}>Remove</button></div>)}{previews.map((url, i) => <div key={url}><ProductImage url={url} alt={`Selected image ${i + 1}`} className="h-28 w-full object-cover rounded-lg" /><button type="button" disabled={busy} className="text-red-700 text-sm underline" onClick={() => removeSelected(i)}>Remove selection</button></div>)}</div>{listing && files.length > 0 && <button type="button" className="action" disabled={busy} onClick={() => void upload()}>{busy ? 'Uploading…' : `Upload ${files.length} image(s)`}</button>}{progress && <p role="status" className="text-sm">{progress}</p>}{error && <p role="alert" className="text-red-700 text-sm">{error}</p>}</section>;
}
