"use client";
import { useState } from 'react';
import Link from 'next/link';
export default function Page() {
 const [code,setCode]=useState(''); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false);
 const base=process.env.NEXT_PUBLIC_API_URL;
 async function call(path:string,body:object) {
  setBusy(true);setMessage('');
  try { if(!base) throw new Error('API URL is not configured');
   const response=await fetch(`${base}/api/auth/${path}`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const data=await response.json(); if(!response.ok) throw new Error(data.error??'Request failed');setMessage(data.message??'Success');
  } catch(e) {setMessage(e instanceof Error?e.message:'Request failed');} finally {setBusy(false);}
 }
 return <main className="page-wrap max-w-2xl"><div className="page-banner"><p className="section-eyebrow">One last step</p><h1>Verify college email</h1></div><div className="surface-panel space-y-5"><p>Sign in first, then request a six-digit code. In local development, the code appears only in the backend terminal when console delivery is enabled.</p><button className="action disabled:opacity-50" disabled={busy} onClick={()=>void call('verification',{})}>Send verification code</button><label className="block">Six-digit code<input className="field mt-2" inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value)}/></label><button className="action disabled:opacity-50" disabled={busy||!/^\d{6}$/.test(code)} onClick={()=>void call('verification/confirm-email',{code})}>Verify code</button><p role="status">{busy?'Please wait…':message}</p><Link href="/profile" className="underline text-indigo-600">View profile</Link></div></main>;
}
