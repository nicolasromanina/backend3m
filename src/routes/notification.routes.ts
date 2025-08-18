import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  subscribeToPush,
  unsubscribeFromPush,
  createNotification,
  sendBulkNotification,
  getNotificationStats
} from '../controllers/notification.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Validation schemas
const getNotificationsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Le numéro de page doit être un entier positif'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('La limite doit être entre 1 et 100'),
  query('type')
    .optional()
    .isIn(['info', 'success', 'warning', 'error', 'order', 'chat', 'system'])
    .withMessage('Type de notification invalide'),
  query('category')
    .optional()
    .isIn(['order', 'payment', 'system', 'promotion', 'reminder', 'security'])
    .withMessage('Catégorie de notification invalide'),
  query('isRead')
    .optional()
    .isBoolean()
    .withMessage('isRead doit être un booléen')
];

const subscribeToPushValidation = [
  body('subscription')
    .isObject()
    .withMessage('Objet de souscription requis'),
  body('subscription.endpoint')
    .isURL()
    .withMessage('Endpoint valide requis'),
  body('subscription.keys')
    .isObject()
    .withMessage('Clés de souscription requises'),
  body('subscription.keys.p256dh')
    .notEmpty()
    .withMessage('Clé p256dh requise'),
  body('subscription.keys.auth')
    .notEmpty()
    .withMessage('Clé auth requise')
];

const unsubscribeFromPushValidation = [
  body('endpoint')
    .isURL()
    .withMessage('Endpoint valide requis')
];

const createNotificationValidation = [
  body('userId')
    .isMongoId()
    .withMessage('ID utilisateur invalide'),
  body('title')
    .trim()
    .notEmpty()
    .isLength({ max: 100 })
    .withMessage('Titre requis (max 100 caractères)'),
  body('message')
    .trim()
    .notEmpty()
    .isLength({ max: 500 })
    .withMessage('Message requis (max 500 caractères)'),
  body('category')
    .isIn(['order', 'payment', 'system', 'promotion', 'reminder', 'security'])
    .withMessage('Catégorie invalide'),
  body('type')
    .optional()
    .isIn(['info', 'success', 'warning', 'error', 'order', 'chat', 'system'])
    .withMessage('Type invalide'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priorité invalide')
];

const bulkNotificationValidation = [
  body('userIds')
    .isArray({ min: 1 })
    .withMessage('Liste d\'utilisateurs requise'),
  body('userIds.*')
    .isMongoId()
    .withMessage('ID utilisateur invalide'),
  body('notificationData')
    .isObject()
    .withMessage('Données de notification requises'),
  body('notificationData.title')
    .trim()
    .notEmpty()
    .withMessage('Titre requis'),
  body('notificationData.message')
    .trim()
    .notEmpty()
    .withMessage('Message requis'),
  body('notificationData.category')
    .isIn(['order', 'payment', 'system', 'promotion', 'reminder', 'security'])
    .withMessage('Catégorie invalide')
];

// Routes utilisateur
router.get('/', validate(getNotificationsValidation), getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/:id/read', validate([param('id').isMongoId()]), markAsRead);
router.put('/mark-all-read', markAllAsRead);

// Routes push notifications
router.post('/push/subscribe', validate(subscribeToPushValidation), subscribeToPush);
router.post('/push/unsubscribe', validate(unsubscribeFromPushValidation), unsubscribeFromPush);

// Routes admin
router.post('/', authorize('admin'), validate(createNotificationValidation), createNotification);
router.post('/bulk', authorize('admin'), validate(bulkNotificationValidation), sendBulkNotification);
router.get('/stats', authorize('admin'), getNotificationStats);

export default router;