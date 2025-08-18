import { Request, Response } from 'express';
import crypto from 'crypto';
import User from '../models/user.model';
import ApiError from '../utils/apiError';
import ApiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middlewares/error.middleware';
import { sendEmail } from '../services/email.service';
import logger from '../utils/logger';
import config from '../config/env';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, phone, address } = req.body;

  // Vérifier si l'utilisateur existe déjà
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw ApiError.conflict('Un compte avec cet email existe déjà');
  }

  // Créer l'utilisateur
  const user = await User.create({
    name,
    email,
    password,
    phone,
    address,
    role: 'client'
  });

  // Générer le token de vérification d'email
  const verificationToken = user.generateEmailVerificationToken();
  await user.save();

  // Construire l'URL complète de vérification
  const verificationUrl = `${config.CORS_ORIGIN}/verify-email?token=${verificationToken}`;

  // Envoyer l'email de vérification
  try {
    await sendEmail({
      to: user.email,
      subject: 'Vérification de votre compte PrintPro',
      template: 'email-verification',
      data: {
        name: user.name,
        verificationUrl // Envoi de l'URL complète
      }
    });
  } catch (error) {
    logger.error('Erreur envoi email de vérification:', error);
    // Ne pas bloquer l'inscription si l'email échoue
  }

  // Générer les tokens
  const accessToken = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();
  await user.save();

  res.status(201).json(
    ApiResponse.created('Compte créé avec succès', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified
      },
      tokens: {
        accessToken,
        refreshToken
      }
    })
  );
});



export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, rememberMe } = req.body;

  const user = await User.findOne({ email, isActive: true }).select('+password +refreshTokens');
  
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Email ou mot de passe incorrect');
  }

  user.lastLogin = new Date();
  
  const accessToken = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshTokens.push(refreshToken);
  await user.save();

  // Modified response structure to match frontend expectations
  res.status(200).json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      lastLogin: user.lastLogin
    },
    tokens: {
      accessToken,
      refreshToken
    }
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const user = req.user;

  if (refreshToken && user) {
    // Retirer le refresh token de la liste
    user.refreshTokens = user.refreshTokens.filter((token: string) => token !== refreshToken);
    await user.save();
  }

  res.json(
    ApiResponse.success('Déconnexion réussie')
  );
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  const { refreshToken: oldRefreshToken } = req.body;

  // Retirer l'ancien refresh token
  user.refreshTokens = user.refreshTokens.filter((token: string) => token !== oldRefreshToken);

  // Générer de nouveaux tokens
  const accessToken = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();
  await user.save();

  res.json(
    ApiResponse.success('Tokens rafraîchis', {
      tokens: {
        accessToken,
        refreshToken
      }
    })
  );
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await User.findOne({ email, isActive: true });
  if (!user) {
    // Ne pas révéler si l'email existe ou non
    return res.json(
      ApiResponse.success('Si cet email existe, un lien de réinitialisation a été envoyé')
    );
  }

  // Générer le token de réinitialisation
  const resetToken = user.generatePasswordResetToken();
  await user.save();

  // Construire l'URL de réinitialisation
  const resetUrl = `${config.CORS_ORIGIN}/reset-password?token=${resetToken}`;

  // Envoyer l'email de réinitialisation
  try {
    await sendEmail({
      to: user.email,
      subject: 'Réinitialisation de votre mot de passe PrintPro',
      template: 'password-reset',
      data: {
        name: user.name,
        resetUrl // Envoi de l'URL complète
      }
    });

    return res.json(
      ApiResponse.success('Email de réinitialisation envoyé')
    );
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    logger.error('Erreur envoi email de réinitialisation:', error);
    throw ApiError.internal('Erreur lors de l\'envoi de l\'email');
  }
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

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

  res.json(
    ApiResponse.success('Mot de passe réinitialisé avec succès')
  );
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body;

  // Hasher le token pour la comparaison
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    isActive: true
  });

  if (!user) {
    throw ApiError.badRequest('Token de vérification invalide');
  }

  // Marquer l'email comme vérifié
  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  await user.save();

  res.json(
    ApiResponse.success('Email vérifié avec succès')
  );
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id).select('+password');

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

  res.json(
    ApiResponse.success('Mot de passe modifié avec succès')
  );
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user.id);
  
  if (!user) {
    throw ApiError.notFound('Utilisateur non trouvé');
  }

  res.json(
    ApiResponse.success('Profil récupéré', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
        preferences: user.preferences,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    })
  );
});