import mongoose, { Schema, Types } from 'mongoose';

export interface ICustomerSegment extends mongoose.Document {
  name: string;
  description: string;
  criteria: {
    totalSpent?: { min?: number; max?: number };
    orderCount?: { min?: number; max?: number };
    lastOrderDate?: { before?: Date; after?: Date };
    registrationDate?: { before?: Date; after?: Date };
    location?: { countries?: string[]; cities?: string[] };
    preferences?: Record<string, any>;
    tags?: string[];
  };
  customerCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMarketingCampaign extends mongoose.Document {
  name: string;
  type: 'email' | 'sms' | 'push' | 'postal';
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused' | 'cancelled';
  targetSegments: Types.ObjectId[];
  targetCustomers?: Types.ObjectId[];
  content: {
    subject?: string;
    htmlContent?: string;
    textContent?: string;
    attachments?: string[];
    template?: string;
    variables?: Record<string, any>;
  };
  schedule: {
    sendAt?: Date;
    timezone?: string;
    recurring?: {
      frequency: 'daily' | 'weekly' | 'monthly';
      interval: number;
      endDate?: Date;
    };
  };
  statistics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    converted: number;
    revenue: number;
  };
  settings: {
    trackOpens: boolean;
    trackClicks: boolean;
    allowUnsubscribe: boolean;
    replyTo?: string;
  };
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILoyaltyProgram extends mongoose.Document {
  name: string;
  description: string;
  type: 'points' | 'tiers' | 'cashback';
  isActive: boolean;
  rules: {
    pointsPerEuro?: number;
    bonusEvents?: Array<{
      event: 'first_order' | 'birthday' | 'referral' | 'review';
      points: number;
      description: string;
    }>;
    tiers?: Array<{
      name: string;
      minSpent: number;
      benefits: string[];
      discountPercentage: number;
    }>;
    cashbackPercentage?: number;
  };
  rewards: Array<{
    name: string;
    description: string;
    pointsCost?: number;
    discountPercentage?: number;
    freeShipping?: boolean;
    isActive: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICustomerLoyalty extends mongoose.Document {
  customerId: Types.ObjectId;
  programId: Types.ObjectId;
  points: number;
  tier?: string;
  totalSpent: number;
  totalOrders: number;
  joinDate: Date;
  lastActivity: Date;
  pointsHistory: Array<{
    points: number;
    type: 'earned' | 'redeemed' | 'expired';
    reason: string;
    orderId?: Types.ObjectId;
    date: Date;
  }>;
  redeemedRewards: Array<{
    rewardName: string;
    pointsUsed: number;
    orderId?: Types.ObjectId;
    redeemedAt: Date;
  }>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProspect extends mongoose.Document {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  source: 'website' | 'referral' | 'social' | 'advertising' | 'event' | 'cold_call' | 'other';
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
  assignedTo?: Types.ObjectId;
  estimatedValue?: number;
  probability?: number;
  expectedCloseDate?: Date;
  actualCloseDate?: Date;
  notes: Array<{
    content: string;
    createdBy: Types.ObjectId;
    createdAt: Date;
    type: 'note' | 'call' | 'email' | 'meeting';
  }>;
  interactions: Array<{
    type: 'email' | 'call' | 'meeting' | 'demo' | 'proposal';
    subject: string;
    description: string;
    date: Date;
    duration?: number;
    outcome?: string;
    nextAction?: string;
    createdBy: Types.ObjectId;
  }>;
  tags: string[];
  customFields: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const customerSegmentSchema = new Schema<ICustomerSegment>({
  name: {
    type: String,
    required: [true, 'Le nom du segment est requis'],
    trim: true
  },
  description: String,
  criteria: {
    totalSpent: {
      min: Number,
      max: Number
    },
    orderCount: {
      min: Number,
      max: Number
    },
    lastOrderDate: {
      before: Date,
      after: Date
    },
    registrationDate: {
      before: Date,
      after: Date
    },
    location: {
      countries: [String],
      cities: [String]
    },
    preferences: Schema.Types.Mixed,
    tags: [String]
  },
  customerCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const marketingCampaignSchema = new Schema<IMarketingCampaign>({
  name: {
    type: String,
    required: [true, 'Le nom de la campagne est requis'],
    trim: true
  },
  type: {
    type: String,
    enum: ['email', 'sms', 'push', 'postal'],
    required: [true, 'Le type de campagne est requis']
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'running', 'completed', 'paused', 'cancelled'],
    default: 'draft'
  },
  targetSegments: [{
    type: Schema.Types.ObjectId,
    ref: 'CustomerSegment'
  }],
  targetCustomers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  content: {
    subject: String,
    htmlContent: String,
    textContent: String,
    attachments: [String],
    template: String,
    variables: Schema.Types.Mixed
  },
  schedule: {
    sendAt: Date,
    timezone: {
      type: String,
      default: 'Europe/Paris'
    },
    recurring: {
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly']
      },
      interval: Number,
      endDate: Date
    }
  },
  statistics: {
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    bounced: { type: Number, default: 0 },
    unsubscribed: { type: Number, default: 0 },
    converted: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 }
  },
  settings: {
    trackOpens: { type: Boolean, default: true },
    trackClicks: { type: Boolean, default: true },
    allowUnsubscribe: { type: Boolean, default: true },
    replyTo: String
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

const loyaltyProgramSchema = new Schema<ILoyaltyProgram>({
  name: {
    type: String,
    required: [true, 'Le nom du programme est requis'],
    trim: true
  },
  description: String,
  type: {
    type: String,
    enum: ['points', 'tiers', 'cashback'],
    required: [true, 'Le type de programme est requis']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  rules: {
    pointsPerEuro: Number,
    bonusEvents: [{
      event: {
        type: String,
        enum: ['first_order', 'birthday', 'referral', 'review']
      },
      points: Number,
      description: String
    }],
    tiers: [{
      name: String,
      minSpent: Number,
      benefits: [String],
      discountPercentage: Number
    }],
    cashbackPercentage: Number
  },
  rewards: [{
    name: {
      type: String,
      required: true
    },
    description: String,
    pointsCost: Number,
    discountPercentage: Number,
    freeShipping: Boolean,
    isActive: {
      type: Boolean,
      default: true
    }
  }]
}, {
  timestamps: true
});

const customerLoyaltySchema = new Schema<ICustomerLoyalty>({
  customerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  programId: {
    type: Schema.Types.ObjectId,
    ref: 'LoyaltyProgram',
    required: true
  },
  points: {
    type: Number,
    default: 0
  },
  tier: String,
  totalSpent: {
    type: Number,
    default: 0
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  joinDate: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  pointsHistory: [{
    points: Number,
    type: {
      type: String,
      enum: ['earned', 'redeemed', 'expired']
    },
    reason: String,
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order'
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],
  redeemedRewards: [{
    rewardName: String,
    pointsUsed: Number,
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order'
    },
    redeemedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const prospectSchema = new Schema<IProspect>({
  name: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'L\'email est requis'],
    lowercase: true,
    trim: true
  },
  phone: String,
  company: String,
  source: {
    type: String,
    enum: ['website', 'referral', 'social', 'advertising', 'event', 'cold_call', 'other'],
    default: 'website'
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'],
    default: 'new'
  },
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  estimatedValue: Number,
  probability: {
    type: Number,
    min: 0,
    max: 100
  },
  expectedCloseDate: Date,
  actualCloseDate: Date,
  notes: [{
    content: {
      type: String,
      required: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['note', 'call', 'email', 'meeting'],
      default: 'note'
    }
  }],
  interactions: [{
    type: {
      type: String,
      enum: ['email', 'call', 'meeting', 'demo', 'proposal'],
      required: true
    },
    subject: {
      type: String,
      required: true
    },
    description: String,
    date: {
      type: Date,
      required: true
    },
    duration: Number,
    outcome: String,
    nextAction: String,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  tags: [String],
  customFields: Schema.Types.Mixed
}, {
  timestamps: true
});

// Index
customerSegmentSchema.index({ name: 1 });
marketingCampaignSchema.index({ status: 1, createdAt: -1 });
customerLoyaltySchema.index({ customerId: 1, programId: 1 });
prospectSchema.index({ email: 1 });
prospectSchema.index({ status: 1, assignedTo: 1 });

export const CustomerSegment = mongoose.model<ICustomerSegment>('CustomerSegment', customerSegmentSchema);
export const MarketingCampaign = mongoose.model<IMarketingCampaign>('MarketingCampaign', marketingCampaignSchema);
export const LoyaltyProgram = mongoose.model<ILoyaltyProgram>('LoyaltyProgram', loyaltyProgramSchema);
export const CustomerLoyalty = mongoose.model<ICustomerLoyalty>('CustomerLoyalty', customerLoyaltySchema);
export const Prospect = mongoose.model<IProspect>('Prospect', prospectSchema);