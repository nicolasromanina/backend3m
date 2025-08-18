import winston from 'winston';
import path from 'path';
import config from '../config/env';

// Définir les niveaux de log personnalisés
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Définir les couleurs pour chaque niveau
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Ajouter les couleurs à winston
winston.addColors(colors);

// Format personnalisé pour les logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Format pour les fichiers (sans couleurs)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Définir les transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format,
    level: config.NODE_ENV === 'development' ? 'debug' : 'info',
  }),
  
  // File transport pour les erreurs
  new winston.transports.File({
    filename: path.join('logs', 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // File transport pour tous les logs
  new winston.transports.File({
    filename: path.join('logs', 'combined.log'),
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Créer le logger
const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  levels,
  format: fileFormat,
  transports,
  exitOnError: false,
});

// Créer le dossier logs s'il n'existe pas
import fs from 'fs';
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Stream pour Morgan
logger.stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
} as any;

export default logger;