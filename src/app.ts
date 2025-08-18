import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { createServer } from 'http';
import SocketService from './services/socket.service';

// Configuration et utilitaires
import config from './config/env';
import database from './config/db';
import logger from './utils/logger';

// Middlewares
import { errorHandler, notFound } from './middlewares/error.middleware';

// Routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import serviceRoutes from './routes/service.routes';
import orderRoutes from './routes/order.routes';
import chatRoutes from './routes/chat.routes';
import notificationRoutes from './routes/notification.routes';
import analyticsRoutes from './routes/analytics.routes';
import inventoryRoutes from './routes/inventory.routes';
import teamRoutes from './routes/team.routes';

class App {
  public app: express.Application;
  public server: any;
  public socketService: SocketService;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.socketService = new SocketService(this.server);
    this.initializeDatabase();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      await database.connect();
    } catch (error) {
      logger.error('❌ Erreur de connexion à la base de données:', error);
      process.exit(1);
    }
  }

  private initializeMiddlewares(): void {
    // Sécurité
    this.app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }));

    // CORS
    this.app.use(cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Compression
    this.app.use(compression());

    // Logging
    this.app.use(morgan('dev'));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX_REQUESTS,
      message: {
        success: false,
        message: 'Trop de requêtes, veuillez réessayer plus tard.'
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Servir les fichiers statiques
    this.app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
    this.app.use('/public', express.static(path.join(__dirname, '../public')));

    // Health check
    this.app.get('/health', async (req, res) => {
      const dbHealth = await database.healthCheck();
      res.status(dbHealth.status === 'success' ? 200 : 503).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.NODE_ENV,
        database: dbHealth,
        memory: process.memoryUsage(),
        version: process.version
      });
    });
  }

  private initializeRoutes(): void {
    // API Routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/services', serviceRoutes);
    this.app.use('/api/orders', orderRoutes);
    this.app.use('/api/chat', chatRoutes);
    this.app.use('/api/notifications', notificationRoutes);
    this.app.use('/api/analytics', analyticsRoutes);
    this.app.use('/api/inventory', inventoryRoutes);
    this.app.use('/api/team', teamRoutes);

    // API Info
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'PrintPro API',
        version: '1.0.0',
        description: 'API pour l\'application de gestion de services d\'impression',
        endpoints: {
          auth: '/api/auth',
          users: '/api/users',
          services: '/api/services',
          orders: '/api/orders',
          chat: '/api/chat',
          notifications: '/api/notifications',
          analytics: '/api/analytics',
          inventory: '/api/inventory',
          team: '/api/team'
        },
        documentation: '/api/docs',
        health: '/health'
      });
    });
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(notFound);

    // Error handler
    this.app.use(errorHandler);
  }

  public listen(): void {
    this.server.listen(config.PORT, () => {
      logger.info(`🚀 Serveur démarré sur le port ${config.PORT}`);
      logger.info(`📱 Environnement: ${config.NODE_ENV}`);
      logger.info(`🌐 CORS autorisé pour: ${config.CORS_ORIGIN}`);
      logger.info(`📊 API disponible sur: http://localhost:${config.PORT}/api`);
      logger.info(`🏥 Health check: http://localhost:${config.PORT}/health`);
      logger.info(`🔌 Socket.IO activé pour chat temps réel`);
    });
  }

  public getServer(): any {
    return this.server;
  }
}

// Créer et démarrer l'application
const app = new App();

// Gestion gracieuse de l'arrêt
process.on('SIGTERM', async () => {
  logger.info('🛑 Signal SIGTERM reçu, arrêt gracieux...');
  await database.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('🛑 Signal SIGINT reçu, arrêt gracieux...');
  await database.disconnect();
  process.exit(0);
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  logger.error('❌ Exception non capturée:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Promesse rejetée non gérée:', reason);
  process.exit(1);
});

// Démarrer le serveur si ce fichier est exécuté directement
if (require.main === module) {
  app.listen();
}

export default app;