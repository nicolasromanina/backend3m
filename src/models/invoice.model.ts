import mongoose, { Schema, Types } from 'mongoose';

export interface IInvoice extends mongoose.Document {
  invoiceNumber: string;
  orderId: Types.ObjectId;
  clientId: Types.ObjectId;
  type: 'invoice' | 'quote' | 'credit_note' | 'proforma';
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    taxRate: number;
    taxAmount: number;
  }>;
  subtotal: number;
  discounts: Array<{
    type: 'percentage' | 'fixed';
    value: number;
    description: string;
    amount: number;
  }>;
  discountTotal: number;
  taxDetails: Array<{
    rate: number;
    base: number;
    amount: number;
    description: string;
  }>;
  taxTotal: number;
  total: number;
  currency: string;
  dueDate: Date;
  paymentTerms: string;
  paymentMethods: string[];
  notes?: string;
  footerText?: string;
  billingAddress: {
    name: string;
    company?: string;
    street: string;
    city: string;
    postalCode: string;
    country: string;
    vatNumber?: string;
  };
  companyInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website?: string;
    vatNumber?: string;
    siret?: string;
  };
  pdfPath?: string;
  sentAt?: Date;
  paidAt?: Date;
  paymentReference?: string;
  recurringSettings?: {
    isRecurring: boolean;
    frequency: 'monthly' | 'quarterly' | 'yearly';
    nextInvoiceDate?: Date;
    endDate?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoice>({
  invoiceNumber: {
    type: String,
    unique: true,
    required: [true, 'Le numéro de facture est requis']
  },
  orderId: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'L\'ID de commande est requis']
  },
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'L\'ID client est requis']
  },
  type: {
    type: String,
    enum: ['invoice', 'quote', 'credit_note', 'proforma'],
    default: 'invoice'
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  items: [{
    description: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    },
    taxRate: {
      type: Number,
      default: 20
    },
    taxAmount: {
      type: Number,
      default: 0
    }
  }],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  discounts: [{
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true
    },
    value: {
      type: Number,
      required: true,
      min: 0
    },
    description: String,
    amount: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  discountTotal: {
    type: Number,
    default: 0
  },
  taxDetails: [{
    rate: Number,
    base: Number,
    amount: Number,
    description: String
  }],
  taxTotal: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'EUR'
  },
  dueDate: {
    type: Date,
    required: true
  },
  paymentTerms: {
    type: String,
    default: 'Paiement à 30 jours'
  },
  paymentMethods: [{
    type: String,
    enum: ['card', 'transfer', 'check', 'cash']
  }],
  notes: String,
  footerText: String,
  billingAddress: {
    name: {
      type: String,
      required: true
    },
    company: String,
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    postalCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      default: 'France'
    },
    vatNumber: String
  },
  companyInfo: {
    name: {
      type: String,
      default: 'PrintPro'
    },
    address: {
      type: String,
      default: '123 Rue de l\'Impression, 75000 Paris'
    },
    phone: {
      type: String,
      default: '01 23 45 67 89'
    },
    email: {
      type: String,
      default: 'contact@printpro.fr'
    },
    website: String,
    vatNumber: String,
    siret: String
  },
  pdfPath: String,
  sentAt: Date,
  paidAt: Date,
  paymentReference: String,
  recurringSettings: {
    isRecurring: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly']
    },
    nextInvoiceDate: Date,
    endDate: Date
  }
}, {
  timestamps: true
});

// Index
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ clientId: 1, createdAt: -1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ dueDate: 1 });

// Générer le numéro de facture
invoiceSchema.pre('save', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const count = await mongoose.model('Invoice').countDocuments({
      createdAt: {
        $gte: new Date(year, date.getMonth(), 1),
        $lt: new Date(year, date.getMonth() + 1, 1)
      }
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    this.invoiceNumber = `${this.type.toUpperCase()}-${year}${month}-${sequence}`;
  }
  next();
});

export const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);