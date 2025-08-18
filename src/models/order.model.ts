import mongoose, { Schema } from 'mongoose';
import { IOrder, IOrderItem, IAddress, IOrderModel } from '../interfaces/order.interface';

const addressSchema = new Schema<IAddress>(
  {
    name: { type: String, required: [true, 'Le nom est requis'], trim: true },
    company: { type: String, trim: true },
    street: { type: String, required: [true, 'La rue est requise'], trim: true },
    city: { type: String, required: [true, 'La ville est requise'], trim: true },
    postalCode: { type: String, required: [true, 'Le code postal est requis'], trim: true },
    country: { type: String, required: [true, 'Le pays est requis'], trim: true, default: 'France' },
    phone: { type: String, trim: true }
  },
  { _id: false }
);

const orderItemSchema = new Schema<IOrderItem>(
  {
    serviceId: { type: String, required: [true, 'L\'ID du service est requis'] },
    service: { type: Schema.Types.Mixed, required: [true, 'Les détails du service sont requis'] },
    quantity: { type: Number, required: [true, 'La quantité est requise'], min: [1, 'La quantité doit être au moins 1'] },
    options: { type: Schema.Types.Mixed, default: {} },
    unitPrice: { type: Number, required: [true, 'Le prix unitaire est requis'], min: [0, 'Le prix unitaire ne peut pas être négatif'] },
    totalPrice: { type: Number, required: [true, 'Le prix total est requis'], min: [0, 'Le prix total ne peut pas être négatif'] },
    files: [{ type: String, trim: true }],
    notes: { type: String, trim: true, maxlength: [500, 'Les notes ne peuvent pas dépasser 500 caractères'] }
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, unique: true, required: [true, 'Le numéro de commande est requis'] },
    clientId: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'L\'ID du client est requis'] },
    client: { type: Schema.Types.Mixed, required: [true, 'Les informations du client sont requises'] },
    items: [orderItemSchema],
    status: {
      type: String,
      enum: ['draft', 'quote', 'pending', 'confirmed', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled'],
      default: 'draft'
    },
    totalPrice: { type: Number, required: [true, 'Le prix total est requis'], min: [0, 'Le prix total ne peut pas être négatif'] },
    subtotal: { type: Number, required: [true, 'Le sous-total est requis'], min: [0, 'Le sous-total ne peut pas être négatif'] },
    taxAmount: { type: Number, default: 0, min: [0, 'Le montant de la taxe ne peut pas être négatif'] },
    discountAmount: { type: Number, default: 0, min: [0, 'Le montant de la remise ne peut pas être négatif'] },
    shippingCost: { type: Number, default: 0, min: [0, 'Les frais de livraison ne peuvent pas être négatifs'] },
    notes: { type: String, trim: true, maxlength: [1000, 'Les notes ne peuvent pas dépasser 1000 caractères'] },
    internalNotes: { type: String, trim: true, maxlength: [1000, 'Les notes internes ne peuvent pas dépasser 1000 caractères'] },

    confirmedAt: Date,
    productionStartedAt: Date,
    readyAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    estimatedDeliveryDate: Date,

    billingAddress: { type: addressSchema, required: [true, 'L\'adresse de facturation est requise'] },
    shippingAddress: { type: addressSchema, required: [true, 'L\'adresse de livraison est requise'] },

    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    paymentMethod: String,
    paymentIntentId: String,

    quoteDocument: String,
    invoiceDocument: String,

    trackingNumber: String,
    carrier: String,

    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ clientId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ assignedTo: 1 });
orderSchema.index({ priority: 1 });
orderSchema.index({ paymentStatus: 1 });

// Pre-save: generate order number
orderSchema.pre<IOrder>('save', async function (next) {
  if (this.isNew && !this.orderNumber) {
    this.orderNumber = await this.generateOrderNumber();
  }
  next();
});

// Pre-save: calculate totals
orderSchema.pre<IOrder>('save', function (next) {
  this.calculateTotals();
  next();
});

// Methods
orderSchema.methods.calculateTotals = function (): void {
  this.subtotal = this.items.reduce((sum: number, item: IOrderItem) => sum + item.totalPrice, 0);
  this.taxAmount = this.subtotal * 0.20;
  this.totalPrice = this.subtotal + this.taxAmount + this.shippingCost - this.discountAmount;
};

orderSchema.methods.generateOrderNumber = async function (): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  const startOfDay = new Date(year, date.getMonth(), date.getDate());
  const endOfDay = new Date(year, date.getMonth(), date.getDate() + 1);

  const count = await mongoose.model<IOrder>('Order').countDocuments({
    createdAt: { $gte: startOfDay, $lt: endOfDay }
  });

  const sequence = String(count + 1).padStart(4, '0');
  return `PP${year}${month}${day}${sequence}`;
};

orderSchema.methods.updateStatus = async function (newStatus: IOrder['status'], userId: string): Promise<void> {
  this.status = newStatus;
  const now = new Date();
  switch (newStatus) {
    case 'confirmed': this.confirmedAt = now; break;
    case 'in_production': this.productionStartedAt = now; break;
    case 'ready': this.readyAt = now; break;
    case 'shipped': this.shippedAt = now; break;
    case 'delivered': this.deliveredAt = now; break;
  }
  await this.save();
};

orderSchema.methods.generateQuote = async function (): Promise<string> {
  const filename = `quote-${this.orderNumber}.pdf`;
  return filename;
};

orderSchema.methods.generateInvoice = async function (): Promise<string> {
  const filename = `invoice-${this.orderNumber}.pdf`;
  return filename;
};

export default mongoose.model<IOrder, IOrderModel>('Order', orderSchema);
