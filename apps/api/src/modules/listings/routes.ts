import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth, requireVerified } from '../../middleware/auth.middleware.js';
import { archiveListing, createListing, getListing, getOwnedListing, isListingId, listListings, updateListing } from './service.js';
import { parsePage, validateListingInput } from './validators.js';

const router = Router();
const safe = (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(handler(req, res)).catch(next); };
const invalidId = (req: Request, res: Response) => {
  if (!isListingId(req.params.listingId)) { res.status(400).json({ error: 'Invalid listing ID' }); return true; }
  return false;
};

router.use(requireAuth, requireVerified);
router.get('/', safe(async (req, res) => {
  const pagination = parsePage(req.query);
  if (pagination.error) { res.status(400).json({ error: pagination.error }); return; }
  res.json(await listListings({ status: 'available' }, pagination.page!, pagination.limit!));
}));
router.get('/my-listings', safe(async (req, res) => {
  const pagination = parsePage(req.query);
  if (pagination.error) { res.status(400).json({ error: pagination.error }); return; }
  res.json(await listListings({ sellerId: req.principal!.id }, pagination.page!, pagination.limit!));
}));
router.post('/', safe(async (req, res) => {
  const { value, error } = validateListingInput(req.body);
  if (error) { res.status(400).json({ error }); return; }
  const listing = await createListing(req.principal!.id, value!);
  res.status(201).json({ data: listing });
}));
router.get('/:listingId', safe(async (req, res) => {
  if (invalidId(req, res)) return;
  const listing = await getListing(req.params.listingId);
  if (!listing) { res.status(404).json({ error: 'Listing not found' }); return; }
  res.json({ data: listing });
}));
router.patch('/:listingId', safe(async (req, res) => {
  if (invalidId(req, res)) return;
  const { value, error } = validateListingInput(req.body, true);
  if (error) { res.status(400).json({ error }); return; }
  const owned = await getOwnedListing(req.params.listingId, req.principal!.id);
  if (!owned) { res.status(404).json({ error: 'Listing not found' }); return; }
  if (owned.status !== 'available') { res.status(409).json({ error: 'Only available listings can be edited' }); return; }
  const updated = await updateListing(req.params.listingId, req.principal!.id, value!);
  if (!updated) { res.status(409).json({ error: 'Listing is no longer available' }); return; }
  res.json({ data: updated });
}));
router.delete('/:listingId', safe(async (req, res) => {
  if (invalidId(req, res)) return;
  const owned = await getOwnedListing(req.params.listingId, req.principal!.id);
  if (!owned) { res.status(404).json({ error: 'Listing not found' }); return; }
  if (owned.status !== 'available') { res.status(409).json({ error: 'Only available listings can be archived' }); return; }
  const archived = await archiveListing(req.params.listingId, req.principal!.id);
  if (!archived) { res.status(409).json({ error: 'Listing is no longer available' }); return; }
  res.status(204).end();
}));
export const listingsRouter = router;
