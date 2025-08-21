import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app';
import User from '../models/user.model';

describe('Auth Endpoints', () => {
  beforeAll(async () => {
    // Connexion à la base de données de test
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/printpro_test');
  });

  beforeEach(async () => {
    // Nettoyer la base de données avant chaque test
    await User.deleteMany({});
  });

  afterAll(async () => {
    // Fermer la connexion après tous les tests
    await mongoose.connection.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'Password123!',
        phone: '+33123456789'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.name).toBe(userData.name);
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');
    });

    it('should not register user with invalid email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'Password123!',
        phone: '+33123456789'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.meta.errors).toHaveProperty('email');
    });

    it('should not register user with weak password', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: '123',
        phone: '+33123456789'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.meta.errors).toHaveProperty('password');
    });

    it('should not register user with existing email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'Password123!',
        phone: '+33123456789'
      };

      // Premier enregistrement
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Tentative de second enregistrement avec le même email
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('existe déjà');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Créer un utilisateur de test
      const user = new User({
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'Password123!',
        isEmailVerified: true
      });
      await user.save();
    });

    it('should login user with valid credentials', async () => {
      const loginData = {
        email: 'john.doe@example.com',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.user.email).toBe(loginData.email);
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
    });

    it('should not login user with invalid password', async () => {
      const loginData = {
        email: 'john.doe@example.com',
        password: 'WrongPassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('incorrect');
    });

    it('should not login user with non-existent email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('incorrect');
    });
  });

  describe('GET /api/auth/profile', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      // Créer un utilisateur et obtenir un token
      const user = new User({
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'Password123!',
        isEmailVerified: true
      });
      await user.save();
      userId = user._id.toString();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john.doe@example.com',
          password: 'Password123!'
        });

      accessToken = loginResponse.body.tokens.accessToken;
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('john.doe@example.com');
      expect(response.body.data.user.name).toBe('John Doe');
    });

    it('should not get profile without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('requis');
    });

    it('should not get profile with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('invalide');
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Créer un utilisateur et obtenir des tokens
      const user = new User({
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'Password123!',
        isEmailVerified: true
      });
      await user.save();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john.doe@example.com',
          password: 'Password123!'
        });

      refreshToken = loginResponse.body.tokens.refreshToken;
    });

    it('should refresh tokens with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');
    });

    it('should not refresh tokens with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('invalide');
    });
  });
});