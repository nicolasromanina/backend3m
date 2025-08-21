import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { FileDocument } from '../models/file.model';
import logger from '../utils/logger';
import config from '../config/env';

// Types pour les résultats de validation
interface ValidationResult {
  isValid: boolean;
  issues: Array<{
    type: 'warning' | 'error';
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  recommendations: string[];
}

interface FileMetadata {
  dimensions?: { width: number; height: number };
  resolution?: number;
  colorMode?: 'CMYK' | 'RGB' | 'Grayscale';
  pages?: number;
  fileFormat?: string;
  printQuality?: 'low' | 'medium' | 'high' | 'print-ready';
}

class FileProcessingService {
  private readonly supportedFormats = {
    images: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif'],
    documents: ['.pdf', '.ai', '.eps', '.psd', '.indd'],
    vectors: ['.svg', '.ai', '.eps']
  };

  private readonly previewsDir = path.join(config.UPLOAD_PATH, 'previews');
  private readonly conversionsDir = path.join(config.UPLOAD_PATH, 'conversions');

  constructor() {
    // Créer les dossiers nécessaires
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    [this.previewsDir, this.conversionsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async processFile(fileId: string): Promise<void> {
    try {
      const file = await FileDocument.findById(fileId);
      if (!file) {
        throw new Error('Fichier non trouvé');
      }

      logger.info(`Début du traitement du fichier: ${file.filename}`);

      // 1. Extraire les métadonnées
      const metadata = await this.extractMetadata(file.path, file.mimetype);
      file.metadata = metadata;

      // 2. Valider le fichier
      const validationResults = await this.validateFile(file.path, file.mimetype);
      file.validationResults = validationResults;

      // 3. Générer les prévisualisations
      const previewImages = await this.generatePreviews(file.path, file.mimetype);
      file.previewImages = previewImages;

      // 4. Mettre à jour le statut
      file.status = validationResults.isValid ? 'validated' : 'rejected';

      await file.save();
      logger.info(`Traitement terminé pour le fichier: ${file.filename}`);

    } catch (error) {
      logger.error(`Erreur lors du traitement du fichier ${fileId}:`, error);
      
      // Marquer le fichier comme rejeté en cas d'erreur
      await FileDocument.findByIdAndUpdate(fileId, {
        status: 'rejected',
        'validationResults.isValid': false,
        'validationResults.issues': [{
          type: 'error',
          message: 'Erreur lors du traitement du fichier',
          severity: 'high'
        }]
      });
    }
  }

  async extractMetadata(filePath: string, mimetype: string): Promise<FileMetadata> {
    const metadata: FileMetadata = {};

    try {
      if (mimetype.startsWith('image/')) {
        const imageMetadata = await sharp(filePath).metadata();
        
        metadata.dimensions = {
          width: imageMetadata.width || 0,
          height: imageMetadata.height || 0
        };
        
        metadata.resolution = imageMetadata.density || 72;
        metadata.fileFormat = imageMetadata.format;
        
        // Déterminer le mode couleur basé sur les canaux
        if (imageMetadata.channels === 1) {
          metadata.colorMode = 'Grayscale';
        } else if (imageMetadata.channels === 3) {
          metadata.colorMode = 'RGB';
        } else if (imageMetadata.channels === 4) {
          metadata.colorMode = 'CMYK';
        }

        // Évaluer la qualité d'impression
        if (metadata.resolution >= 300) {
          metadata.printQuality = 'print-ready';
        } else if (metadata.resolution >= 150) {
          metadata.printQuality = 'high';
        } else if (metadata.resolution >= 72) {
          metadata.printQuality = 'medium';
        } else {
          metadata.printQuality = 'low';
        }
      }

      // Pour les PDF, on pourrait utiliser pdf-poppler ou pdf2pic
      if (mimetype === 'application/pdf') {
        // Simulation - dans un vrai projet, utiliser une bibliothèque PDF
        metadata.pages = 1;
        metadata.fileFormat = 'PDF';
        metadata.printQuality = 'high';
      }

    } catch (error) {
      logger.error('Erreur extraction métadonnées:', error);
    }

    return metadata;
  }

  async validateFile(filePath: string, mimetype: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      issues: [],
      recommendations: []
    };

    try {
      // Vérifier la taille du fichier
      const stats = fs.statSync(filePath);
      if (stats.size > 100 * 1024 * 1024) { // 100MB
        result.issues.push({
          type: 'warning',
          message: 'Fichier très volumineux (>100MB)',
          severity: 'medium'
        });
        result.recommendations.push('Considérez compresser le fichier pour réduire sa taille');
      }

      // Validation spécifique aux images
      if (mimetype.startsWith('image/')) {
        const imageMetadata = await sharp(filePath).metadata();
        
        // Vérifier la résolution
        if (imageMetadata.density && imageMetadata.density < 150) {
          result.issues.push({
            type: 'warning',
            message: `Résolution faible: ${imageMetadata.density} DPI`,
            severity: 'high'
          });
          result.recommendations.push('Utilisez une résolution d\'au moins 300 DPI pour l\'impression');
        }

        // Vérifier les dimensions
        if (imageMetadata.width && imageMetadata.height) {
          if (imageMetadata.width < 300 || imageMetadata.height < 300) {
            result.issues.push({
              type: 'warning',
              message: 'Dimensions très petites',
              severity: 'medium'
            });
          }
        }

        // Vérifier le mode couleur pour l'impression
        if (imageMetadata.space === 'srgb') {
          result.recommendations.push('Convertissez en CMYK pour une impression optimale');
        }
      }

      // Validation des formats supportés
      const ext = path.extname(filePath).toLowerCase();
      const allSupportedFormats = [
        ...this.supportedFormats.images,
        ...this.supportedFormats.documents,
        ...this.supportedFormats.vectors
      ];

      if (!allSupportedFormats.includes(ext)) {
        result.issues.push({
          type: 'error',
          message: `Format de fichier non supporté: ${ext}`,
          severity: 'high'
        });
        result.isValid = false;
      }

      // Si pas d'erreurs critiques, le fichier est valide
      const hasErrors = result.issues.some(issue => issue.type === 'error');
      result.isValid = !hasErrors;

    } catch (error) {
      logger.error('Erreur validation fichier:', error);
      result.isValid = false;
      result.issues.push({
        type: 'error',
        message: 'Erreur lors de la validation du fichier',
        severity: 'high'
      });
    }

    return result;
  }

  async generatePreviews(filePath: string, mimetype: string): Promise<string[]> {
    const previews: string[] = [];

    try {
      const filename = path.basename(filePath, path.extname(filePath));
      
      if (mimetype.startsWith('image/')) {
        // Générer différentes tailles de prévisualisation
        const sizes = [
          { name: 'thumbnail', width: 150, height: 150 },
          { name: 'medium', width: 500, height: 500 },
          { name: 'large', width: 1200, height: 1200 }
        ];

        for (const size of sizes) {
          const previewPath = path.join(
            this.previewsDir,
            `${filename}_${size.name}.jpg`
          );

          await sharp(filePath)
            .resize(size.width, size.height, { 
              fit: 'inside',
              withoutEnlargement: true 
            })
            .jpeg({ quality: 85 })
            .toFile(previewPath);

          previews.push(previewPath);
        }
      }

      // Pour les PDF, on pourrait utiliser pdf2pic
      if (mimetype === 'application/pdf') {
        // Simulation - générer une prévisualisation de la première page
        const previewPath = path.join(this.previewsDir, `${filename}_page1.jpg`);
        
        // Dans un vrai projet, utiliser pdf2pic ou ghostscript
        // const convert = fromPath(filePath, { format: 'jpeg', out_dir: this.previewsDir });
        // const result = await convert(1);
        
        // Pour la simulation, créer un placeholder
        await sharp({
          create: {
            width: 500,
            height: 700,
            channels: 3,
            background: { r: 255, g: 255, b: 255 }
          }
        })
        .jpeg()
        .toFile(previewPath);

        previews.push(previewPath);
      }

    } catch (error) {
      logger.error('Erreur génération prévisualisations:', error);
    }

    return previews;
  }

  async convertFile(filePath: string, currentMimetype: string, targetFormat: string): Promise<string> {
    const filename = path.basename(filePath, path.extname(filePath));
    const outputPath = path.join(this.conversionsDir, `${filename}_converted.${targetFormat}`);

    try {
      if (currentMimetype.startsWith('image/')) {
        // Conversion d'image avec Sharp
        let pipeline = sharp(filePath);

        switch (targetFormat.toLowerCase()) {
          case 'jpg':
          case 'jpeg':
            await pipeline.jpeg({ quality: 90 }).toFile(outputPath);
            break;
          case 'png':
            await pipeline.png({ quality: 90 }).toFile(outputPath);
            break;
          case 'webp':
            await pipeline.webp({ quality: 90 }).toFile(outputPath);
            break;
          case 'tiff':
            await pipeline.tiff({ quality: 90 }).toFile(outputPath);
            break;
          default:
            throw new Error(`Format de conversion non supporté: ${targetFormat}`);
        }
      } else {
        throw new Error('Conversion non supportée pour ce type de fichier');
      }

      return outputPath;
    } catch (error) {
      logger.error('Erreur conversion fichier:', error);
      throw error;
    }
  }

  async optimizeForPrint(filePath: string, mimetype: string): Promise<string> {
    if (!mimetype.startsWith('image/')) {
      throw new Error('Optimisation disponible uniquement pour les images');
    }

    const filename = path.basename(filePath, path.extname(filePath));
    const outputPath = path.join(this.conversionsDir, `${filename}_print_optimized.jpg`);

    try {
      await sharp(filePath)
        .resize(null, null, { withoutEnlargement: true })
        .jpeg({ 
          quality: 95,
          chromaSubsampling: '4:4:4' // Meilleure qualité pour l'impression
        })
        .withMetadata() // Conserver les métadonnées
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      logger.error('Erreur optimisation impression:', error);
      throw error;
    }
  }

  async getFileInfo(filePath: string): Promise<any> {
    try {
      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      let info: any = {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        extension: ext
      };

      if (this.supportedFormats.images.includes(ext)) {
        const metadata = await sharp(filePath).metadata();
        info = { ...info, ...metadata };
      }

      return info;
    } catch (error) {
      logger.error('Erreur récupération info fichier:', error);
      throw error;
    }
  }
}

export const fileProcessingService = new FileProcessingService();