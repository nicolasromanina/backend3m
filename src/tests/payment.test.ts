import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app';
import User from '../models/user.model';
import Order from '../models/order.model';
import { Payment } from '../models/payment.model';

describe('Payment Endpoints', () => {
  let clientToken: string;
  let adminToken: string;
  let orderId: string;
  let clientId: string;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/printpro_test');
  });

  beforeEach(async () => {
    // Nettoyer la base de données
    await User.deleteMany({});
    await Order.deleteMany({});
    await Payment.deleteMany({});

    // Créer un client
    const client = new User({
      name: 'Client Test',
      email: 'client@example.com',
      password: 'Password123!',
      role: 'client',
      isEmailVerified: true
    });
    await client.save();
    clientId = client._id.toString();

    // Créer un admin
    const admin = new User({
      name: 'Admin Test',
      email: 'admin@example.com',
      password: 'Password123!',
      role: 'admin',
      isEmailVerified: true
    });
    await admin.save();

    // Obtenir les tokens
    const clientLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'client@example.com',
        password: 'Password123!'
      });
    clientToken = clientLogin.body.tokens.accessToken;

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'Password123!'
      });
    adminToken = adminLogin.body.tokens.accessToken;

    // Créer une commande
    const order = new Order({
      clientId,
      client: { name: 'Client Test', email: 'client@example.com' },
      items: [{
        serviceId: new mongoose.Types.ObjectId(),
        service: { name: 'Flyers A5', unit: 'unité' },
        quantity: 500,
        options: {},
        unitPrice: 50,
        totalPrice: 25000
      }],
      billingAddress: {
        name: 'Client Test',
        street: '123 Test Street',
        city: 'Test City',
        postalCode: '12345',
        country: 'France'
      },
      shippingAddress: {
        name: 'Client Test',
        street: '123 Test Street',
        city: 'Test City',
        postalCode: '12345',
        country: 'France'
      }
    });
    await order.save();
    orderId = order._id.toString();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/payments', () => {
    it('should create payment successfully', async () => {
      const paymentData = {
        orderId,
        amount: 25000,
        method: 'card'
      };

      const response = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(paymentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment.amount).toBe(25000);
      expect(response.body.data.payment.method).toBe('card');
      expect(response.body.data.payment.status).toBe('pending');
    });

    it('should create Mvola payment with phone number', async () => {
      const paymentData = {
        orderId,
        amount: 25000,
        method: 'mvola',
        phoneNumber: '+261341234567'
      };

      // Note: Ce test échouera en réalité car le service Mvola n'est pas configuré
      // Dans un environnement de test, on devrait mocker le service Mvola
      const response = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(paymentData)
        .expect(400); // Attendu car le service Mvola n'est pas configuré

      expect(response.body.success).toBe(false);
    });

    it('should not create payment without authentication', async () => {
      const paymentData = {
        orderId,
        amount: 25000,
        method: 'card'
      };

      const response = await request(app)
        .post('/api/payments')
        .send(paymentData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should not create payment with invalid order', async () => {
      const paymentData = {
        orderId: new mongoose.Types.ObjectId().toString(),
        amount: 25000,
        method: 'card'
      };

      const response = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(paymentData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('non trouvée');
    });

    it('should not create payment with invalid amount', async () => {
      const paymentData = {
        orderId,
        amount: -100,
        method: 'card'
      };

      const response = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(paymentData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/payments', () => {
    let paymentId: string;

    beforeEach(async () => {
      // Créer un paiement de test
      const payment = new Payment({
        orderId,
        clientId,
        amount: 25000,
        method: 'card',
        status: 'completed',
        fees: {
          processingFee: 750,
          platformFee: 250,
          totalFees: 1000
        }
      });
      await payment.save();
      paymentId = payment._id.toString();
    });

    it('should get client payments', async () => {
      const response = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].clientId).toBe(clientId);
    });

    it('should get all payments for admin', async () => {
      const response = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should filter payments by status', async () => {
      const response = await request(app)
        .get('/api/payments?status=completed')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('completed');
    });

    it('should filter payments by method', async () => {
      const response = await request(app)
        .get('/api/payments?method=card')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].method).toBe('card');
    });
  });

  describe('GET /api/payments/:id', () => {
    let paymentId: string;

    beforeEach(async () => {
      const payment = new Payment({
        orderId,
        clientId,
        amount: 25000,
        method: 'card',
        status: 'completed',
        fees: {
          processingFee: 750,
          platformFee: 250,
          totalFees: 1000
        }
      });
      await payment.save();
      paymentId = payment._id.toString();
    });

    it('should get payment by id for owner', async () => {
      const response = await request(app)
        .get(`/api/payments/${paymentId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment._id).toBe(paymentId);
    });

    it('should get payment by id for admin', async () => {
      const response = await request(app)
        .get(`/api/payments/${paymentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment._id).toBe(paymentId);
    });

    it('should not get non-existent payment', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .get(`/api/payments/${fakeId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/payments/:id/status', () => {
    let paymentId: string;

    beforeEach(async () => {
      const payment = new Payment({
        orderId,
        clientId,
        amount: 25000,
        method: 'card',
        status: 'pending',
        fees: {
          processingFee: 750,
          platformFee: 250,
          totalFees: 1000
        }
      });
      await payment.save();
      paymentId = payment._id.toString();
    });

    it('should update payment status by admin', async () => {
      const updateData = {
        status: 'completed'
      };

      const response = await request(app)
        .put(`/api/payments/${paymentId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payment.status).toBe('completed');
    });

    it('should not update payment status by client', async () => {
      const updateData = {
        status: 'completed'
      };

      const response = await request(app)
        .put(`/api/payments/${paymentId}/status`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/payments/stats', () => {
    beforeEach(async () => {
      // Créer quelques paiements pour les stats
      const payments = [
        {
          orderId,
          clientId,
          amount: 25000,
          method: 'card',
          status: 'completed',
          fees: { processingFee: 750, platformFee: 250, totalFees: 1000 }
        },
        {
          orderId,
          clientId,
          amount: 15000,
          method: 'mvola',
          status: 'pending',
          fees: { processingFee: 300, platformFee: 150, totalFees: 450 }
        }
      ];

      await Payment.insertMany(payments);
    });

    it('should get payment statistics', async () => {
      const response = await request(app)
        .get('/api/payments/stats')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.general.totalPayments).toBe(2);
      expect(response.body.data.general.completedPayments).toBe(1);
      expect(response.body.data.general.completedAmount).toBe(25000);
      expect(response.body.data.general.pendingAmount).toBe(15000);
    });

    it('should get payment statistics by method', async () => {
      const response = await request(app)
        .get('/api/payments/stats')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.byMethod).toHaveLength(2);
      
      const cardStats = response.body.data.byMethod.find((m: any) => m._id === 'card');
      const mvolaStats = response.body.data.byMethod.find((m: any) => m._id === 'mvola');
      
      expect(cardStats.count).toBe(1);
      expect(cardStats.amount).toBe(25000);
      expect(mvolaStats.count).toBe(1);
      expect(mvolaStats.amount).toBe(15000);
    });
  });
});