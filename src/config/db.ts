import mongoose from 'mongoose';
import config from './env';
import logger from '../utils/logger';
import User from '../models/user.model';
import bcrypt from 'bcryptjs';

class Database {
  private static instance: Database;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('📦 Base de données déjà connectée');
      return;
    }

    try {
      const mongoUri = config.NODE_ENV === 'test' ? config.MONGODB_TEST_URI : config.MONGODB_URI;
      
      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
      });

      this.isConnected = true;
      logger.info(`📦 MongoDB connecté: ${mongoUri}`);

      // Initialisation de l'admin après la connexion
      await this.initializeAdminUser();

      // Gestion des événements de connexion
      mongoose.connection.on('error', (error) => {
        logger.error('❌ Erreur MongoDB:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('⚠️ MongoDB déconnecté');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('🔄 MongoDB reconnecté');
        this.isConnected = true;
        this.initializeAdminUser(); // Réinitialiser l'admin si reconnecté
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });

    } catch (error) {
      logger.error('❌ Erreur de connexion MongoDB:', error);
      process.exit(1);
    }
  }

  private async initializeAdminUser(): Promise<void> {
    try {
      if (!config.ADMIN_EMAIL || !config.ADMIN_PASSWORD) {
        logger.warn('⚠️ Configuration admin manquante dans .env');
        return;
      }

      const adminData = {
        name: config.ADMIN_NAME || 'Administrateur Principal',
        email: config.ADMIN_EMAIL,
        password: await bcrypt.hash(config.ADMIN_PASSWORD, 12),
        role: 'admin',
        isEmailVerified: true,
        isActive: true,
        preferences: {
          notifications: {
            email: true,
            sms: false,
            push: true
          },
          theme: 'dark',
          language: 'fr'
        }
      };

      const adminUser = await User.findOneAndUpdate(
        { email: config.ADMIN_EMAIL },
        adminData,
        { 
          upsert: true,
          new: true,
          setDefaultsOnInsert: true 
        }
      );

      logger.info(`🛡️  Utilisateur admin initialisé: ${adminUser.email}`);
    } catch (error) {
      logger.error('❌ Erreur lors de l\'initialisation de l\'admin:', error);
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('📦 MongoDB déconnecté proprement');
    } catch (error) {
      logger.error('❌ Erreur lors de la déconnexion MongoDB:', error);
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  public async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      if (!this.isConnected) {
        return { status: 'error', message: 'Base de données non connectée' };
      }

      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
        return { 
          status: 'success', 
          message: `Base de données connectée - État: ${mongoose.connection.readyState}` 
        };
      }
      
      return { status: 'error', message: 'La connexion DB est undefined' };
    } catch (error) {
      return { 
        status: 'error', 
        message: `Erreur de santé de la base de données: ${error}` 
      };
    }
  }
}

export default Database.getInstance();