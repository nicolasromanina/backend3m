import mongoose, { Schema } from 'mongoose';

export interface IMessage extends mongoose.Document {
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderModel: 'User';
  receiverId?: mongoose.Types.ObjectId;
  receiverModel?: 'User';
  content: string;
  messageType: 'text' | 'file' | 'image' | 'system';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  isRead: boolean;
  readAt?: Date;
  isEdited: boolean;
  editedAt?: Date;
  replyTo?: string;
  reactions: Array<{
    userId: string;
    emoji: string;
    createdAt: Date;
  }>;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversation extends mongoose.Document {
  participants: Array<{
    userId: mongoose.Types.ObjectId;
    userModel: 'User';
    role: 'client' | 'admin' | 'employee';
    joinedAt: Date;
    lastSeenAt?: Date;
  }>;
  type: 'direct' | 'group' | 'support';
  title?: string;
  description?: string;
  orderId?: string;
  isActive: boolean;
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCount: Record<string, number>;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>({
  conversationId: {
  type: Schema.Types.ObjectId,
  required: true,
  index: true,
  ref: 'Conversation'
},
  senderId: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: 'senderModel'
  },
  senderModel: {
    type: String,
    required: true,
    enum: ['User']
  },
  receiverId: {
    type: Schema.Types.ObjectId,
    refPath: 'receiverModel'
  },
  receiverModel: {
    type: String,
    enum: ['User']
  },
  content: {
    type: String,
    required: true,
    maxlength: [2000, 'Le message ne peut pas dépasser 2000 caractères']
  },
  messageType: {
    type: String,
    enum: ['text', 'file', 'image', 'system'],
    default: 'text'
  },
  fileUrl: String,
  fileName: String,
  fileSize: Number,
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  replyTo: {
    type: Schema.Types.ObjectId,
    ref: 'Message'
  },
  reactions: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: Schema.Types.Mixed
}, {
  timestamps: true
});

const conversationSchema = new Schema<IConversation>({
  participants: [{
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'participants.userModel'
    },
    userModel: {
      type: String,
      required: true,
      enum: ['User']
    },
    role: {
      type: String,
      enum: ['client', 'admin', 'employee'],
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastSeenAt: Date
  }],
  type: {
    type: String,
    enum: ['direct', 'group', 'support'],
    default: 'direct'
  },
  title: String,
  description: String,
  orderId: {
    type: Schema.Types.ObjectId,
    ref: 'Order'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastMessage: String,
  lastMessageAt: Date,
  unreadCount: {
    type: Map,
    of: Number,
    default: new Map()
  },
  metadata: Schema.Types.Mixed
}, {
  timestamps: true
});

// Index pour améliorer les performances
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ isRead: 1 });

conversationSchema.index({ 'participants.userId': 1 });
conversationSchema.index({ type: 1 });
conversationSchema.index({ orderId: 1 });
conversationSchema.index({ lastMessageAt: -1 });

export const Message = mongoose.model<IMessage>('Message', messageSchema);
export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);