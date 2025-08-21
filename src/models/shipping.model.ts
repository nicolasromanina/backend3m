import mongoose, { Schema, Types } from 'mongoose';

export interface IShippingCarrier extends mongoose.Document {
  name: string;
  code: string;
  apiEndpoint?: string;
  apiKey?: string;
  services: Array<{
    code: string;
    name: string;
    description: string;
    deliveryTime: string;
    trackingAvailable: boolean;
    insuranceAvailable: boolean;
    signatureRequired: boolean;
    maxWeight: number;
    maxDimensions: {
      length: number;
      width: number;
      height: number;
    };
    pricing: {
      basePrice: number;
      pricePerKg: number;
      pricePerKm?: number;
      freeShippingThreshold?: number;
    };
  }>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IShipment extends mongoose.Document {
  shipmentNumber: string;
  orderId: Types.ObjectId;
  carrierId: Types.ObjectId;
  serviceCode: string;
  status: 'pending' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned';
  trackingNumber?: string;
  labelUrl?: string;
  sender: {
    name: string;
    company: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    phone: string;
    email: string;
  };
  recipient: {
    name: string;
    company?: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    phone: string;
    email?: string;
    instructions?: string;
  };
  package: {
    weight: number;
    dimensions: {
      length: number;
      width: number;
      height: number;
    };
    description: string;
    value: number;
    insurance?: {
      amount: number;
      reference: string;
    };
  };
  pricing: {
    shippingCost: number;
    insuranceCost: number;
    totalCost: number;
    currency: string;
  };
  estimatedDelivery: Date;
  actualDelivery?: Date;
  trackingEvents: Array<{
    timestamp: Date;
    status: string;
    location: string;
    description: string;
    source: 'carrier' | 'manual';
  }>;
  pickupPoint?: {
    id: string;
    name: string;
    address: string;
    city: string;
    postalCode: string;
    openingHours: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IShippingZone extends mongoose.Document {
  name: string;
  countries: string[];
  regions?: string[];
  postalCodes?: string[];
  shippingRates: Array<{
    carrierId: Types.ObjectId;
    serviceCode: string;
    baseRate: number;
    weightRates: Array<{
      minWeight: number;
      maxWeight: number;
      rate: number;
    }>;
    freeShippingThreshold?: number;
  }>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const shippingCarrierSchema = new Schema<IShippingCarrier>({
  name: {
    type: String,
    required: [true, 'Le nom du transporteur est requis'],
    trim: true
  },
  code: {
    type: String,
    required: [true, 'Le code du transporteur est requis'],
    unique: true,
    uppercase: true
  },
  apiEndpoint: String,
  apiKey: String,
  services: [{
    code: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    description: String,
    deliveryTime: String,
    trackingAvailable: {
      type: Boolean,
      default: true
    },
    insuranceAvailable: {
      type: Boolean,
      default: false
    },
    signatureRequired: {
      type: Boolean,
      default: false
    },
    maxWeight: {
      type: Number,
      default: 30
    },
    maxDimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    pricing: {
      basePrice: {
        type: Number,
        required: true
      },
      pricePerKg: {
        type: Number,
        default: 0
      },
      pricePerKm: Number,
      freeShippingThreshold: Number
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const shipmentSchema = new Schema<IShipment>({
  shipmentNumber: {
    type: String,
    unique: true,
    required: [true, 'Le numéro d\'expédition est requis']
  },
  orderId: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'L\'ID de commande est requis']
  },
  carrierId: {
    type: Schema.Types.ObjectId,
    ref: 'ShippingCarrier',
    required: [true, 'L\'ID du transporteur est requis']
  },
  serviceCode: {
    type: String,
    required: [true, 'Le code de service est requis']
  },
  status: {
    type: String,
    enum: ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'],
    default: 'pending'
  },
  trackingNumber: String,
  labelUrl: String,
  sender: {
    name: {
      type: String,
      required: true
    },
    company: {
      type: String,
      required: true
    },
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    postalCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    }
  },
  recipient: {
    name: {
      type: String,
      required: true
    },
    company: String,
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    postalCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    email: String,
    instructions: String
  },
  package: {
    weight: {
      type: Number,
      required: true,
      min: 0
    },
    dimensions: {
      length: {
        type: Number,
        required: true
      },
      width: {
        type: Number,
        required: true
      },
      height: {
        type: Number,
        required: true
      }
    },
    description: {
      type: String,
      required: true
    },
    value: {
      type: Number,
      required: true,
      min: 0
    },
    insurance: {
      amount: Number,
      reference: String
    }
  },
  pricing: {
    shippingCost: {
      type: Number,
      required: true,
      min: 0
    },
    insuranceCost: {
      type: Number,
      default: 0
    },
    totalCost: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'EUR'
    }
  },
  estimatedDelivery: {
    type: Date,
    required: true
  },
  actualDelivery: Date,
  trackingEvents: [{
    timestamp: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      required: true
    },
    location: String,
    description: String,
    source: {
      type: String,
      enum: ['carrier', 'manual'],
      default: 'carrier'
    }
  }],
  pickupPoint: {
    id: String,
    name: String,
    address: String,
    city: String,
    postalCode: String,
    openingHours: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  }
}, {
  timestamps: true
});

const shippingZoneSchema = new Schema<IShippingZone>({
  name: {
    type: String,
    required: [true, 'Le nom de la zone est requis']
  },
  countries: [{
    type: String,
    required: true
  }],
  regions: [String],
  postalCodes: [String],
  shippingRates: [{
    carrierId: {
      type: Schema.Types.ObjectId,
      ref: 'ShippingCarrier',
      required: true
    },
    serviceCode: {
      type: String,
      required: true
    },
    baseRate: {
      type: Number,
      required: true,
      min: 0
    },
    weightRates: [{
      minWeight: {
        type: Number,
        required: true,
        min: 0
      },
      maxWeight: {
        type: Number,
        required: true
      },
      rate: {
        type: Number,
        required: true,
        min: 0
      }
    }],
    freeShippingThreshold: Number
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index
shippingCarrierSchema.index({ code: 1 });
shipmentSchema.index({ orderId: 1 });
shipmentSchema.index({ trackingNumber: 1 });
shipmentSchema.index({ status: 1 });
shippingZoneSchema.index({ countries: 1 });

// Générer le numéro d'expédition
shipmentSchema.pre('save', async function(next) {
  if (this.isNew && !this.shipmentNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const count = await mongoose.model('Shipment').countDocuments({
      createdAt: {
        $gte: new Date(year, date.getMonth(), date.getDate()),
        $lt: new Date(year, date.getMonth(), date.getDate() + 1)
      }
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    this.shipmentNumber = `SHIP-${year}${month}${day}-${sequence}`;
  }
  next();
});

export const ShippingCarrier = mongoose.model<IShippingCarrier>('ShippingCarrier', shippingCarrierSchema);
export const Shipment = mongoose.model<IShipment>('Shipment', shipmentSchema);
export const ShippingZone = mongoose.model<IShippingZone>('ShippingZone', shippingZoneSchema);