import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import TimeEntry from '@/lib/models/TimeEntry';
import Employee from '@/lib/models/Employee';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const period = searchParams.get('period');
    
    let query: any = {};
    
    if (employeeId && employeeId !== 'all') {
      // Validate that employeeId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        return NextResponse.json(
          { error: 'Invalid employee ID format' },
          { status: 400 }
        );
      }
      query.employeeId = new mongoose.Types.ObjectId(employeeId);
    }
    
    // Filter by time period
    if (period === 'week') {
      const now = new Date();
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      query.clockIn = { $gte: startOfWeek };
    } else if (period === 'month') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      query.clockIn = { $gte: startOfMonth };
    }
    
    const timeEntries = await TimeEntry.find(query)
      .populate('employeeId', 'name')
      .sort({ clockIn: -1 });
    
    return NextResponse.json({ timeEntries });
  } catch (error) {
    console.error('Get time entries error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await mongoose.startSession();
  
  try {
    await connectDB();
    
    const { employeeId, action } = await request.json();

    if (!employeeId || !action) {
      return NextResponse.json(
        { error: 'Employee ID and action are required' },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return NextResponse.json(
        { error: 'Invalid employee ID format' },
        { status: 400 }
      );
    }

    let result: {
      timeEntry: any;
      message: string;
      status: number;
    } | null = null;
    
    await session.withTransaction(async () => {
      // Verify employee exists
      const employee = await Employee.findById(employeeId).session(session);
      if (!employee) {
        throw new Error('Employee not found');
      }

      if (action === 'clockIn') {
        // Check if already clocked in (with session for consistency)
        const activeEntry = await TimeEntry.findOne({
          employeeId: new mongoose.Types.ObjectId(employeeId),
          clockOut: null
        }).session(session);

        if (activeEntry) {
          throw new Error('Employee is already clocked in');
        }

        // Create new time entry
        const timeEntry = new TimeEntry({
          employeeId: new mongoose.Types.ObjectId(employeeId),
          clockIn: new Date()
        });

        const [savedEntry] = await TimeEntry.create([timeEntry], { session });
        
        result = { 
          timeEntry: savedEntry.toObject(),
          message: 'Successfully clocked in',
          status: 201
        };

      } else if (action === 'clockOut') {
        // Find active time entry first
        const activeEntry = await TimeEntry.findOne({
          employeeId: new mongoose.Types.ObjectId(employeeId),
          clockOut: null
        }).session(session);

        if (!activeEntry) {
          throw new Error('No active clock-in found');
        }

        // Calculate hours worked
        const clockOutTime = new Date();
        const diffMs = clockOutTime.getTime() - activeEntry.clockIn.getTime();
        const hoursWorked = diffMs / (1000 * 60 * 60); // Convert to hours

        // Update the entry with calculated hours
        const updatedEntry = await TimeEntry.findByIdAndUpdate(
          activeEntry._id,
          { 
            clockOut: clockOutTime,
            hoursWorked: hoursWorked,
            updatedAt: new Date()
          },
          { 
            new: true,
            session,
            runValidators: true
          }
        );

        if (!updatedEntry) {
          throw new Error('Failed to update time entry');
        }
        
        result = { 
          timeEntry: updatedEntry.toObject(),
          message: 'Successfully clocked out',
          status: 200
        };

      } else {
        throw new Error('Invalid action. Use "clockIn" or "clockOut"');
      }
    }, {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' }
    });

    return NextResponse.json(result!, { status: result!.status });

  } catch (error) {
    console.error('Time entry error:', error);
    
    // Handle specific known errors
    if (error instanceof Error) {
      if (error.message === 'Employee not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message === 'Employee is already clocked in' || 
          error.message === 'No active clock-in found' ||
          error.message === 'Invalid action. Use "clockIn" or "clockOut"') {
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