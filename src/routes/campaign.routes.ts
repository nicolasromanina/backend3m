import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  executeCampaign,
  getCampaignStats,
  createEmailTemplate,
  getEmailTemplates,
  getEmailTemplateById,
  updateEmailTemplate,
  deleteEmailTemplate,
  previewEmailTemplate
} from '../controllers/campaign.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';

const router = Router();

// Toutes les routes nécessitent une authentification admin
router.use(authenticate, authorize('admin'));

// Validation schemas
const createCampaignValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Le nom de la campagne est requis'),
  body('type')
    .isIn(['email', 'sms', 'push'])
    .withMessage('Type de campagne invalide'),
  body('targetSegmentId')
    .isMongoId()
    .withMessage('ID de segment invalide'),
  body('templateId')
    .optional()
    .isMongoId()
    .withMessage('ID de template invalide'),
  body('customTemplate')
    .optional()
    .isObject()
    .withMessage('Template personnalisé invalide')
];

const createTemplateValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Le nom du template est requis'),
  body('category')
    .isIn(['marketing', 'transactional', 'notification'])
    .withMessage('Catégorie invalide'),
  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Le sujet est requis'),
  body('htmlContent')
    .trim()
    .notEmpty()
    .withMessage('Le contenu HTML est requis')
];

// Routes des campagnes
router.get('/', getCampaigns);
router.post('/', validate(createCampaignValidation), createCampaign);
router.get('/:id', validate([param('id').isMongoId()]), getCampaignById);
router.put('/:id', validate([param('id').isMongoId()]), updateCampaign);
router.post('/:id/execute', validate([param('id').isMongoId()]), executeCampaign);
router.get('/:id/stats', validate([param('id').isMongoId()]), getCampaignStats);

// Routes des templates
router.get('/templates/email', getEmailTemplates);
router.post('/templates/email', validate(createTemplateValidation), createEmailTemplate);
router.get('/templates/email/:id', validate([param('id').isMongoId()]), getEmailTemplateById);
router.put('/templates/email/:id', validate([param('id').isMongoId()]), updateEmailTemplate);
router.delete('/templates/email/:id', validate([param('id').isMongoId()]), deleteEmailTemplate);
router.post('/templates/email/:id/preview', validate([param('id').isMongoId()]), previewEmailTemplate);

export default router;