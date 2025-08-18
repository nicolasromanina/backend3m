import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  getInventoryItems,
  getInventoryItemById,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  addStockMovement,
  getStockMovements,
  getLowStockItems,
  getInventoryStats,
  generateStockReport
} from '../controllers/inventory.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Validation schemas
const createInventoryItemValidation = [
  body('name')
    .trim()
    .notEmpty()
    .isLength({ max: 200 })
    .withMessage('Le nom est requis et ne peut pas dépasser 200 caractères'),
  body('category')
    .isIn(['papier', 'encre', 'finition', 'equipement', 'consommable'])
    .withMessage('Catégorie invalide'),
  body('currentStock')
    .isInt({ min: 0 })
    .withMessage('Le stock actuel doit être un entier positif'),
  body('minStock')
    .isInt({ min: 0 })
    .withMessage('Le stock minimum doit être un entier positif'),
  body('maxStock')
    .isInt({ min: 1 })
    .withMessage('Le stock maximum doit être au moins 1'),
  body('unit')
    .trim()
    .notEmpty()
    .withMessage('L\'unité est requise'),
  body('supplier.name')
    .trim()
    .notEmpty()
    .withMessage('Le nom du fournisseur est requis'),
  body('unitCost')
    .isFloat({ min: 0 })
    .withMessage('Le coût unitaire doit être un nombre positif')
];

const updateInventoryItemValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID d\'article invalide'),
  body('name')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Le nom ne peut pas dépasser 200 caractères'),
  body('currentStock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Le stock actuel doit être un entier positif'),
  body('unitCost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Le coût unitaire doit être un nombre positif')
];

const addStockMovementValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID d\'article invalide'),
  body('type')
    .isIn(['in', 'out', 'adjustment'])
    .withMessage('Type de mouvement invalide'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('La quantité doit être un entier positif'),
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('La raison est requise'),
  body('reference')
    .optional()
    .trim(),
  body('cost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Le coût doit être un nombre positif')
];

const getInventoryItemsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Le numéro de page doit être un entier positif'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('La limite doit être entre 1 et 100'),
  query('category')
    .optional()
    .isIn(['papier', 'encre', 'finition', 'equipement', 'consommable'])
    .withMessage('Catégorie invalide'),
  query('status')
    .optional()
    .isIn(['ok', 'low', 'critical', 'out_of_stock', 'discontinued'])
    .withMessage('Statut invalide'),
  query('search')
    .optional()
    .trim()
];

// Routes (admin uniquement)
router.get('/', authorize('admin'), validate(getInventoryItemsValidation), getInventoryItems);
router.get('/low-stock', authorize('admin'), getLowStockItems);
router.get('/stats', authorize('admin'), getInventoryStats);
router.get('/report', authorize('admin'), generateStockReport);
router.get('/:id', authorize('admin'), validate([param('id').isMongoId()]), getInventoryItemById);
router.post('/', authorize('admin'), validate(createInventoryItemValidation), createInventoryItem);
router.put('/:id', authorize('admin'), validate(updateInventoryItemValidation), updateInventoryItem);
router.delete('/:id', authorize('admin'), validate([param('id').isMongoId()]), deleteInventoryItem);

// Mouvements de stock
router.post('/:id/movements', authorize('admin'), validate(addStockMovementValidation), addStockMovement);
router.get('/:id/movements', authorize('admin'), validate([param('id').isMongoId()]), getStockMovements);

export default router;