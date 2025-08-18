import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/user.model';
import ApiError from '../utils/apiError';
import config from '../config/env';
import { IUser, IAuthTokens } from '../interfaces/auth.interface';
import { emailService } from './email.service';

export class AuthService {
  static async createUser(userData: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    address?: string;
    role?: string;
  }): Promise<IUser> {
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw ApiError.conflict('Un compte avec cet email existe déjà');
    }

    // Créer l'utilisateur
    const user = await User.create({
      ...userData,
      role: userData.role || 'client'
    });

    // Générer le token de vérification d'email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures
    await user.save();

    // Envoyer l'email de vérification
    await emailService.sendEmailVerification(user.email, user.name, verificationToken);

    return user;
  }

  static async authenticateUser(email: string, password: string): Promise<IUser> {
    // Trouver l'utilisateur avec le mot de passe
    const user = await User.findOne({ email, isActive: true }).select('+password');
    
    if (!user || !(await user.comparePassword(password))) {
      throw ApiError.unauthorized('Email ou mot de passe incorrect');
    }

    // Vérifier si l'email est vérifié
    if (!user.isEmailVerified) {
      throw ApiError.unauthorized('Veuillez vérifier votre adresse email');
    }

    // Mettre à jour la dernière connexion
    user.lastLogin = new Date();
    await user.save();

    return user;
  }

  static generateTokens(user: IUser): IAuthTokens {
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();
    
    return {
      accessToken,
      refreshToken
    };
  }

  static async refreshTokens(refreshToken: string): Promise<{ user: IUser; tokens: IAuthTokens }> {
    try {
      // Vérifier le refresh token
      const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as any;

      if (decoded.type !== 'refresh') {
        throw ApiError.unauthorized('Token invalide');
      }

      // Récupérer l'utilisateur
      const user = await User.findById(decoded.userId).select('+refreshTokens');
      
      if (!user || !user.isActive) {
        throw ApiError.unauthorized('Utilisateur non trouvé ou désactivé');
      }

      // Vérifier que le refresh token est valide
      if (!user.refreshTokens.includes(refreshToken)) {
        throw ApiError.unauthorized('Refresh token invalide');
      }

      // Retirer l'ancien refresh token
      user.refreshTokens = user.refreshTokens.filter(token => token !== refreshToken);

      // Générer de nouveaux tokens
      const tokens = this.generateTokens(user);
      user.refreshTokens.push(tokens.refreshToken);
      await user.save();

      return { user, tokens };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw ApiError.unauthorized('Refresh token invalide');
      }
      throw error;
    }
  }

  static async logout(user: IUser, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Retirer le refresh token spécifique
      user.refreshTokens = user.refreshTokens.filter(token => token !== refreshToken);
    } else {
      // Retirer tous les refresh tokens
      user.refreshTokens = [];
    }
    await user.save();
  }

  static async generatePasswordResetToken(email: string): Promise<string> {
    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      throw ApiError.notFound('Utilisateur non trouvé');
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save();

    return resetToken;
  }

  static async resetPassword(token: string, newPassword: string): Promise<void> {
    // Hasher le token pour la comparaison
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
      isActive: true
    });

    if (!user) {
      throw ApiError.badRequest('Token invalide ou expiré');
    }

    // Mettre à jour le mot de passe
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = []; // Invalider tous les refresh tokens
    await user.save();
  }

  static async verifyEmail(token: string): Promise<void> {
    // Hasher le token pour la comparaison
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
      isActive: true
    });

    if (!user) {
      throw ApiError.badRequest('Token de vérification invalide ou expiré');
    }

    // Marquer l'email comme vérifié
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Optionnel : Envoyer un email de bienvenue après vérification
    await emailService.sendWelcomeEmail(user.email, user.name);
  }

  static async resendVerificationEmail(email: string): Promise<void> {
    const user = await User.findOne({ email });
    if (!user) {
      throw ApiError.notFound('Utilisateur non trouvé');
    }
    if (user.isEmailVerified) {
      throw ApiError.badRequest("L'email est déjà vérifié");
    }
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures
    await user.save();
    await emailService.sendEmailVerification(user.email, user.name, verificationToken);
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await User.findById(userId).select('+password');

    if (!user) {
      throw ApiError.notFound('Utilisateur non trouvé');
    }

    // Vérifier le mot de passe actuel
    if (!(await user.comparePassword(currentPassword))) {
      throw ApiError.badRequest('Mot de passe actuel incorrect');
    }

    // Mettre à jour le mot de passe
    user.password = newPassword;
    user.refreshTokens = []; // Invalider tous les refresh tokens
    await user.save();
  }

  static async validateToken(token: string): Promise<IUser> {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as any;
      
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw ApiError.unauthorized('Token invalide');
      }

      return user;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw ApiError.unauthorized('Token invalide');
      }
      throw error;
    }
  }
}