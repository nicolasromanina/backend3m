import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import ApiError from '../utils/apiError';
import config from '../config/env';

// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.UPLOAD_PATH);
  },
  filename: (req, file, cb) => {
    // Générer un nom unique
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// Filtre pour les types de fichiers
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Types de fichiers autorisés
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError('Type de fichier non autorisé', 400) as any, false);
  }
};

// Configuration de base
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.MAX_FILE_SIZE, // 10MB par défaut
    files: 10 // Maximum 10 fichiers
  }
});

// Middleware pour un seul fichier
export const uploadSingle = (fieldName: string) => {
  return upload.single(fieldName);
};

// Middleware pour plusieurs fichiers
export const uploadMultiple = (fieldName: string, maxCount: number = 10) => {
  return upload.array(fieldName, maxCount);
};

// Middleware pour plusieurs champs
export const uploadFields = (fields: { name: string; maxCount: number }[]) => {
  return upload.fields(fields);
};

// Middleware de gestion d'erreurs pour multer
export const handleUploadError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(ApiError.badRequest('Fichier trop volumineux'));
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return next(ApiError.badRequest('Trop de fichiers'));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(ApiError.badRequest('Champ de fichier inattendu'));
    }
  }
  next(err);
};