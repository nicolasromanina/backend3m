import mongoose, { Schema } from 'mongoose';
import { IService, IServiceModel } from '../interfaces/order.interface';

const serviceSchema = new Schema<IService>(
  {
    name: { type: String, required: true },
    description: String,
    category: {
      type: String,
      enum: ['flyers', 'cartes', 'affiches', 'brochures', 'autres'],
      required: true
    },
    basePrice: { type: Number, required: true },
    unit: { type: String, enum: ['unité', 'page', 'm²'], required: true },
    options: [
      {
        id: String,
        name: String,
        type: { type: String, enum: ['select', 'checkbox', 'number', 'text'] },
        options: [String],
        priceModifier: Number,
        required: Boolean
      }
    ],
    minQuantity: Number,
    maxQuantity: Number,
    isActive: { type: Boolean, default: true },
    images: [String],
    tags: [String],
    estimatedDeliveryDays: Number
  },
  { timestamps: true }
);

// Instance method
serviceSchema.methods.calculatePrice = function (quantity: number, selectedOptions: Record<string, any>): number {
  let total = this.basePrice * quantity;
  for (const option of this.options) {
    if (selectedOptions[option.id]) {
      total += option.priceModifier * quantity;
    }
  }
  return total;
};

// Static method
serviceSchema.statics.searchServices = function (query: string, category?: string) {
  const search: any = { isActive: true };
  if (query) search.name = new RegExp(query, 'i');
  if (category) search.category = category;
  return this.find(search);
};

export default mongoose.model<IService, IServiceModel>('Service', serviceSchema);
