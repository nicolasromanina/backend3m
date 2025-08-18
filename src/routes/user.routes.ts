import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  updateProfile,
  uploadAvatar,
  deleteAccount,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats
} from '../controllers/user.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { uploadSingle, handleUploadError } from '../middlewares/upload.middleware';

const router = Router();

// Validation schemas
const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom doit contenir entre 2 et 100 caractères'),
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

const deleteAccountValidation = [
  body('password')
    .notEmpty()
    .withMessage('Mot de passe requis pour supprimer le compte')
];

const getUsersValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Le numéro de page doit être un entier positif'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('La limite doit être entre 1 et 100'),
  query('role')
    .optional()
    .isIn(['client', 'admin', 'employee'])
    .withMessage('Rôle invalide'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive doit être un booléen')
];

const updateUserValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID utilisateur invalide'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom doit contenir entre 2 et 100 caractères'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide'),
  body('role')
    .optional()
    .isIn(['client', 'admin', 'employee'])
    .withMessage('Rôle invalide'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive doit être un booléen')
];

const userIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID utilisateur invalide')
];

// Routes utilisateur (authentifié)
router.put('/profile', authenticate, validate(updateProfileValidation), updateProfile);
router.post('/avatar', authenticate, uploadSingle('avatar'), handleUploadError, uploadAvatar);
router.delete('/account', authenticate, validate(deleteAccountValidation), deleteAccount);

// Routes admin uniquement
router.get('/', authenticate, authorize('admin'), validate(getUsersValidation), getAllUsers);
router.get('/stats', authenticate, authorize('admin'), getUserStats);
router.get('/:id', authenticate, authorize('admin'), validate(userIdValidation), getUserById);
router.put('/:id', authenticate, authorize('admin'), validate(updateUserValidation), updateUser);
router.delete('/:id', authenticate, authorize('admin'), validate(userIdValidation), deleteUser);

export default router;