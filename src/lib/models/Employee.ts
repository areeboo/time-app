import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployee extends Document {
  name: string;
  pin: string;        // Legacy field - will be pinHash
  pinHash: string;    // Hashed PIN for authentication
  adminPin: string;   // Plain PIN for admin viewing
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema: Schema = new Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxLength: [50, 'Name cannot exceed 50 characters']
  },
  pin: {
    type: String,
    required: false  // Legacy field - make optional for migration
  },
  pinHash: {
    type: String,
    required: [true, 'PIN hash is required']
  },
  adminPin: {
    type: String,
    required: [true, 'Admin PIN is required']
  },
  isAdmin: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  optimisticConcurrency: true  // Enable optimistic locking
});

// Indexes for better performance and concurrency
EmployeeSchema.index({ pinHash: 1 }); // PIN authentication
EmployeeSchema.index({ adminPin: 1 }); // Admin PIN lookups
EmployeeSchema.index({ isAdmin: 1 }); // Admin filtering
EmployeeSchema.index({ name: 1 }); // Name sorting/searching
EmployeeSchema.index({ createdAt: -1 }); // Recent employees first

// Compound index for PIN uniqueness checks
EmployeeSchema.index({ adminPin: 1, _id: 1 }, { sparse: true });

export default mongoose.models.Employee || mongoose.model<IEmployee>('Employee', EmployeeSchema);