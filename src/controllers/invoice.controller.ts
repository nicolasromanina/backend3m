import { Request, Response } from 'express';
import { Invoice } from '../models/invoice.model';
import { invoiceService } from '../services/invoice.service';
import ApiError from '../utils/apiError';
import ApiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middlewares/error.middleware';

export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoiceData = req.body;

  const invoice = await invoiceService.createInvoice(invoiceData);

  res.status(201).json(
    ApiResponse.created('Facture créée avec succès', { invoice })
  );
});

export const getInvoices = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = req.query.status as string;
  const type = req.query.type as string;
  const clientId = req.query.clientId as string;

  const query: any = {};
  
  // Si c'est un client, ne montrer que ses factures
  if (req.user.role === 'client') {
    query.clientId = req.user.id;
  } else if (clientId) {
    query.clientId = clientId;
  }
  
  if (status) query.status = status;
  if (type) query.type = type;

  const [invoices, total] = await Promise.all([
    Invoice.find(query)
      .populate('clientId', 'name email company')
      .populate('orderId', 'orderNumber')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit),
    Invoice.countDocuments(query)
  ]);

  res.json(
    ApiResponse.paginated(
      'Factures récupérées',
      invoices,
      page,
      Math.ceil(total / limit),
      total,
      limit
    )
  );
});

export const getInvoiceById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const invoice = await Invoice.findById(id)
    .populate('clientId', 'name email company')
    .populate('orderId', 'orderNumber');

  if (!invoice) {
    throw ApiError.notFound('Facture non trouvée');
  }

  // Vérifier les permissions
  if (req.user.role === 'client' && invoice.clientId._id.toString() !== req.user.id) {
    throw ApiError.forbidden('Accès non autorisé à cette facture');
  }

  res.json(
    ApiResponse.success('Facture récupérée', { invoice })
  );
});

export const updateInvoice = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const invoice = await Invoice.findById(id);
  if (!invoice) {
    throw ApiError.notFound('Facture non trouvée');
  }

  // Seuls les admins peuvent modifier les factures
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Seuls les administrateurs peuvent modifier les factures');
  }

  // Ne pas permettre la modification des factures payées
  if (invoice.status === 'paid') {
    throw ApiError.badRequest('Impossible de modifier une facture payée');
  }

  Object.assign(invoice, updateData);
  await invoice.save();

  res.json(
    ApiResponse.updated('Facture mise à jour', { invoice })
  );
});

export const markAsPaid = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { paymentReference } = req.body;

  const invoice = await invoiceService.markAsPaid(id, paymentReference);

  res.json(
    ApiResponse.success('Facture marquée comme payée', { invoice })
  );
});

export const sendInvoice = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  await invoiceService.sendInvoice(id);

  res.json(
    ApiResponse.success('Facture envoyée avec succès')
  );
});

export const downloadInvoice = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const invoice = await Invoice.findById(id);
  if (!invoice) {
    throw ApiError.notFound('Facture non trouvée');
  }

  // Vérifier les permissions
  if (req.user.role === 'client' && invoice.clientId.toString() !== req.user.id) {
    throw ApiError.forbidden('Accès non autorisé à cette facture');
  }

  if (!invoice.pdfPath) {
    throw ApiError.notFound('PDF de la facture non disponible');
  }

  res.download(invoice.pdfPath, `${invoice.invoiceNumber}.pdf`);
});

export const getOverdueInvoices = asyncHandler(async (req: Request, res: Response) => {
  const overdueInvoices = await invoiceService.getOverdueInvoices();

  res.json(
    ApiResponse.success('Factures en retard récupérées', { invoices: overdueInvoices })
  );
});

export const getInvoiceStats = asyncHandler(async (req: Request, res: Response) => {
  const clientId = req.user.role === 'client' ? req.user.id : undefined;
  const matchStage = clientId ? { clientId } : {};

  const stats = await Invoice.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        totalAmount: { $sum: '$total' },
        paidAmount: {
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$total', 0] }
        },
        pendingAmount: {
          $sum: { $cond: [{ $ne: ['$status', 'paid'] }, '$total', 0] }
        },
        overdueAmount: {
          $sum: {
            $cond: [
              { 
                $and: [
                  { $eq: ['$status', 'sent'] },
                  { $lt: ['$dueDate', new Date()] }
                ]
              },
              '$total',
              0
            ]
          }
        }
      }
    }
  ]);

  const statusStats = await Invoice.aggregate([
    { $match: matchStage },
    { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$total' } } }
  ]);

  const monthlyStats = await Invoice.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 },
        amount: { $sum: '$total' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    { $limit: 12 }
  ]);

  res.json(
    ApiResponse.success('Statistiques des factures', {
      general: stats[0] || {
        totalInvoices: 0,
        totalAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        overdueAmount: 0
      },
      byStatus: statusStats,
      monthly: monthlyStats
    })
  );
});

export const createRecurringInvoice = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { frequency, endDate } = req.body;

  const invoice = await Invoice.findById(id);
  if (!invoice) {
    throw ApiError.notFound('Facture non trouvée');
  }

  // Configurer la récurrence
  invoice.recurringSettings = {
    isRecurring: true,
    frequency,
    nextInvoiceDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Dans 30 jours
    endDate: endDate ? new Date(endDate) : undefined
  };

  await invoice.save();

  res.json(
    ApiResponse.success('Facture récurrente configurée', { invoice })
  );
});