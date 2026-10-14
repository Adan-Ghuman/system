import mongoose, { Model, Schema, Query, Types } from 'mongoose';
import { currentBusinessId, businessObjectId, businessContext } from './context.js';
import { ForbiddenError } from '../utils/errors.js';

export function businessModel<T>(name: string, schema: Schema<T>): Model<T> {
  const legacy = mongoose.model<T>(name, schema);
  const scopedSchema = schema.clone();
  const indexes = scopedSchema.indexes();
  scopedSchema.clearIndexes();
  scopedSchema.eachPath((_path, type) => { type.options.unique = false; type.options.index = false; type.index(false); });
  scopedSchema.add({ businessId: { type: Schema.Types.ObjectId, required: true, index: true }, businessName: { type: String, default: () => businessContext.getStore()?.name || '' }, postingVersion: { type: Number, default: 0 }, poNo: { type: String, default: '' }, externalReference: { type: String, default: '' } } as never);
  if (name === 'FabricInventory') scopedSchema.add({ ownerKey: { type: String, default: 'OWN' } } as never);
  scopedSchema.add({ reversedAt: Date } as never);
  scopedSchema.pre('save', function() { if (this.isModified('status') && this.get('status') === 'REVERSED' && !this.get('reversedAt')) this.set('reversedAt', new Date()); });
  for (const [fields, options] of indexes) scopedSchema.index({ businessId: 1, ...fields, ...(name === 'FabricInventory' && options.unique ? { ownerKey: 1 } : {}) }, options);
  for (const hook of ['find', 'findOne', 'findOneAndUpdate', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'countDocuments', 'distinct'] as const) {
    scopedSchema.pre(hook, function(this: Query<unknown, unknown>) {
      const businessId = businessObjectId();
      if (!businessId) throw new ForbiddenError('Choose a business first.');
      this.setQuery({ $and: [this.getFilter(), { businessId }] });
      const update = this.getUpdate();
      if (update && !Array.isArray(update)) {
        const requested = (update.$set as Record<string, unknown> | undefined)?.businessId || (update as Record<string, unknown>).businessId;
        if (requested && String(requested) !== String(businessId)) throw new ForbiddenError('The business cannot be changed.');
      }
    });
  }
  scopedSchema.pre('aggregate', function() {
    const businessId = businessObjectId();
    if (!businessId) throw new ForbiddenError('Choose a business first.');
    this.pipeline().unshift({ $match: { businessId } });
    for (const stage of this.pipeline()) if ('$lookup' in stage && stage.$lookup.from === 'parties') stage.$lookup.from = 'partyaccounts';
  });
  scopedSchema.pre('validate', function() {
    const businessId = businessObjectId();
    if (!businessId) throw new ForbiddenError('Choose a business first.');
    const existing = this.get('businessId');
    if (existing && String(existing) !== String(businessId)) throw new ForbiddenError('This record belongs to another business.');
    this.set('businessId', businessId);
  });
  scopedSchema.pre('insertMany', function(next, docs: Array<Record<string, unknown>>) {
    const businessId = businessObjectId();
    if (!businessId) return next(new ForbiddenError('Choose a business first.'));
    for (const doc of docs) {
      if (doc.businessId && String(doc.businessId) !== String(businessId)) return next(new ForbiddenError('This record belongs to another business.'));
      doc.businessId = businessId;
    }
    next();
  });
  if (name === 'Party') {
    const Contact = mongoose.models.PartyContact || mongoose.model('PartyContact', new Schema({ name: String, phone: String }, { timestamps: true }));
    scopedSchema.add({ contactId: { type: Schema.Types.ObjectId, ref: 'PartyContact' } } as never);
    scopedSchema.pre('save', async function() {
      if (!this.isNew || this.get('contactId')) return;
      const contactId = new Types.ObjectId();
      const session = this.$session();
      await Contact.create([{ _id: contactId, name: this.get('name'), phone: this.get('phone') }], session ? { session } : {});
      this.set('contactId', contactId);
    });
  }
  const scoped = mongoose.model<T>(name === 'Party' ? 'PartyAccount' : `Business${name}`, scopedSchema, name === 'Party' ? 'partyaccounts' : `business_${legacy.collection.name}`);
  return new Proxy(legacy, {
    get(_target, property) { const target = currentBusinessId() ? scoped : legacy; const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value; },
    construct(_target, argumentsList) { return Reflect.construct(currentBusinessId() ? scoped : legacy, argumentsList); }
  });
}
