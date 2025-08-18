import mongoose, { Schema } from 'mongoose';

export interface IUserActivity extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  duration?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface ISystemMetrics extends mongoose.Document {
  date: Date;
  metrics: {
    activeUsers: number;
    newUsers: number;
    totalOrders: number;
    revenue: number;
    averageOrderValue: number;
    conversionRate: number;
    pageViews: number;
    uniqueVisitors: number;
    bounceRate: number;
    avgSessionDuration: number;
  };
  performance: {
    avgResponseTime: number;
    errorRate: number;
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  createdAt: Date;
}

export interface IUserPreferences extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  notifications: {
    email: {
      orderUpdates: boolean;
      promotions: boolean;
      newsletter: boolean;
      security: boolean;
    };
    push: {
      orderUpdates: boolean;
      chat: boolean;
      promotions: boolean;
    };
    sms: {
      orderUpdates: boolean;
      security: boolean;
    };
  };
  privacy: {
    profileVisibility: 'public' | 'private' | 'contacts';
    dataSharing: boolean;
    analytics: boolean;
  };
  interface: {
    theme: string;
    language: string;
    timezone: string;
    currency: string;
    dateFormat: string;
    accessibility: {
      highContrast: boolean;
      fontSize: 'small' | 'medium' | 'large' | 'extra-large';
      colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
      screenReader: boolean;
      keyboardNavigation: boolean;
      reducedMotion: boolean;
    };
  };
  dashboard: {
    layout: string;
    widgets: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
      config: Record<string, any>;
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userActivitySchema = new Schema<IUserActivity>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  resource: {
    type: String,
    required: true
  },
  resourceId: String,
  details: Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  sessionId: String,
  duration: Number,
  metadata: Schema.Types.Mixed
}, {
  timestamps: true
});

const systemMetricsSchema = new Schema<ISystemMetrics>({
  date: {
    type: Date,
    required: true,
    unique: true,
    index: true
  },
  metrics: {
    activeUsers: { type: Number, default: 0 },
    newUsers: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    pageViews: { type: Number, default: 0 },
    uniqueVisitors: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 },
    avgSessionDuration: { type: Number, default: 0 }
  },
  performance: {
    avgResponseTime: { type: Number, default: 0 },
    errorRate: { type: Number, default: 0 },
    uptime: { type: Number, default: 100 },
    memoryUsage: { type: Number, default: 0 },
    cpuUsage: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

const userPreferencesSchema = new Schema<IUserPreferences>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  notifications: {
    email: {
      orderUpdates: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false },
      newsletter: { type: Boolean, default: false },
      security: { type: Boolean, default: true }
    },
    push: {
      orderUpdates: { type: Boolean, default: true },
      chat: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false }
    },
    sms: {
      orderUpdates: { type: Boolean, default: false },
      security: { type: Boolean, default: true }
    }
  },
  privacy: {
    profileVisibility: {
      type: String,
      enum: ['public', 'private', 'contacts'],
      default: 'private'
    },
    dataSharing: { type: Boolean, default: false },
    analytics: { type: Boolean, default: true }
  },
  interface: {
    theme: { type: String, default: 'default' },
    language: { type: String, default: 'fr' },
    timezone: { type: String, default: 'Europe/Paris' },
    currency: { type: String, default: 'EUR' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    accessibility: {
      highContrast: { type: Boolean, default: false },
      fontSize: {
        type: String,
        enum: ['small', 'medium', 'large', 'extra-large'],
        default: 'medium'
      },
      colorBlindMode: {
        type: String,
        enum: ['none', 'protanopia', 'deuteranopia', 'tritanopia'],
        default: 'none'
      },
      screenReader: { type: Boolean, default: false },
      keyboardNavigation: { type: Boolean, default: true },
      reducedMotion: { type: Boolean, default: false }
    }
  },
  dashboard: {
    layout: { type: String, default: 'default' },
    widgets: [{
      id: String,
      type: String,
      position: {
        x: Number,
        y: Number
      },
      size: {
        width: Number,
        height: Number
      },
      config: Schema.Types.Mixed
    }]
  }
}, {
  timestamps: true
});

// Index pour améliorer les performances
userActivitySchema.index({ userId: 1, createdAt: -1 });
userActivitySchema.index({ action: 1, createdAt: -1 });
userActivitySchema.index({ resource: 1 });

systemMetricsSchema.index({ date: -1 });

export const UserActivity = mongoose.model<IUserActivity>('UserActivity', userActivitySchema);
export const SystemMetrics = mongoose.model<ISystemMetrics>('SystemMetrics', systemMetricsSchema);
export const UserPreferences = mongoose.model<IUserPreferences>('UserPreferences', userPreferencesSchema);