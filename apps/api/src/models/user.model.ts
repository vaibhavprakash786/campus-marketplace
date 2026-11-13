import mongoose, { Schema } from 'mongoose';
const userSchema = new Schema({
 email: { type: String, required: true, unique: true, lowercase: true, trim: true },
 passwordHash: { type: String, required: true, select: false },
 name: { type: String, required: true, trim: true, maxlength: 100 },
 department: { type: String, required: true, trim: true, maxlength: 100 },
 graduationYear: { type: Number, required: true, min: 2000, max: 2200 },
 role: { type: String, enum: ['student','admin'], default: 'student' },
 verificationStatus: { type: String, enum: ['unverified','pending','verified','rejected'], default: 'unverified' },
 status: { type: String, enum: ['active','suspended'], default: 'active' },
 verificationMethod: { type: String, enum: ['college_email','manual_review','sso'] },
 verifiedAt: Date,
 profilePicture: {
  url: { type: String, default: null },
  publicId: { type: String, default: null },
 },
}, { timestamps: true });
export const User = mongoose.model('User', userSchema);
