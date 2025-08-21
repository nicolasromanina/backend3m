import mongoose, { Schema, Types } from 'mongoose';

export interface ICampaign extends mongoose.Document {
  name: string;
  type: 'email' | 'sms' | 'push';
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused' | 'cancelled';
  targetSegment: Types.ObjectId;
  template: {
    subject?: string;
    content: string;
    variables: Record<string, any>;
  };
  schedule: {
    sendAt?: Date;
    timezone: string;
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
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmailTemplate extends mongoose.Document {
  name: string;
  category: 'marketing' | 'transactional' | 'notification';
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: Array<{
    name: string;
    type: 'text' | 'number' | 'date' | 'boolean';
    required: boolean;
    defaultValue?: any;
  }>;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const campaignSchema = new Schema<ICampaign>({
  name: {
    type: String,
    required: [true, 'Le nom de la campagne est requis'],
    trim: true
  },
  type: {
    type: String,
    enum: ['email', 'sms', 'push'],
    required: [true, 'Le type de campagne est requis']
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'running', 'completed', 'paused', 'cancelled'],
    default: 'draft'
  },
  targetSegment: {
    type: Schema.Types.ObjectId,
    ref: 'CustomerSegment',
    required: true
  },
  template: {
    subject: String,
    content: {
      type: String,
      required: true
    },
    variables: {
      type: Schema.Types.Mixed,
      default: {}
    }
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
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

const emailTemplateSchema = new Schema<IEmailTemplate>({
  name: {
    type: String,
    required: [true, 'Le nom du template est requis'],
    trim: true
  },
  category: {
    type: String,
    enum: ['marketing', 'transactional', 'notification'],
    required: [true, 'La catégorie est requise']
  },
  subject: {
    type: String,
    required: [true, 'Le sujet est requis']
  },
  htmlContent: {
    type: String,
    required: [true, 'Le contenu HTML est requis']
  },
  textContent: String,
  variables: [{
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'boolean'],
      default: 'text'
    },
    required: {
      type: Boolean,
      default: false
    },
    defaultValue: Schema.Types.Mixed
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

export const Campaign = mongoose.model<ICampaign>('Campaign', campaignSchema);
export const EmailTemplate = mongoose.model<IEmailTemplate>('EmailTemplate', emailTemplateSchema);