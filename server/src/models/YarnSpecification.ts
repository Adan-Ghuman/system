import { Schema, model, Document } from 'mongoose';

export type YarnCategory = 'Polyester' | 'Cotton' | 'Spandex' | 'Blended' | 'Viscose' | 'Other';

export interface IYarnSpecification extends Document {
  name: string;
  category: YarnCategory;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const yarnSpecificationSchema = new Schema<IYarnSpecification>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    category: {
      type: String,
      enum: ['Polyester', 'Cotton', 'Spandex', 'Blended', 'Viscose', 'Other'],
      default: 'Polyester',
      required: true,
      index: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    sortOrder: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

export const DEFAULT_YARN_SPECIFICATIONS = [
  { name: '75/72 Sim', category: 'Polyester' as YarnCategory, description: 'Standard Interlock Chamki / CDP' },
  { name: '75/36 Sim', category: 'Polyester' as YarnCategory, description: 'Fine Filament' },
  { name: '100/36 Sim', category: 'Polyester' as YarnCategory, description: 'Standard Semi Dull' },
  { name: '100/144 Micro', category: 'Polyester' as YarnCategory, description: 'Microfilament Terry Fleece' },
  { name: '150/48 Rotto', category: 'Polyester' as YarnCategory, description: 'Heavy Dull / 11 Bhary Dull' },
  { name: '150/144 Micro', category: 'Polyester' as YarnCategory, description: 'Micro Fleece Brushed' },
  { name: '30/1 Cotton', category: 'Cotton' as YarnCategory, description: 'Combed / Carded Single Jersey' },
  { name: '20/1 Cotton', category: 'Cotton' as YarnCategory, description: 'Heavy Cotton Knit' },
  { name: '40/1 Cotton', category: 'Cotton' as YarnCategory, description: 'Fine Gauge Cotton' },
  { name: '50D Spandex', category: 'Spandex' as YarnCategory, description: 'Lycra / Spandex Inlay' },
  { name: '70D Spandex', category: 'Spandex' as YarnCategory, description: 'Heavy Spandex Inlay' }
];

export const YarnSpecification = model<IYarnSpecification>('YarnSpecification', yarnSpecificationSchema);
