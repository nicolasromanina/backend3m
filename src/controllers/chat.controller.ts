import { Request, Response } from 'express';
import { Message, Conversation } from '../models/chat.model';
import ApiError from '../utils/apiError';
import ApiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middlewares/error.middleware';
import notificationService from '../services/notification.service';
import mongoose from 'mongoose';

export const getConversations = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const conversations = await Conversation.find({
    'participants.userId': userId,
    isActive: true
  })
    .populate('participants.userId', 'name email avatar role')
    .sort({ lastMessageAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);

  const total = await Conversation.countDocuments({
    'participants.userId': userId,
    isActive: true
  });

  res.json(
    ApiResponse.paginated(
      'Conversations retrieved',
      conversations,
      page,
      Math.ceil(total / limit),
      total,
      limit
    )
  );
});

export const getConversationById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user.id;

  const conversation = await Conversation.findOne({
    _id: id,
    'participants.userId': userId
  }).populate('participants.userId', 'name email avatar role');

  if (!conversation) {
    throw ApiError.notFound('Conversation not found');
  }

  res.json(
    ApiResponse.success('Conversation retrieved', { conversation })
  );
});

export const createConversation = asyncHandler(async (req: Request, res: Response) => {
  const { participantIds, type = 'direct', title, orderId } = req.body;
  const userId = req.user.id;

  // Add current user to participants
  const allParticipantIds = [userId, ...participantIds];

  // Check if direct conversation already exists
  if (type === 'direct' && allParticipantIds.length === 2) {
    const existingConversation = await Conversation.findOne({
      type: 'direct',
      'participants.userId': { $all: allParticipantIds },
      'participants': { $size: 2 }
    });

    if (existingConversation) {
      return res.json(
        ApiResponse.success('Existing conversation', { conversation: existingConversation })
      );
    }
  }

  // Get participants info
  const User = mongoose.model('User');
  const users = await User.find({ _id: { $in: allParticipantIds } });

  const participants = users.map((user: any) => ({
    userId: user._id,
    userModel: 'User',
    role: user.role,
    joinedAt: new Date()
  }));

  // Initialize unreadCount as a plain object
  const unreadCount: Record<string, number> = {};
  participants.forEach(p => {
    unreadCount[p.userId.toString()] = 0;
  });

  const conversation = await Conversation.create({
    participants,
    type,
    title,
    orderId,
    unreadCount
  });

  await conversation.populate('participants.userId', 'name email avatar role');

  return res.status(201).json(
    ApiResponse.created('Conversation created', { conversation })
  );
});

export const getMessages = asyncHandler(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const userId = req.user.id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  // Verify user is part of conversation
  const conversation = await Conversation.findOne({
    _id: conversationId,
    'participants.userId': userId
  });

  if (!conversation) {
    throw ApiError.notFound('Conversation not found');
  }

  const messages = await Message.find({ conversationId })
    .populate('senderId', 'name email avatar')
    .populate('replyTo')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);

  const total = await Message.countDocuments({ conversationId });

  res.json(
    ApiResponse.paginated(
      'Messages retrieved',
      messages.reverse(), // Reverse for chronological order
      page,
      Math.ceil(total / limit),
      total,
      limit
    )
  );
});

export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { content, messageType = 'text', replyTo } = req.body;
  const userId = req.user.id;

  const conversation = await Conversation.findOne({
    _id: conversationId,
    'participants.userId': userId
  });

  if (!conversation) {
    throw ApiError.notFound('Conversation not found');
  }

  const message = await Message.create({
    conversationId,
    senderId: userId,
    senderModel: 'User',
    content,
    messageType,
    replyTo
  });

  await message.populate('senderId', 'name email avatar');

  conversation.lastMessage = content;
  conversation.lastMessageAt = new Date();

  // Increment unread count for other participants
  const unreadCountObj = conversation.unreadCount as Record<string, number>;
  conversation.participants.forEach(participant => {
    if (participant.userId.toString() !== userId) {
      const key = participant.userId.toString();
      const currentCount = unreadCountObj[key] || 0;
      unreadCountObj[key] = currentCount + 1;
    }
  });
  conversation.markModified('unreadCount');
  await conversation.save();

  const otherParticipants = conversation.participants.filter(p => p.userId.toString() !== userId);
  for (const participant of otherParticipants) {
    await notificationService.notifyNewMessage(
      participant.userId.toString(),
      userId,
      req.user.name,
      content,
      conversationId
    );
  }

  res.status(201).json(
    ApiResponse.created('Message sent', { message })
  );
});

export const markMessageAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const userId = req.user.id;

  const message = await Message.findById(messageId);
  if (!message) {
    throw ApiError.notFound('Message not found');
  }

  const conversation = await Conversation.findOne({
    _id: message.conversationId,
    'participants.userId': userId
  });

  if (!conversation) {
    throw ApiError.forbidden('Unauthorized access');
  }

  message.isRead = true;
  message.readAt = new Date();
  await message.save();

  // Reset unread count for this user
  const unreadCountObj = conversation.unreadCount as Record<string, number>;
  unreadCountObj[userId.toString()] = 0;
  conversation.markModified('unreadCount');
  await conversation.save();

  res.json(
    ApiResponse.success('Message marked as read')
  );
});

export const markConversationAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const userId = req.user.id;

  const conversation = await Conversation.findOne({
    _id: conversationId,
    'participants.userId': userId
  });

  if (!conversation) {
    throw ApiError.notFound('Conversation not found');
  }

  await Message.updateMany(
    {
      conversationId,
      senderId: { $ne: userId },
      isRead: false
    },
    {
      isRead: true,
      readAt: new Date()
    }
  );

  // Reset counter
  const unreadCountObj = conversation.unreadCount as Record<string, number>;
  unreadCountObj[userId.toString()] = 0;
  conversation.markModified('unreadCount');
  await conversation.save();

  res.json(
    ApiResponse.success('Conversation marked as read')
  );
});

export const deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const userId = req.user.id;

  const message = await Message.findById(messageId);
  if (!message) {
    throw ApiError.notFound('Message not found');
  }

  if (message.senderId.toString() !== userId && req.user.role !== 'admin') {
    throw ApiError.forbidden('You can only delete your own messages');
  }

  await Message.findByIdAndDelete(messageId);

  res.json(
    ApiResponse.success('Message deleted')
  );
});

export const editMessage = asyncHandler(async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  const message = await Message.findById(messageId);
  if (!message) {
    throw ApiError.notFound('Message not found');
  }

  if (message.senderId.toString() !== userId) {
    throw ApiError.forbidden('You can only edit your own messages');
  }

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  if (message.createdAt < fifteenMinutesAgo) {
    throw ApiError.badRequest('Cannot edit messages older than 15 minutes');
  }

  message.content = content;
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  res.json(
    ApiResponse.success('Message edited', { message })
  );
});

export const addReaction = asyncHandler(async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const { emoji } = req.body;
  const userId = req.user.id;

  const message = await Message.findById(messageId);
  if (!message) {
    throw ApiError.notFound('Message not found');
  }

  const existingReaction = message.reactions.find(
    r => r.userId.toString() === userId && r.emoji === emoji
  );

  if (existingReaction) {
    message.reactions = message.reactions.filter(
      r => !(r.userId.toString() === userId && r.emoji === emoji)
    );
  } else {
    message.reactions.push({
      userId: userId as any,
      emoji,
      createdAt: new Date()
    });
  }

  await message.save();

  res.json(
    ApiResponse.success('Reaction updated', { message })
  );
});

export const searchMessages = asyncHandler(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { query, page = 1, limit = 20 } = req.query;
  const userId = req.user.id;

  const conversation = await Conversation.findOne({
    _id: conversationId,
    'participants.userId': userId
  });

  if (!conversation) {
    throw ApiError.notFound('Conversation not found');
  }

  const messages = await Message.find({
    conversationId,
    content: { $regex: query, $options: 'i' }
  })
    .populate('senderId', 'name email avatar')
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip((Number(page) - 1) * Number(limit));

  const total = await Message.countDocuments({
    conversationId,
    content: { $regex: query, $options: 'i' }
  });

  res.json(
    ApiResponse.paginated(
      'Messages found',
      messages,
      Number(page),
      Math.ceil(total / Number(limit)),
      total,
      Number(limit)
    )
  );
});