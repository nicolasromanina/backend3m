import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getShifts,
  createShift,
  updateShift,
  deleteShift,
  getTrainings,
  createTraining,
  updateTraining,
  enrollInTraining,
  completeTraining,
  getTickets,
  createTicket,
  updateTicket,
  assignTicket,
  getPerformanceReviews,
  createPerformanceReview,
  updatePerformanceReview,
  getTeamStats
} from '../controllers/team.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Validation schemas pour les employés
const createEmployeeValidation = [
  body('userId')
    .isMongoId()
    .withMessage('ID utilisateur invalide'),
  body('department')
    .isIn(['production', 'commercial', 'admin', 'design', 'logistics'])
    .withMessage('Département invalide'),
  body('position')
    .trim()
    .notEmpty()
    .withMessage('Le poste est requis'),
  body('level')
    .isIn(['intern', 'junior', 'senior', 'lead', 'manager'])
    .withMessage('Niveau invalide'),
  body('hireDate')
    .isISO8601()
    .withMessage('Date d\'embauche invalide')
];

// Routes des employés (admin uniquement)
router.get('/employees', authorize('admin'), getEmployees);
router.get('/employees/:id', authorize('admin'), validate([param('id').isMongoId()]), getEmployeeById);
router.post('/employees', authorize('admin'), validate(createEmployeeValidation), createEmployee);
router.put('/employees/:id', authorize('admin'), updateEmployee);
router.delete('/employees/:id', authorize('admin'), deleteEmployee);

// Routes des shifts
router.get('/shifts', authorize('admin'), getShifts);
router.post('/shifts', authorize('admin'), createShift);
router.put('/shifts/:id', authorize('admin'), updateShift);
router.delete('/shifts/:id', authorize('admin'), deleteShift);

// Routes des formations
router.get('/trainings', getTrainings);
router.post('/trainings', authorize('admin'), createTraining);
router.put('/trainings/:id', authorize('admin'), updateTraining);
router.post('/trainings/:id/enroll', enrollInTraining);
router.post('/trainings/:id/complete', completeTraining);

// Routes des tickets
router.get('/tickets', getTickets);
router.post('/tickets', createTicket);
router.put('/tickets/:id', updateTicket);
router.post('/tickets/:id/assign', authorize('admin'), assignTicket);

// Routes des évaluations de performance
router.get('/performance-reviews', getPerformanceReviews);
router.post('/performance-reviews', authorize('admin'), createPerformanceReview);
router.put('/performance-reviews/:id', updatePerformanceReview);

// Statistiques d'équipe
router.get('/stats', authorize('admin'), getTeamStats);

export default router;