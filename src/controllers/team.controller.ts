import { Request, Response } from 'express';
import { Employee, Shift, Training, Ticket, PerformanceReview } from '../models/team.model';
import ApiError from '../utils/apiError';
import ApiResponse from '../utils/apiResponse';
import { asyncHandler } from '../middlewares/error.middleware';

// Employee Controllers
export const getEmployees = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const department = req.query.department as string;
  const isActive = req.query.isActive as string;

  const query: any = {};
  if (department) query.department = department;
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const [employees, total] = await Promise.all([
    Employee.find(query)
      .populate('userId', 'name email avatar')
      .populate('manager', 'employeeId userId')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit),
    Employee.countDocuments(query)
  ]);

  res.json(
    ApiResponse.paginated(
      'Employees retrieved successfully',
      employees,
      page,
      Math.ceil(total / limit),
      total,
      limit
    )
  );
});

export const getEmployeeById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const employee = await Employee.findById(id)
    .populate('userId', 'name email avatar phone')
    .populate('manager', 'employeeId userId')
    .populate('directReports', 'employeeId userId');

  if (!employee) {
    throw ApiError.notFound('Employee not found');
  }

  res.json(
    ApiResponse.success('Employee retrieved successfully', { employee })
  );
});

export const createEmployee = asyncHandler(async (req: Request, res: Response) => {
  const employeeData = req.body;

  const employee = await Employee.create(employeeData);
  await employee.populate('userId', 'name email avatar');

  res.status(201).json(
    ApiResponse.created('Employee created successfully', { employee })
  );
});

export const updateEmployee = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const employee = await Employee.findById(id);
  if (!employee) {
    throw ApiError.notFound('Employee not found');
  }

  Object.assign(employee, updateData);
  await employee.save();

  res.json(
    ApiResponse.updated('Employee updated successfully', { employee })
  );
});

export const deleteEmployee = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const employee = await Employee.findById(id);
  if (!employee) {
    throw ApiError.notFound('Employee not found');
  }

  employee.isActive = false;
  await employee.save();

  res.json(
    ApiResponse.deleted('Employee deactivated successfully')
  );
});

// Shift Controllers
export const getShifts = asyncHandler(async (req: Request, res: Response) => {
  const employeeId = req.query.employeeId as string;
  const date = req.query.date as string;
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;

  const query: any = {};
  if (employeeId) query.employeeId = employeeId;
  if (date) query.date = new Date(date);
  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const shifts = await Shift.find(query)
    .populate('employeeId', 'employeeId userId')
    .populate('createdBy', 'name email')
    .sort({ date: 1, startTime: 1 });

  res.json(
    ApiResponse.success('Shifts retrieved successfully', { shifts })
  );
});

export const createShift = asyncHandler(async (req: Request, res: Response) => {
  const shiftData = { ...req.body, createdBy: req.user.id };

  const shift = await Shift.create(shiftData);
  await shift.populate('employeeId', 'employeeId userId');

  res.status(201).json(
    ApiResponse.created('Shift created successfully', { shift })
  );
});

export const updateShift = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const shift = await Shift.findById(id);
  if (!shift) {
    throw ApiError.notFound('Shift not found');
  }

  Object.assign(shift, updateData);
  await shift.save();

  res.json(
    ApiResponse.updated('Shift updated successfully', { shift })
  );
});

export const deleteShift = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  await Shift.findByIdAndDelete(id);

  res.json(
    ApiResponse.deleted('Shift deleted successfully')
  );
});

// Training Controllers
export const getTrainings = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const type = req.query.type as string;
  const status = req.query.status as string;

  const query: any = { isActive: true };
  if (type) query.type = type;
  if (status) query.status = status;

  const [trainings, total] = await Promise.all([
    Training.find(query)
      .populate('enrolledEmployees', 'employeeId userId')
      .sort({ scheduledDate: 1 })
      .limit(limit)
      .skip((page - 1) * limit),
    Training.countDocuments(query)
  ]);

  res.json(
    ApiResponse.paginated(
      'Trainings retrieved successfully',
      trainings,
      page,
      Math.ceil(total / limit),
      total,
      limit
    )
  );
});

export const createTraining = asyncHandler(async (req: Request, res: Response) => {
  const trainingData = req.body;

  const training = await Training.create(trainingData);

  res.status(201).json(
    ApiResponse.created('Training created successfully', { training })
  );
});

export const updateTraining = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const training = await Training.findById(id);
  if (!training) {
    throw ApiError.notFound('Training not found');
  }

  Object.assign(training, updateData);
  await training.save();

  res.json(
    ApiResponse.updated('Training updated successfully', { training })
  );
});

export const enrollInTraining = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { employeeId } = req.body;

  const training = await Training.findById(id);
  if (!training) {
    throw ApiError.notFound('Training not found');
  }

  if (!training.enrolledEmployees.includes(employeeId)) {
    training.enrolledEmployees.push(employeeId);
    await training.save();
  }

  res.json(
    ApiResponse.success('Enrolled in training successfully', { training })
  );
});

export const completeTraining = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { employeeId, score, certificate } = req.body;

  const training = await Training.findById(id);
  if (!training) {
    throw ApiError.notFound('Training not found');
  }

  const existingCompletion = training.completedBy.find(
    c => c.employeeId.toString() === employeeId
  );

  if (existingCompletion) {
    throw ApiError.badRequest('Training already completed by this employee');
  }

  training.completedBy.push({
    employeeId,
    completedAt: new Date(),
    score,
    certificate
  });

  await training.save();

  res.json(
    ApiResponse.success('Training completed successfully', { training })
  );
});

// Ticket Controllers
export const getTickets = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = req.query.status as string;
  const priority = req.query.priority as string;
  const assignedTo = req.query.assignedTo as string;

  const query: any = {};
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (assignedTo) query.assignedTo = assignedTo;

  const [tickets, total] = await Promise.all([
    Ticket.find(query)
      .populate('reportedBy', 'employeeId userId')
      .populate('assignedTo', 'employeeId userId')
      .sort({ priority: 1, createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit),
    Ticket.countDocuments(query)
  ]);

  res.json(
    ApiResponse.paginated(
      'Tickets retrieved successfully',
      tickets,
      page,
      Math.ceil(total / limit),
      total,
      limit
    )
  );
});

export const createTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticketData = { ...req.body, reportedBy: req.user.id };

  const ticket = await Ticket.create(ticketData);
  await ticket.populate('reportedBy', 'employeeId userId');

  res.status(201).json(
    ApiResponse.created('Ticket created successfully', { ticket })
  );
});

export const updateTicket = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const ticket = await Ticket.findById(id);
  if (!ticket) {
    throw ApiError.notFound('Ticket not found');
  }

  // Add to history if status changes
  if (updateData.status && updateData.status !== ticket.status) {
    ticket.statusHistory.push({
      status: updateData.status,
      changedBy: req.user.id,
      timestamp: new Date(),
      reason: updateData.statusReason
    });
  }

  Object.assign(ticket, updateData);
  await ticket.save();

  res.json(
    ApiResponse.updated('Ticket updated successfully', { ticket })
  );
});

export const assignTicket = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { employeeId } = req.body;

  const ticket = await Ticket.findById(id);
  if (!ticket) {
    throw ApiError.notFound('Ticket not found');
  }

  ticket.assignedTo = employeeId;
  ticket.assignedAt = new Date();
  ticket.status = 'assigned';

  ticket.statusHistory.push({
    status: 'assigned',
    changedBy: req.user.id,
    timestamp: new Date(),
    reason: `Assigned to employee ${employeeId}`
  });

  await ticket.save();

  res.json(
    ApiResponse.success('Ticket assigned successfully', { ticket })
  );
});

// Performance Review Controllers
export const getPerformanceReviews = asyncHandler(async (req: Request, res: Response) => {
  const employeeId = req.query.employeeId as string;
  const year = req.query.year as string;

  const query: any = {};
  if (employeeId) query.employeeId = employeeId;
  if (year) {
    const startOfYear = new Date(`${year}-01-01`);
    const endOfYear = new Date(`${year}-12-31`);
    query['period.startDate'] = { $gte: startOfYear, $lte: endOfYear };
  }

  const reviews = await PerformanceReview.find(query)
    .populate('employeeId', 'employeeId userId')
    .populate('reviewerId', 'employeeId userId')
    .sort({ 'period.startDate': -1 });

  res.json(
    ApiResponse.success('Performance reviews retrieved successfully', { reviews })
  );
});

export const createPerformanceReview = asyncHandler(async (req: Request, res: Response) => {
  const reviewData = { ...req.body, reviewerId: req.user.id };

  const review = await PerformanceReview.create(reviewData);
  await review.populate('employeeId', 'employeeId userId');

  res.status(201).json(
    ApiResponse.created('Performance review created successfully', { review })
  );
});

export const updatePerformanceReview = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const review = await PerformanceReview.findById(id);
  if (!review) {
    throw ApiError.notFound('Performance review not found');
  }

  Object.assign(review, updateData);
  await review.save();

  res.json(
    ApiResponse.updated('Performance review updated successfully', { review })
  );
});

export const getTeamStats = asyncHandler(async (req: Request, res: Response) => {
  const [
    totalEmployees,
    activeEmployees,
    departmentStats,
    openTickets,
    upcomingReviews,
    trainingStats
  ] = await Promise.all([
    Employee.countDocuments(),
    Employee.countDocuments({ isActive: true }),
    Employee.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]),
    Ticket.countDocuments({ status: { $in: ['open', 'assigned', 'in-progress'] } }),
    PerformanceReview.countDocuments({ 
      status: 'pending-employee-review',
      'period.endDate': { $lte: new Date() }
    }),
    Training.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const departmentBreakdown = departmentStats.reduce((acc: any, dept: any) => {
    acc[dept._id] = dept.count;
    return acc;
  }, {});

  res.json(
    ApiResponse.success('Team statistics retrieved successfully', {
      totalEmployees,
      activeEmployees,
      departmentBreakdown,
      openTickets,
      upcomingReviews,
      trainingStats
    })
  );
});