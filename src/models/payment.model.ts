import mongoose, { Schema, Types } from 'mongoose';

export interface IPayment extends mongoose.Document {
  paymentNumber: string;
  orderId: Types.ObjectId;
  clientId: Types.ObjectId;
  amount: number;
  currency: string;
  method: 'mvola' | 'card' | 'transfer' | 'cash' | 'check';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  type: 'full' | 'partial' | 'deposit' | 'installment';
  installmentPlan?: {
    totalInstallments: number;
    currentInstallment: number;
    installmentAmount: number;
    nextDueDate?: Date;
  };
  mvolaTransaction?: {
    transactionId: string;
    phoneNumber: string;
    reference: string;
    status: string;
  };
  cardTransaction?: {
    transactionId: string;
    last4: string;
    brand: string;
    authCode: string;
  };
  fees: {
    processingFee: number;
    platformFee: number;
    totalFees: number;
  };
  refunds: Array<{
    amount: number;
    reason: string;
    refundedAt: Date;
    refundId: string;
  }>;
  metadata: Record<string, any>;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFinancialReport extends mongoose.Document {
  reportType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  period: {
    startDate: Date;
    endDate: Date;
  };
  metrics: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    totalPayments: number;
    pendingPayments: number;
    refundedAmount: number;
    processingFees: number;
    netRevenue: number;
  };
  breakdown: {
    byPaymentMethod: Array<{
      method: string;
      amount: number;
      count: number;
      percentage: number;
    }>;
    byService: Array<{
      serviceId: Types.ObjectId;
      serviceName: string;
      revenue: number;
      orders: number;
    }>;
    byClient: Array<{
      clientId: Types.ObjectId;
      clientName: string;
      totalSpent: number;
      orderCount: number;
    }>;
  };
  generatedAt: Date;
  generatedBy: Types.ObjectId;
}

const paymentSchema = new Schema<IPayment>({
  paymentNumber: {
    type: String,
    unique: true,
    required: [true, 'Le numéro de paiement est requis']
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
  amount: {
    type: Number,
    required: [true, 'Le montant est requis'],
    min: [0, 'Le montant ne peut pas être négatif']
  },
  currency: {
    type: String,
    default: 'MGA'
  },
  method: {
    type: String,
    enum: ['mvola', 'card', 'transfer', 'cash', 'check'],
    required: [true, 'La méthode de paiement est requise']
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  type: {
    type: String,
    enum: ['full', 'partial', 'deposit', 'installment'],
    default: 'full'
  },
  installmentPlan: {
    totalInstallments: Number,
    currentInstallment: Number,
    installmentAmount: Number,
    nextDueDate: Date
  },
  mvolaTransaction: {
    transactionId: String,
    phoneNumber: String,
    reference: String,
    status: String
  },
  cardTransaction: {
    transactionId: String,
    last4: String,
    brand: String,
    authCode: String
  },
  fees: {
    processingFee: {
      type: Number,
      default: 0
    },
    platformFee: {
      type: Number,
      default: 0
    },
    totalFees: {
      type: Number,
      default: 0
    }
  },
  refunds: [{
    amount: {
      type: Number,
      required: true
    },
    reason: String,
    refundedAt: {
      type: Date,
      default: Date.now
    },
    refundId: String
  }],
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  processedAt: Date
}, {
  timestamps: true
});

const financialReportSchema = new Schema<IFinancialReport>({
  reportType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
    required: true
  },
  period: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  metrics: {
    totalRevenue: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    totalPayments: { type: Number, default: 0 },
    pendingPayments: { type: Number, default: 0 },
    refundedAmount: { type: Number, default: 0 },
    processingFees: { type: Number, default: 0 },
    netRevenue: { type: Number, default: 0 }
  },
  breakdown: {
    byPaymentMethod: [{
      method: String,
      amount: Number,
      count: Number,
      percentage: Number
    }],
    byService: [{
      serviceId: {
        type: Schema.Types.ObjectId,
        ref: 'Service'
      },
      serviceName: String,
      revenue: Number,
      orders: Number
    }],
    byClient: [{
      clientId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      clientName: String,
      totalSpent: Number,
      orderCount: Number
    }]
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  generatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Générer le numéro de paiement
paymentSchema.pre('save', async function(next) {
  if (this.isNew && !this.paymentNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const count = await mongoose.model('Payment').countDocuments({
      createdAt: {
        $gte: new Date(year, date.getMonth(), date.getDate()),
        $lt: new Date(year, date.getMonth(), date.getDate() + 1)
      }
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    this.paymentNumber = `PAY-${year}${month}${day}-${sequence}`;
  }
  next();
});

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
export const FinancialReport = mongoose.model<IFinancialReport>('FinancialReport', financialReportSchema);