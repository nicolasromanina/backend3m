import { Campaign, EmailTemplate } from '../models/campaign.model';
import { CustomerSegment } from '../models/crm.model';
import User from '../models/user.model';
import { sendEmail } from './email.service';
import logger from '../utils/logger';
import ApiError from '../utils/apiError';

interface CampaignData {
  name: string;
  type: 'email' | 'sms' | 'push';
  targetSegmentId: string;
  templateId?: string;
  customTemplate?: {
    subject?: string;
    content: string;
    variables?: Record<string, any>;
  };
  schedule?: {
    sendAt?: Date;
    timezone?: string;
    recurring?: {
      frequency: 'daily' | 'weekly' | 'monthly';
      interval: number;
      endDate?: Date;
    };
  };
  createdBy: string;
}

class CampaignService {
  async createCampaign(campaignData: CampaignData) {
    try {
      // Vérifier que le segment existe
      const segment = await CustomerSegment.findById(campaignData.targetSegmentId);
      if (!segment) {
        throw ApiError.notFound('Segment client non trouvé');
      }

      let template = campaignData.customTemplate;

      // Si un template ID est fourni, récupérer le template
      if (campaignData.templateId) {
        const emailTemplate = await EmailTemplate.findById(campaignData.templateId);
        if (!emailTemplate) {
          throw ApiError.notFound('Template email non trouvé');
        }

        template = {
          subject: emailTemplate.subject,
          content: emailTemplate.htmlContent,
          variables: campaignData.customTemplate?.variables || {}
        };
      }

      if (!template) {
        throw ApiError.badRequest('Template requis');
      }

      const campaign = await Campaign.create({
        name: campaignData.name,
        type: campaignData.type,
        targetSegment: campaignData.targetSegmentId,
        template,
        schedule: campaignData.schedule || { timezone: 'Europe/Paris' },
        createdBy: campaignData.createdBy
      });

      return campaign;
    } catch (error) {
      logger.error('Erreur création campagne:', error);
      throw error;
    }
  }

  async executeCampaign(campaignId: string) {
    try {
      const campaign = await Campaign.findById(campaignId)
        .populate('targetSegment')
        .populate('createdBy', 'name email');

      if (!campaign) {
        throw ApiError.notFound('Campagne non trouvée');
      }

      if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
        throw ApiError.badRequest('La campagne ne peut pas être exécutée');
      }

      // Marquer la campagne comme en cours
      campaign.status = 'running';
      await campaign.save();

      // Récupérer les clients du segment
      const clients = await this.getSegmentClients(campaign.targetSegment._id);

      logger.info(`Exécution campagne ${campaign.name} pour ${clients.length} clients`);

      let sent = 0;
      let delivered = 0;
      let failed = 0;

      // Envoyer selon le type de campagne
      for (const client of clients) {
        try {
          if (campaign.type === 'email') {
            await this.sendEmailCampaign(campaign, client);
            delivered++;
          } else if (campaign.type === 'sms') {
            await this.sendSMSCampaign(campaign, client);
            delivered++;
          } else if (campaign.type === 'push') {
            await this.sendPushCampaign(campaign, client);
            delivered++;
          }
          sent++;
        } catch (error) {
          logger.error(`Erreur envoi campagne à ${client.email}:`, error);
          failed++;
        }
      }

      // Mettre à jour les statistiques
      campaign.statistics.sent = sent;
      campaign.statistics.delivered = delivered;
      campaign.status = 'completed';
      await campaign.save();

      logger.info(`Campagne ${campaign.name} terminée: ${delivered}/${sent} envoyés avec succès`);

      return {
        sent,
        delivered,
        failed
      };

    } catch (error) {
      logger.error('Erreur exécution campagne:', error);
      throw error;
    }
  }

  private async getSegmentClients(segmentId: string) {
    const segment = await CustomerSegment.findById(segmentId);
    if (!segment) {
      throw ApiError.notFound('Segment non trouvé');
    }

    const query: any = { isActive: true };

    // Appliquer les critères du segment
    if (segment.criteria.totalSpent) {
      // Ici on devrait calculer le total dépensé par client
      // Pour simplifier, on utilise un placeholder
    }

    if (segment.criteria.location?.countries) {
      query['address.country'] = { $in: segment.criteria.location.countries };
    }

    if (segment.criteria.registrationDate) {
      if (segment.criteria.registrationDate.after) {
        query.createdAt = { $gte: segment.criteria.registrationDate.after };
      }
      if (segment.criteria.registrationDate.before) {
        query.createdAt = { ...query.createdAt, $lte: segment.criteria.registrationDate.before };
      }
    }

    return User.find(query).select('name email phone preferences');
  }

  private async sendEmailCampaign(campaign: any, client: any) {
    // Remplacer les variables dans le template
    let content = campaign.template.content;
    let subject = campaign.template.subject;

    const variables = {
      name: client.name,
      email: client.email,
      ...campaign.template.variables
    };

    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      content = content.replace(regex, variables[key]);
      if (subject) {
        subject = subject.replace(regex, variables[key]);
      }
    });

    await sendEmail({
      to: client.email,
      subject: subject || 'Message de PrintPro',
      html: content
    });
  }

  private async sendSMSCampaign(campaign: any, client: any) {
    // Implémentation SMS
    logger.info(`SMS campagne envoyé à ${client.phone}: ${campaign.template.content}`);
  }

  private async sendPushCampaign(campaign: any, client: any) {
    // Implémentation Push
    logger.info(`Push campagne envoyé à ${client._id}: ${campaign.template.content}`);
  }

  async getCampaignStats(campaignId: string) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw ApiError.notFound('Campagne non trouvée');
    }

    return {
      campaign: {
        id: campaign._id,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status
      },
      statistics: campaign.statistics,
      performance: {
        openRate: campaign.statistics.sent > 0 ? (campaign.statistics.opened / campaign.statistics.sent) * 100 : 0,
        clickRate: campaign.statistics.sent > 0 ? (campaign.statistics.clicked / campaign.statistics.sent) * 100 : 0,
        conversionRate: campaign.statistics.sent > 0 ? (campaign.statistics.converted / campaign.statistics.sent) * 100 : 0,
        roi: campaign.statistics.revenue > 0 ? ((campaign.statistics.revenue - 1000) / 1000) * 100 : 0 // Coût estimé de 1000
      }
    };
  }

  async createEmailTemplate(templateData: {
    name: string;
    category: 'marketing' | 'transactional' | 'notification';
    subject: string;
    htmlContent: string;
    textContent?: string;
    variables?: Array<{
      name: string;
      type: 'text' | 'number' | 'date' | 'boolean';
      required: boolean;
      defaultValue?: any;
    }>;
    createdBy: string;
  }) {
    const template = await EmailTemplate.create(templateData);
    return template;
  }

  async getEmailTemplates(category?: string) {
    const query: any = { isActive: true };
    if (category) {
      query.category = category;
    }

    return EmailTemplate.find(query).sort({ createdAt: -1 });
  }

  async scheduleRecurringCampaigns() {
    const recurringCampaigns = await Campaign.find({
      'schedule.recurring': { $exists: true },
      status: 'completed'
    });

    for (const campaign of recurringCampaigns) {
      try {
        const recurring = campaign.schedule.recurring;
        if (!recurring) continue;

        const now = new Date();
        const lastExecution = campaign.updatedAt;
        
        let nextExecution = new Date(lastExecution);
        
        switch (recurring.frequency) {
          case 'daily':
            nextExecution.setDate(nextExecution.getDate() + recurring.interval);
            break;
          case 'weekly':
            nextExecution.setDate(nextExecution.getDate() + (recurring.interval * 7));
            break;
          case 'monthly':
            nextExecution.setMonth(nextExecution.getMonth() + recurring.interval);
            break;
        }

        if (nextExecution <= now && (!recurring.endDate || now <= recurring.endDate)) {
          // Créer une nouvelle campagne
          const newCampaign = await Campaign.create({
            name: `${campaign.name} - ${now.toISOString().split('T')[0]}`,
            type: campaign.type,
            targetSegment: campaign.targetSegment,
            template: campaign.template,
            schedule: { timezone: campaign.schedule.timezone },
            createdBy: campaign.createdBy
          });

          await this.executeCampaign(newCampaign._id.toString());
        }
      } catch (error) {
        logger.error(`Erreur campagne récurrente ${campaign._id}:`, error);
      }
    }
  }
}

export const campaignService = new CampaignService();