'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type ConnectionStatus = 'loading' | 'connected' | 'error' | 'unconfigured';

export default function Home() {
  const [status, setStatus] = useState<ConnectionStatus>('loading');

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!baseUrl) {
      setStatus('unconfigured');
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    async function checkConnection() {
      try {
        const response = await fetch(`${baseUrl!.replace(/\/$/, '')}/api/health`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('API unavailable');
        const data: unknown = await response.json();
        if (typeof data !== 'object' || data === null || !('status' in data) || data.status !== 'success') {
          throw new Error('Unexpected health response');
        }
        setStatus('connected');
      } catch {
        setStatus('error');
      } finally {
        clearTimeout(timeout);
      }
    }
    void checkConnection();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, []);

  const messages: Record<ConnectionStatus, string> = {
    loading: 'Checking API connection…',
    connected: 'API connection successful.',
    error: 'Cannot reach the API. Check that the backend and MongoDB are running.',
    unconfigured: 'API URL is not configured. Set NEXT_PUBLIC_API_URL.',
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <section className="w-full max-w-xl rounded-2xl bg-white p-10 shadow-sm border border-slate-200">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Welcome</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">College Marketplace</h1>
        <p className="mt-4 text-lg text-slate-600">A college-exclusive space to give second-hand essentials a new home.</p>
        <p className="mt-6 text-slate-700">Your campus marketplace is being prepared.</p>
        <p className="mt-8 text-sm text-slate-600" role="status" aria-live="polite">{messages[status]}</p>
        <nav className="mt-5 flex gap-4 text-sm text-indigo-600"><Link href="/register">Register</Link><Link href="/login">Log in</Link><Link href="/profile">Profile</Link></nav>
      </section>
    </main>
  );
}
