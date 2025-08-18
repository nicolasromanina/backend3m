import { Document } from 'mongoose';

export interface IUserProfile {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  avatar?: string;
  company?: string;
  website?: string;
  bio?: string;
}

export interface IUserPreferences {
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
    orderUpdates: boolean;
    marketing: boolean;
    newsletter: boolean;
  };
  theme: string;
  language: string;
  timezone: string;
  currency: string;
  accessibility: {
    highContrast: boolean;
    fontSize: 'small' | 'medium' | 'large' | 'extra-large';
    colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
    screenReader: boolean;
    keyboardNavigation: boolean;
    reducedMotion: boolean;
  };
}

export interface IUserStats {
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate?: Date;
  favoriteServices: string[];
  loyaltyPoints: number;
  membershipLevel: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface IUserActivity {
  action: string;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface IUserDocument extends Document {
  profile: IUserProfile;
  preferences: IUserPreferences;
  stats: IUserStats;
  activities: IUserActivity[];
  
  // Methods
  updateProfile(profileData: Partial<IUserProfile>): Promise<IUserDocument>;
  updatePreferences(preferences: Partial<IUserPreferences>): Promise<IUserDocument>;
  addActivity(activity: Omit<IUserActivity, 'timestamp'>): Promise<IUserDocument>;
  calculateStats(): Promise<IUserStats>;
}

export interface IUpdateProfileRequest {
  name?: string;
  phone?: string;
  address?: string;
  company?: string;
  website?: string;
  bio?: string;
}

export interface IUpdatePreferencesRequest {
  notifications?: Partial<IUserPreferences['notifications']>;
  theme?: string;
  language?: string;
  timezone?: string;
  currency?: string;
  accessibility?: Partial<IUserPreferences['accessibility']>;
}

export interface IUserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IUserListResponse {
  users: IUserDocument[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalUsers: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}