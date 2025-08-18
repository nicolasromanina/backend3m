import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';
import ApiError from '../utils/apiError';
import config from '../config/env';
import { IJWTPayload } from '../interfaces/auth.interface';

// Étendre l'interface Request pour inclure user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Token d\'accès requis');
    }

    const token = authHeader.substring(7); // Enlever "Bearer "

    if (!token) {
      throw ApiError.unauthorized('Token d\'accès requis');
    }

    // Vérifier le token
    const decoded = jwt.verify(token, config.JWT_SECRET) as IJWTPayload;

    // Récupérer l'utilisateur
    const user = await User.findById(decoded.userId).select('-password -refreshTokens');
    
    if (!user) {
      throw ApiError.unauthorized('Token invalide');
    }

    if (!user.isActive) {
      throw ApiError.unauthorized('Compte désactivé');
    }

    // Ajouter l'utilisateur à la requête
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(ApiError.unauthorized('Token invalide'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(ApiError.unauthorized('Token expiré'));
    } else {
      next(error);
    }
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentification requise'));
    }

    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Permissions insuffisantes'));
    }

    next();
  };
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (token) {
        const decoded = jwt.verify(token, config.JWT_SECRET) as IJWTPayload;
        const user = await User.findById(decoded.userId).select('-password -refreshTokens');
        
        if (user && user.isActive) {
          req.user = user;
        }
      }
    }
    
    next();
  } catch (error) {
    // En cas d'erreur, continuer sans utilisateur
    next();
  }
};

export const refreshTokenAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw ApiError.unauthorized('Refresh token requis');
    }

    // Vérifier le refresh token
    const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as any;

    if (decoded.type !== 'refresh') {
      throw ApiError.unauthorized('Token invalide');
    }

    // Récupérer l'utilisateur avec les refresh tokens
    const user = await User.findById(decoded.userId).select('+refreshTokens');
    
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('Utilisateur non trouvé ou désactivé');
    }

    // Vérifier que le refresh token est dans la liste
    if (!user.refreshTokens.includes(refreshToken)) {
      throw ApiError.unauthorized('Refresh token invalide');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(ApiError.unauthorized('Refresh token invalide'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(ApiError.unauthorized('Refresh token expiré'));
    } else {
      next(error);
    }
  }
};

export const checkEmailVerification = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(ApiError.unauthorized('Authentification requise'));
  }

  if (!req.user.isEmailVerified) {
    return next(ApiError.forbidden('Email non vérifié. Veuillez vérifier votre email.'));
  }

  next();
};

export const rateLimitByUser = (maxRequests: number, windowMs: number) => {
  const requests = new Map();

  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id || req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Nettoyer les anciennes entrées
    if (requests.has(userId)) {
      const userRequests = requests.get(userId).filter((time: number) => time > windowStart);
      requests.set(userId, userRequests);
    }

    // Vérifier la limite
    const userRequests = requests.get(userId) || [];
    if (userRequests.length >= maxRequests) {
      return next(ApiError.tooManyRequests('Trop de requêtes. Veuillez réessayer plus tard.'));
    }

    // Ajouter la requête actuelle
    userRequests.push(now);
    requests.set(userId, userRequests);

    next();
  };
};