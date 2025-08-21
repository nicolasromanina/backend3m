import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { Invoice } from '../models/invoice.model';
import Order from '../models/order.model';
import User from '../models/user.model';
import ApiError from '../utils/apiError';
import logger from '../utils/logger';
import config from '../config/env';

interface InvoiceData {
  orderId: string;
  type: 'invoice' | 'quote' | 'credit_note' | 'proforma';
  dueDate?: Date;
  discounts?: Array<{
    type: 'percentage' | 'fixed';
    value: number;
    description: string;
  }>;
  notes?: string;
  paymentTerms?: string;
}

class InvoiceService {
  private readonly invoicesDir = path.join(config.UPLOAD_PATH, 'invoices');

  constructor() {
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.invoicesDir)) {
      fs.mkdirSync(this.invoicesDir, { recursive: true });
    }
  }

  async createInvoice(invoiceData: InvoiceData): Promise<any> {
    try {
      // Récupérer la commande
      const order = await Order.findById(invoiceData.orderId);
      if (!order) {
        throw ApiError.notFound('Commande non trouvée');
      }

      // Récupérer le client
      const client = await User.findById(order.clientId);
      if (!client) {
        throw ApiError.notFound('Client non trouvé');
      }

      // Calculer les montants
      const items = order.items.map(item => ({
        description: `${item.service.name} - ${item.quantity} ${item.service.unit}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        taxRate: 20, // TVA française
        taxAmount: item.totalPrice * 0.2
      }));

      const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
      
      // Appliquer les remises
      let discountTotal = 0;
      const discounts = invoiceData.discounts || [];
      
      discounts.forEach(discount => {
        if (discount.type === 'percentage') {
          discount.amount = subtotal * (discount.value / 100);
        } else {
          discount.amount = discount.value;
        }
        discountTotal += discount.amount;
      });

      const taxableAmount = subtotal - discountTotal;
      const taxTotal = taxableAmount * 0.2; // TVA 20%
      const total = taxableAmount + taxTotal;

      // Créer la facture
      const invoice = await Invoice.create({
        orderId: order._id,
        clientId: client._id,
        type: invoiceData.type,
        items,
        subtotal,
        discounts,
        discountTotal,
        taxDetails: [{
          rate: 20,
          base: taxableAmount,
          amount: taxTotal,
          description: 'TVA 20%'
        }],
        taxTotal,
        total,
        dueDate: invoiceData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentTerms: invoiceData.paymentTerms || 'Paiement à 30 jours',
        paymentMethods: ['card', 'transfer'],
        notes: invoiceData.notes,
        billingAddress: {
          name: client.name,
          company: client.company || '',
          street: order.billingAddress.street,
          city: order.billingAddress.city,
          postalCode: order.billingAddress.postalCode,
          country: order.billingAddress.country
        }
      });

      // Générer le PDF
      const pdfPath = await this.generatePDF(invoice);
      invoice.pdfPath = pdfPath;
      await invoice.save();

      return invoice;
    } catch (error) {
      logger.error('Erreur création facture:', error);
      throw error;
    }
  }

  async generatePDF(invoice: any): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const filename = `${invoice.invoiceNumber}.pdf`;
        const pdfPath = path.join(this.invoicesDir, filename);
        
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(pdfPath);
        doc.pipe(stream);

        // En-tête de l'entreprise
        this.addCompanyHeader(doc, invoice);
        
        // Informations client
        this.addClientInfo(doc, invoice);
        
        // Détails de la facture
        this.addInvoiceDetails(doc, invoice);
        
        // Tableau des articles
        this.addItemsTable(doc, invoice);
        
        // Totaux
        this.addTotals(doc, invoice);
        
        // Pied de page
        this.addFooter(doc, invoice);

        doc.end();

        stream.on('finish', () => {
          resolve(pdfPath);
        });

        stream.on('error', (error) => {
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private addCompanyHeader(doc: PDFKit.PDFDocument, invoice: any): void {
    // Logo et informations entreprise
    doc.fontSize(20)
       .text('PrintPro', 50, 50)
       .fontSize(10)
       .text(invoice.companyInfo.address, 50, 80)
       .text(`Tél: ${invoice.companyInfo.phone}`, 50, 95)
       .text(`Email: ${invoice.companyInfo.email}`, 50, 110);

    if (invoice.companyInfo.siret) {
      doc.text(`SIRET: ${invoice.companyInfo.siret}`, 50, 125);
    }

    // Type de document
    const docType = this.getDocumentTypeLabel(invoice.type);
    doc.fontSize(16)
       .text(docType, 400, 50)
       .fontSize(12)
       .text(`N° ${invoice.invoiceNumber}`, 400, 75)
       .text(`Date: ${new Date(invoice.createdAt).toLocaleDateString('fr-FR')}`, 400, 90);

    if (invoice.type === 'invoice') {
      doc.text(`Échéance: ${new Date(invoice.dueDate).toLocaleDateString('fr-FR')}`, 400, 105);
    }
  }

  private addClientInfo(doc: PDFKit.PDFDocument, invoice: any): void {
    doc.fontSize(12)
       .text('Facturé à:', 50, 180)
       .fontSize(10)
       .text(invoice.billingAddress.name, 50, 200);

    if (invoice.billingAddress.company) {
      doc.text(invoice.billingAddress.company, 50, 215);
    }

    doc.text(invoice.billingAddress.street, 50, 230)
       .text(`${invoice.billingAddress.postalCode} ${invoice.billingAddress.city}`, 50, 245)
       .text(invoice.billingAddress.country, 50, 260);
  }

  private addInvoiceDetails(doc: PDFKit.PDFDocument, invoice: any): void {
    const startY = 300;
    doc.fontSize(10)
       .text(`Conditions de paiement: ${invoice.paymentTerms}`, 50, startY);

    if (invoice.notes) {
      doc.text(`Notes: ${invoice.notes}`, 50, startY + 15);
    }
  }

  private addItemsTable(doc: PDFKit.PDFDocument, invoice: any): void {
    const tableTop = 350;
    const itemCodeX = 50;
    const descriptionX = 150;
    const quantityX = 350;
    const priceX = 400;
    const totalX = 480;

    // En-têtes du tableau
    doc.fontSize(10)
       .text('Description', descriptionX, tableTop)
       .text('Qté', quantityX, tableTop)
       .text('Prix unit.', priceX, tableTop)
       .text('Total HT', totalX, tableTop);

    // Ligne de séparation
    doc.moveTo(50, tableTop + 15)
       .lineTo(550, tableTop + 15)
       .stroke();

    let currentY = tableTop + 25;

    // Articles
    invoice.items.forEach((item: any) => {
      doc.text(item.description, descriptionX, currentY)
         .text(item.quantity.toString(), quantityX, currentY)
         .text(`${item.unitPrice.toFixed(2)} €`, priceX, currentY)
         .text(`${item.totalPrice.toFixed(2)} €`, totalX, currentY);
      
      currentY += 20;
    });

    // Ligne de séparation finale
    doc.moveTo(50, currentY + 5)
       .lineTo(550, currentY + 5)
       .stroke();
  }

  private addTotals(doc: PDFKit.PDFDocument, invoice: any): void {
    const totalsX = 400;
    let currentY = 500;

    // Sous-total
    doc.fontSize(10)
       .text('Sous-total HT:', totalsX, currentY)
       .text(`${invoice.subtotal.toFixed(2)} €`, totalsX + 100, currentY);
    currentY += 15;

    // Remises
    if (invoice.discountTotal > 0) {
      doc.text('Remise:', totalsX, currentY)
         .text(`-${invoice.discountTotal.toFixed(2)} €`, totalsX + 100, currentY);
      currentY += 15;
    }

    // TVA
    invoice.taxDetails.forEach((tax: any) => {
      doc.text(`${tax.description}:`, totalsX, currentY)
         .text(`${tax.amount.toFixed(2)} €`, totalsX + 100, currentY);
      currentY += 15;
    });

    // Total TTC
    doc.fontSize(12)
       .text('Total TTC:', totalsX, currentY)
       .text(`${invoice.total.toFixed(2)} €`, totalsX + 100, currentY);
  }

  private addFooter(doc: PDFKit.PDFDocument, invoice: any): void {
    const footerY = 700;
    
    doc.fontSize(8)
       .text('Merci de votre confiance !', 50, footerY)
       .text('PrintPro - Services d\'impression professionnelle', 50, footerY + 15);

    if (invoice.footerText) {
      doc.text(invoice.footerText, 50, footerY + 30);
    }
  }

  private getDocumentTypeLabel(type: string): string {
    const labels = {
      'invoice': 'FACTURE',
      'quote': 'DEVIS',
      'credit_note': 'AVOIR',
      'proforma': 'FACTURE PROFORMA'
    };
    return labels[type as keyof typeof labels] || 'DOCUMENT';
  }

  async markAsPaid(invoiceId: string, paymentReference?: string): Promise<any> {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      throw ApiError.notFound('Facture non trouvée');
    }

    invoice.status = 'paid';
    invoice.paidAt = new Date();
    if (paymentReference) {
      invoice.paymentReference = paymentReference;
    }

    await invoice.save();
    return invoice;
  }

  async sendInvoice(invoiceId: string): Promise<void> {
    const invoice = await Invoice.findById(invoiceId)
      .populate('clientId', 'name email');

    if (!invoice) {
      throw ApiError.notFound('Facture non trouvée');
    }

    // Ici, on intégrerait l'envoi par email
    // await emailService.sendInvoice(invoice.clientId.email, invoice);

    invoice.sentAt = new Date();
    invoice.status = 'sent';
    await invoice.save();
  }

  async getOverdueInvoices(): Promise<any[]> {
    const today = new Date();
    return Invoice.find({
      type: 'invoice',
      status: 'sent',
      dueDate: { $lt: today }
    }).populate('clientId', 'name email');
  }

  async createRecurringInvoices(): Promise<void> {
    const recurringInvoices = await Invoice.find({
      'recurringSettings.isRecurring': true,
      'recurringSettings.nextInvoiceDate': { $lte: new Date() },
      status: { $ne: 'cancelled' }
    });

    for (const invoice of recurringInvoices) {
      try {
        // Créer une nouvelle facture basée sur la récurrente
        const newInvoiceData = {
          orderId: invoice.orderId.toString(),
          type: 'invoice' as const,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        };

        await this.createInvoice(newInvoiceData);

        // Mettre à jour la date de la prochaine facture
        const nextDate = new Date(invoice.recurringSettings!.nextInvoiceDate!);
        switch (invoice.recurringSettings!.frequency) {
          case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
          case 'quarterly':
            nextDate.setMonth(nextDate.getMonth() + 3);
            break;
          case 'yearly':
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
        }

        invoice.recurringSettings!.nextInvoiceDate = nextDate;
        await invoice.save();

      } catch (error) {
        logger.error(`Erreur création facture récurrente ${invoice._id}:`, error);
      }
    }
  }
}

export const invoiceService = new InvoiceService();