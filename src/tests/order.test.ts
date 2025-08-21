import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app';
import User from '../models/user.model';
import Service from '../models/service.model';
import Order from '../models/order.model';

describe('Order Endpoints', () => {
  let clientToken: string;
  let adminToken: string;
  let serviceId: string;
  let clientId: string;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/printpro_test');
  });

  beforeEach(async () => {
    // Nettoyer la base de données
    await User.deleteMany({});
    await Service.deleteMany({});
    await Order.deleteMany({});

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

    // Créer un service
    const service = new Service({
      name: 'Flyers A5',
      description: 'Flyers format A5',
      category: 'flyers',
      basePrice: 50,
      unit: 'unité',
      minQuantity: 100,
      maxQuantity: 10000,
      isActive: true
    });
    await service.save();
    serviceId = service._id.toString();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/orders', () => {
    it('should create order successfully', async () => {
      const orderData = {
        items: [{
          serviceId,
          quantity: 500,
          options: {}
        }],
        billingAddress: {
          name: 'Client Test',
          street: '123 Test Street',
          city: 'Test City',
          postalCode: '12345',
          country: 'France'
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order.items).toHaveLength(1);
      expect(response.body.data.order.items[0].quantity).toBe(500);
      expect(response.body.data.order.status).toBe('draft');
    });

    it('should not create order without authentication', async () => {
      const orderData = {
        items: [{
          serviceId,
          quantity: 500,
          options: {}
        }],
        billingAddress: {
          name: 'Client Test',
          street: '123 Test Street',
          city: 'Test City',
          postalCode: '12345',
          country: 'France'
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should not create order with invalid service', async () => {
      const orderData = {
        items: [{
          serviceId: new mongoose.Types.ObjectId().toString(),
          quantity: 500,
          options: {}
        }],
        billingAddress: {
          name: 'Client Test',
          street: '123 Test Street',
          city: 'Test City',
          postalCode: '12345',
          country: 'France'
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('non trouvé');
    });

    it('should not create order with quantity below minimum', async () => {
      const orderData = {
        items: [{
          serviceId,
          quantity: 50, // Minimum est 100
          options: {}
        }],
        billingAddress: {
          name: 'Client Test',
          street: '123 Test Street',
          city: 'Test City',
          postalCode: '12345',
          country: 'France'
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Quantité invalide');
    });
  });

  describe('GET /api/orders', () => {
    let orderId: string;

    beforeEach(async () => {
      // Créer une commande de test
      const order = new Order({
        clientId,
        client: { name: 'Client Test', email: 'client@example.com' },
        items: [{
          serviceId,
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

    it('should get client orders', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].clientId).toBe(clientId);
    });

    it('should get all orders for admin', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should filter orders by status', async () => {
      const response = await request(app)
        .get('/api/orders?status=draft')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('draft');
    });

    it('should paginate orders', async () => {
      const response = await request(app)
        .get('/api/orders?page=1&limit=5')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination.currentPage).toBe(1);
      expect(response.body.pagination.itemsPerPage).toBe(5);
    });
  });

  describe('GET /api/orders/:id', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = new Order({
        clientId,
        client: { name: 'Client Test', email: 'client@example.com' },
        items: [{
          serviceId,
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

    it('should get order by id for owner', async () => {
      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order._id).toBe(orderId);
    });

    it('should get order by id for admin', async () => {
      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order._id).toBe(orderId);
    });

    it('should not get order with invalid id', async () => {
      const response = await request(app)
        .get('/api/orders/invalid-id')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should not get non-existent order', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .get(`/api/orders/${fakeId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/orders/:id', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = new Order({
        clientId,
        client: { name: 'Client Test', email: 'client@example.com' },
        items: [{
          serviceId,
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

    it('should update order notes by client', async () => {
      const updateData = {
        notes: 'Notes mises à jour'
      };

      const response = await request(app)
        .put(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order.notes).toBe('Notes mises à jour');
    });

    it('should update order status by admin', async () => {
      const updateData = {
        status: 'confirmed'
      };

      const response = await request(app)
        .put(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order.status).toBe('confirmed');
    });

    it('should not update order status by client', async () => {
      const updateData = {
        status: 'confirmed'
      };

      const response = await request(app)
        .put(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send(updateData)
        .expect(200);

      // Le statut ne devrait pas changer car le client n'a pas le droit
      expect(response.body.data.order.status).toBe('draft');
    });
  });

  describe('GET /api/orders/stats', () => {
    beforeEach(async () => {
      // Créer quelques commandes pour les stats
      const orders = [
        {
          clientId,
          client: { name: 'Client Test', email: 'client@example.com' },
          items: [{
            serviceId,
            service: { name: 'Flyers A5', unit: 'unité' },
            quantity: 500,
            options: {},
            unitPrice: 50,
            totalPrice: 25000
          }],
          status: 'draft',
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
        },
        {
          clientId,
          client: { name: 'Client Test', email: 'client@example.com' },
          items: [{
            serviceId,
            service: { name: 'Flyers A5', unit: 'unité' },
            quantity: 1000,
            options: {},
            unitPrice: 50,
            totalPrice: 50000
          }],
          status: 'delivered',
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
        }
      ];

      await Order.insertMany(orders);
    });

    it('should get order statistics', async () => {
      const response = await request(app)
        .get('/api/orders/stats')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.general.totalOrders).toBe(2);
      expect(response.body.data.general.completedOrders).toBe(1);
      expect(response.body.data.general.pendingOrders).toBe(1);
    });
  });
});