/** OTP delivery: local console-only development or configured Resend HTTPS API. */
export async function deliverOtp(to: string, code: string): Promise<void> {
 const mode = process.env.EMAIL_DELIVERY_MODE ?? 'disabled';
 if (mode === 'console' && process.env.NODE_ENV === 'development') {
  console.info(`[DEV ONLY] College verification OTP for ${to}: ${code}`);
  return;
 }
 if (mode === 'resend') {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error('Email delivery is not configured');
  const response = await fetch('https://api.resend.com/emails', {
   method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
   body: JSON.stringify({ from, to: [to], subject: 'College Marketplace verification code', text: `Your verification code is ${code}. It expires in 10 minutes. Do not share it.` }),
  });
  if (!response.ok) throw new Error('Email delivery failed');
  return;
 }
 throw new Error('Email delivery is not configured');
}
export function deliveryReady() {
 const mode = process.env.EMAIL_DELIVERY_MODE ?? 'disabled';
 return (mode === 'console' && process.env.NODE_ENV === 'development') || (mode === 'resend' && Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM));
}
