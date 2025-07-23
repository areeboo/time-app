import mongoose, { Schema, Document } from 'mongoose';

export interface ITimeEntry extends Document {
  employeeId: mongoose.Types.ObjectId;
  clockIn: Date;
  clockOut?: Date;
  hoursWorked?: number;
  isAutoClockOut?: boolean;  // Track if this was an automatic clock-out
  autoClockOutReason?: string;  // Reason for auto clock-out
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
  }
}, {
  timestamps: true
});

// Indexes for better performance and concurrency
TimeEntrySchema.index({ employeeId: 1, clockIn: -1 }); // Employee time queries
TimeEntrySchema.index({ clockIn: 1 }); // Date range queries
TimeEntrySchema.index({ employeeId: 1, clockOut: 1 }); // Active entry lookups
TimeEntrySchema.index({ clockOut: 1 }); // Completed entries
TimeEntrySchema.index({ createdAt: -1 }); // Recent entries

// Compound index for active entry checks (critical for concurrency)
TimeEntrySchema.index({ employeeId: 1, clockOut: 1 }, { 
  partialFilterExpression: { clockOut: null } 
});

// Calculate hours worked when clockOut is set
TimeEntrySchema.pre('save', function(next) {
  if (this.clockOut && this.clockIn) {
    const diffMs = this.clockOut.getTime() - this.clockIn.getTime();
    this.hoursWorked = diffMs / (1000 * 60 * 60); // Convert to hours
  }
  next();
});

export default mongoose.models.TimeEntry || mongoose.model<ITimeEntry>('TimeEntry', TimeEntrySchema);