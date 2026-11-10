'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
const api = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
export function AuthForm({ mode }: { mode: 'register'|'login' }) {
 const [message,setMessage] = useState(''); const [busy,setBusy] = useState(false);
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); setBusy(true); setMessage('');
  const form = new FormData(event.currentTarget);
  const body: Record<string,string|number> = { email: String(form.get('email')), password: String(form.get('password')) };
  if(mode==='register') { body.name=String(form.get('name')); body.department=String(form.get('department')); body.graduationYear=Number(form.get('graduationYear')); }
  try { if(!api) throw new Error('API URL is not configured');
   const response=await fetch(`${api}/api/auth/${mode}`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify(body) });
   const data=await response.json(); if(!response.ok) throw new Error(data.error ?? 'Request failed');
   setMessage(data.message ?? 'Success'); if(mode==='login') window.location.assign('/profile');
  } catch(e) {setMessage(e instanceof Error ? e.message : 'Connection failed');} finally {setBusy(false);}
 }
 return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-8 space-y-4 shadow-sm"><h1 className="text-2xl font-bold text-slate-900">{mode==='register'?'Student registration':'Student login'}</h1>{mode==='register'&&<><input required name="name" placeholder="Full name" maxLength={100} className="w-full border p-3 rounded"/><input required name="department" placeholder="Department" maxLength={100} className="w-full border p-3 rounded"/><input required name="graduationYear" type="number" placeholder="Graduation year" className="w-full border p-3 rounded"/></>}<input required name="email" type="email" placeholder="Email" className="w-full border p-3 rounded"/><input required name="password" type="password" placeholder="Password" className="w-full border p-3 rounded"/><p className="text-xs text-slate-600">Passwords must contain at least 12 characters, upper and lowercase letters, a number and a symbol.</p><button disabled={busy} className="w-full bg-indigo-600 text-white p-3 rounded disabled:opacity-50">{busy?'Please wait…':mode==='register'?'Create account':'Log in'}</button><p role="status" className="text-sm text-slate-700">{message}</p><Link className="text-indigo-600 underline" href={mode==='register'?'/login':'/register'}>{mode==='register'?'Already registered? Log in':'Create an account'}</Link></form></main>;
}
