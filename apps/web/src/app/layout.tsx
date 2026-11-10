import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'College Marketplace',
  description: 'A student-only marketplace for second-hand campus essentials.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
