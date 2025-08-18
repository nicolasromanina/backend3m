import { Router } from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  changePassword,
  getProfile
} from '../controllers/auth.controller';
import { authenticate, refreshTokenAuth } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';

const router = Router();

// Validation schemas
const registerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom doit contenir entre 2 et 100 caractères'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Numéro de téléphone invalide'),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('L\'adresse ne peut pas dépasser 500 caractères')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide'),
  body('password')
    .notEmpty()
    .withMessage('Mot de passe requis')
];

const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide')
];

const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Token requis'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre')
];

const verifyEmailValidation = [
  body('token')
    .notEmpty()
    .withMessage('Token requis')
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Mot de passe actuel requis'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Le nouveau mot de passe doit contenir au moins 8 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Le nouveau mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre')
];

const refreshTokenValidation = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token requis')
];

// Routes publiques
router.post('/register', validate(registerValidation), register);
router.post('/login', validate(loginValidation), login);
router.post('/forgot-password', validate(forgotPasswordValidation), forgotPassword);
router.post('/reset-password', validate(resetPasswordValidation), resetPassword);
router.post('/verify-email', validate(verifyEmailValidation), verifyEmail);
router.post('/refresh-token', validate(refreshTokenValidation), refreshTokenAuth, refreshToken);

// Routes protégées
router.post('/logout', authenticate, logout);
router.post('/change-password', authenticate, validate(changePasswordValidation), changePassword);
router.get('/profile', authenticate, getProfile);

export default router;