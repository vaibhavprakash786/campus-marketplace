import type { Metadata } from 'next';
import { SessionProvider } from '../components/session';
import { Navbar } from '../components/navbar';
import './globals.css';
export const metadata: Metadata = { title: 'CampusMarket | College Marketplace', description: 'Buy and sell second-hand essentials on campus.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><SessionProvider><Navbar />{children}<footer className="border-t border-slate-200/70 bg-white/70"><div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap justify-between gap-3 text-sm text-slate-500"><span className="font-bold text-slate-700">✦ campusmarket.</span><span>Made for students, powered by the campus community.</span><span>Buy better · Sell smarter</span></div></footer></SessionProvider></body></html>; }
