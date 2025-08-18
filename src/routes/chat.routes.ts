import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  getConversations,
  getConversationById,
  createConversation,
  getMessages,
  sendMessage,
  markMessageAsRead,
  markConversationAsRead,
  deleteMessage,
  editMessage,
  addReaction,
  searchMessages
} from '../controllers/chat.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Validation schemas
const createConversationValidation = [
  body('participantIds')
    .isArray({ min: 1 })
    .withMessage('Au moins un participant requis'),
  body('participantIds.*')
    .isMongoId()
    .withMessage('ID de participant invalide'),
  body('type')
    .optional()
    .isIn(['direct', 'group', 'support'])
    .withMessage('Type de conversation invalide'),
  body('title')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Le titre ne peut pas dépasser 100 caractères'),
  body('orderId')
    .optional()
    .isMongoId()
    .withMessage('ID de commande invalide')
];

const sendMessageValidation = [
  param('conversationId')
    .isMongoId()
    .withMessage('ID de conversation invalide'),
  body('content')
    .trim()
    .notEmpty()
    .isLength({ max: 2000 })
    .withMessage('Le message ne peut pas dépasser 2000 caractères'),
  body('messageType')
    .optional()
    .isIn(['text', 'file', 'image', 'system'])
    .withMessage('Type de message invalide'),
  body('replyTo')
    .optional()
    .isMongoId()
    .withMessage('ID de message de réponse invalide')
];

const editMessageValidation = [
  param('messageId')
    .isMongoId()
    .withMessage('ID de message invalide'),
  body('content')
    .trim()
    .notEmpty()
    .isLength({ max: 2000 })
    .withMessage('Le message ne peut pas dépasser 2000 caractères')
];

const addReactionValidation = [
  param('messageId')
    .isMongoId()
    .withMessage('ID de message invalide'),
  body('emoji')
    .trim()
    .notEmpty()
    .withMessage('Emoji requis')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Le numéro de page doit être un entier positif'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('La limite doit être entre 1 et 100')
];

const searchValidation = [
  param('conversationId')
    .isMongoId()
    .withMessage('ID de conversation invalide'),
  query('query')
    .trim()
    .notEmpty()
    .withMessage('Terme de recherche requis'),
  ...paginationValidation
];

// Routes des conversations
router.get('/', validate(paginationValidation), getConversations);
router.post('/', validate(createConversationValidation), createConversation);
router.get('/:id', validate([param('id').isMongoId()]), getConversationById);
router.put('/:conversationId/read', validate([param('conversationId').isMongoId()]), markConversationAsRead);

// Routes des messages
router.get('/:conversationId/messages', validate([param('conversationId').isMongoId(), ...paginationValidation]), getMessages);
router.post('/:conversationId/messages', validate(sendMessageValidation), sendMessage);
router.get('/:conversationId/messages/search', validate(searchValidation), searchMessages);

// Routes des messages individuels
router.put('/messages/:messageId/read', validate([param('messageId').isMongoId()]), markMessageAsRead);
router.put('/messages/:messageId', validate(editMessageValidation), editMessage);
router.delete('/messages/:messageId', validate([param('messageId').isMongoId()]), deleteMessage);
router.post('/messages/:messageId/reactions', validate(addReactionValidation), addReaction);

export default router;