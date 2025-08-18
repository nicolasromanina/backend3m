import mongoose, { Schema } from 'mongoose';

export interface INotification extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'order' | 'chat' | 'system';
  category: 'order' | 'payment' | 'system' | 'promotion' | 'reminder' | 'security';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isRead: boolean;
  readAt?: Date;
  actionUrl?: string;
  actionText?: string;
  data?: Record<string, any>;
  expiresAt?: Date;
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
    inApp: boolean;
  };
  deliveryStatus: {
    push?: 'pending' | 'sent' | 'delivered' | 'failed';
    email?: 'pending' | 'sent' | 'delivered' | 'failed';
    sms?: 'pending' | 'sent' | 'delivered' | 'failed';
    inApp?: 'pending' | 'sent' | 'delivered' | 'failed';
  };
  scheduledFor?: Date;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPushSubscription extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    maxlength: [100, 'Le titre ne peut pas dépasser 100 caractères']
  },
  message: {
    type: String,
    required: true,
    maxlength: [500, 'Le message ne peut pas dépasser 500 caractères']
  },
  type: {
    type: String,
    enum: ['info', 'success', 'warning', 'error', 'order', 'chat', 'system'],
    default: 'info'
  },
  category: {
    type: String,
    enum: ['order', 'payment', 'system', 'promotion', 'reminder', 'security'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  actionUrl: String,
  actionText: String,
  data: Schema.Types.Mixed,
  expiresAt: Date,
  channels: {
    push: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
    inApp: { type: Boolean, default: true }
  },
  deliveryStatus: {
    push: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed']
    },
    email: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed']
    },
    sms: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed']
    },
    inApp: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed'],
      default: 'delivered'
    }
  },
  scheduledFor: Date,
  sentAt: Date
}, {
  timestamps: true
});

const pushSubscriptionSchema = new Schema<IPushSubscription>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  endpoint: {
    type: String,
    required: true,
    unique: true
  },
  keys: {
    p256dh: {
      type: String,
      required: true
    },
    auth: {
      type: String,
      required: true
    }
  },
  userAgent: String,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index pour améliorer les performances
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ category: 1 });
notificationSchema.index({ priority: 1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ expiresAt: 1 });

pushSubscriptionSchema.index({ userId: 1, isActive: 1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
export const PushSubscription = mongoose.model<IPushSubscription>('PushSubscription', pushSubscriptionSchema);