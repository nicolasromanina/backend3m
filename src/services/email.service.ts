import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import config from '../config/env';
import logger from '../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  template?: string;
  html?: string;
  text?: string;
  data?: Record<string, any>;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS
      }
    });
  }

  private async loadTemplate(templateName: string, data: Record<string, any> = {}): Promise<string> {
    try {
      const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.html`);
      let template = fs.readFileSync(templatePath, 'utf-8');

      logger.info(`Chargement du template ${templateName} avant remplacement:\n${template}`);

      // Remplacement des placeholders avec tolérance aux espaces dans {{ key }}
      Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        template = template.replace(regex, String(data[key]));
      });

      logger.info(`Template ${templateName} après remplacement:\n${template}`);

      return template;
    } catch (error) {
      logger.error(`Erreur lors du chargement du template ${templateName}:`, error);
      return this.getDefaultTemplate(data);
    }
  }

  private getDefaultTemplate(data: Record<string, any>): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>PrintPro</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3B82F6; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; color: #666; }
          .button { display: inline-block; padding: 12px 24px; background: #3B82F6; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>PrintPro</h1>
          </div>
          <div class="content">
            <h2>Bonjour ${data.name || 'Cher client'},</h2>
            <p>${data.message || 'Merci de votre confiance.'}</p>
            ${data.actionUrl ? `<p><a href="${data.actionUrl}" class="button">${data.actionText || 'Cliquez ici'}</a></p>` : ''}
          </div>
          <div class="footer">
            <p>© 2024 PrintPro. Tous droits réservés.</p>
            <p>Si vous avez des questions, contactez-nous à support@printpro.fr</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      let html = options.html;

      if (options.template && options.data) {
        html = await this.loadTemplate(options.template, options.data);
      }

      const mailOptions = {
        from: `${config.FROM_NAME} <${config.FROM_EMAIL}>`,
        to: options.to,
        subject: options.subject,
        html: html || options.text,
        text: options.text
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Email envoyé avec succès à ${options.to}:`, result.messageId);
    } catch (error) {
      logger.error(`Erreur lors de l'envoi de l'email à ${options.to}:`, error);
      throw error;
    }
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Bienvenue chez PrintPro !',
      template: 'welcome',
      data: {
        name,
        loginUrl: `${config.CORS_ORIGIN}/login`
      }
    });
  }

  async sendEmailVerification(to: string, name: string, token: string): Promise<void> {
    const verificationUrl = `${config.CORS_ORIGIN}/verify-email?token=${token}`;
    logger.info(`URL de vérification générée: ${verificationUrl}`);

    await this.sendEmail({
      to,
      subject: 'Vérifiez votre adresse email - PrintPro',
      template: 'email-verification',
      data: {
        name,
        verificationUrl
      }
    });
  }

  async sendPasswordReset(to: string, name: string, token: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Réinitialisation de votre mot de passe - PrintPro',
      template: 'password-reset',
      data: {
        name,
        resetUrl: `${config.CORS_ORIGIN}/reset-password?token=${token}`
      }
    });
  }

  async sendOrderConfirmation(to: string, name: string, orderNumber: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: `Confirmation de commande ${orderNumber} - PrintPro`,
      template: 'order-confirmation',
      data: {
        name,
        orderNumber,
        orderUrl: `${config.CORS_ORIGIN}/orders/${orderNumber}`
      }
    });
  }

  async sendOrderStatusUpdate(to: string, name: string, orderNumber: string, status: string): Promise<void> {
    const statusLabels: Record<string, string> = {
      confirmed: 'confirmée',
      in_production: 'en production',
      ready: 'prête',
      shipped: 'expédiée',
      delivered: 'livrée'
    };

    await this.sendEmail({
      to,
      subject: `Mise à jour de votre commande ${orderNumber} - PrintPro`,
      template: 'order-status-update',
      data: {
        name,
        orderNumber,
        status: statusLabels[status] || status,
        orderUrl: `${config.CORS_ORIGIN}/orders/${orderNumber}`
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('Connexion SMTP vérifiée avec succès');
      return true;
    } catch (error) {
      logger.error('Erreur de connexion SMTP:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
export const sendEmail = (options: EmailOptions) => emailService.sendEmail(options);