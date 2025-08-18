import { Request, Response } from 'express';
import User from '../models/user.model';
import ApiError from '../utils/apiError';
import ApiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middlewares/error.middleware';

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const { name, phone, address, preferences } = req.body;
  const userId = req.user.id;

  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('Utilisateur non trouvé');
  }

  // Mettre à jour les champs autorisés
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (address) user.address = address;
  if (preferences) user.preferences = { ...user.preferences, ...preferences };

  await user.save();

  res.json(
    ApiResponse.updated('Profil mis à jour avec succès', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        preferences: user.preferences
      }
    })
  );
});

export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const file = req.file;

  if (!file) {
    throw ApiError.badRequest('Aucun fichier fourni');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('Utilisateur non trouvé');
  }

  // Mettre à jour l'avatar
  user.avatar = `/uploads/${file.filename}`;
  await user.save();

  res.json(
    ApiResponse.updated('Avatar mis à jour avec succès', {
      avatar: user.avatar
    })
  );
});

export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { password } = req.body;

  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw ApiError.notFound('Utilisateur non trouvé');
  }

  // Vérifier le mot de passe
  if (!(await user.comparePassword(password))) {
    throw ApiError.badRequest('Mot de passe incorrect');
  }

  // Désactiver le compte au lieu de le supprimer
  user.isActive = false;
  user.refreshTokens = [];
  await user.save();

  res.json(
    ApiResponse.success('Compte supprimé avec succès')
  );
});

// Admin only controllers
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string;
  const role = req.query.role as string;
  const isActive = req.query.isActive as string;

  // Construire la requête
  const query: any = {};
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (role) {
    query.role = role;
  }
  
  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  // Pagination
  const skip = (page - 1) * limit;
  
  const [users, total] = await Promise.all([
    User.find(query)
      .select('-password -refreshTokens')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json(
    ApiResponse.paginated(
      'Utilisateurs récupérés avec succès',
      users,
      page,
      totalPages,
      total,
      limit
    )
  );
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = await User.findById(id).select('-password -refreshTokens');
  if (!user) {
    throw ApiError.notFound('Utilisateur non trouvé');
  }

  res.json(
    ApiResponse.success('Utilisateur récupéré', { user })
  );
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, role, isActive, phone, address } = req.body;

  const user = await User.findById(id);
  if (!user) {
    throw ApiError.notFound('Utilisateur non trouvé');
  }

  // Vérifier si l'email est déjà utilisé
  if (email && email !== user.email) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw ApiError.conflict('Cet email est déjà utilisé');
    }
  }

  // Mettre à jour les champs
  if (name) user.name = name;
  if (email) user.email = email;
  if (role) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;
  if (phone) user.phone = phone;
  if (address) user.address = address;

  await user.save();

  res.json(
    ApiResponse.updated('Utilisateur mis à jour avec succès', { user })
  );
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    throw ApiError.notFound('Utilisateur non trouvé');
  }

  // Désactiver au lieu de supprimer
  user.isActive = false;
  await user.save();

  res.json(
    ApiResponse.deleted('Utilisateur supprimé avec succès')
  );
});

export const getUserStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await User.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
        verifiedUsers: { $sum: { $cond: ['$isEmailVerified', 1, 0] } }
      }
    }
  ]);

  const roleStats = await User.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$role', count: { $sum: 1 } } }
  ]);

  res.json(
    ApiResponse.success('Statistiques récupérées', {
      general: stats[0] || { totalUsers: 0, activeUsers: 0, verifiedUsers: 0 },
      byRole: roleStats
    })
  );
});