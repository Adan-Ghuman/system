import { Schema, model } from 'mongoose';

const schema = new Schema({ name: { type: String, required: true }, code: { type: String, required: true, unique: true }, isActive: { type: Boolean, default: true } }, { timestamps: true });
export const Business = model('Business', schema);
