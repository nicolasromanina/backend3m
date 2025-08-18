import { Router } from 'express';
import { body, query } from 'express-validator';
import {
  logActivity,
  getUserActivity,
  getUserStats,
  getSystemMetrics,
  updateSystemMetrics,
  getUserPreferences,
  updateUserPreferences,
  exportUserData,
  getAnalyticsDashboard
} from '../controllers/analytics.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Validation schemas
const logActivityValidation = [
  body('action')
    .trim()
    .notEmpty()
    .withMessage('Action requise'),
  body('resource')
    .trim()
    .notEmpty()
    .withMessage('Ressource requise'),
  body('resourceId')
    .optional()
    .trim(),
  body('details')
    .optional()
    .isObject()
    .withMessage('Les détails doivent être un objet'),
  body('duration')
    .optional()
    .isNumeric()
    .withMessage('La durée doit être un nombre')
];

const getUserActivityValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Le numéro de page doit être un entier positif'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('La limite doit être entre 1 et 100'),
  query('action')
    .optional()
    .trim(),
  query('resource')
    .optional()
    .trim()
];

const getSystemMetricsValidation = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Le nombre de jours doit être entre 1 et 365')
];

const updateUserPreferencesValidation = [
  body('notifications')
    .optional()
    .isObject()
    .withMessage('Les notifications doivent être un objet'),
  body('privacy')
    .optional()
    .isObject()
    .withMessage('La confidentialité doit être un objet'),
  body('interface')
    .optional()
    .isObject()
    .withMessage('L\'interface doit être un objet'),
  body('dashboard')
    .optional()
    .isObject()
    .withMessage('Le dashboard doit être un objet')
];

// Routes d'activité utilisateur
router.post('/activity', validate(logActivityValidation), logActivity);
router.get('/activity', validate(getUserActivityValidation), getUserActivity);
router.get('/stats', getUserStats);

// Routes de préférences utilisateur
router.get('/preferences', getUserPreferences);
router.put('/preferences', validate(updateUserPreferencesValidation), updateUserPreferences);

// Export de données utilisateur
router.get('/export', exportUserData);

// Routes admin
router.get('/system/metrics', authorize('admin'), validate(getSystemMetricsValidation), getSystemMetrics);
router.post('/system/metrics', authorize('admin'), updateSystemMetrics);
router.get('/dashboard', authorize('admin'), validate(getSystemMetricsValidation), getAnalyticsDashboard);

export default router;