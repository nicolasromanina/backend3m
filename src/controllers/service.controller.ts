import { Request, Response } from 'express';
import Service from '../models/service.model';
import ApiError from '../utils/apiError';
import ApiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middlewares/error.middleware';

export const createService = asyncHandler(async (req: Request, res: Response) => {
  const serviceData = req.body;

  // Validation supplémentaire pour les options
  if (serviceData.options) {
    for (const option of serviceData.options) {
      if (option.type === 'select' && (!option.options || option.options.length === 0)) {
        throw ApiError.badRequest('Les options de sélection doivent avoir des valeurs');
      }
      if (typeof option.priceModifier !== 'number') {
        throw ApiError.badRequest('Le modificateur de prix doit être un nombre');
      }
    }
  }

  // Valeurs par défaut
  const completeServiceData = {
    ...serviceData,
    isActive: serviceData.isActive !== false,
    estimatedDeliveryDays: serviceData.estimatedDeliveryDays || 7,
    options: serviceData.options || []
  };

  const service = await Service.create(completeServiceData);

  res.status(201).json(
    ApiResponse.created('Service créé avec succès', { service })
  );
});

export const getServices = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const category = req.query.category as string;
  const search = req.query.search as string;
  const isActive = req.query.isActive as string;

  // Construire la requête
  const query: any = {};
  
  if (category && category !== 'all') {
    query.category = category;
  }
  
  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  } else {
    // Par défaut, ne montrer que les services actifs pour les clients
    if (req.user?.role === 'client') {
      query.isActive = true;
    }
  }
  
  if (search) {
    query.$text = { $search: search };
  }

  // Pagination
  const skip = (page - 1) * limit;
  
  const [services, total] = await Promise.all([
    Service.find(query)
      .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Service.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json(
    ApiResponse.paginated(
      'Services récupérés avec succès',
      services,
      page,
      totalPages,
      total,
      limit
    )
  );
});

export const getServiceById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const service = await Service.findById(id);
  
  if (!service) {
    throw ApiError.notFound('Service non trouvé');
  }

  // Si c'est un client, ne montrer que les services actifs
  if (req.user?.role === 'client' && !service.isActive) {
    throw ApiError.notFound('Service non trouvé');
  }

  res.json(
    ApiResponse.success('Service récupéré', { service })
  );
});

export const updateService = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const service = await Service.findById(id);
  if (!service) {
    throw ApiError.notFound('Service non trouvé');
  }

  // Mettre à jour le service
  Object.assign(service, updateData);
  await service.save();

  res.json(
    ApiResponse.updated('Service mis à jour avec succès', { service })
  );
});

export const deleteService = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const service = await Service.findById(id);
  if (!service) {
    throw ApiError.notFound('Service non trouvé');
  }

  // Désactiver au lieu de supprimer pour préserver l'historique
  service.isActive = false;
  await service.save();

  res.json(
    ApiResponse.deleted('Service supprimé avec succès')
  );
});

export const calculatePrice = asyncHandler(async (req: Request, res: Response) => {
  const { serviceId, quantity, options } = req.body;

  const service = await Service.findById(serviceId);
  if (!service || !service.isActive) {
    throw ApiError.notFound('Service non trouvé ou inactif');
  }

  // Valider la quantité
  if (quantity < service.minQuantity || quantity > service.maxQuantity) {
    throw ApiError.badRequest(
      `Quantité invalide. Min: ${service.minQuantity}, Max: ${service.maxQuantity}`
    );
  }

  // Calculer le prix
  const totalPrice = service.calculatePrice(quantity, options || {});

  res.json(
    ApiResponse.success('Prix calculé', {
      serviceId,
      quantity,
      options,
      unitPrice: totalPrice / quantity,
      totalPrice
    })
  );
});

export const getServiceCategories = asyncHandler(async (req: Request, res: Response) => {
  const categories = await Service.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgPrice: { $avg: '$basePrice' },
        minPrice: { $min: '$basePrice' },
        maxPrice: { $max: '$basePrice' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.json(
    ApiResponse.success('Catégories récupérées', { categories })
  );
});

export const searchServices = asyncHandler(async (req: Request, res: Response) => {
  const { q: query, category } = req.query;

  if (!query) {
    throw ApiError.badRequest('Terme de recherche requis');
  }

  const services = await Service.searchServices(query as string, category as string);

  res.json(
    ApiResponse.success('Résultats de recherche', { services })
  );
});

export const getPopularServices = asyncHandler(async (req: Request, res: Response) => {
  // Cette fonction nécessiterait des données de commandes pour calculer la popularité
  // Pour l'instant, on retourne les services les plus récents
  const services = await Service.find({ isActive: true })
    .sort({ createdAt: -1 })
    .limit(10);

  res.json(
    ApiResponse.success('Services populaires', { services })
  );
});