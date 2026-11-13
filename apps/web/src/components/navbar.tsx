'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { useSession } from './session';

export function Navbar() {
  const { user, loading, refresh, unreadCount, latestNotification, clearNotification } = useSession();
  const router = useRouter();

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
      await refresh();
      router.push('/login');
    } catch {
      window.alert('Unable to log out. Please try again.');
    }
  }

  // Auto-dismiss the popup notification after 6 seconds
  useEffect(() => {
    if (!latestNotification) return;
    const timer = setTimeout(() => {
      clearNotification();
    }, 6000);
    return () => clearTimeout(timer);
  }, [latestNotification, clearNotification]);

  const verified = user?.verificationStatus === 'verified' && user.status === 'active';

  return (
    <>
      <header className="site-header">
        <nav className="site-nav">
          <Link href="/" className="brand-logo">
            <span className="brand-icon">✦</span>
            <span>
              campus<span style={{ color: '#5147e8' }}>market</span>
              <span style={{ color: '#f5a942' }}>.</span>
            </span>
          </Link>
          <div className="nav-links">
            <Link className="nav-link" href="/">Explore</Link>
            {verified && (
              <>
                <Link className="nav-link" href="/my-listings">My listings</Link>
                <Link className="nav-link nav-messages-btn relative flex items-center gap-1.5" href="/messages">
                  <svg className="w-4 h-4 text-slate-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>Messages</span>
                  {unreadCount > 0 && (
                    <span className="nav-badge animate-pulse" title={`${unreadCount} new message${unreadCount > 1 ? 's' : ''}`}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
                <Link className="nav-cta" href="/sell">＋ Sell an item</Link>
              </>
            )}
            {user ? (
              <>
                <Link className="nav-link nav-profile-btn flex items-center gap-1.5" href="/profile" title="View profile">
                  {user.profilePicture?.url ? (
                    <img
                      src={user.profilePicture.url}
                      alt={user.name}
                      className="w-5 h-5 rounded-full object-cover border border-indigo-300 shrink-0"
                    />
                  ) : (
                    <svg className="w-4 h-4 text-slate-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                  <span>Profile</span>
                </Link>
                <button onClick={() => void logout()} className="nav-logout">Log out</button>
              </>
            ) : !loading ? (
              <>
                <Link className="nav-link" href="/login">Log in</Link>
                <Link className="nav-cta" href="/register">Join campus</Link>
              </>
            ) : (
              <span className="nav-link">Loading…</span>
            )}
          </div>
        </nav>
      </header>

      {/* Floating toast notification when a new message pops */}
      {latestNotification && (
        <div className="fixed top-16 right-5 z-50 animate-bounce duration-300 max-w-sm w-full bg-white border border-indigo-200 shadow-xl rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">New Message</p>
            <p className="text-sm font-medium text-slate-800 truncate mt-0.5">{latestNotification.text}</p>
            <div className="mt-2 flex items-center gap-3">
              <Link
                href={`/messages/${latestNotification.conversationId}`}
                onClick={clearNotification}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
              >
                Open chat →
              </Link>
            </div>
          </div>
          <button
            onClick={clearNotification}
            className="text-slate-400 hover:text-slate-600 p-1 -mr-1 -mt-1 rounded-lg"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
