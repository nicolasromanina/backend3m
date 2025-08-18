import { Document, Types } from 'mongoose';

export interface IEmployee extends Document {
  employeeId: string;
  userId: Types.ObjectId;
  department: 'production' | 'commercial' | 'admin' | 'design' | 'logistics';
  position: string;
  level: 'intern' | 'junior' | 'senior' | 'lead' | 'manager';
  skills: string[];
  certifications: string[];
  hireDate: Date;
  salary?: number;
  workSchedule: {
    type: 'full-time' | 'part-time' | 'contract';
    hoursPerWeek: number;
    workDays: string[];
  };
  manager?: Types.ObjectId;
  directReports: Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IShift extends Document {
  employeeId: Types.ObjectId;
  date: Date;
  startTime: string;
  endTime: string;
  type: 'work' | 'break' | 'lunch' | 'vacation' | 'sick' | 'training';
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  hoursWorked?: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITraining extends Document {
  title: string;
  description: string;
  type: 'technical' | 'safety' | 'management' | 'software' | 'compliance';
  category: string;
  duration: number;
  format: 'online' | 'in-person' | 'hybrid';
  instructor?: string;
  maxParticipants?: number;
  requiredSkills: string[];
  prerequisites: string[];
  materials: string[];
  scheduledDate?: Date;
  location?: string;
  enrolledEmployees: Types.ObjectId[];
  completedBy: Array<{
    employeeId: Types.ObjectId;
    completedAt: Date;
    score?: number;
    certificate?: string;
  }>;
  status: 'draft' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deadline?: Date;
}

export interface ITicket extends Document {
  ticketNumber: string;
  title: string;
  description: string;
  category: 'technical' | 'hr' | 'equipment' | 'process' | 'safety' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'assigned' | 'in-progress' | 'resolved' | 'closed' | 'cancelled';
  reportedBy: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  watchers: Types.ObjectId[];
  tags: string[];
  attachments: string[];
  estimatedResolutionTime?: number;
  actualResolutionTime?: number;
  assignedAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  dueDate?: Date;
  comments: Array<{
    authorId: Types.ObjectId;
    content: string;
    timestamp: Date;
    isInternal: boolean;
  }>;
  statusHistory: Array<{
    status: string;
    changedBy: Types.ObjectId;
    timestamp: Date;
    reason?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPerformanceReview extends Document {
  employeeId: Types.ObjectId;
  reviewerId: Types.ObjectId;
  period: {
    startDate: Date;
    endDate: Date;
    type: 'quarterly' | 'semi-annual' | 'annual';
  };
  metrics: {
    productivity: number;
    quality: number;
    teamwork: number;
    communication: number;
    initiative: number;
    punctuality: number;
    problemSolving: number;
    leadership?: number;
  };
  goals: Array<{
    id: string;
    title: string;
    description: string;
    category: 'performance' | 'skill' | 'project' | 'behavior';
    targetDate: Date;
    status: 'not-started' | 'in-progress' | 'completed' | 'overdue';
    progress: number;
    notes?: string;
  }>;
  strengths: string[];
  areasForImprovement: string[];
  feedback: string;
  employeeFeedback?: string;
  trainingRecommendations: string[];
  careerDevelopmentPlan?: string;
  status: 'draft' | 'pending-employee-review' | 'completed' | 'approved';
  overallRating: number;
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
  approvedAt?: Date;
}

export interface ITeamStats {
  totalEmployees: number;
  activeEmployees: number;
  departmentBreakdown: Record<string, number>;
  openTickets: number;
  upcomingReviews: number;
  trainingStats: Array<{ _id: string; count: number }>;
}