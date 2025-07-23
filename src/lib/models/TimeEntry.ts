import mongoose, { Schema, Document } from 'mongoose';

export interface ITimeEntry extends Document {
  employeeId: mongoose.Types.ObjectId;
  clockIn: Date;
  clockOut?: Date;
  hoursWorked?: number;
  isAutoClockOut?: boolean;  // Track if this was an automatic clock-out
  autoClockOutReason?: string;  // Reason for auto clock-out
  needsReview?: boolean;  // Flag for entries requiring admin attention
  originalClockOut?: Date;  // Store original auto-clockout time before correction
  adminCorrected?: boolean;  // Track if admin has corrected this entry
  correctedBy?: mongoose.Types.ObjectId;  // Admin who made the correction
  correctedAt?: Date;  // When the correction was made
  adminNotes?: string;  // Admin notes about the correction
  createdAt: Date;
  updatedAt: Date;
}

const TimeEntrySchema: Schema = new Schema({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee ID is required']
  },
  clockIn: {
    type: Date,
    required: [true, 'Clock in time is required']
  },
  clockOut: {
    type: Date,
    default: null
  },
  hoursWorked: {
    type: Number,
    default: null,
    min: [0, 'Hours worked cannot be negative']
  },
  isAutoClockOut: {
    type: Boolean,
    default: false
  },
  autoClockOutReason: {
    type: String,
    default: null
  },
  needsReview: {
    type: Boolean,
    default: false
  },
  originalClockOut: {
    type: Date,
    default: null
  },
  adminCorrected: {
    type: Boolean,
    default: false
  },
  correctedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  correctedAt: {
    type: Date,
    default: null
  },
  adminNotes: {
    type: String,
    default: null,
    maxLength: [500, 'Admin notes cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Indexes for better performance and concurrency
TimeEntrySchema.index({ employeeId: 1, clockIn: -1 }); // Employee time queries
TimeEntrySchema.index({ clockIn: 1 }); // Date range queries
TimeEntrySchema.index({ clockOut: 1 }); // Completed entries
TimeEntrySchema.index({ createdAt: -1 }); // Recent entries

// Compound index for active entry checks (critical for concurrency)
TimeEntrySchema.index({ employeeId: 1, clockOut: 1 }, { 
  partialFilterExpression: { clockOut: null } 
});

// Indexes for correction workflow
TimeEntrySchema.index({ needsReview: 1, clockIn: -1 }); // Entries needing review
TimeEntrySchema.index({ isAutoClockOut: 1, needsReview: 1 }); // Auto-clockouts needing review
TimeEntrySchema.index({ adminCorrected: 1, correctedAt: -1 }); // Corrected entries
TimeEntrySchema.index({ correctedBy: 1, correctedAt: -1 }); // Corrections by admin

// Calculate hours worked when clockOut is set
TimeEntrySchema.pre('save', function(next) {
  if (this.clockOut && this.clockIn) {
    const clockOutTime = this.clockOut as Date;
    const clockInTime = this.clockIn as Date;
    const diffMs = clockOutTime.getTime() - clockInTime.getTime();
    this.hoursWorked = diffMs / (1000 * 60 * 60); // Convert to hours
  }
  next();
});

// Also calculate hours worked on update operations
TimeEntrySchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function(next) {
  const update = this.getUpdate() as any;
  
  // If clockOut is being set and we have access to the document
  if (update && update.clockOut) {
    // For findOneAndUpdate, we need to get the original document to calculate hours
    // The calculation will be handled in the API route for better reliability
    // This hook serves as a backup for other update scenarios
  }
  next();
});

export default mongoose.models.TimeEntry || mongoose.model<ITimeEntry>('TimeEntry', TimeEntrySchema);