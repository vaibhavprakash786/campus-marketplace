'use client';
import { useState } from 'react';
export function ProductImage({ url, alt, className = '' }: { url?: string; alt: string; className?: string }) {
 const [failed, setFailed] = useState(false);
 return url && !failed ? <img src={url} alt={alt} className={className} onError={() => setFailed(true)} /> : <div className={`${className} bg-gradient-to-br from-indigo-50 to-slate-200 flex items-center justify-center text-5xl`} role="img" aria-label="Product image unavailable">📦</div>;
}
