import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
 userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
 codeHash: { type: String, required: true },
 expiresAt: { type: Date, required: true },
 resendAfter: { type: Date, required: true },
 attempts: { type: Number, required: true, default: 0 },
}, { timestamps: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const EmailVerification = mongoose.model('EmailVerification', schema);
