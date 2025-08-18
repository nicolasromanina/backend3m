import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { IUser } from '../interfaces/auth.interface';
import config from '../config/env';

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Le nom est requis'],
      trim: true,
      maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères']
    },
    email: {
      type: String,
      required: [true, "L'email est requis"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Veuillez fournir un email valide'
      ]
    },
    password: {
      type: String,
      required: [true, 'Le mot de passe est requis'],
      minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères'],
      select: false
    },
    role: {
      type: String,
      enum: ['client', 'admin', 'employee'],
      default: 'client'
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[\+]?[1-9][\d]{0,15}$/, 'Veuillez fournir un numéro de téléphone valide']
    },
    address: {
      type: String,
      trim: true,
      maxlength: [500, "L'adresse ne peut pas dépasser 500 caractères"]
    },
    avatar: {
      type: String,
      default: null
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: {
      type: String,
      select: false
    },
    passwordResetToken: {
      type: String,
      select: false
    },
    passwordResetExpires: {
      type: Date,
      select: false
    },
    refreshTokens: [
      {
        type: String,
        select: false,
        default: []
      }
    ],
    lastLogin: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    preferences: {
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: true }
      },
      theme: { type: String, default: 'default' },
      language: { type: String, default: 'fr' }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// Password hashing middleware
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT Auth Token
userSchema.methods.generateAuthToken = function (): string {
  return jwt.sign(
    {
      userId: this._id,
      email: this.email,
      role: this.role
    },
    String(config.JWT_SECRET),
    {
      expiresIn: config.JWT_EXPIRE as SignOptions['expiresIn']
    }
  );
};

// Generate Refresh Token
userSchema.methods.generateRefreshToken = function (): string {
  const refreshToken = jwt.sign(
    {
      userId: this._id,
      type: 'refresh'
    },
    String(config.JWT_REFRESH_SECRET),
    {
      expiresIn: config.JWT_REFRESH_EXPIRE as SignOptions['expiresIn']
    }
  );

  this.refreshTokens.push(refreshToken);
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }

  return refreshToken;
};

// Generate Email Verification Token
userSchema.methods.generateEmailVerificationToken = function (): string {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  return verificationToken;
};

// Generate Password Reset Token
userSchema.methods.generatePasswordResetToken = function (): string {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);

  return resetToken;
};

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  return this.name;
});

// Hide sensitive fields when sending JSON
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.refreshTokens;
  delete userObject.emailVerificationToken;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  return userObject;
};

// Static method for login with credentials
userSchema.statics.findByCredentials = async function (
  email: string,
  password: string
) {
  const user = await this.findOne({ email, isActive: true }).select('+password');

  if (!user) {
    throw new Error('Email ou mot de passe incorrect');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Email ou mot de passe incorrect');
  }

  return user;
};

export default mongoose.model<IUser>('User', userSchema);
