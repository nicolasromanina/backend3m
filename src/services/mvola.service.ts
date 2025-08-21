import axios from 'axios';
import crypto from 'crypto';
import config from '../config/env';
import logger from '../utils/logger';
import { Payment } from '../models/payment.model';

interface MvolaPaymentRequest {
  amount: number;
  phoneNumber: string;
  reference: string;
  description?: string;
}

interface MvolaPaymentResponse {
  transactionId: string;
  status: 'pending' | 'completed' | 'failed';
  message: string;
}

class MvolaService {
  private readonly baseUrl = 'https://api.mvola.mg';
  private readonly merchantId = process.env.MVOLA_MERCHANT_ID || '';
  private readonly secretKey = process.env.MVOLA_SECRET_KEY || '';
  private readonly callbackUrl = process.env.MVOLA_CALLBACK_URL || '';

  private generateSignature(data: any): string {
    const sortedKeys = Object.keys(data).sort();
    const signatureString = sortedKeys
      .map(key => `${key}=${data[key]}`)
      .join('&') + this.secretKey;
    
    return crypto.createHash('sha256').update(signatureString).digest('hex');
  }

  async initiatePayment(paymentData: MvolaPaymentRequest): Promise<MvolaPaymentResponse> {
    try {
      const requestData = {
        merchantId: this.merchantId,
        amount: paymentData.amount,
        phoneNumber: paymentData.phoneNumber,
        reference: paymentData.reference,
        description: paymentData.description || 'Paiement PrintPro',
        callbackUrl: this.callbackUrl,
        timestamp: Date.now()
      };

      const signature = this.generateSignature(requestData);

      const response = await axios.post(`${this.baseUrl}/api/v1/payments/initiate`, {
        ...requestData,
        signature
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.secretKey}`
        },
        timeout: 30000
      });

      logger.info('Paiement Mvola initié:', response.data);

      return {
        transactionId: response.data.transactionId,
        status: response.data.status,
        message: response.data.message
      };

    } catch (error: any) {
      logger.error('Erreur initiation paiement Mvola:', error.response?.data || error.message);
      throw new Error(`Erreur Mvola: ${error.response?.data?.message || error.message}`);
    }
  }

  async checkPaymentStatus(transactionId: string): Promise<MvolaPaymentResponse> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/payments/${transactionId}/status`, {
        headers: {
          'Authorization': `Bearer ${this.secretKey}`
        },
        timeout: 15000
      });

      return {
        transactionId: response.data.transactionId,
        status: response.data.status,
        message: response.data.message
      };

    } catch (error: any) {
      logger.error('Erreur vérification statut Mvola:', error.response?.data || error.message);
      throw new Error(`Erreur Mvola: ${error.response?.data?.message || error.message}`);
    }
  }

  async handleCallback(callbackData: any): Promise<void> {
    try {
      // Vérifier la signature du callback
      const receivedSignature = callbackData.signature;
      delete callbackData.signature;
      
      const expectedSignature = this.generateSignature(callbackData);
      
      if (receivedSignature !== expectedSignature) {
        throw new Error('Signature invalide');
      }

      // Mettre à jour le paiement
      const payment = await Payment.findOne({
        'mvolaTransaction.transactionId': callbackData.transactionId
      });

      if (!payment) {
        throw new Error('Paiement non trouvé');
      }

      payment.status = this.mapMvolaStatus(callbackData.status);
      payment.mvolaTransaction!.status = callbackData.status;
      payment.processedAt = new Date();

      if (payment.status === 'completed') {
        // Mettre à jour la commande
        const Order = require('../models/order.model').default;
        await Order.findByIdAndUpdate(payment.orderId, {
          paymentStatus: 'paid'
        });
      }

      await payment.save();

      logger.info(`Paiement Mvola mis à jour: ${payment.paymentNumber} - ${payment.status}`);

    } catch (error) {
      logger.error('Erreur traitement callback Mvola:', error);
      throw error;
    }
  }

  private mapMvolaStatus(mvolaStatus: string): 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded' {
    const statusMap: Record<string, any> = {
      'PENDING': 'pending',
      'PROCESSING': 'processing',
      'SUCCESS': 'completed',
      'COMPLETED': 'completed',
      'FAILED': 'failed',
      'CANCELLED': 'cancelled',
      'REFUNDED': 'refunded'
    };

    return statusMap[mvolaStatus.toUpperCase()] || 'failed';
  }

  async refundPayment(transactionId: string, amount: number, reason: string): Promise<any> {
    try {
      const requestData = {
        merchantId: this.merchantId,
        transactionId,
        amount,
        reason,
        timestamp: Date.now()
      };

      const signature = this.generateSignature(requestData);

      const response = await axios.post(`${this.baseUrl}/api/v1/payments/refund`, {
        ...requestData,
        signature
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.secretKey}`
        },
        timeout: 30000
      });

      logger.info('Remboursement Mvola initié:', response.data);
      return response.data;

    } catch (error: any) {
      logger.error('Erreur remboursement Mvola:', error.response?.data || error.message);
      throw new Error(`Erreur remboursement Mvola: ${error.response?.data?.message || error.message}`);
    }
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/merchant/balance`, {
        headers: {
          'Authorization': `Bearer ${this.secretKey}`
        },
        timeout: 15000
      });

      return {
        balance: response.data.balance,
        currency: response.data.currency
      };

    } catch (error: any) {
      logger.error('Erreur récupération solde Mvola:', error.response?.data || error.message);
      throw new Error(`Erreur Mvola: ${error.response?.data?.message || error.message}`);
    }
  }
}

export const mvolaService = new MvolaService();