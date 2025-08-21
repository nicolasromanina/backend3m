import { Request, Response } from 'express';
import { FileDocument } from '../models/file.model';
import ApiError from '../utils/apiError';
import ApiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middlewares/error.middleware';
import { fileProcessingService } from '../services/file.service';
import path from 'path';
import fs from 'fs';

export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  const { orderId, fileType = 'design', tags } = req.body;
  const userId = req.user.id;

  if (!file) {
    throw ApiError.badRequest('Aucun fichier fourni');
  }

  // Créer l'enregistrement du fichier
  const fileDocument = await FileDocument.create({
    originalName: file.originalname,
    filename: file.filename,
    path: file.path,
    mimetype: file.mimetype,
    size: file.size,
    uploadedBy: userId,
    orderId,
    fileType,
    tags: tags ? tags.split(',') : [],
    status: 'uploaded'
  });

  // Démarrer le traitement asynchrone
  fileProcessingService.processFile(fileDocument._id.toString())
    .catch(error => console.error('Erreur traitement fichier:', error));

  res.status(201).json(
    ApiResponse.created('Fichier uploadé avec succès', { file: fileDocument })
  );
});

export const getFiles = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const fileType = req.query.fileType as string;
  const status = req.query.status as string;
  const orderId = req.query.orderId as string;

  const query: any = { isActive: true };
  
  // Si c'est un client, ne montrer que ses fichiers
  if (req.user.role === 'client') {
    query.uploadedBy = req.user.id;
  }
  
  if (fileType) query.fileType = fileType;
  if (status) query.status = status;
  if (orderId) query.orderId = orderId;

  const [files, total] = await Promise.all([
    FileDocument.find(query)
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit),
    FileDocument.countDocuments(query)
  ]);

  res.json(
    ApiResponse.paginated(
      'Fichiers récupérés',
      files,
      page,
      Math.ceil(total / limit),
      total,
      limit
    )
  );
});

export const getFileById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const file = await FileDocument.findById(id)
    .populate('uploadedBy', 'name email')
    .populate('versions.createdBy', 'name email');

  if (!file) {
    throw ApiError.notFound('Fichier non trouvé');
  }

  // Vérifier les permissions
  if (req.user.role === 'client' && file.uploadedBy._id.toString() !== req.user.id) {
    throw ApiError.forbidden('Accès non autorisé à ce fichier');
  }

  res.json(
    ApiResponse.success('Fichier récupéré', { file })
  );
});

export const downloadFile = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { version } = req.query;

  const file = await FileDocument.findById(id);
  if (!file) {
    throw ApiError.notFound('Fichier non trouvé');
  }

  // Vérifier les permissions
  if (req.user.role === 'client' && file.uploadedBy.toString() !== req.user.id) {
    throw ApiError.forbidden('Accès non autorisé à ce fichier');
  }

  let filePath = file.path;
  let filename = file.originalName;

  // Si une version spécifique est demandée
  if (version) {
    const versionNumber = parseInt(version as string);
    const fileVersion = file.versions.find(v => v.version === versionNumber);
    if (fileVersion) {
      filePath = fileVersion.path;
      filename = fileVersion.filename;
    }
  }

  // Vérifier que le fichier existe
  if (!fs.existsSync(filePath)) {
    throw ApiError.notFound('Fichier physique non trouvé');
  }

  res.download(filePath, filename);
});

export const getFilePreview = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { page = 1 } = req.query;

  const file = await FileDocument.findById(id);
  if (!file) {
    throw ApiError.notFound('Fichier non trouvé');
  }

  // Vérifier les permissions
  if (req.user.role === 'client' && file.uploadedBy.toString() !== req.user.id) {
    throw ApiError.forbidden('Accès non autorisé à ce fichier');
  }

  if (!file.previewImages || file.previewImages.length === 0) {
    throw ApiError.notFound('Aucune prévisualisation disponible');
  }

  const pageIndex = parseInt(page as string) - 1;
  const previewPath = file.previewImages[pageIndex] || file.previewImages[0];

  if (!fs.existsSync(previewPath)) {
    throw ApiError.notFound('Image de prévisualisation non trouvée');
  }

  res.sendFile(path.resolve(previewPath));
});

export const validateFile = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const file = await FileDocument.findById(id);
  if (!file) {
    throw ApiError.notFound('Fichier non trouvé');
  }

  // Relancer la validation
  const validationResults = await fileProcessingService.validateFile(file.path, file.mimetype);
  
  file.validationResults = validationResults;
  file.status = validationResults.isValid ? 'validated' : 'rejected';
  await file.save();

  res.json(
    ApiResponse.success('Fichier validé', { 
      file,
      validationResults 
    })
  );
});

export const convertFile = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { targetFormat } = req.body;

  if (!targetFormat) {
    throw ApiError.badRequest('Format cible requis');
  }

  const file = await FileDocument.findById(id);
  if (!file) {
    throw ApiError.notFound('Fichier non trouvé');
  }

  // Vérifier les permissions
  if (req.user.role === 'client' && file.uploadedBy.toString() !== req.user.id) {
    throw ApiError.forbidden('Accès non autorisé à ce fichier');
  }

  try {
    file.status = 'processing';
    await file.save();

    const convertedPath = await fileProcessingService.convertFile(
      file.path, 
      file.mimetype, 
      targetFormat
    );

    // Créer une nouvelle version
    const version = file.versions.length + 1;
    file.versions.push({
      version,
      filename: `${path.parse(file.originalName).name}_v${version}.${targetFormat}`,
      path: convertedPath,
      changes: `Conversion vers ${targetFormat}`,
      createdBy: req.user.id,
      createdAt: new Date()
    });

    file.status = 'converted';
    await file.save();

    res.json(
      ApiResponse.success('Fichier converti avec succès', { file })
    );
  } catch (error) {
    file.status = 'rejected';
    await file.save();
    throw ApiError.internal('Erreur lors de la conversion');
  }
});

export const createFileVersion = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const file = req.file;
  const { changes } = req.body;

  if (!file) {
    throw ApiError.badRequest('Aucun fichier fourni');
  }

  const originalFile = await FileDocument.findById(id);
  if (!originalFile) {
    throw ApiError.notFound('Fichier original non trouvé');
  }

  // Vérifier les permissions
  if (req.user.role === 'client' && originalFile.uploadedBy.toString() !== req.user.id) {
    throw ApiError.forbidden('Accès non autorisé à ce fichier');
  }

  const version = originalFile.versions.length + 1;
  originalFile.versions.push({
    version,
    filename: file.filename,
    path: file.path,
    changes: changes || `Version ${version}`,
    createdBy: req.user.id,
    createdAt: new Date()
  });

  await originalFile.save();

  res.json(
    ApiResponse.success('Nouvelle version créée', { file: originalFile })
  );
});

export const deleteFile = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const file = await FileDocument.findById(id);
  if (!file) {
    throw ApiError.notFound('Fichier non trouvé');
  }

  // Vérifier les permissions
  if (req.user.role === 'client' && file.uploadedBy.toString() !== req.user.id) {
    throw ApiError.forbidden('Accès non autorisé à ce fichier');
  }

  // Marquer comme inactif au lieu de supprimer
  file.isActive = false;
  await file.save();

  res.json(
    ApiResponse.deleted('Fichier supprimé')
  );
});

export const getFileStats = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.role === 'client' ? req.user.id : undefined;
  const matchStage = userId ? { uploadedBy: userId, isActive: true } : { isActive: true };

  const stats = await FileDocument.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalFiles: { $sum: 1 },
        totalSize: { $sum: '$size' },
        avgSize: { $avg: '$size' },
        byType: {
          $push: {
            type: '$fileType',
            size: '$size'
          }
        },
        byStatus: {
          $push: '$status'
        }
      }
    }
  ]);

  const typeStats = await FileDocument.aggregate([
    { $match: matchStage },
    { $group: { _id: '$fileType', count: { $sum: 1 }, totalSize: { $sum: '$size' } } }
  ]);

  const statusStats = await FileDocument.aggregate([
    { $match: matchStage },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  res.json(
    ApiResponse.success('Statistiques des fichiers', {
      general: stats[0] || {
        totalFiles: 0,
        totalSize: 0,
        avgSize: 0
      },
      byType: typeStats,
      byStatus: statusStats
    })
  );
});