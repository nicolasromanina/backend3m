import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  createPayment,
  getPayments,
  getPaymentById,
  updatePaymentStatus,
  refundPayment,
  mvolaCallback,
  getPaymentStats,
  generateFinancialReport
} from '../controllers/payment.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';

const router = Router();

// Validation schemas
const createPaymentValidation = [
  body('orderId')
    .isMongoId()
    .withMessage('ID de commande invalide'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Montant invalide'),
  body('method')
    .isIn(['mvola', 'card', 'transfer', 'cash', 'check'])
    .withMessage('Méthode de paiement invalide'),
  body('phoneNumber')
    .if(body('method').equals('mvola'))
    .isMobilePhone('any')
    .withMessage('Numéro de téléphone requis pour Mvola'),
  body('installmentPlan')
    .optional()
    .isObject()
    .withMessage('Plan d\'échelonnement invalide')
];

const updatePaymentValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID de paiement invalide'),
  body('status')
    .isIn(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'])
    .withMessage('Statut invalide')
];

const refundPaymentValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID de paiement invalide'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Montant de remboursement invalide'),
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Raison du remboursement requise')
];

const generateReportValidation = [
  body('reportType')
    .isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
    .withMessage('Type de rapport invalide'),
  body('startDate')
    .isISO8601()
    .withMessage('Date de début invalide'),
  body('endDate')
    .isISO8601()
    .withMessage('Date de fin invalide')
];

// Routes publiques
router.post('/mvola/callback', mvolaCallback);

// Routes authentifiées
router.use(authenticate);

router.post('/', validate(createPaymentValidation), createPayment);
router.get('/', getPayments);
router.get('/stats', getPaymentStats);
router.get('/:id', validate([param('id').isMongoId()]), getPaymentById);

// Routes admin
router.put('/:id/status', authorize('admin'), validate(updatePaymentValidation), updatePaymentStatus);
router.post('/:id/refund', authorize('admin'), validate(refundPaymentValidation), refundPayment);
router.post('/reports/generate', authorize('admin'), validate(generateReportValidation), generateFinancialReport);

export default router;