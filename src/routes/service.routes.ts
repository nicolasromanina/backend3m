import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  createService,
  getServices,
  getServiceById,
  updateService,
  deleteService,
  calculatePrice,
  getServiceCategories,
  searchServices,
  getPopularServices
} from '../controllers/service.controller';
import { authenticate, authorize, optionalAuth } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';

const router = Router();

// Validation schemas
const createServiceValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Le nom est requis')
    .isLength({ max: 200 })
    .withMessage('Le nom ne peut pas dépasser 200 caractères'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('La description est requise')
    .isLength({ max: 1000 })
    .withMessage('La description ne peut pas dépasser 1000 caractères'),
  body('category')
    .isIn(['flyers', 'cartes', 'affiches', 'brochures', 'autres'])
    .withMessage('Catégorie invalide'),
  body('basePrice')
    .isFloat({ min: 0 })
    .withMessage('Le prix de base doit être un nombre positif'),
  body('unit')
    .isIn(['unité', 'page', 'm²'])
    .withMessage('Unité invalide'),
  body('minQuantity')
    .isInt({ min: 1 })
    .withMessage('La quantité minimum doit être au moins 1'),
  body('maxQuantity')
    .isInt({ min: 1 })
    .withMessage('La quantité maximum doit être au moins 1'),
  body('estimatedDeliveryDays')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Le délai de livraison doit être au moins 1 jour'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive doit être un booléen'),
  body('options')
    .optional()
    .isArray()
    .withMessage('Les options doivent être un tableau'),
  body('options.*.name')
    .if(body('options').exists())
    .notEmpty()
    .withMessage('Le nom de l\'option est requis'),
  body('options.*.type')
    .if(body('options').exists())
    .isIn(['select', 'checkbox', 'number'])
    .withMessage('Type d\'option invalide'),
  body('options.*.priceModifier')
    .if(body('options').exists())
    .isFloat()
    .withMessage('Le modificateur de prix doit être un nombre'),
  body('options.*.required')
    .if(body('options').exists())
    .isBoolean()
    .withMessage('Le champ required doit être un booléen'),
  body('options.*.options')
    .if((value, { req }) => req.body.options && req.body.options.some((opt: any) => opt.type === 'select'))
    .isArray({ min: 1 })
    .withMessage('Les options de sélection doivent avoir au moins une valeur')
];

const getServicesValidation = [
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
    .isIn(['all', 'flyers', 'cartes', 'affiches', 'brochures', 'autres'])
    .withMessage('Catégorie invalide'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive doit être un booléen')
];

const updateServiceValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID de service invalide'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Le nom ne peut pas dépasser 200 caractères'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('La description ne peut pas dépasser 1000 caractères'),
  body('basePrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Le prix de base doit être un nombre positif'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive doit être un booléen')
];

const calculatePriceValidation = [
  body('serviceId')
    .isMongoId()
    .withMessage('ID de service invalide'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('La quantité doit être un entier positif'),
  body('options')
    .optional()
    .isObject()
    .withMessage('Les options doivent être un objet')
];

const serviceIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID de service invalide')
];

const searchValidation = [
  query('q')
    .trim()
    .notEmpty()
    .withMessage('Terme de recherche requis'),
  query('category')
    .optional()
    .isIn(['flyers', 'cartes', 'affiches', 'brochures', 'autres'])
    .withMessage('Catégorie invalide')
];

// Routes publiques (avec authentification optionnelle)
router.get('/', optionalAuth, validate(getServicesValidation), getServices);
router.get('/categories', getServiceCategories);
router.get('/popular', getPopularServices);
router.get('/search', validate(searchValidation), searchServices);
router.get('/:id', optionalAuth, validate(serviceIdValidation), getServiceById);
router.post('/calculate-price', validate(calculatePriceValidation), calculatePrice);

// Routes admin uniquement
router.post('/', authenticate, authorize('admin'), validate(createServiceValidation), createService);
router.put('/:id', authenticate, authorize('admin'), validate(updateServiceValidation), updateService);
router.delete('/:id', authenticate, authorize('admin'), validate(serviceIdValidation), deleteService);

export default router;