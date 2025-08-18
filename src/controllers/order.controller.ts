import { Request, Response } from 'express';
import Order from '../models/order.model';
import Service from '../models/service.model';
import ApiError from '../utils/apiError';
import ApiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middlewares/error.middleware';

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const { items, notes, billingAddress, shippingAddress, priority } = req.body;
  const clientId = req.user.id;

  // Valider et calculer les prix des items
  const orderItems = await Promise.all(
    items.map(async (item: any) => {
      const service = await Service.findById(item.serviceId);
      if (!service || !service.isActive) {
        throw ApiError.badRequest(`Service ${item.serviceId} non trouvé ou inactif`);
      }

      // Valider la quantité
      if (item.quantity < service.minQuantity || item.quantity > service.maxQuantity) {
        throw ApiError.badRequest(
          `Quantité invalide pour ${service.name}. Min: ${service.minQuantity}, Max: ${service.maxQuantity}`
        );
      }

      // Calculer le prix
      const unitPrice = service.calculatePrice(1, item.options);
      const totalPrice = unitPrice * item.quantity;

      return {
        serviceId: service._id,
        service: service.toObject(),
        quantity: item.quantity,
        options: item.options || {},
        unitPrice,
        totalPrice,
        files: item.files || [],
        notes: item.notes
      };
    })
  );

  // Créer la commande
  const order = await Order.create({
    clientId,
    client: req.user,
    items: orderItems,
    status: 'draft',
    notes,
    billingAddress,
    shippingAddress: shippingAddress || billingAddress,
    priority: priority || 'normal'
  });

  res.status(201).json(
    ApiResponse.created('Commande créée avec succès', { order })
  );
});

export const getOrders = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const status = req.query.status as string;
  const priority = req.query.priority as string;
  const search = req.query.search as string;

  // Construire la requête
  const query: any = {};
  
  // Si c'est un client, ne montrer que ses commandes
  if (req.user.role === 'client') {
    query.clientId = req.user.id;
  }
  
  if (status) {
    query.status = status;
  }
  
  if (priority) {
    query.priority = priority;
  }
  
  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: 'i' } },
      { 'client.name': { $regex: search, $options: 'i' } }
    ];
  }

  // Pagination
  const skip = (page - 1) * limit;
  
  const [orders, total] = await Promise.all([
    Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('assignedTo', 'name email'),
    Order.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json(
    ApiResponse.paginated(
      'Commandes récupérées avec succès',
      orders,
      page,
      totalPages,
      total,
      limit
    )
  );
});

export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const order = await Order.findById(id).populate('assignedTo', 'name email');
  
  if (!order) {
    throw ApiError.notFound('Commande non trouvée');
  }

  // Vérifier les permissions
  if (req.user.role === 'client' && order.clientId.toString() !== req.user.id) {
    throw ApiError.forbidden('Accès non autorisé à cette commande');
  }

  res.json(
    ApiResponse.success('Commande récupérée', { order })
  );
});

export const updateOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { items, notes, internalNotes, status, priority, assignedTo, estimatedDeliveryDate } = req.body;

  const order = await Order.findById(id);
  if (!order) {
    throw ApiError.notFound('Commande non trouvée');
  }

  // Vérifier les permissions
  if (req.user.role === 'client') {
    if (order.clientId.toString() !== req.user.id) {
      throw ApiError.forbidden('Accès non autorisé à cette commande');
    }
    // Les clients ne peuvent modifier que certains champs et seulement si la commande est en draft
    if (order.status !== 'draft') {
      throw ApiError.forbidden('Impossible de modifier une commande confirmée');
    }
  }

  // Mettre à jour les champs autorisés
  if (items && req.user.role === 'client' && order.status === 'draft') {
    // Recalculer les items
    const orderItems = await Promise.all(
      items.map(async (item: any) => {
        const service = await Service.findById(item.serviceId);
        if (!service || !service.isActive) {
          throw ApiError.badRequest(`Service ${item.serviceId} non trouvé ou inactif`);
        }

        const unitPrice = service.calculatePrice(1, item.options);
        const totalPrice = unitPrice * item.quantity;

        return {
          serviceId: service._id,
          service: service.toObject(),
          quantity: item.quantity,
          options: item.options || {},
          unitPrice,
          totalPrice,
          files: item.files || [],
          notes: item.notes
        };
      })
    );
    order.items = orderItems;
  }

  if (notes) order.notes = notes;
  if (internalNotes && req.user.role !== 'client') order.internalNotes = internalNotes;
  if (status && req.user.role !== 'client') {
    await order.updateStatus(status, req.user.id);
  }
  if (priority && req.user.role !== 'client') order.priority = priority;
  if (assignedTo && req.user.role !== 'client') order.assignedTo = assignedTo;
  if (estimatedDeliveryDate && req.user.role !== 'client') {
    order.estimatedDeliveryDate = new Date(estimatedDeliveryDate);
  }

  await order.save();

  res.json(
    ApiResponse.updated('Commande mise à jour avec succès', { order })
  );
});

export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const order = await Order.findById(id);
  if (!order) {
    throw ApiError.notFound('Commande non trouvée');
  }

  // Vérifier les permissions
  if (req.user.role === 'client') {
    if (order.clientId.toString() !== req.user.id) {
      throw ApiError.forbidden('Accès non autorisé à cette commande');
    }
    if (order.status !== 'draft') {
      throw ApiError.forbidden('Impossible de supprimer une commande confirmée');
    }
  }

  await Order.findByIdAndDelete(id);

  res.json(
    ApiResponse.deleted('Commande supprimée avec succès')
  );
});

export const generateQuote = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const order = await Order.findById(id);
  if (!order) {
    throw ApiError.notFound('Commande non trouvée');
  }

  // Générer le devis PDF
  const quoteDocument = await order.generateQuote();
  order.quoteDocument = quoteDocument;
  order.status = 'quote';
  await order.save();

  res.json(
    ApiResponse.success('Devis généré avec succès', {
      quoteDocument: order.quoteDocument
    })
  );
});

export const generateInvoice = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const order = await Order.findById(id);
  if (!order) {
    throw ApiError.notFound('Commande non trouvée');
  }

  if (!['delivered', 'ready'].includes(order.status)) {
    throw ApiError.badRequest('La commande doit être terminée pour générer une facture');
  }

  // Générer la facture PDF
  const invoiceDocument = await order.generateInvoice();
  order.invoiceDocument = invoiceDocument;
  await order.save();

  res.json(
    ApiResponse.success('Facture générée avec succès', {
      invoiceDocument: order.invoiceDocument
    })
  );
});

export const getOrderStats = asyncHandler(async (req: Request, res: Response) => {
  const clientId = req.user.role === 'client' ? req.user.id : undefined;

  const matchStage = clientId ? { clientId } : {};

  const stats = await Order.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalPrice' },
        averageOrderValue: { $avg: '$totalPrice' },
        pendingOrders: {
          $sum: { $cond: [{ $in: ['$status', ['draft', 'quote', 'pending']] }, 1, 0] }
        },
        completedOrders: {
          $sum: { $cond: [{ $in: ['$status', ['delivered']] }, 1, 0] }
        }
      }
    }
  ]);

  const statusStats = await Order.aggregate([
    { $match: matchStage },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const monthlyStats = await Order.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        orders: { $sum: 1 },
        revenue: { $sum: '$totalPrice' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    { $limit: 12 }
  ]);

  res.json(
    ApiResponse.success('Statistiques récupérées', {
      general: stats[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        pendingOrders: 0,
        completedOrders: 0
      },
      byStatus: statusStats,
      monthly: monthlyStats
    })
  );
});