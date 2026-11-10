export type ListingInput = {
  title: string; description: string; category: string; pricePaise: number;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor'; location: string;
};
const fields = ['title', 'description', 'category', 'pricePaise', 'condition', 'location'] as const;
const limits: Record<string, [number, number]> = {
  title: [3, 120], description: [5, 5000], category: [1, 60], location: [2, 120],
};
const conditions = new Set(['new', 'like_new', 'good', 'fair', 'poor']);

export function validateListingInput(body: unknown, partial = false): { value?: Partial<ListingInput>; error?: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'A JSON object is required' };
  const input = body as Record<string, unknown>;
  const keys = Object.keys(input);
  if (!partial && fields.some(field => !(field in input))) return { error: 'Missing required listing field' };
  if (keys.length === 0) return { error: 'At least one field is required' };
  if (keys.some(key => !fields.includes(key as typeof fields[number]))) return { error: 'Unknown or protected listing field' };
  const value: Record<string, unknown> = {};
  for (const key of keys) {
    const raw = input[key];
    if (key in limits) {
      const [min, max] = limits[key];
      if (typeof raw !== 'string' || raw.trim().length < min || raw.trim().length > max) return { error: `Invalid ${key}` };
      value[key] = raw.trim();
    } else if (key === 'pricePaise') {
      if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw <= 0) return { error: 'pricePaise must be a positive safe integer' };
      value[key] = raw;
    } else if (key === 'condition') {
      if (typeof raw !== 'string' || !conditions.has(raw)) return { error: 'Invalid condition' };
      value[key] = raw;
    }
  }
  return { value: value as Partial<ListingInput> };
}

export function parsePage(query: Record<string, unknown>): { page?: number; limit?: number; error?: string } {
  if (Object.keys(query).some(key => !['page', 'limit'].includes(key))) return { error: 'Unsupported query parameter' };
  const parse = (raw: unknown, fallback: number) => raw === undefined ? fallback :
    (typeof raw === 'string' && /^[1-9]\d*$/.test(raw) ? Number(raw) : NaN);
  const page = parse(query.page, 1), limit = parse(query.limit, 20);
  if (!Number.isSafeInteger(page) || page > 10000 || !Number.isSafeInteger(limit) || limit > 50) return { error: 'Invalid pagination (page 1-10000, limit 1-50)' };
  return { page, limit };
}
