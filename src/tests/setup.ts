import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  // Démarrer MongoDB en mémoire pour les tests
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  // Configurer la variable d'environnement pour les tests
  process.env.MONGODB_TEST_URI = uri;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
});

afterAll(async () => {
  // Fermer la connexion et arrêter MongoDB
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (mongod) {
    await mongod.stop();
  }
});

beforeEach(async () => {
  // Nettoyer toutes les collections avant chaque test
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
});

// Supprimer les logs pendant les tests
console.log = jest.fn();
console.error = jest.fn();
console.warn = jest.fn();