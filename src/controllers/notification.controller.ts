import { Request, Response } from 'express';
import ApiError from '../utils/apiError';
import ApiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middlewares/error.middleware';
import notificationService from '../services/notification.service';

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const options = {
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 20,
    type: req.query.type as string,
    category: req.query.category as string,
    isRead: req.query.isRead ? req.query.isRead === 'true' : undefined
  };

  const result = await notificationService.getNotifications(userId, options);

  res.json(
    ApiResponse.paginated(
      'Notifications récupérées',
      result.notifications,
      result.pagination.page,
      result.pagination.pages,
      result.pagination.total,
      result.pagination.limit
    )
  );
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const count = await notificationService.getUnreadCount(userId);

  res.json(
    ApiResponse.success('Nombre de notifications non lues', { count })
  );
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user.id;

  const notification = await notificationService.markAsRead(id, userId);

  if (!notification) {
    throw ApiError.notFound('Notification non trouvée');
  }

  res.json(
    ApiResponse.success('Notification marquée comme lue', { notification })
  );
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;

  await notificationService.markAllAsRead(userId);

  res.json(
    ApiResponse.success('Toutes les notifications marquées comme lues')
  );
});

export const subscribeToPush = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { subscription } = req.body;

  if (!subscription || !subscription.endpoint || !subscription.keys) {
    throw ApiError.badRequest('Données de souscription invalides');
  }

  const result = await notificationService.subscribeToPush(userId, subscription);

  res.json(
    ApiResponse.success('Souscription aux notifications push réussie', { subscription: result })
  );
});

export const unsubscribeFromPush = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { endpoint } = req.body;

  if (!endpoint) {
    throw ApiError.badRequest('Endpoint requis');
  }

  await notificationService.unsubscribeFromPush(userId, endpoint);

  res.json(
    ApiResponse.success('Désinscription des notifications push réussie')
  );
});

export const createNotification = asyncHandler(async (req: Request, res: Response) => {
  // Endpoint pour les admins pour créer des notifications
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Accès réservé aux administrateurs');
  }

  const notificationData = req.body;

  const notification = await notificationService.createNotification(notificationData);

  res.status(201).json(
    ApiResponse.created('Notification créée', { notification })
  );
});

export const sendBulkNotification = asyncHandler(async (req: Request, res: Response) => {
  // Endpoint pour les admins pour envoyer des notifications en masse
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Accès réservé aux administrateurs');
  }

  const { userIds, notificationData } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw ApiError.badRequest('Liste d\'utilisateurs requise');
  }

  const promises = userIds.map(userId => 
    notificationService.createNotification({
      ...notificationData,
      userId
    })
  );

  const results = await Promise.allSettled(promises);
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  res.json(
    ApiResponse.success('Notifications envoyées en masse', {
      total: userIds.length,
      successful,
      failed
    })
  );
});

export const getNotificationStats = asyncHandler(async (req: Request, res: Response) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Accès réservé aux administrateurs');
  }

  const { Notification } = require('../models/notification.model');

  const stats = await Notification.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unread: { $sum: { $cond: ['$isRead', 0, 1] } },
        byType: {
          $push: {
            type: '$type',
            count: 1
          }
        },
        byCategory: {
          $push: {
            category: '$category',
            count: 1
          }
        }
      }
    }
  ]);

  const deliveryStats = await Notification.aggregate([
    {
      $group: {
        _id: '$deliveryStatus.push',
        count: { $sum: 1 }
      }
    }
  ]);

  res.json(
    ApiResponse.success('Statistiques des notifications', {
      general: stats[0] || { total: 0, unread: 0 },
      delivery: deliveryStats
    })
  );
});