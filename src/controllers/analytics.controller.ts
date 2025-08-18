import { Request, Response } from 'express';
import { UserActivity, SystemMetrics, UserPreferences } from '../models/analytics.model';
import ApiError from '../utils/apiError';
import ApiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middlewares/error.middleware';

export const logActivity = asyncHandler(async (req: Request, res: Response) => {
  const { action, resource, resourceId, details, duration } = req.body;
  const userId = req.user.id;

  const activity = await UserActivity.create({
    userId,
    action,
    resource,
    resourceId,
    details,
    duration,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    sessionId: req.sessionID
  });

  res.status(201).json(
    ApiResponse.created('Activité enregistrée', { activity })
  );
});

export const getUserActivity = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const action = req.query.action as string;
  const resource = req.query.resource as string;

  const query: any = { userId };
  if (action) query.action = action;
  if (resource) query.resource = resource;

  const activities = await UserActivity.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);

  const total = await UserActivity.countDocuments(query);

  res.json(
    ApiResponse.paginated(
      'Activités récupérées',
      activities,
      page,
      Math.ceil(total / limit),
      total,
      limit
    )
  );
});

export const getUserStats = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;

  const stats = await UserActivity.aggregate([
    { $match: { userId: userId } },
    {
      $group: {
        _id: null,
        totalActivities: { $sum: 1 },
        uniqueActions: { $addToSet: '$action' },
        uniqueResources: { $addToSet: '$resource' },
        avgDuration: { $avg: '$duration' },
        lastActivity: { $max: '$createdAt' }
      }
    }
  ]);

  const activityByDay = await UserActivity.aggregate([
    { $match: { userId: userId } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    { $limit: 30 }
  ]);

  const topActions = await UserActivity.aggregate([
    { $match: { userId: userId } },
    { $group: { _id: '$action', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  res.json(
    ApiResponse.success('Statistiques utilisateur', {
      general: stats[0] || {
        totalActivities: 0,
        uniqueActions: [],
        uniqueResources: [],
        avgDuration: 0,
        lastActivity: null
      },
      activityByDay,
      topActions
    })
  );
});

export const getSystemMetrics = asyncHandler(async (req: Request, res: Response) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Accès réservé aux administrateurs');
  }

  const days = parseInt(req.query.days as string) || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const metrics = await SystemMetrics.find({
    date: { $gte: startDate }
  }).sort({ date: 1 });

  res.json(
    ApiResponse.success('Métriques système', { metrics })
  );
});

export const updateSystemMetrics = asyncHandler(async (req: Request, res: Response) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Accès réservé aux administrateurs');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculer les métriques du jour
  const User = require('../models/user.model').default;
  const Order = require('../models/order.model').default;

  const [
    totalUsers,
    newUsersToday,
    totalOrders,
    ordersToday,
    revenueToday
  ] = await Promise.all([
    User.countDocuments({ isActive: true }),
    User.countDocuments({ createdAt: { $gte: today } }),
    Order.countDocuments(),
    Order.countDocuments({ createdAt: { $gte: today } }),
    Order.aggregate([
      { $match: { createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ])
  ]);

  const revenue = revenueToday[0]?.total || 0;
  const avgOrderValue = ordersToday > 0 ? revenue / ordersToday : 0;

  const metrics = await SystemMetrics.findOneAndUpdate(
    { date: today },
    {
      date: today,
      metrics: {
        activeUsers: totalUsers,
        newUsers: newUsersToday,
        totalOrders: ordersToday,
        revenue,
        averageOrderValue: avgOrderValue,
        conversionRate: 0, // À calculer selon vos besoins
        pageViews: 0, // À implémenter avec un tracker
        uniqueVisitors: 0,
        bounceRate: 0,
        avgSessionDuration: 0
      },
      performance: {
        avgResponseTime: 0, // À implémenter avec un middleware
        errorRate: 0,
        uptime: 100,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        cpuUsage: 0 // À implémenter avec un monitor système
      }
    },
    { upsert: true, new: true }
  );

  res.json(
    ApiResponse.success('Métriques système mises à jour', { metrics })
  );
});

export const getUserPreferences = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;

  let preferences = await UserPreferences.findOne({ userId });

  if (!preferences) {
    // Créer des préférences par défaut
    preferences = await UserPreferences.create({ userId });
  }

  res.json(
    ApiResponse.success('Préférences récupérées', { preferences })
  );
});

export const updateUserPreferences = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const updates = req.body;

  const preferences = await UserPreferences.findOneAndUpdate(
    { userId },
    { $set: updates },
    { upsert: true, new: true }
  );

  res.json(
    ApiResponse.updated('Préférences mises à jour', { preferences })
  );
});

export const exportUserData = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;

  // Récupérer toutes les données utilisateur
  const User = require('../models/user.model').default;
  const Order = require('../models/order.model').default;
  const { Notification } = require('../models/notification.model');

  const [user, orders, activities, notifications, preferences] = await Promise.all([
    User.findById(userId).select('-password -refreshTokens'),
    Order.find({ clientId: userId }),
    UserActivity.find({ userId }).sort({ createdAt: -1 }),
    Notification.find({ userId }).sort({ createdAt: -1 }),
    UserPreferences.findOne({ userId })
  ]);

  const exportData = {
    user,
    orders,
    activities,
    notifications,
    preferences,
    exportedAt: new Date(),
    version: '1.0'
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="user-data-${userId}-${Date.now()}.json"`);
  
  res.json(exportData);
});

export const getAnalyticsDashboard = asyncHandler(async (req: Request, res: Response) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Accès réservé aux administrateurs');
  }

  const days = parseInt(req.query.days as string) || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Métriques générales
  const User = require('../models/user.model').default;
  const Order = require('../models/order.model').default;

  const [
    totalUsers,
    activeUsers,
    totalOrders,
    totalRevenue,
    userGrowth,
    orderTrends,
    topActions,
    deviceStats
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ lastLogin: { $gte: startDate } }),
    Order.countDocuments(),
    Order.aggregate([
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]),
    User.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$totalPrice' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]),
    UserActivity.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
    UserActivity.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            $cond: [
              { $regexMatch: { input: '$userAgent', regex: /Mobile|Android|iPhone/ } },
              'Mobile',
              'Desktop'
            ]
          },
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  res.json(
    ApiResponse.success('Dashboard analytics', {
      overview: {
        totalUsers,
        activeUsers,
        totalOrders,
        totalRevenue: totalRevenue[0]?.total || 0
      },
      trends: {
        userGrowth,
        orderTrends
      },
      insights: {
        topActions,
        deviceStats
      }
    })
  );
});