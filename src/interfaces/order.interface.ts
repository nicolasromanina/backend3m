import { Document, Model, Types } from 'mongoose';

export interface IServiceOption {
  id: string;
  name: string;
  type: 'select' | 'checkbox' | 'number' | 'text';
  options?: string[];
  priceModifier: number;
  required: boolean;
}

export interface IService extends Document {
  name: string;
  description: string;
  category: 'flyers' | 'cartes' | 'affiches' | 'brochures' | 'autres';
  basePrice: number;
  unit: 'unité' | 'page' | 'm²';
  options: IServiceOption[];
  minQuantity: number;
  maxQuantity: number;
  isActive: boolean;
  images: string[];
  tags: string[];
  estimatedDeliveryDays: number;
  createdAt: Date;
  updatedAt: Date;

  calculatePrice(quantity: number, selectedOptions: Record<string, any>): number;
}

export interface IServiceModel extends Model<IService> {
  searchServices(query: string, category?: string): Promise<IService[]>;
}

export interface IOrderItem {
  serviceId: Types.ObjectId | string;
  service: IService;
  quantity: number;
  options: Record<string, any>;
  unitPrice: number;
  totalPrice: number;
  files: string[];
  notes?: string;
}

export interface IAddress {
  name: string;
  company?: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface IOrder extends Document {
  orderNumber: string;
  clientId: Types.ObjectId;
  client: any;
  items: IOrderItem[];
  status:
    | 'draft'
    | 'quote'
    | 'pending'
    | 'confirmed'
    | 'in_production'
    | 'ready'
    | 'shipped'
    | 'delivered'
    | 'cancelled';
  totalPrice: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  shippingCost: number;
  notes?: string;
  internalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
  productionStartedAt?: Date;
  readyAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  estimatedDeliveryDate?: Date;
  billingAddress: IAddress;
  shippingAddress: IAddress;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentMethod?: string;
  paymentIntentId?: string;
  quoteDocument?: string;
  invoiceDocument?: string;
  trackingNumber?: string;
  carrier?: string;
  assignedTo?: Types.ObjectId | string;
  priority: 'low' | 'normal' | 'high' | 'urgent';

  calculateTotals(): void;
  generateOrderNumber(): Promise<string>;
  updateStatus(newStatus: IOrder['status'], userId: string): Promise<void>;
  generateQuote(): Promise<string>;
  generateInvoice(): Promise<string>;
}

export interface IOrderModel extends Model<IOrder> {
  // Add static methods here if needed, e.g.:
  // findByOrderNumber(orderNumber: string): Promise<IOrder | null>;
}

export interface ICreateOrderRequest {
  items: Omit<IOrderItem, 'service' | 'unitPrice' | 'totalPrice'>[];
  notes?: string;
  billingAddress: IAddress;
  shippingAddress?: IAddress;
  priority?: IOrder['priority'];
}

export interface IUpdateOrderRequest {
  items?: Omit<IOrderItem, 'service' | 'unitPrice' | 'totalPrice'>[];
  notes?: string;
  internalNotes?: string;
  status?: IOrder['status'];
  priority?: IOrder['priority'];
  assignedTo?: Types.ObjectId | string;
  estimatedDeliveryDate?: Date;
}

export interface IOrderQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  clientId?: Types.ObjectId | string;
  assignedTo?: Types.ObjectId | string;
  priority?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IOrderStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  topServices: Array<{
    serviceId: string;
    serviceName: string;
    count: number;
    revenue: number;
  }>;
  monthlyStats: Array<{
    month: string;
    orders: number;
    revenue: number;
  }>;
}
