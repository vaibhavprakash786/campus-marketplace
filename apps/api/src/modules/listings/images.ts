import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { fileTypeFromBuffer } from 'file-type';
import { Listing } from './model.js';
import { isListingId } from './service.js';
import { requireAuth, requireVerified } from '../../middleware/auth.middleware.js';

const router = Router({ mergeParams: true });
router.use(requireAuth, requireVerified);
const MAX_IMAGES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: MAX_IMAGES, fields: 0, parts: MAX_IMAGES } });
const safe = (handler: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => { Promise.resolve(handler(req, res)).catch(next); };

function configure() {
  const { CLOUDINARY_CLOUD_NAME: cloud_name, CLOUDINARY_API_KEY: api_key, CLOUDINARY_API_SECRET: api_secret } = process.env;
  if (!cloud_name || !api_key || !api_secret) throw new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET on the API server.');
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
}
function uploadOne(buffer: Buffer, folder: string): Promise<{ publicId: string; url: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'image', overwrite: false }, (error, result) => {
      if (error || !result) { reject(error ?? new Error('Cloudinary upload failed')); return; }
      resolve({ publicId: result.public_id, url: result.secure_url });
    });
    stream.end(buffer);
  });
}
async function cleanup(publicIds: string[]) {
  const failures: string[] = [];
  for (const id of publicIds) {
    try { await cloudinary.uploader.destroy(id, { resource_type: 'image' }); }
    catch { failures.push(id); }
  }
  if (failures.length) console.error('Cloudinary cleanup requires retry for asset IDs:', failures);
}
function validListingId(req: Request, res: Response) {
  if (!isListingId(req.params.listingId)) { res.status(400).json({ error: 'Invalid listing ID' }); return false; }
  return true;
}
async function owned(req: Request) {
  return Listing.findOne({ _id: req.params.listingId, sellerId: req.principal!.id, status: 'available' });
}
router.post('/', (req, res, next) => {
  upload.array('images', MAX_IMAGES)(req, res, (error: unknown) => {
    if (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid image upload' }); return; }
    next();
  });
}, safe(async (req, res) => {
  if (!validListingId(req, res)) return;
  const listing = await owned(req);
  if (!listing) { res.status(404).json({ error: 'Available listing not found or not owned by you' }); return; }
  const files = (req.files ?? []) as Express.Multer.File[];
  if (!files.length) { res.status(400).json({ error: 'Select at least one image' }); return; }
  if (listing.imageAssets.length + files.length > MAX_IMAGES) { res.status(400).json({ error: 'Maximum five images per listing' }); return; }
  for (const file of files) {
    if (!file.size || file.size > MAX_BYTES || !allowed.has(file.mimetype)) { res.status(400).json({ error: 'Only nonempty JPEG, PNG or WebP images up to 5 MB are allowed' }); return; }
    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || detected.mime !== file.mimetype || !allowed.has(detected.mime)) { res.status(400).json({ error: 'Image content does not match a supported format' }); return; }
  }
  try { configure(); } catch (error) { res.status(503).json({ error: (error as Error).message }); return; }
  const created: { publicId: string; url: string }[] = [];
  try {
    for (const file of files) created.push(await uploadOne(file.buffer, `college-marketplace/listings/${listing.id}`));
    // Compare the previous image count atomically: concurrent uploads cannot exceed the limit.
    const updated = await Listing.findOneAndUpdate({ _id: listing.id, sellerId: req.principal!.id, status: 'available', $expr: { $lte: [{ $size: '$imageAssets' }, MAX_IMAGES - created.length] } }, { $push: { imageAssets: { $each: created } } }, { new: true, runValidators: true });
    if (!updated) { await cleanup(created.map(i => i.publicId)); res.status(409).json({ error: 'Listing changed during upload. Retry after refreshing.' }); return; }
    res.status(201).json({ data: updated });
  } catch (error) {
    await cleanup(created.map(i => i.publicId));
    console.error('Image upload failed:', error);
    res.status(502).json({ error: 'Image upload failed; successfully uploaded images were queued for cleanup if necessary.' });
  }
}));
router.delete('/:imageId', safe(async (req, res) => {
  if (!validListingId(req, res)) return;
  const listing = await owned(req);
  if (!listing) { res.status(404).json({ error: 'Listing not found' }); return; }
  const image = listing.imageAssets.find(asset => String(asset._id) === req.params.imageId);
  if (!image) { res.status(404).json({ error: 'Image not found' }); return; }
  try { configure(); } catch (error) { res.status(503).json({ error: (error as Error).message }); return; }
  // Remove metadata first. A failed Cloudinary deletion is reported and remains retryable by administrators.
  const updated = await Listing.findOneAndUpdate({ _id: listing.id, sellerId: req.principal!.id, status: 'available', 'imageAssets._id': image._id }, { $pull: { imageAssets: { _id: image._id } } }, { new: true });
  if (!updated) { res.status(409).json({ error: 'Image changed; refresh and retry' }); return; }
  try {
    const result = await cloudinary.uploader.destroy(image.publicId, { resource_type: 'image' });
    if (result.result !== 'ok' && result.result !== 'not found') throw new Error('Cloudinary did not confirm deletion');
  } catch (error) {
    console.error('Cloudinary deletion requires cleanup:', image.publicId, error);
    res.status(502).json({ error: 'Image removed from listing but Cloudinary cleanup failed; administrator retry required', data: updated }); return;
  }
  res.json({ data: updated });
}));
router.patch('/:imageId/primary', safe(async (req, res) => {
  if (!validListingId(req, res)) return;
  const listing = await owned(req);
  if (!listing) { res.status(404).json({ error: 'Listing not found' }); return; }
  const image = listing.imageAssets.find(asset => String(asset._id) === req.params.imageId);
  if (!image) { res.status(404).json({ error: 'Image not found' }); return; }
  const reordered = [image, ...listing.imageAssets.filter(asset => String(asset._id) !== req.params.imageId)];
  const updated = await Listing.findOneAndUpdate({ _id: listing.id, sellerId: req.principal!.id, status: 'available', __v: listing.__v }, { $set: { imageAssets: reordered }, $inc: { __v: 1 } }, { new: true, runValidators: true });
  if (!updated) { res.status(409).json({ error: 'Images changed; refresh and retry' }); return; }
  res.json({ data: updated });
}));
export const listingImagesRouter = router;
