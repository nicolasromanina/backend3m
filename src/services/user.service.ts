import User from '../models/user.model';
import ApiError from '../utils/apiError';
import { IUser } from '../interfaces/auth.interface';
import { IUserListQuery, IUserListResponse } from '../interfaces/user.interface';

export class UserService {
  static async getUserById(id: string): Promise<IUser> {
    const user = await User.findById(id).select('-password -refreshTokens');
    if (!user) {
      throw ApiError.notFound('Utilisateur non trouvé');
    }
    return user;
  }

  static async updateUserProfile(
    userId: string,
    updateData: {
      name?: string;
      phone?: string;
      address?: string;
      preferences?: any;
    }
  ): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('Utilisateur non trouvé');
    }

    // Mettre à jour les champs autorisés
    if (updateData.name) user.name = updateData.name;
    if (updateData.phone) user.phone = updateData.phone;
    if (updateData.address) user.address = updateData.address;
    if (updateData.preferences) {
      user.preferences = { ...user.preferences, ...updateData.preferences };
    }

    await user.save();
    return user;
  }

  static async updateUserAvatar(userId: string, avatarPath: string): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('Utilisateur non trouvé');
    }

    user.avatar = avatarPath;
    await user.save();
    return user;
  }

  static async deactivateUser(userId: string, password: string): Promise<void> {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw ApiError.notFound('Utilisateur non trouvé');
    }

    // Vérifier le mot de passe
    if (!(await user.comparePassword(password))) {
      throw ApiError.badRequest('Mot de passe incorrect');
    }

    // Désactiver le compte
    user.isActive = false;
    user.refreshTokens = [];
    await user.save();
  }

  static async getAllUsers(query: IUserListQuery): Promise<IUserListResponse> {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = query;

    // Construire la requête de filtrage
    const filter: any = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) {
      filter.role = role;
    }
    
    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    // Construire le tri
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Pagination
    const skip = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -refreshTokens')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  static async updateUserByAdmin(
    userId: string,
    updateData: {
      name?: string;
      email?: string;
      role?: string;
      isActive?: boolean;
      phone?: string;
      address?: string;
    }
  ): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('Utilisateur non trouvé');
    }

    // Vérifier si l'email est déjà utilisé
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await User.findOne({ email: updateData.email });
      if (existingUser) {
        throw ApiError.conflict('Cet email est déjà utilisé');
      }
    }

    // Mettre à jour les champs
    Object.assign(user, updateData);
    await user.save();

    return user;
  }

  static async deleteUserByAdmin(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('Utilisateur non trouvé');
    }

    // Désactiver au lieu de supprimer pour préserver l'intégrité des données
    user.isActive = false;
    await user.save();
  }

  static async getUserStats(): Promise<any> {
    const [generalStats, roleStats, monthlyStats] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
            verifiedUsers: { $sum: { $cond: ['$isEmailVerified', 1, 0] } }
          }
        }
      ]),
      User.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      User.aggregate([
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 }
      ])
    ]);

    return {
      general: generalStats[0] || { totalUsers: 0, activeUsers: 0, verifiedUsers: 0 },
      byRole: roleStats,
      monthly: monthlyStats
    };
  }

  static async searchUsers(searchTerm: string, limit: number = 10): Promise<IUser[]> {
    return User.find({
      $and: [
        { isActive: true },
        {
          $or: [
            { name: { $regex: searchTerm, $options: 'i' } },
            { email: { $regex: searchTerm, $options: 'i' } }
          ]
        }
      ]
    })
    .select('name email role avatar')
    .limit(limit);
  }
}