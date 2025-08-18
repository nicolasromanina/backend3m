import webpush from 'web-push';
import { Notification, PushSubscription } from '../models/notification.model';
import { UserPreferences } from '../models/analytics.model';
import { sendEmail } from './email.service';
import config from '../config/env';
import logger from '../utils/logger';

// Configuration Web Push
webpush.setVapidDetails(
  'mailto:support@printpro.fr',
  config.VAPID_PUBLIC_KEY || 'BP7TGiMSvWKKe_9StIFaKe2FwO6XthCbcmsshQwjHkJMT3weDmIJbPx_53vIplS5Dw_ktoBE4GtmC3WqtBuT4wA',
  config.VAPID_PRIVATE_KEY || 'KUkl_HV9AaPguXlf-9p4KCic7Bo3k4wh7pU0NvYqiJc'
);

interface NotificationData {
  userId: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'order' | 'chat' | 'system';
  category: 'order' | 'payment' | 'system' | 'promotion' | 'reminder' | 'security';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  actionUrl?: string;
  actionText?: string;
  data?: Record<string, any>;
  channels?: {
    push?: boolean;
    email?: boolean;
    sms?: boolean;
    inApp?: boolean;
  };
  scheduledFor?: Date;
}

class NotificationService {
  
  async createNotification(notificationData: NotificationData) {
    try {
      // Récupérer les préférences utilisateur
      const userPrefs = await UserPreferences.findOne({ userId: notificationData.userId });
      
      // Déterminer les canaux à utiliser selon les préférences
      const channels = this.determineChannels(notificationData, userPrefs);
      
      // Créer la notification
      const notification = new Notification({
        ...notificationData,
        channels,
        deliveryStatus: {
          inApp: 'delivered'
        }
      });

      await notification.save();

      // Envoyer selon les canaux activés
      if (channels.push) {
        await this.sendPushNotification(notification);
      }

      if (channels.email) {
        await this.sendEmailNotification(notification);
      }

      if (channels.sms) {
        await this.sendSMSNotification(notification);
      }

      return notification;
    } catch (error) {
      logger.error('Erreur lors de la création de la notification:', error);
      throw error;
    }
  }

  async sendPushNotification(notification: any) {
    try {
      const subscriptions = await PushSubscription.find({
        userId: notification.userId,
        isActive: true
      });

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.message,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: {
          url: notification.actionUrl || '/',
          notificationId: notification._id,
          ...notification.data
        },
        actions: notification.actionText ? [{
          action: 'open',
          title: notification.actionText
        }] : [],
        requireInteraction: notification.priority === 'urgent',
        silent: notification.priority === 'low'
      });

      const promises = subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: subscription.keys
          }, payload);

          return { success: true, subscription: subscription._id };
        } catch (error: any) {
          logger.error(`Erreur envoi push à ${subscription._id}:`, error);
          
          // Désactiver les souscriptions invalides
          if (error.statusCode === 410 || error.statusCode === 404) {
            await PushSubscription.findByIdAndUpdate(subscription._id, { isActive: false });
          }
          
          return { success: false, subscription: subscription._id, error: error.message };
        }
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;

      // Mettre à jour le statut de livraison
      await Notification.findByIdAndUpdate(notification._id, {
        'deliveryStatus.push': successCount > 0 ? 'delivered' : 'failed',
        sentAt: new Date()
      });

      logger.info(`Push notification envoyée: ${successCount}/${subscriptions.length} succès`);

    } catch (error) {
      logger.error('Erreur lors de l\'envoi de la notification push:', error);
      
      await Notification.findByIdAndUpdate(notification._id, {
        'deliveryStatus.push': 'failed'
      });
    }
  }

  async sendEmailNotification(notification: any) {
    try {
      // Récupérer les informations utilisateur
      const User = require('../models/user.model').default;
      const user = await User.findById(notification.userId);
      
      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }

      await sendEmail({
        to: user.email,
        subject: notification.title,
        template: 'notification',
        data: {
          name: user.name,
          title: notification.title,
          message: notification.message,
          actionUrl: notification.actionUrl,
          actionText: notification.actionText,
          type: notification.type
        }
      });

      await Notification.findByIdAndUpdate(notification._id, {
        'deliveryStatus.email': 'delivered'
      });

    } catch (error) {
      logger.error('Erreur lors de l\'envoi de l\'email de notification:', error);
      
      await Notification.findByIdAndUpdate(notification._id, {
        'deliveryStatus.email': 'failed'
      });
    }
  }

  async sendSMSNotification(notification: any) {
    try {
      // Implémentation SMS (Twilio, etc.)
      // Pour l'instant, on simule l'envoi
      logger.info(`SMS notification simulée pour ${notification.userId}: ${notification.title}`);

      await Notification.findByIdAndUpdate(notification._id, {
        'deliveryStatus.sms': 'delivered'
      });

    } catch (error) {
      logger.error('Erreur lors de l\'envoi du SMS:', error);
      
      await Notification.findByIdAndUpdate(notification._id, {
        'deliveryStatus.sms': 'failed'
      });
    }
  }

  private determineChannels(notificationData: NotificationData, userPrefs: any) {
    const defaultChannels = {
      push: true,
      email: false,
      sms: false,
      inApp: true
    };

    // Utiliser les canaux spécifiés ou les préférences utilisateur
    if (notificationData.channels) {
      return { ...defaultChannels, ...notificationData.channels };
    }

    if (!userPrefs) {
      return defaultChannels;
    }

    // Appliquer les préférences selon la catégorie
    const channels = { ...defaultChannels };

    switch (notificationData.category) {
      case 'order':
        channels.email = userPrefs.notifications.email.orderUpdates;
        channels.push = userPrefs.notifications.push.orderUpdates;
        channels.sms = userPrefs.notifications.sms.orderUpdates;
        break;
      case 'security':
        channels.email = userPrefs.notifications.email.security;
        channels.sms = userPrefs.notifications.sms.security;
        break;
      case 'promotion':
        channels.email = userPrefs.notifications.email.promotions;
        channels.push = userPrefs.notifications.push.promotions;
        break;
      default:
        break;
    }

    return channels;
  }

  async subscribeToPush(userId: string, subscription: any) {
    try {
      const existingSubscription = await PushSubscription.findOne({
        userId,
        endpoint: subscription.endpoint
      });

      if (existingSubscription) {
        existingSubscription.isActive = true;
        await existingSubscription.save();
        return existingSubscription;
      }

      const newSubscription = new PushSubscription({
        userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys
      });

      await newSubscription.save();
      return newSubscription;

    } catch (error) {
      logger.error('Erreur lors de la souscription push:', error);
      throw error;
    }
  }

  async unsubscribeFromPush(userId: string, endpoint: string) {
    try {
      await PushSubscription.findOneAndUpdate(
        { userId, endpoint },
        { isActive: false }
      );
    } catch (error) {
      logger.error('Erreur lors de la désinscription push:', error);
      throw error;
    }
  }

  async markAsRead(notificationId: string, userId: string) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { isRead: true, readAt: new Date() },
        { new: true }
      );

      return notification;
    } catch (error) {
      logger.error('Erreur lors du marquage de la notification comme lue:', error);
      throw error;
    }
  }

  async markAllAsRead(userId: string) {
    try {
      await Notification.updateMany(
        { userId, isRead: false },
        { isRead: true, readAt: new Date() }
      );
    } catch (error) {
      logger.error('Erreur lors du marquage de toutes les notifications comme lues:', error);
      throw error;
    }
  }

  async getNotifications(userId: string, options: any = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        type,
        category,
        isRead
      } = options;

      const query: any = { userId };
      
      if (type) query.type = type;
      if (category) query.category = category;
      if (isRead !== undefined) query.isRead = isRead;

      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Notification.countDocuments(query);

      return {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération des notifications:', error);
      throw error;
    }
  }

  async getUnreadCount(userId: string) {
    try {
      const count = await Notification.countDocuments({
        userId,
        isRead: false
      });

      return count;
    } catch (error) {
      logger.error('Erreur lors du comptage des notifications non lues:', error);
      throw error;
    }
  }

  // Notifications prédéfinies pour les événements courants
  async notifyOrderStatusChange(userId: string, orderId: string, status: string) {
    const statusMessages = {
      'confirmed': 'Votre commande a été confirmée',
      'in_production': 'Votre commande est en cours de production',
      'ready': 'Votre commande est prête',
      'shipped': 'Votre commande a été expédiée',
      'delivered': 'Votre commande a été livrée'
    };

    await this.createNotification({
      userId,
      title: 'Mise à jour de commande',
      message: statusMessages[status as keyof typeof statusMessages] || 'Statut de commande mis à jour',
      type: 'order',
      category: 'order',
      actionUrl: `/orders/${orderId}`,
      actionText: 'Voir la commande',
      data: { orderId, status }
    });
  }

  async notifyNewMessage(userId: string, senderId: string, senderName: string, message: string, conversationId: string) {
    await this.createNotification({
      userId,
      title: 'Nouveau message',
      message: `${senderName}: ${message}`,
      type: 'chat',
      category: 'order',
      actionUrl: `/chat/${conversationId}`,
      actionText: 'Répondre',
      data: { senderId, conversationId }
    });
  }

  async notifyPaymentReceived(userId: string, orderId: string, amount: number) {
    await this.createNotification({
      userId,
      title: 'Paiement reçu',
      message: `Votre paiement de ${amount}€ a été confirmé`,
      type: 'success',
      category: 'payment',
      actionUrl: `/orders/${orderId}`,
      data: { orderId, amount }
    });
  }
}

export default new NotificationService();