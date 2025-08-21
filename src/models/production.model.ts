import mongoose, { Schema, Types } from 'mongoose';

export interface IProductionMachine extends mongoose.Document {
  name: string;
  type: 'digital' | 'offset' | 'large_format' | 'finishing';
  model: string;
  manufacturer: string;
  capabilities: {
    maxWidth: number;
    maxHeight: number;
    minWidth: number;
    minHeight: number;
    supportedFormats: string[];
    colorModes: string[];
    maxResolution: number;
    speedPagesPerHour: number;
  };
  status: 'available' | 'busy' | 'maintenance' | 'broken' | 'offline';
  currentJob?: Types.ObjectId;
  location: string;
  maintenanceSchedule: Array<{
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    description: string;
    lastPerformed?: Date;
    nextDue: Date;
    responsible: Types.ObjectId;
  }>;
  operatingCosts: {
    hourlyRate: number;
    consumables: Array<{
      name: string;
      costPerUnit: number;
      unit: string;
    }>;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductionJob extends mongoose.Document {
  jobNumber: string;
  orderId: Types.ObjectId;
  title: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'queued' | 'in_progress' | 'paused' | 'completed' | 'cancelled' | 'failed';
  assignedMachine?: Types.ObjectId;
  assignedOperator?: Types.ObjectId;
  estimatedDuration: number; // en minutes
  actualDuration?: number;
  scheduledStart: Date;
  actualStart?: Date;
  scheduledEnd: Date;
  actualEnd?: Date;
  requirements: {
    machineType: string;
    materials: Array<{
      name: string;
      quantity: number;
      unit: string;
    }>;
    specialInstructions: string[];
  };
  progress: {
    percentage: number;
    currentStep: string;
    completedSteps: string[];
    issues: Array<{
      description: string;
      severity: 'low' | 'medium' | 'high';
      reportedAt: Date;
      resolvedAt?: Date;
    }>;
  };
  qualityChecks: Array<{
    checkType: string;
    result: 'pass' | 'fail' | 'warning';
    notes: string;
    checkedBy: Types.ObjectId;
    checkedAt: Date;
  }>;
  costs: {
    materials: number;
    labor: number;
    machine: number;
    total: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductionQueue extends mongoose.Document {
  name: string;
  machineId: Types.ObjectId;
  jobs: Array<{
    jobId: Types.ObjectId;
    position: number;
    estimatedStart: Date;
    estimatedEnd: Date;
  }>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productionMachineSchema = new Schema<IProductionMachine>({
  name: {
    type: String,
    required: [true, 'Le nom de la machine est requis'],
    trim: true
  },
  type: {
    type: String,
    enum: ['digital', 'offset', 'large_format', 'finishing'],
    required: [true, 'Le type de machine est requis']
  },
  model: {
    type: String,
    required: [true, 'Le modèle est requis']
  },
  manufacturer: {
    type: String,
    required: [true, 'Le fabricant est requis']
  },
  capabilities: {
    maxWidth: {
      type: Number,
      required: true
    },
    maxHeight: {
      type: Number,
      required: true
    },
    minWidth: {
      type: Number,
      required: true
    },
    minHeight: {
      type: Number,
      required: true
    },
    supportedFormats: [String],
    colorModes: [String],
    maxResolution: Number,
    speedPagesPerHour: Number
  },
  status: {
    type: String,
    enum: ['available', 'busy', 'maintenance', 'broken', 'offline'],
    default: 'available'
  },
  currentJob: {
    type: Schema.Types.ObjectId,
    ref: 'ProductionJob'
  },
  location: {
    type: String,
    required: true
  },
  maintenanceSchedule: [{
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
      required: true
    },
    description: {
      type: String,
      required: true
    },
    lastPerformed: Date,
    nextDue: {
      type: Date,
      required: true
    },
    responsible: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  operatingCosts: {
    hourlyRate: {
      type: Number,
      default: 0
    },
    consumables: [{
      name: String,
      costPerUnit: Number,
      unit: String
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const productionJobSchema = new Schema<IProductionJob>({
  jobNumber: {
    type: String,
    unique: true,
    required: [true, 'Le numéro de job est requis']
  },
  orderId: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'L\'ID de commande est requis']
  },
  title: {
    type: String,
    required: [true, 'Le titre est requis']
  },
  description: String,
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  status: {
    type: String,
    enum: ['queued', 'in_progress', 'paused', 'completed', 'cancelled', 'failed'],
    default: 'queued'
  },
  assignedMachine: {
    type: Schema.Types.ObjectId,
    ref: 'ProductionMachine'
  },
  assignedOperator: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  estimatedDuration: {
    type: Number,
    required: true
  },
  actualDuration: Number,
  scheduledStart: {
    type: Date,
    required: true
  },
  actualStart: Date,
  scheduledEnd: {
    type: Date,
    required: true
  },
  actualEnd: Date,
  requirements: {
    machineType: String,
    materials: [{
      name: String,
      quantity: Number,
      unit: String
    }],
    specialInstructions: [String]
  },
  progress: {
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    currentStep: String,
    completedSteps: [String],
    issues: [{
      description: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high']
      },
      reportedAt: {
        type: Date,
        default: Date.now
      },
      resolvedAt: Date
    }]
  },
  qualityChecks: [{
    checkType: String,
    result: {
      type: String,
      enum: ['pass', 'fail', 'warning']
    },
    notes: String,
    checkedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    checkedAt: {
      type: Date,
      default: Date.now
    }
  }],
  costs: {
    materials: {
      type: Number,
      default: 0
    },
    labor: {
      type: Number,
      default: 0
    },
    machine: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

const productionQueueSchema = new Schema<IProductionQueue>({
  name: {
    type: String,
    required: true
  },
  machineId: {
    type: Schema.Types.ObjectId,
    ref: 'ProductionMachine',
    required: true
  },
  jobs: [{
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductionJob',
      required: true
    },
    position: {
      type: Number,
      required: true
    },
    estimatedStart: Date,
    estimatedEnd: Date
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index
productionMachineSchema.index({ type: 1, status: 1 });
productionJobSchema.index({ status: 1, priority: -1, scheduledStart: 1 });
productionJobSchema.index({ orderId: 1 });
productionQueueSchema.index({ machineId: 1 });

// Générer le numéro de job
productionJobSchema.pre('save', async function(next) {
  if (this.isNew && !this.jobNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const count = await mongoose.model('ProductionJob').countDocuments({
      createdAt: {
        $gte: new Date(year, date.getMonth(), date.getDate()),
        $lt: new Date(year, date.getMonth(), date.getDate() + 1)
      }
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    this.jobNumber = `JOB-${year}${month}${day}-${sequence}`;
  }
  next();
});

export const ProductionMachine = mongoose.model<IProductionMachine>('ProductionMachine', productionMachineSchema);
export const ProductionJob = mongoose.model<IProductionJob>('ProductionJob', productionJobSchema);
export const ProductionQueue = mongoose.model<IProductionQueue>('ProductionQueue', productionQueueSchema);