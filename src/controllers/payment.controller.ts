import { Request, Response } from 'express';
import { Payment, FinancialReport } from '../models/payment.model';
import { mvolaService } from '../services/mvola.service';
import Order from '../models/order.model';
import ApiError from '../utils/apiError';
import ApiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middlewares/error.middleware';
import logger from '../utils/logger';

export const createPayment = asyncHandler(async (req: Request, res: Response) => {
  const { orderId, amount, method, phoneNumber, installmentPlan } = req.body;
  const clientId = req.user.id;

  // Vérifier la commande
  const order = await Order.findById(orderId);
  if (!order) {
    throw ApiError.notFound('Commande non trouvée');
  }

  if (order.clientId.toString() !== clientId) {
    throw ApiError.forbidden('Accès non autorisé à cette commande');
  }

  // Calculer les frais
  const processingFee = method === 'mvola' ? amount * 0.02 : amount * 0.03; // 2% pour Mvola, 3% pour carte
  const platformFee = amount * 0.01; // 1% de frais plateforme
  const totalFees = processingFee + platformFee;

  // Créer le paiement
  const payment = await Payment.create({
    orderId,
    clientId,
    amount,
    method,
    type: installmentPlan ? 'installment' : 'full',
    installmentPlan,
    fees: {
      processingFee,
      platformFee,
      totalFees
    }
  });

  // Traiter selon la méthode
  if (method === 'mvola') {
    try {
      const mvolaResponse = await mvolaService.initiatePayment({
        amount,
        phoneNumber,
        reference: payment.paymentNumber,
        description: `Paiement commande ${order.orderNumber}`
      });

      payment.mvolaTransaction = {
        transactionId: mvolaResponse.transactionId,
        phoneNumber,
        reference: payment.paymentNumber,
        status: mvolaResponse.status
      };
      payment.status = 'processing';
      await payment.save();

    } catch (error: any) {
      payment.status = 'failed';
      await payment.save();
      throw ApiError.badRequest(`Erreur Mvola: ${error.message}`);
    }
  }

  res.status(201).json(
    ApiResponse.created('Paiement initié avec succès', { payment })
  );
});

export const getPayments = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = req.query.status as string;
  const method = req.query.method as string;

  const query: any = {};
  
  // Si c'est un client, ne montrer que ses paiements
  if (req.user.role === 'client') {
    query.clientId = req.user.id;
  }
  
  if (status) query.status = status;
  if (method) query.method = method;

  const [payments, total] = await Promise.all([
    Payment.find(query)
      .populate('clientId', 'name email')
      .populate('orderId', 'orderNumber')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit),
    Payment.countDocuments(query)
  ]);

  res.json(
    ApiResponse.paginated(
      'Paiements récupérés',
      payments,
      page,
      Math.ceil(total / limit),
      total,
      limit
    )
  );
});

export const getPaymentById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const payment = await Payment.findById(id)
    .populate('clientId', 'name email')
    .populate('orderId', 'orderNumber');

  if (!payment) {
    throw ApiError.notFound('Paiement non trouvé');
  }

  // Vérifier les permissions
  if (req.user.role === 'client' && payment.clientId._id.toString() !== req.user.id) {
    throw ApiError.forbidden('Accès non autorisé à ce paiement');
  }

  res.json(
    ApiResponse.success('Paiement récupéré', { payment })
  );
});

export const updatePaymentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Seuls les administrateurs peuvent modifier les paiements');
  }

  const payment = await Payment.findById(id);
  if (!payment) {
    throw ApiError.notFound('Paiement non trouvé');
  }

  payment.status = status;
  if (status === 'completed') {
    payment.processedAt = new Date();
    
    // Mettre à jour la commande
    await Order.findByIdAndUpdate(payment.orderId, {
      paymentStatus: 'paid'
    });
  }

  await payment.save();

  res.json(
    ApiResponse.updated('Statut du paiement mis à jour', { payment })
  );
});

export const refundPayment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount, reason } = req.body;

  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Seuls les administrateurs peuvent effectuer des remboursements');
  }

  const payment = await Payment.findById(id);
  if (!payment) {
    throw ApiError.notFound('Paiement non trouvé');
  }

  if (payment.status !== 'completed') {
    throw ApiError.badRequest('Seuls les paiements complétés peuvent être remboursés');
  }

  const refundAmount = amount || payment.amount;
  
  if (refundAmount > payment.amount) {
    throw ApiError.badRequest('Le montant du remboursement ne peut pas dépasser le montant du paiement');
  }

  // Traiter le remboursement selon la méthode
  if (payment.method === 'mvola' && payment.mvolaTransaction) {
    try {
      await mvolaService.refundPayment(
        payment.mvolaTransaction.transactionId,
        refundAmount,
        reason
      );
    } catch (error: any) {
      throw ApiError.badRequest(`Erreur remboursement Mvola: ${error.message}`);
    }
  }

  // Enregistrer le remboursement
  payment.refunds.push({
    amount: refundAmount,
    reason,
    refundedAt: new Date(),
    refundId: `REF-${Date.now()}`
  });

  const totalRefunded = payment.refunds.reduce((sum, refund) => sum + refund.amount, 0);
  if (totalRefunded >= payment.amount) {
    payment.status = 'refunded';
  }

  await payment.save();

  res.json(
    ApiResponse.success('Remboursement effectué avec succès', { payment })
  );
});

export const mvolaCallback = asyncHandler(async (req: Request, res: Response) => {
  try {
    await mvolaService.handleCallback(req.body);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Erreur callback Mvola:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

export const getPaymentStats = asyncHandler(async (req: Request, res: Response) => {
  const clientId = req.user.role === 'client' ? req.user.id : undefined;
  const matchStage = clientId ? { clientId } : {};

  const stats = await Payment.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalPayments: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        completedPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        completedAmount: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] }
        },
        pendingAmount: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] }
        },
        totalFees: { $sum: '$fees.totalFees' }
      }
    }
  ]);

  const methodStats = await Payment.aggregate([
    { $match: matchStage },
    { $group: { _id: '$method', count: { $sum: 1 }, amount: { $sum: '$amount' } } }
  ]);

  const monthlyStats = await Payment.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 },
        amount: { $sum: '$amount' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    { $limit: 12 }
  ]);

  res.json(
    ApiResponse.success('Statistiques des paiements', {
      general: stats[0] || {
        totalPayments: 0,
        totalAmount: 0,
        completedPayments: 0,
        completedAmount: 0,
        pendingAmount: 0,
        totalFees: 0
      },
      byMethod: methodStats,
      monthly: monthlyStats
    })
  );
});

export const generateFinancialReport = asyncHandler(async (req: Request, res: Response) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Accès réservé aux administrateurs');
  }

  const { reportType, startDate, endDate } = req.body;

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Calculer les métriques
  const payments = await Payment.find({
    createdAt: { $gte: start, $lte: end },
    status: 'completed'
  }).populate('orderId');

  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalPayments = payments.length;
  const processingFees = payments.reduce((sum, p) => sum + p.fees.totalFees, 0);
  const netRevenue = totalRevenue - processingFees;

  // Breakdown par méthode de paiement
  const byPaymentMethod = payments.reduce((acc: any[], payment) => {
    const existing = acc.find(item => item.method === payment.method);
    if (existing) {
      existing.amount += payment.amount;
      existing.count += 1;
    } else {
      acc.push({
        method: payment.method,
        amount: payment.amount,
        count: 1,
        percentage: 0
      });
    }
    return acc;
  }, []);

  // Calculer les pourcentages
  byPaymentMethod.forEach(item => {
    item.percentage = totalRevenue > 0 ? (item.amount / totalRevenue) * 100 : 0;
  });

  const report = await FinancialReport.create({
    reportType,
    period: { startDate: start, endDate: end },
    metrics: {
      totalRevenue,
      totalOrders: totalPayments,
      averageOrderValue: totalPayments > 0 ? totalRevenue / totalPayments : 0,
      totalPayments,
      pendingPayments: 0,
      refundedAmount: 0,
      processingFees,
      netRevenue
    },
    breakdown: {
      byPaymentMethod,
      byService: [],
      byClient: []
    },
    generatedBy: req.user.id
  });

  res.json(
    ApiResponse.created('Rapport financier généré', { report })
  );
});