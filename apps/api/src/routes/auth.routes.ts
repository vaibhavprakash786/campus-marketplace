import { randomInt, timingSafeEqual } from 'node:crypto';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { fileTypeFromBuffer } from 'file-type';
import { EmailVerification } from '../models/email-verification.model.js';
import { deliverOtp, deliveryReady } from '../utils/email-delivery.js';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { User } from '../models/user.model.js';
import { Session } from '../models/session.model.js';
import { createToken, hashToken, hashPassword, checkPassword } from '../utils/auth.js';
import { requireAuth } from '../middleware/auth.middleware.js';
const router = Router();
const wrap = (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => { void fn(req, res).catch(next); };
const collegeDomain = () => (process.env.COLLEGE_EMAIL_DOMAIN ?? '').trim().toLowerCase();
const isCollegeEmail = (email: string) => Boolean(collegeDomain()) && email.endsWith(`@${collegeDomain()}`);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const publicUser = (u: {
    _id: unknown;
    email: string;
    name: string;
    department: string;
    graduationYear: number;
    role: string;
    verificationStatus: string;
    status: string;
    profilePicture?: { url?: string | null; publicId?: string | null } | null;
}) => ({
    id: String(u._id),
    email: u.email,
    name: u.name,
    department: u.department,
    graduationYear: u.graduationYear,
    role: u.role,
    verificationStatus: u.verificationStatus,
    status: u.status,
    profilePicture: u.profilePicture?.url ? { url: u.profilePicture.url, publicId: u.profilePicture.publicId ?? '' } : null
});
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
const validPassword = (p: unknown): p is string => typeof p === 'string' && p.length >= 12 && p.length <= 128 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);
router.post('/register', wrap(async (req, res) => {
    const { email, password, name, department, graduationYear } = req.body ?? {};
    if (typeof email !== 'string' || email.length > 254 || !emailPattern.test(email.trim()) || !validPassword(password) || typeof name !== 'string' || !name.trim() || name.length > 100 || typeof department !== 'string' || !department.trim() || department.length > 100 || !Number.isInteger(graduationYear) || graduationYear < 2000 || graduationYear > 2200) { res.status(400).json({ error: 'Invalid registration details or weak password' }); return; }
    const normalized = email.trim().toLowerCase();
    if (!isCollegeEmail(normalized)) { res.status(400).json({ error: 'A valid approved college email address is required' }); return; }
    if (await User.exists({ email: normalized })) { res.status(409).json({ error: 'Account already exists' }); return; }
    try {
        const user = await User.create({ email: normalized, passwordHash: await hashPassword(password), name: name.trim(), department: department.trim(), graduationYear });
        res.status(201).json({ user: publicUser(user), message: 'Account created. Sign in and request a college email verification code.' });
    } catch (err) { if (typeof err === 'object' && err !== null && 'code' in err && err.code === 11000) { res.status(409).json({ error: 'Account already exists' }); return; } throw err; }
}));
router.post('/login', wrap(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 128) { res.status(401).json({ error: 'Invalid credentials' }); return; }
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
    if (!user || !(await checkPassword(password, user.passwordHash))) { res.status(401).json({ error: 'Invalid credentials' }); return; }
    if (user.status === 'suspended') { res.status(403).json({ error: 'Account unavailable' }); return; }
    const token = createToken();
    await Session.create({ userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
    res.cookie('campus_session', token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ user: publicUser(user), message: user.verificationStatus === 'verified' ? 'Logged in' : 'Logged in with limited unverified access' });
}));
router.post('/logout', requireAuth, wrap(async (req, res) => {
    await Session.deleteOne({ tokenHash: req.sessionTokenHash });
    res.clearCookie('campus_session', cookieOptions);
    res.json({ message: 'Logged out' });
}));
router.get('/me', requireAuth, wrap(async (req, res) => {
    const user = await User.findById(req.principal!.id);
    if (!user) { res.status(401).json({ error: 'Account unavailable' }); return; }
    res.json({ user: publicUser(user) });
}));
router.patch('/me', requireAuth, wrap(async (req, res) => {
    const body = req.body ?? {};
    if (typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['name', 'department', 'graduationYear'].includes(k)) || Object.keys(body).length === 0) { res.status(400).json({ error: 'Only profile fields can be updated' }); return; }
    if (('name' in body && (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100)) || ('department' in body && (typeof body.department !== 'string' || !body.department.trim() || body.department.length > 100)) || ('graduationYear' in body && (!Number.isInteger(body.graduationYear) || body.graduationYear < 2000 || body.graduationYear > 2200))) { res.status(400).json({ error: 'Invalid profile fields' }); return; }
    const updates = { ...body }; if (updates.name) updates.name = updates.name.trim(); if (updates.department) updates.department = updates.department.trim();
    const user = await User.findByIdAndUpdate(req.principal!.id, { $set: updates }, { new: true, runValidators: true });
    if (!user) { res.status(404).json({ error: 'Account not found' }); return; }
    res.json({ user: publicUser(user) });
}));
router.post('/profile-picture', requireAuth, (req, res, next) => {
    upload.single('image')(req, res, (error: unknown) => {
        if (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid image upload' }); return; }
        next();
    });
}, wrap(async (req, res) => {
    const file = req.file;
    if (!file || !file.size) { res.status(400).json({ error: 'Select an image file' }); return; }
    if (file.size > 5 * 1024 * 1024) { res.status(400).json({ error: 'Image must be 5 MB or less' }); return; }
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(file.mimetype)) { res.status(400).json({ error: 'Only JPEG, PNG, or WebP images are allowed' }); return; }
    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !allowed.has(detected.mime)) { res.status(400).json({ error: 'Image content does not match a supported format' }); return; }

    const { CLOUDINARY_CLOUD_NAME: cloud_name, CLOUDINARY_API_KEY: api_key, CLOUDINARY_API_SECRET: api_secret } = process.env;
    if (!cloud_name || !api_key || !api_secret) {
        res.status(503).json({ error: 'Cloudinary is not configured. Set CLOUDINARY credentials on API server.' });
        return;
    }
    cloudinary.config({ cloud_name, api_key, api_secret, secure: true });

    const user = await User.findById(req.principal!.id);
    if (!user) { res.status(404).json({ error: 'Account not found' }); return; }

    const oldPublicId = (user as unknown as { profilePicture?: { publicId?: string } }).profilePicture?.publicId;

    const uploaded = await new Promise<{ public_id: string; secure_url: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: `college-marketplace/profiles/${req.principal!.id}`,
                resource_type: 'image',
                transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
            },
            (error, result) => {
                if (error || !result) { reject(error ?? new Error('Cloudinary upload failed')); return; }
                resolve(result);
            }
        );
        stream.end(file.buffer);
    });

    if (oldPublicId) {
        try {
            await cloudinary.uploader.destroy(oldPublicId, { resource_type: 'image' });
        } catch (e) {
            console.error('Failed to clean up old Cloudinary profile image:', e);
        }
    }

    const updated = await User.findByIdAndUpdate(req.principal!.id, {
        $set: { profilePicture: { url: uploaded.secure_url, publicId: uploaded.public_id } }
    }, { new: true });

    res.json({ user: publicUser(updated || user), message: 'Profile picture updated successfully' });
}));
router.delete('/profile-picture', requireAuth, wrap(async (req, res) => {
    const user = await User.findById(req.principal!.id);
    if (!user) { res.status(404).json({ error: 'Account not found' }); return; }
    const oldPublicId = (user as unknown as { profilePicture?: { publicId?: string } }).profilePicture?.publicId;
    if (oldPublicId) {
        const { CLOUDINARY_CLOUD_NAME: cloud_name, CLOUDINARY_API_KEY: api_key, CLOUDINARY_API_SECRET: api_secret } = process.env;
        if (cloud_name && api_key && api_secret) {
            cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
            try {
                await cloudinary.uploader.destroy(oldPublicId, { resource_type: 'image' });
            } catch (e) {
                console.error('Failed to destroy Cloudinary asset:', e);
            }
        }
    }
    const updated = await User.findByIdAndUpdate(req.principal!.id, {
        $set: { profilePicture: { url: null, publicId: null } }
    }, { new: true });
    res.json({ user: publicUser(updated || user), message: 'Profile picture removed' });
}));
router.get('/verification/status', requireAuth, (req, res) => res.json({ verificationStatus: req.principal!.verificationStatus, method: 'college_email', deliveryConfigured: deliveryReady() }));
router.post('/verification', requireAuth, wrap(async (req, res) => {
    if (req.principal!.verificationStatus === 'verified') { res.status(409).json({ error: 'Already verified' }); return; }
    if (!deliveryReady()) { res.status(503).json({ error: 'Email delivery is not configured' }); return; }
    const user = await User.findById(req.principal!.id);
    if (!user || !isCollegeEmail(user.email)) { res.status(403).json({ error: 'Approved college email required' }); return; }
    const existing = await EmailVerification.findOne({ userId: user.id });
    if (existing && existing.resendAfter.getTime() > Date.now()) { res.status(429).json({ error: 'Please wait before requesting another code' }); return; }
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const now = Date.now();
    // Keep a previously valid challenge until delivery succeeds. In production, do not log the code.
    await deliverOtp(user.email, code);
    await EmailVerification.findOneAndUpdate({ userId: user.id }, { $set: { codeHash: hashToken(`${user.id}:${code}`), expiresAt: new Date(now + 10 * 60 * 1000), resendAfter: new Date(now + 60 * 1000), attempts: 0 } }, { upsert: true, new: true });
    await User.updateOne({ _id: user.id, verificationStatus: { $ne: 'verified' } }, { $set: { verificationStatus: 'pending', verificationMethod: 'college_email' } });
    res.json({ message: 'If delivery succeeds, a verification code has been sent', expiresInSeconds: 600 });
}));
router.post('/verification/confirm-email', requireAuth, wrap(async (req, res) => {
    const code: unknown = req.body?.code;
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) { res.status(400).json({ error: 'Invalid verification code' }); return; }
    const challenge = await EmailVerification.findOneAndUpdate({ userId: req.principal!.id, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }, { $inc: { attempts: 1 } }, { new: true });
    if (!challenge) { res.status(400).json({ error: 'Invalid or expired verification code' }); return; }
    const expected = Buffer.from(challenge.codeHash, 'hex');
    const received = Buffer.from(hashToken(`${req.principal!.id}:${code}`), 'hex');
    if (!timingSafeEqual(expected, received)) { res.status(400).json({ error: 'Invalid or expired verification code' }); return; }
    // A conditional delete prevents concurrent requests from reusing the same challenge.
    const claimed = await EmailVerification.deleteOne({ _id: challenge.id, codeHash: challenge.codeHash });
    if (claimed.deletedCount !== 1) { res.status(409).json({ error: 'Code already used' }); return; }
    await User.updateOne({ _id: req.principal!.id, verificationStatus: { $ne: 'verified' } }, { $set: { verificationStatus: 'verified', verificationMethod: 'college_email', verifiedAt: new Date() } });
    res.json({ message: 'College email verified' });
}));
export const authRouter = router;
