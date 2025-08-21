import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  uploadFile,
  uploadMultipleFiles,
  getFiles,
  getFileById,
  downloadFile,
  downloadMultipleFiles,
  getFilePreview,
  validateFile,
  convertFile,
  createFileVersion,
  deleteFile,
  getFileStats,
  getFileAnalytics,
  optimizeFileForPrint,
  compareFileVersions
} from '../controllers/file.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { uploadSingle, uploadMultiple, handleUploadError } from '../middlewares/upload.middleware';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Validation schemas
const uploadValidation = [
  body('orderId')
    .optional()
    .isMongoId()
    .withMessage('ID de commande invalide'),
  body('fileType')
    .optional()
    .isIn(['design', 'proof', 'final', 'template', 'other'])
    .withMessage('Type de fichier invalide')
];

const convertFileValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID de fichier invalide'),
  body('targetFormat')
    .isIn(['jpg', 'jpeg', 'png', 'pdf', 'tiff', 'webp'])
    .withMessage('Format cible invalide')
];

const getFilesValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Numéro de page invalide'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limite invalide'),
  query('fileType')
    .optional()
    .isIn(['design', 'proof', 'final', 'template', 'other'])
    .withMessage('Type de fichier invalide'),
  query('status')
    .optional()
    .isIn(['uploaded', 'processing', 'validated', 'rejected', 'converted'])
    .withMessage('Statut invalide')
];

// Routes d'upload
router.post('/upload', uploadSingle('file'), handleUploadError, validate(uploadValidation), uploadFile);
router.post('/upload/multiple', uploadMultiple('files', 10), handleUploadError, validate(uploadValidation), uploadMultipleFiles);

// Routes de gestion des fichiers
router.get('/', validate(getFilesValidation), getFiles);
router.get('/stats', getFileStats);
router.get('/analytics', getFileAnalytics);
router.get('/:id', validate([param('id').isMongoId()]), getFileById);
router.get('/:id/download', validate([param('id').isMongoId()]), downloadFile);
router.post('/download/multiple', downloadMultipleFiles);
router.get('/:id/preview', validate([param('id').isMongoId()]), getFilePreview);
router.delete('/:id', validate([param('id').isMongoId()]), deleteFile);

// Routes de traitement
router.post('/:id/validate', validate([param('id').isMongoId()]), validateFile);
router.post('/:id/convert', validate(convertFileValidation), convertFile);
router.post('/:id/optimize', validate([param('id').isMongoId()]), optimizeFileForPrint);
router.get('/:id/compare', validate([param('id').isMongoId()]), compareFileVersions);

// Versions de fichiers
router.post('/:id/versions', validate([param('id').isMongoId()]), uploadSingle('file'), handleUploadError, createFileVersion);

export default router;