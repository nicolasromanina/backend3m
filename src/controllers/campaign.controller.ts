import { Request, Response } from 'express';
import { Campaign, EmailTemplate } from '../models/campaign.model';
import { campaignService } from '../services/campaign.service';
import ApiError from '../utils/apiError';
import ApiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middlewares/error.middleware';

export const createCampaign = asyncHandler(async (req: Request, res: Response) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Accès réservé aux administrateurs');
  }

  const campaignData = {
    ...req.body,
    createdBy: req.user.id
  };

  const campaign = await campaignService.createCampaign(campaignData);

  res.status(201).json(
    ApiResponse.created('Campagne créée avec succès', { campaign })
  );
});

export const getCampaigns = asyncHandler(async (req: Request, res: Response) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Accès réservé aux administrateurs');
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const type = req.query.type as string;
  const status = req.query.status as string;

  const query: any = {};
  if (type) query.type = type;
  if (status) query.status = status;

  const [campaigns, total] = await Promise.all([
    Campaign.find(query)
      .populate('targetSegment', 'name')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit),
    Campaign.countDocuments(query)
  ]);

  res.json(
    ApiResponse.paginated(
      'Campagnes récupérées',
      campaigns,
      page,
      Math.ceil(total / limit),
      total,
      limit
    )
  );
});

export const getCampaignById = asyncHandler(async (req: Request, res: Response) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Accès réservé aux administrateurs');
  }

  const { id } = req.params;

  const campaign = await Campaign.findById(id)
    .populate('targetSegment')
    .populate('createdBy', 'name email');

  if (!campaign) {
    throw ApiError.notFound('Campagne non trouvée');
  }

  res.json(
    ApiResponse.success('Campagne récupérée', { campaign })
  );
});

export const updateCampaign = asyncHandler(async (req: Request, res: Response) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Accès réservé aux administrateurs');
  }

  const { id } = req.params;
  const updateData = req.body;

  const campaign = await Campaign.findById(id);
  if (!campaign) {
    throw ApiError.notFound('Campagne non trouvée');
  }

  if (campaign.status === 'running') {
    throw ApiError.badRequest('Impossible de modifier une campagne en cours');
  }

  Object.assign(campaign, updateData);
  await campaign.save();

  res.json(
    ApiResponse.updated('Campagne mise à jour', { campaign })
  );
});

export const executeCampaign = asyncHandler(async (req: Request, res: Response) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Accès réservé aux administrateurs');
  }

  const { id } = req.params;

  const result = await campaignService.executeCampaign(id);

  res.json(
    ApiResponse.success('Campagne exécutée avec succès', result)
  );
});

export const getCampaignStats = asyncHandler(async (req: Request, res: Response) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Accès réservé aux administrateurs');
  }

  const { id } = req.params;

  const stats = await campaignService.getCampaignStats(id);

  res.json(
    ApiResponse.success('Statistiques de campagne', stats)
  );
});

export const createEmailTemplate = asyncHandler(async (req: Request, res: Response) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Accès réservé aux administrateurs');
  }

  const templateData = {
    ...req.body,
    createdBy: req.user.id
  };

  const template = await campaignService.createEmailTemplate(templateData);

  res.status(201).json(
    ApiResponse.created('Template email créé', { template })
  );
});

export const getEmailTemplates = asyncHandler(async (req: Request, res: Response) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Accès réservé aux administrateurs');
  }

  const category = req.query.category as string;
  const templates = await campaignService.getEmailTemplates(category);

  res.json(
    ApiResponse.success('Templates email récupérés', { templates })
  );
});

export const getEmailTemplateById = asyncHandler(async (req: Request, res: Response) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Accès réservé aux administrateurs');
  }

  const { id } = req.params;

  const template = await EmailTemplate.findById(id);
  if (!template) {
    throw ApiError.notFound('Template non trouvé');
  }

  res.json(
    ApiResponse.success('Template récupéré', { template })
  );
});

export const updateEmailTemplate = asyncHandler(async (req: Request, res: Response) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Accès réservé aux administrateurs');
  }

  const { id } = req.params;
  const updateData = req.body;

  const template = await EmailTemplate.findById(id);
  if (!template) {
    throw ApiError.notFound('Template non trouvé');
  }

  Object.assign(template, updateData);
  await template.save();

  res.json(
    ApiResponse.updated('Template mis à jour', { template })
  );
});

export const deleteEmailTemplate = asyncHandler(async (req: Request, res: Response) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Accès réservé aux administrateurs');
  }

  const { id } = req.params;

  const template = await EmailTemplate.findById(id);
  if (!template) {
    throw ApiError.notFound('Template non trouvé');
  }

  template.isActive = false;
  await template.save();

  res.json(
    ApiResponse.deleted('Template supprimé')
  );
});

export const previewEmailTemplate = asyncHandler(async (req: Request, res: Response) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Accès réservé aux administrateurs');
  }

  const { id } = req.params;
  const { variables } = req.body;

  const template = await EmailTemplate.findById(id);
  if (!template) {
    throw ApiError.notFound('Template non trouvé');
  }

  let htmlContent = template.htmlContent;
  let subject = template.subject;

  // Remplacer les variables
  const defaultVariables = {
    name: 'John Doe',
    email: 'john.doe@example.com',
    company: 'Example Corp',
    ...variables
  };

  Object.keys(defaultVariables).forEach(key => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    htmlContent = htmlContent.replace(regex, defaultVariables[key]);
    subject = subject.replace(regex, defaultVariables[key]);
  });

  res.json(
    ApiResponse.success('Prévisualisation du template', {
      subject,
      htmlContent,
      variables: defaultVariables
    })
  );
});