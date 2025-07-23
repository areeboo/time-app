import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Employee from '@/lib/models/Employee';
import TimeEntry from '@/lib/models/TimeEntry';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await mongoose.startSession();
  
  try {
    await connectDB();
    
    const { name, pin, isAdmin } = await request.json();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid employee ID' },
        { status: 400 }
      );
    }

    // Validate input
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    let updatedEmployee;

    await session.withTransaction(async () => {
      const employee = await Employee.findById(id).session(session);
      if (!employee) {
        throw new Error('Employee not found');
      }

      const updateData: any = {
        name: name.trim(),
        isAdmin: isAdmin || false
      };

      // If PIN is provided, validate and update both hash and admin fields
      if (pin) {
        if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
          throw new Error('PIN must be exactly 4 digits');
        }

        // Check if PIN already exists (excluding current employee) within transaction
        const existingEmployee = await Employee.findOne({
          _id: { $ne: id },
          $or: [
            { adminPin: pin },
            { pin: { $exists: true } }  // Will check hashed pins below
          ]
        }).session(session);

        if (existingEmployee) {
          // Check against adminPin (new format)
          if (existingEmployee.adminPin === pin) {
            throw new Error('PIN already exists');
          }
          // Check against legacy hashed pin for existing employees
          if (existingEmployee.pin && !existingEmployee.adminPin) {
            const isMatch = await bcrypt.compare(pin, existingEmployee.pin);
            if (isMatch) {
              throw new Error('PIN already exists');
            }
          }
        }

        updateData.pinHash = await bcrypt.hash(pin, 10);
        updateData.adminPin = pin;
      }

      // Update with optimistic locking
      updatedEmployee = await Employee.findOneAndUpdate(
        { 
          _id: id,
          __v: employee.__v  // Optimistic locking check
        },
        { 
          ...updateData,
          $inc: { __v: 1 }  // Increment version
        },
        { 
          new: true,
          session,
          runValidators: true
        }
      );

      if (!updatedEmployee) {
        throw new Error('Employee was modified by another process. Please retry.');
      }
    }, {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' }
    });

    return NextResponse.json({
      employee: {
        id: updatedEmployee!._id,
        name: updatedEmployee!.name,
        isAdmin: updatedEmployee!.isAdmin,
        createdAt: updatedEmployee!.createdAt,
        updatedAt: updatedEmployee!.updatedAt
      }
    });

  } catch (error) {
    console.error('Update employee error:', error);
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === 'Employee not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message === 'PIN must be exactly 4 digits' || 
          error.message === 'PIN already exists' ||
          error.message === 'Name is required' ||
          error.message === 'Employee was modified by another process. Please retry.') {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await session.endSession();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await mongoose.startSession();
  
  try {
    await connectDB();
    
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid employee ID' },
        { status: 400 }
      );
    }

    await session.withTransaction(async () => {
      const employee = await Employee.findById(id).session(session);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Check if this is the last admin
      if (employee.isAdmin) {
        const adminCount = await Employee.countDocuments({ isAdmin: true }).session(session);
        if (adminCount <= 1) {
          throw new Error('Cannot delete the last admin user');
        }
      }

      // Mark employee as deleted but preserve time entries for data integrity
      // Time entries will retain reference to deleted employee for historical records
      
      // Delete the employee
      await Employee.findByIdAndDelete(id).session(session);
    }, {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' }
    });

    return NextResponse.json({
      message: 'Employee deleted successfully. Time entries preserved for data integrity.'
    });

  } catch (error) {
    console.error('Delete employee error:', error);
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === 'Employee not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message === 'Cannot delete the last admin user') {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await session.endSession();
  }
}