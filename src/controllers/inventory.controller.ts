import { Request, Response } from 'express';
import { InventoryItem, StockMovement } from '../models/inventory.model';
import ApiError from '../utils/apiError';
import ApiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middlewares/error.middleware';

export const getInventoryItems = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const category = req.query.category as string;
  const status = req.query.status as string;
  const search = req.query.search as string;

  const query: any = { isActive: true };
  
  if (category) query.category = category;
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { 'supplier.name': { $regex: search, $options: 'i' } }
    ];
  }

  const [items, total] = await Promise.all([
    InventoryItem.find(query)
      .sort({ name: 1 })
      .limit(limit)
      .skip((page - 1) * limit),
    InventoryItem.countDocuments(query)
  ]);

  res.json(
    ApiResponse.paginated(
      'Articles d\'inventaire récupérés',
      items,
      page,
      Math.ceil(total / limit),
      total,
      limit
    )
  );
});

export const getInventoryItemById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const item = await InventoryItem.findById(id);
  if (!item) {
    throw ApiError.notFound('Article non trouvé');
  }

  res.json(
    ApiResponse.success('Article récupéré', { item })
  );
});

export const createInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  const itemData = req.body;

  const item = await InventoryItem.create(itemData);

  res.status(201).json(
    ApiResponse.created('Article créé avec succès', { item })
  );
});

export const updateInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const item = await InventoryItem.findById(id);
  if (!item) {
    throw ApiError.notFound('Article non trouvé');
  }

  Object.assign(item, updateData);
  await item.save();

  res.json(
    ApiResponse.updated('Article mis à jour', { item })
  );
});

export const deleteInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const item = await InventoryItem.findById(id);
  if (!item) {
    throw ApiError.notFound('Article non trouvé');
  }

  item.isActive = false;
  await item.save();

  res.json(
    ApiResponse.deleted('Article supprimé')
  );
});

export const addStockMovement = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { type, quantity, reason, reference, cost } = req.body;
  const userId = req.user.id;

  const item = await InventoryItem.findById(id);
  if (!item) {
    throw ApiError.notFound('Article non trouvé');
  }

  await item.addStockMovement(type, quantity, reason, userId, reference, cost);

  res.json(
    ApiResponse.success('Mouvement de stock ajouté', { item })
  );
});

export const getStockMovements = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const movements = await StockMovement.find({ itemId: id })
    .populate('performedBy', 'name email')
    .populate('approvedBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);

  const total = await StockMovement.countDocuments({ itemId: id });

  res.json(
    ApiResponse.paginated(
      'Mouvements de stock récupérés',
      movements,
      page,
      Math.ceil(total / limit),
      total,
      limit
    )
  );
});

export const getLowStockItems = asyncHandler(async (req: Request, res: Response) => {
  const lowStockItems = await InventoryItem.find({
    isActive: true,
    $expr: { $lte: ['$currentStock', '$minStock'] }
  }).sort({ status: 1, currentStock: 1 });

  res.json(
    ApiResponse.success('Articles en stock faible', { items: lowStockItems })
  );
});

export const getInventoryStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await InventoryItem.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalItems: { $sum: 1 },
        totalValue: { $sum: { $multiply: ['$currentStock', '$unitCost'] } },
        lowStockItems: {
          $sum: { $cond: [{ $lte: ['$currentStock', '$minStock'] }, 1, 0] }
        },
        criticalItems: {
          $sum: { $cond: [{ $lte: ['$currentStock', { $multiply: ['$minStock', 0.5] }] }, 1, 0] }
        },
        outOfStockItems: {
          $sum: { $cond: [{ $eq: ['$currentStock', 0] }, 1, 0] }
        }
      }
    }
  ]);

  const categoryStats = await InventoryItem.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalValue: { $sum: { $multiply: ['$currentStock', '$unitCost'] } },
        avgStock: { $avg: '$currentStock' }
      }
    }
  ]);

  res.json(
    ApiResponse.success('Statistiques d\'inventaire', {
      general: stats[0] || {
        totalItems: 0,
        totalValue: 0,
        lowStockItems: 0,
        criticalItems: 0,
        outOfStockItems: 0
      },
      byCategory: categoryStats
    })
  );
});

export const generateStockReport = asyncHandler(async (req: Request, res: Response) => {
  const items = await InventoryItem.find({ isActive: true })
    .populate('stockMovements.performedBy', 'name')
    .sort({ category: 1, name: 1 });

  // Générer un rapport CSV ou Excel
  const reportData = items.map(item => ({
    SKU: item.sku,
    Nom: item.name,
    Catégorie: item.category,
    'Stock Actuel': item.currentStock,
    'Stock Min': item.minStock,
    'Stock Max': item.maxStock,
    Unité: item.unit,
    'Coût Unitaire': item.unitCost,
    'Valeur Stock': item.currentStock * item.unitCost,
    Statut: item.status,
    Fournisseur: item.supplier.name,
    'Dernier Réappro': item.lastRestocked
  }));

  res.json(
    ApiResponse.success('Rapport de stock généré', { reportData })
  );
});