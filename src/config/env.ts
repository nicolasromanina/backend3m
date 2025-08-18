import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

interface Config {
  NODE_ENV: string;
  PORT: number;
  MONGODB_URI: string;
  MONGODB_TEST_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRE: string | number;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRE: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  FROM_EMAIL: string;
  FROM_NAME: string;
  MAX_FILE_SIZE: number;
  UPLOAD_PATH: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  CORS_ORIGIN: string;
  LOG_LEVEL: string;
  LOG_FILE: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  REDIS_URL?: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  ADMIN_NAME: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
}

const config: Config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/3m',
  MONGODB_TEST_URI: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/3m_test',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-key',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
  JWT_REFRESH_EXPIRE: process.env.JWT_REFRESH_EXPIRE || '30d',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  FROM_EMAIL: process.env.FROM_EMAIL || 'nicolasromanina@gmail.com',
  FROM_NAME: process.env.FROM_NAME || 'PrintPro',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
  UPLOAD_PATH: process.env.UPLOAD_PATH || './uploads',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || 'logs/app.log',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  REDIS_URL: process.env.REDIS_URL,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'nicolasromanina@gmail.com',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Password123',
  ADMIN_NAME: process.env.ADMIN_NAME || 'Administrateur Principal',
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER
};

// Validation des variables d'environnement critiques
const requiredEnvVars = ['JWT_SECRET', 'MONGODB_URI'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(`❌ Variables d'environnement manquantes: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

export default config;