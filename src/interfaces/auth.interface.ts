import { Document } from 'mongoose';

export interface IUser extends Document {
  _id: string;
  name: string;
  email: string;
  password: string;
  role: 'client' | 'admin' | 'employee';
  phone?: string;
  address?: string;
  avatar?: string;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  refreshTokens: string[];
  lastLogin?: Date;
  isActive: boolean;
  preferences: {
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
    theme: string;
    language: string;
  };
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAuthToken(): string;
  generateRefreshToken(): string;
  generateEmailVerificationToken(): string;
  generatePasswordResetToken(): string;
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ILoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface IRegisterRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  role?: 'client';
}

export interface IChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface IForgotPasswordRequest {
  email: string;
}

export interface IResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface IVerifyEmailRequest {
  token: string;
}

export interface IRefreshTokenRequest {
  refreshToken: string;
}

export interface IAuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: Partial<IUser>;
    tokens?: IAuthTokens;
  };
}

export interface IJWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export interface IPasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}