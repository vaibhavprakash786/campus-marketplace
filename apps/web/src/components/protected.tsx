'use client';
import Link from 'next/link';
import { useSession } from './session';
export function Protected({ children }: { children: React.ReactNode }) {
 const { user, loading } = useSession();
 if (loading) return <p role="status" className="page-wrap">Checking your account…</p>;
 if (!user) return <section className="page-wrap"><h1 className="text-2xl font-bold">Sign in required</h1><p className="my-3">Log in to access the campus marketplace.</p><Link className="action" href="/login">Log in</Link></section>;
 if (user.verificationStatus !== 'verified') return <section className="page-wrap"><h1 className="text-2xl font-bold">Verify your college email</h1><p className="my-3">Only verified students can access listings.</p><Link className="action" href="/verify">Verify email</Link></section>;
 if (user.status !== 'active') return <p role="alert" className="page-wrap">Your account cannot access marketplace features.</p>;
 return <>{children}</>;
}
