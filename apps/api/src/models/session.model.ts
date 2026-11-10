import mongoose, { Schema } from 'mongoose';
const sessionSchema = new Schema({
 userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
 tokenHash: { type: String, required: true, unique: true },
 expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });
export const Session = mongoose.model('Session', sessionSchema);
