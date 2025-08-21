import mongoose, { Schema, Types } from 'mongoose';

export interface IFileDocument extends mongoose.Document {
  originalName: string;
  filename: string;
  path: string;
  mimetype: string;
  size: number;
  uploadedBy: Types.ObjectId;
  orderId?: Types.ObjectId;
  fileType: 'design' | 'proof' | 'final' | 'template' | 'other';
  status: 'uploaded' | 'processing' | 'validated' | 'rejected' | 'converted';
  metadata: {
    dimensions?: { width: number; height: number };
    resolution?: number;
    colorMode?: 'CMYK' | 'RGB' | 'Grayscale';
    pages?: number;
    fileFormat?: string;
    printQuality?: 'low' | 'medium' | 'high' | 'print-ready';
  };
  versions: Array<{
    version: number;
    filename: string;
    path: string;
    changes: string;
    createdAt: Date;
    createdBy: Types.ObjectId;
  }>;
  validationResults: {
    isValid: boolean;
    issues: Array<{
      type: 'warning' | 'error';
      message: string;
      severity: 'low' | 'medium' | 'high';
    }>;
    recommendations: string[];
  };
  previewImages: string[];
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const fileDocumentSchema = new Schema<IFileDocument>({
  originalName: {
    type: String,
    required: [true, 'Le nom original du fichier est requis'],
    trim: true
  },
  filename: {
    type: String,
    required: [true, 'Le nom du fichier est requis'],
    unique: true
  },
  path: {
    type: String,
    required: [true, 'Le chemin du fichier est requis']
  },
  mimetype: {
    type: String,
    required: [true, 'Le type MIME est requis']
  },
  size: {
    type: Number,
    required: [true, 'La taille du fichier est requise'],
    min: [0, 'La taille ne peut pas être négative']
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'L\'utilisateur qui a uploadé le fichier est requis']
  },
  orderId: {
    type: Schema.Types.ObjectId,
    ref: 'Order'
  },
  fileType: {
    type: String,
    enum: ['design', 'proof', 'final', 'template', 'other'],
    default: 'design'
  },
  status: {
    type: String,
    enum: ['uploaded', 'processing', 'validated', 'rejected', 'converted'],
    default: 'uploaded'
  },
  metadata: {
    dimensions: {
      width: Number,
      height: Number
    },
    resolution: Number,
    colorMode: {
      type: String,
      enum: ['CMYK', 'RGB', 'Grayscale']
    },
    pages: Number,
    fileFormat: String,
    printQuality: {
      type: String,
      enum: ['low', 'medium', 'high', 'print-ready']
    }
  },
  versions: [{
    version: {
      type: Number,
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    changes: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  validationResults: {
    isValid: {
      type: Boolean,
      default: false
    },
    issues: [{
      type: {
        type: String,
        enum: ['warning', 'error'],
        required: true
      },
      message: {
        type: String,
        required: true
      },
      severity: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
      }
    }],
    recommendations: [String]
  },
  previewImages: [String],
  tags: [String],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index pour améliorer les performances
fileDocumentSchema.index({ uploadedBy: 1, createdAt: -1 });
fileDocumentSchema.index({ orderId: 1 });
fileDocumentSchema.index({ status: 1 });
fileDocumentSchema.index({ fileType: 1 });

export const FileDocument = mongoose.model<IFileDocument>('FileDocument', fileDocumentSchema);