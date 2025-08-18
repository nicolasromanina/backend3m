import mongoose, { Schema, Types } from 'mongoose';
import { IEmployee, IShift, ITraining, ITicket, IPerformanceReview } from '../interfaces/team.interface';

// Employee Model
const employeeSchema = new Schema<IEmployee>({
  employeeId: {
    type: String,
    unique: true,
    required: [true, 'Employee ID is required']
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  department: {
    type: String,
    enum: ['production', 'commercial', 'admin', 'design', 'logistics'],
    required: [true, 'Department is required']
  },
  position: {
    type: String,
    required: [true, 'Position is required'],
    trim: true
  },
  level: {
    type: String,
    enum: ['intern', 'junior', 'senior', 'lead', 'manager'],
    required: [true, 'Level is required']
  },
  skills: [{
    type: String,
    trim: true
  }],
  certifications: [{
    type: String,
    trim: true
  }],
  hireDate: {
    type: Date,
    required: [true, 'Hire date is required']
  },
  salary: {
    type: Number,
    min: [0, 'Salary cannot be negative']
  },
  workSchedule: {
    type: {
      type: String,
      enum: ['full-time', 'part-time', 'contract'],
      default: 'full-time'
    },
    hoursPerWeek: {
      type: Number,
      default: 35,
      min: [1, 'Hours per week must be at least 1']
    },
    workDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }]
  },
  manager: {
    type: Schema.Types.ObjectId,
    ref: 'Employee'
  },
  directReports: [{
    type: Schema.Types.ObjectId,
    ref: 'Employee'
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Shift Model
const shiftSchema = new Schema<IShift>({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee ID is required']
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
  },
  endTime: {
    type: String,
    required: [true, 'End time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
  },
  type: {
    type: String,
    enum: ['work', 'break', 'lunch', 'vacation', 'sick', 'training'],
    default: 'work'
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  actualStartTime: String,
  actualEndTime: String,
  hoursWorked: Number,
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Training Model
const trainingSchema = new Schema<ITraining>({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  type: {
    type: String,
    enum: ['technical', 'safety', 'management', 'software', 'compliance'],
    required: [true, 'Type is required']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  duration: {
    type: Number,
    required: [true, 'Duration is required'],
    min: [0.5, 'Duration must be at least 0.5 hour']
  },
  format: {
    type: String,
    enum: ['online', 'in-person', 'hybrid'],
    default: 'in-person'
  },
  instructor: String,
  maxParticipants: {
    type: Number,
    min: [1, 'Max participants must be at least 1']
  },
  requiredSkills: [String],
  prerequisites: [String],
  materials: [String],
  scheduledDate: Date,
  location: String,
  enrolledEmployees: [{
    type: Schema.Types.ObjectId,
    ref: 'Employee'
  }],
  completedBy: [{
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee'
    },
    completedAt: Date,
    score: {
      type: Number,
      min: 0,
      max: 100
    },
    certificate: String
  }],
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'in-progress', 'completed', 'cancelled'],
    default: 'draft'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  deadline: Date
}, {
  timestamps: true
});

// Ticket Model
const ticketSchema = new Schema<ITicket>({
  ticketNumber: {
    type: String,
    unique: true,
    required: [true, 'Ticket number is required']
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  category: {
    type: String,
    enum: ['technical', 'hr', 'equipment', 'process', 'safety', 'other'],
    required: [true, 'Category is required']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'assigned', 'in-progress', 'resolved', 'closed', 'cancelled'],
    default: 'open'
  },
  reportedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Reporter is required']
  },
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'Employee'
  },
  watchers: [{
    type: Schema.Types.ObjectId,
    ref: 'Employee'
  }],
  tags: [String],
  attachments: [String],
  estimatedResolutionTime: Number,
  actualResolutionTime: Number,
  assignedAt: Date,
  resolvedAt: Date,
  closedAt: Date,
  dueDate: Date,
  comments: [{
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee'
    },
    content: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    isInternal: {
      type: Boolean,
      default: false
    }
  }],
  statusHistory: [{
    status: String,
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Employee'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    reason: String
  }]
}, {
  timestamps: true
});

// Performance Review Model
const performanceReviewSchema = new Schema<IPerformanceReview>({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee ID is required']
  },
  reviewerId: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Reviewer ID is required']
  },
  period: {
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required']
    },
    type: {
      type: String,
      enum: ['quarterly', 'semi-annual', 'annual'],
      required: [true, 'Period type is required']
    }
  },
  metrics: {
    productivity: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    quality: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    teamwork: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    communication: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    initiative: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    punctuality: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    problemSolving: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    leadership: {
      type: Number,
      min: 0,
      max: 100
    }
  },
  goals: [{
    id: String,
    title: String,
    description: String,
    category: {
      type: String,
      enum: ['performance', 'skill', 'project', 'behavior']
    },
    targetDate: Date,
    status: {
      type: String,
      enum: ['not-started', 'in-progress', 'completed', 'overdue'],
      default: 'not-started'
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    notes: String
  }],
  strengths: [String],
  areasForImprovement: [String],
  feedback: {
    type: String,
    required: [true, 'Feedback is required']
  },
  employeeFeedback: String,
  trainingRecommendations: [String],
  careerDevelopmentPlan: String,
  status: {
    type: String,
    enum: ['draft', 'pending-employee-review', 'completed', 'approved'],
    default: 'draft'
  },
  overallRating: {
    type: Number,
    min: 0,
    max: 5,
    required: true
  },
  submittedAt: Date,
  approvedAt: Date
}, {
  timestamps: true
});

// Indexes
employeeSchema.index({ employeeId: 1 });
employeeSchema.index({ userId: 1 });
employeeSchema.index({ department: 1 });
employeeSchema.index({ isActive: 1 });

shiftSchema.index({ employeeId: 1, date: 1 });
shiftSchema.index({ date: 1 });
shiftSchema.index({ status: 1 });

trainingSchema.index({ type: 1 });
trainingSchema.index({ status: 1 });
trainingSchema.index({ scheduledDate: 1 });

ticketSchema.index({ ticketNumber: 1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ priority: 1 });
ticketSchema.index({ assignedTo: 1 });

performanceReviewSchema.index({ employeeId: 1 });
performanceReviewSchema.index({ 'period.startDate': 1, 'period.endDate': 1 });

// Middleware for generating ticket number
ticketSchema.pre('save', async function(next) {
  if (this.isNew && !this.ticketNumber) {
    const count = await mongoose.model('Ticket').countDocuments();
    this.ticketNumber = `TK${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Middleware for generating employee ID
employeeSchema.pre('save', async function(next) {
  if (this.isNew && !this.employeeId) {
    const count = await mongoose.model('Employee').countDocuments();
    this.employeeId = `EMP${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

export const Employee = mongoose.model<IEmployee>('Employee', employeeSchema);
export const Shift = mongoose.model<IShift>('Shift', shiftSchema);
export const Training = mongoose.model<ITraining>('Training', trainingSchema);
export const Ticket = mongoose.model<ITicket>('Ticket', ticketSchema);
export const PerformanceReview = mongoose.model<IPerformanceReview>('PerformanceReview', performanceReviewSchema);