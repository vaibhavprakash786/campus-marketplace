export const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
export type User = {
  id: string;
  name: string;
  email: string;
  verificationStatus: string;
  status: string;
  department?: string;
  graduationYear?: number;
  role?: string;
  profilePicture?: { url: string; publicId: string } | null;
};
export type Listing = { _id: string; sellerId: string; title: string; description: string; category: string; pricePaise: number; condition: string; location: string; status: string; createdAt: string; imageAssets?: { _id: string; publicId: string; url: string }[] };
export type ListingInput = Pick<Listing, 'title'|'description'|'category'|'pricePaise'|'condition'|'location'>;
export type ListingPage = { data: Listing[]; page: { page: number; limit: number; total: number; hasMore: boolean } };
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) throw new ApiError('NEXT_PUBLIC_API_URL is not configured', 0);
  let response: Response;
  try { response = await fetch(`${API_BASE}/api${path}`, { credentials: 'include', cache: 'no-store', ...init, headers: { ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } }); }
  catch { throw new ApiError('Cannot reach the server. Check that the API is running.', 0); }
  if (response.status === 204) return undefined as T;
  const raw = await response.text();
  let data: unknown;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: raw || 'Invalid server response' }; }
  if (!response.ok) {
    const error = data && typeof data === 'object' && 'error' in data ? String(data.error) : 'Request failed';
    throw new ApiError(error, response.status);
  }
  return data as T;
}
export const formatPrice = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100);
export const CATEGORIES = ['electronics', 'furniture', 'books', 'stationery', 'appliances', 'others'] as const;
export const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'] as const;
export const pretty = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
