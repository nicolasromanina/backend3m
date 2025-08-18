import { Request, Response, NextFunction } from 'express';
import { Error as MongooseError } from 'mongoose';
import ApiError from '../utils/apiError';
import ApiResponse from '../utils/apiResponse';
import logger from '../utils/logger';
import config from '../config/env';

// Interface pour les erreurs de validation
type ValidationError = Record<string, string[]>;

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err };
  error.message = err.message;

  // Log de l'erreur
  logger.error(`Erreur: ${err.message}`, {
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Erreur de validation Mongoose
  if (err.name === 'ValidationError') {
    const message = 'Erreurs de validation';
    const errors: ValidationError = {};
    
    Object.values(err.errors).forEach((val: any) => {
      // Stocker les messages d'erreur dans un tableau
      if (!errors[val.path]) {
        errors[val.path] = [];
      }
      errors[val.path].push(val.message);
    });
    
    return res.status(400).json(
      ApiResponse.validation(message, errors)
    );
  }

  // Erreur de duplication MongoDB
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} déjà existant`;
    error = ApiError.conflict(message);
  }

  // Erreur CastError MongoDB (ID invalide)
  if (err.name === 'CastError') {
    const message = 'Ressource non trouvée';
    error = ApiError.notFound(message);
  }

  // Erreur JWT
  if (err.name === 'JsonWebTokenError') {
    const message = 'Token invalide';
    error = ApiError.unauthorized(message);
  }

  // Erreur JWT expiré
  if (err.name === 'TokenExpiredError') {
    const message = 'Token expiré';
    error = ApiError.unauthorized(message);
  }

  // Erreur de taille de fichier
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'Fichier trop volumineux';
    error = ApiError.badRequest(message);
  }

  // Erreur de type de fichier
  if (err.code === 'INVALID_FILE_TYPE') {
    const message = 'Type de fichier non autorisé';
    error = ApiError.badRequest(message);
  }

  // Si c'est une ApiError, utiliser ses propriétés
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json(
      ApiResponse.error(error.message)
    );
  }

  // Erreur par défaut
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Erreur interne du serveur';

  // En production, ne pas exposer les détails des erreurs
  const responseMessage = config.NODE_ENV === 'production' && statusCode === 500
    ? 'Erreur interne du serveur'
    : message;

  return res.status(statusCode).json(
    ApiResponse.error(responseMessage)
  );
};

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = ApiError.notFound(`Route non trouvée - ${req.originalUrl}`);
  next(error);
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};