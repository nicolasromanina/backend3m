import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import config from '../config/env';
import { Message, Conversation } from '../models/chat.model';
import { Notification } from '../models/notification.model';
import { UserActivity } from '../models/analytics.model';
import logger from '../utils/logger';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

class SocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: config.CORS_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentification middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Token d\'authentification requis'));
        }

        const decoded = jwt.verify(token, config.JWT_SECRET) as any;
        socket.userId = decoded.userId;
        socket.userRole = decoded.role;
        
        next();
      } catch (error) {
        next(new Error('Token invalide'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`Utilisateur connecté: ${socket.userId}`);
      
      if (socket.userId) {
        this.connectedUsers.set(socket.userId, socket.id);
        this.joinUserRooms(socket);
        this.updateUserStatus(socket.userId, 'online');
      }

      socket.on('join_conversation', (conversationId: string) => {
        socket.join(`conversation_${conversationId}`);
        logger.info(`Utilisateur ${socket.userId} a rejoint la conversation ${conversationId}`);
      });

      socket.on('leave_conversation', (conversationId: string) => {
        socket.leave(`conversation_${conversationId}`);
        logger.info(`Utilisateur ${socket.userId} a quitté la conversation ${conversationId}`);
      });

      socket.on('send_message', async (data) => {
        await this.handleSendMessage(socket, data);
      });

      socket.on('mark_message_read', async (data) => {
        await this.handleMarkMessageRead(socket, data);
      });

      socket.on('typing_start', (data) => {
        this.handleTyping(socket, data, true);
      });

      socket.on('typing_stop', (data) => {
        this.handleTyping(socket, data, false);
      });

      socket.on('mark_notification_read', async (notificationId: string) => {
        await this.handleMarkNotificationRead(socket, notificationId);
      });

      socket.on('disconnect', () => {
        logger.info(`Utilisateur déconnecté: ${socket.userId}`);
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);
          this.updateUserStatus(socket.userId, 'offline');
        }
      });

      socket.on('error', (error) => {
        logger.error('Erreur Socket.IO:', error);
      });
    });
  }

  private async joinUserRooms(socket: AuthenticatedSocket) {
    if (!socket.userId) return;

    socket.join(`user_${socket.userId}`);

    try {
      const conversations = await Conversation.find({
        'participants.userId': socket.userId,
        isActive: true
      });

      conversations.forEach(conversation => {
        socket.join(`conversation_${conversation._id}`);
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération des conversations:', error);
    }
  }

  private async handleSendMessage(socket: AuthenticatedSocket, data: any) {
    try {
      const { conversationId, content, messageType = 'text', replyTo } = data;

      if (!socket.userId || !conversationId || !content) {
        socket.emit('error', { message: 'Données manquantes' });
        return;
      }

      const conversation = await Conversation.findOne({
        _id: conversationId,
        'participants.userId': socket.userId
      });

      if (!conversation) {
        socket.emit('error', { message: 'Conversation non trouvée' });
        return;
      }

      const message = new Message({
        conversationId,
        senderId: socket.userId,
        senderModel: 'User',
        content,
        messageType,
        replyTo
      });

      await message.save();
      await message.populate('senderId', 'name email avatar');

      conversation.lastMessage = content;
      conversation.lastMessageAt = new Date();
      
      // Incrémenter le compteur de messages non lus pour les autres participants
      conversation.participants.forEach(participant => {
        if (participant.userId.toString() !== socket.userId) {
          const key = participant.userId.toString();
          const unreadCountObj = conversation.unreadCount as Record<string, number>;
          const currentCount = unreadCountObj[key] ?? 0;
          unreadCountObj[key] = currentCount + 1;
        }
      });
      await conversation.save();

      this.io.to(`conversation_${conversationId}`).emit('new_message', {
        message,
        conversation: {
          id: conversation._id,
          lastMessage: conversation.lastMessage,
          lastMessageAt: conversation.lastMessageAt,
          unreadCount: conversation.unreadCount
        }
      });

      await this.sendMessageNotifications(conversation, message, socket.userId!);

      await this.logUserActivity(
        socket.userId!,
        'send_message',
        'message',
        String((message._id ?? ''))
      );
    } catch (error) {
      logger.error('Erreur lors de l\'envoi du message:', error);
      socket.emit('error', { message: 'Erreur lors de l\'envoi du message' });
    }
  }

  private async handleMarkMessageRead(socket: AuthenticatedSocket, data: any) {
    try {
      const { messageId, conversationId } = data;

      if (!socket.userId || !messageId || !conversationId) {
        return;
      }

      await Message.findByIdAndUpdate(messageId, {
        isRead: true,
        readAt: new Date()
      });

      // Fetch the conversation before updating unreadCount
      const conversation = await Conversation.findById(conversationId);
      if (conversation && conversation.unreadCount && typeof conversation.unreadCount.set === 'function') {
        const unreadCountObj = conversation.unreadCount as Record<string, number>;
        unreadCountObj[socket.userId] = 0;
        await conversation.save();
      }

      this.io.to(`conversation_${conversationId}`).emit('message_read', {
        messageId,
        readBy: socket.userId,
        readAt: new Date()
      });

    } catch (error) {
      logger.error('Erreur lors du marquage du message comme lu:', error);
    }
  }

  private handleTyping(socket: AuthenticatedSocket, data: any, isTyping: boolean) {
    const { conversationId } = data;
    if (!socket.userId || !conversationId) return;

    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      userId: socket.userId,
      conversationId,
      isTyping
    });
  }

  private async handleMarkNotificationRead(socket: AuthenticatedSocket, notificationId: string) {
    try {
      if (!socket.userId) return;

      await Notification.findOneAndUpdate(
        { _id: notificationId, userId: socket.userId },
        { isRead: true, readAt: new Date() }
      );

      socket.emit('notification_read', { notificationId });

    } catch (error) {
      logger.error('Erreur lors du marquage de la notification comme lue:', error);
    }
  }

  private async updateUserStatus(userId: string, status: 'online' | 'offline') {
    try {
      await Conversation.updateMany(
        { 'participants.userId': userId },
        { 
          $set: { 
            'participants.$.lastSeenAt': new Date() 
          } 
        }
      );

      this.io.emit('user_status_changed', {
        userId,
        status,
        lastSeen: new Date()
      });

    } catch (error) {
      logger.error('Erreur lors de la mise à jour du statut utilisateur:', error);
    }
  }

  private async sendMessageNotifications(conversation: any, message: any, senderId: string) {
    try {
      const offlineParticipants = conversation.participants.filter((p: any) => 
        p.userId.toString() !== senderId && !this.connectedUsers.has(p.userId.toString())
      );

      for (const participant of offlineParticipants) {
        const notification = new Notification({
          userId: participant.userId,
          title: 'Nouveau message',
          message: `${message.senderId.name}: ${message.content}`,
          type: 'chat',
          category: 'order',
          actionUrl: `/chat/${conversation._id}`,
          channels: {
            push: true,
            inApp: true
          }
        });

        await notification.save();
        await this.sendPushNotification(participant.userId, notification);
      }
    } catch (error) {
      logger.error('Erreur lors de l\'envoi des notifications de message:', error);
    }
  }

  private async logUserActivity(userId: string, action: string, resource: string, resourceId?: string) {
    try {
      const activity = new UserActivity({
        userId,
        action,
        resource,
        resourceId
      });
      await activity.save();
    } catch (error) {
      logger.error('Erreur lors de l\'enregistrement de l\'activité:', error);
    }
  }

  public async sendNotificationToUser(userId: string, notification: any) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('new_notification', notification);
    }
  }

  public async sendNotificationToRoom(room: string, notification: any) {
    this.io.to(room).emit('new_notification', notification);
  }

  public async broadcastNotification(notification: any) {
    this.io.emit('broadcast_notification', notification);
  }

  private async sendPushNotification(userId: string, notification: any) {
    logger.info(`Notification push à envoyer à l'utilisateur ${userId}: ${notification.title}`);
  }

  public getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}

export default SocketService;