import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  generateQuote,
  generateInvoice,
  getOrderStats
} from '../controllers/order.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';

const router = Router();

// Validation schemas
const createOrderValidation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Au moins un article est requis'),
  body('items.*.serviceId')
    .isMongoId()
    .withMessage('ID de service invalide'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('La quantité doit être un entier positif'),
  body('billingAddress.name')
    .trim()
    .notEmpty()
    .withMessage('Nom de facturation requis'),
  body('billingAddress.street')
    .trim()
    .notEmpty()
    .withMessage('Adresse de facturation requise'),
  body('billingAddress.city')
    .trim()
    .notEmpty()
    .withMessage('Ville de facturation requise'),
  body('billingAddress.postalCode')
    .trim()
    .notEmpty()
    .withMessage('Code postal de facturation requis'),
  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priorité invalide')
];

const getOrdersValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Le numéro de page doit être un entier positif'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('La limite doit être entre 1 et 100'),
  query('status')
    .optional()
    .isIn(['draft', 'quote', 'pending', 'confirmed', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled'])
    .withMessage('Statut invalide'),
  query('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priorité invalide')
];

const updateOrderValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID de commande invalide'),
  body('status')
    .optional()
    .isIn(['draft', 'quote', 'pending', 'confirmed', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled'])
    .withMessage('Statut invalide'),
  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Priorité invalide'),
  body('assignedTo')
    .optional()
    .isMongoId()
    .withMessage('ID d\'assignation invalide')
];

const orderIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID de commande invalide')
];

// Routes
router.post('/', authenticate, validate(createOrderValidation), createOrder);
router.get('/', authenticate, validate(getOrdersValidation), getOrders);
router.get('/stats', authenticate, getOrderStats);
router.get('/:id', authenticate, validate(orderIdValidation), getOrderById);
router.put('/:id', authenticate, validate(updateOrderValidation), updateOrder);
router.delete('/:id', authenticate, validate(orderIdValidation), deleteOrder);

// Actions spéciales (admin uniquement)
router.post('/:id/quote', authenticate, authorize('admin'), validate(orderIdValidation), generateQuote);
router.post('/:id/invoice', authenticate, authorize('admin'), validate(orderIdValidation), generateInvoice);

export default router;