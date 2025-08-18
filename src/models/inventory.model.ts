import mongoose, { Schema, Types } from 'mongoose';

// Type aliases for better code organization
type StockMovementType = 'in' | 'out' | 'adjustment' | 'transfer';
type InventoryCategory = 'papier' | 'encre' | 'finition' | 'equipement' | 'consommable';
type InventoryStatus = 'ok' | 'low' | 'critical' | 'out_of_stock' | 'discontinued';

export interface IInventoryItemMethods {
  addStockMovement: (
    type: Exclude<StockMovementType, 'transfer'>,
    quantity: number,
    reason: string,
    performedBy: Types.ObjectId,
    reference?: string,
    cost?: number
  ) => Promise<IInventoryItem>;
}

export interface IInventoryItem extends mongoose.Document, IInventoryItemMethods {
  name: string;
  description?: string;
  category: InventoryCategory;
  sku: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
  supplier: {
    name: string;
    contact?: string;
    email?: string;
    phone?: string;
  };
  unitCost: number;
  lastPurchasePrice?: number;
  averageCost: number;
  lastRestocked: Date;
  expirationDate?: Date;
  location?: string;
  warehouse?: string;
  status: InventoryStatus;
  isActive: boolean;
  stockMovements: Array<{
    type: Exclude<StockMovementType, 'transfer'>;
    quantity: number;
    reason: string;
    reference?: string;
    performedBy: Types.ObjectId;
    timestamp: Date;
    cost?: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStockMovement extends mongoose.Document {
  itemId: Types.ObjectId;
  type: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  reference?: string;
  cost?: number;
  performedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  notes?: string;
  createdAt: Date;
}

const inventoryItemSchema = new Schema<IInventoryItem, {}, IInventoryItemMethods>({
  name: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
    maxlength: [200, 'Le nom ne peut pas dépasser 200 caractères']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'La description ne peut pas dépasser 1000 caractères']
  },
  category: {
    type: String,
    enum: ['papier', 'encre', 'finition', 'equipement', 'consommable'],
    required: [true, 'La catégorie est requise']
  },
  sku: {
    type: String,
    unique: true,
    required: [true, 'Le SKU est requis'],
    uppercase: true,
    trim: true
  },
  currentStock: {
    type: Number,
    required: [true, 'Le stock actuel est requis'],
    min: [0, 'Le stock ne peut pas être négatif']
  },
  minStock: {
    type: Number,
    required: [true, 'Le stock minimum est requis'],
    min: [0, 'Le stock minimum ne peut pas être négatif']
  },
  maxStock: {
    type: Number,
    required: [true, 'Le stock maximum est requis'],
    min: [1, 'Le stock maximum doit être au moins 1']
  },
  unit: {
    type: String,
    required: [true, 'L\'unité est requise'],
    trim: true
  },
  supplier: {
    name: {
      type: String,
      required: [true, 'Le nom du fournisseur est requis'],
      trim: true
    },
    contact: String,
    email: String,
    phone: String
  },
  unitCost: {
    type: Number,
    required: [true, 'Le coût unitaire est requis'],
    min: [0, 'Le coût ne peut pas être négatif']
  },
  lastPurchasePrice: Number,
  averageCost: {
    type: Number,
    default: 0
  },
  lastRestocked: {
    type: Date,
    default: Date.now
  },
  expirationDate: Date,
  location: String,
  warehouse: String,
  status: {
    type: String,
    enum: ['ok', 'low', 'critical', 'out_of_stock', 'discontinued'],
    default: 'ok'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  stockMovements: [{
    type: {
      type: String,
      enum: ['in', 'out', 'adjustment'],
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    reference: String,
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    cost: Number
  }]
}, {
  timestamps: true
});

const stockMovementSchema = new Schema<IStockMovement>({
  itemId: {
    type: Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['in', 'out', 'adjustment', 'transfer'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  previousStock: {
    type: Number,
    required: true
  },
  newStock: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  reference: String,
  cost: Number,
  performedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String
}, {
  timestamps: true
});

// Indexes
inventoryItemSchema.index({ sku: 1 });
inventoryItemSchema.index({ category: 1 });
inventoryItemSchema.index({ status: 1 });
inventoryItemSchema.index({ 'supplier.name': 1 });
inventoryItemSchema.index({ currentStock: 1 });

stockMovementSchema.index({ itemId: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1 });
stockMovementSchema.index({ performedBy: 1 });

// Middleware
inventoryItemSchema.pre('save', function(next) {
  if (this.currentStock <= 0) {
    this.status = 'out_of_stock';
  } else if (this.currentStock <= this.minStock * 0.5) {
    this.status = 'critical';
  } else if (this.currentStock <= this.minStock) {
    this.status = 'low';
  } else {
    this.status = 'ok';
  }
  next();
});

inventoryItemSchema.pre('save', async function(next) {
  if (this.isNew && !this.sku) {
    const categoryPrefix = this.category.substring(0, 3).toUpperCase();
    const count = await mongoose.model('InventoryItem').countDocuments({ category: this.category });
    this.sku = `${categoryPrefix}${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Methods
inventoryItemSchema.methods.addStockMovement = async function(
  type: Exclude<StockMovementType, 'transfer'>,
  quantity: number,
  reason: string,
  performedBy: Types.ObjectId,
  reference?: string,
  cost?: number
): Promise<IInventoryItem> {
  if (quantity <= 0) {
    throw new Error('Quantity must be positive');
  }

  const previousStock = this.currentStock;
  
  if (type === 'in') {
    this.currentStock += quantity;
  } else if (type === 'out') {
    if (quantity > this.currentStock) {
      throw new Error('Insufficient stock');
    }
    this.currentStock -= quantity;
  } else if (type === 'adjustment') {
    this.currentStock = quantity;
  }

  this.stockMovements.push({
    type,
    quantity,
    reason,
    reference,
    performedBy,
    timestamp: new Date(),
    cost
  });

  const StockMovement = mongoose.model<IStockMovement>('StockMovement');
  await StockMovement.create({
    itemId: this._id,
    type,
    quantity,
    previousStock,
    newStock: this.currentStock,
    reason,
    reference,
    performedBy,
    cost
  });

  await this.save();
  return this;
};

export const InventoryItem = mongoose.model<IInventoryItem, mongoose.Model<IInventoryItem, {}, IInventoryItemMethods>>(
  'InventoryItem', 
  inventoryItemSchema
);

export const StockMovement = mongoose.model<IStockMovement>('StockMovement', stockMovementSchema);