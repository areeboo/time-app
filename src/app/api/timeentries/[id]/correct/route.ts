import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import TimeEntry from '@/lib/models/TimeEntry';
import Employee from '@/lib/models/Employee';
import mongoose from 'mongoose';
import { withTransactionRetry } from '@/lib/database';

/**
 * PUT - Correct a time entry (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await mongoose.startSession();
  
  try {
    await connectDB();
    
    const { id } = await params;
    const body = await request.json();
    const { 
      clockOut, 
      adminEmployeeId, 
      adminNotes,
      markAsCorrect = false  // Option to mark as correct without changing time
    } = body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid time entry ID' },
        { status: 400 }
      );
    }

    if (!adminEmployeeId) {
      return NextResponse.json(
        { error: 'Admin employee ID is required' },
        { status: 400 }
      );
    }

    let correctedEntry;

    await withTransactionRetry(session, async () => {
      // Verify admin permissions
      const admin = await Employee.findById(adminEmployeeId).session(session);
      if (!admin || !admin.isAdmin) {
        throw new Error('Admin privileges required');
      }

      // Find the time entry
      const timeEntry = await TimeEntry.findById(id).session(session);
      if (!timeEntry) {
        throw new Error('Time entry not found');
      }

      if (!timeEntry.clockOut) {
        throw new Error('Cannot correct an entry that is still active (not clocked out)');
      }

      // Prepare update data
      const updateData: any = {
        needsReview: false,  // Clear the needs review flag
        correctedBy: new mongoose.Types.ObjectId(adminEmployeeId),
        correctedAt: new Date(),
        adminNotes: adminNotes || null
      };

      // If we're just marking as correct without changing time
      if (markAsCorrect && !clockOut) {
        updateData.adminCorrected = true;
      }
      // If we're actually correcting the clock-out time
      else if (clockOut) {
        const newClockOut = new Date(clockOut);
        
        // Validate the new clock-out time
        if (newClockOut <= timeEntry.clockIn) {
          throw new Error('Clock-out time must be after clock-in time');
        }

        if (newClockOut > new Date()) {
          throw new Error('Clock-out time cannot be in the future');
        }

        // Store original clock-out time if this is the first correction
        if (!timeEntry.originalClockOut && timeEntry.isAutoClockOut) {
          updateData.originalClockOut = timeEntry.clockOut;
        }

        updateData.clockOut = newClockOut;
        updateData.adminCorrected = true;
        
        // Hours will be recalculated by the pre-save hook
      } else {
        throw new Error('Either provide a new clock-out time or set markAsCorrect to true');
      }

      // Apply the correction
      correctedEntry = await TimeEntry.findOneAndUpdate(
        { _id: id },
        updateData,
        { 
          new: true,
          session,
          runValidators: true
        }
      ).populate('correctedBy', 'name');

      if (!correctedEntry) {
        throw new Error('Failed to update time entry');
      }
    });

    return NextResponse.json({
      success: true,
      message: markAsCorrect ? 'Time entry marked as correct' : 'Time entry corrected successfully',
      timeEntry: {
        id: correctedEntry!._id,
        employeeId: correctedEntry!.employeeId,
        clockIn: correctedEntry!.clockIn,
        clockOut: correctedEntry!.clockOut,
        hoursWorked: correctedEntry!.hoursWorked,
        isAutoClockOut: correctedEntry!.isAutoClockOut,
        needsReview: correctedEntry!.needsReview,
        adminCorrected: correctedEntry!.adminCorrected,
        correctedBy: correctedEntry!.correctedBy,
        correctedAt: correctedEntry!.correctedAt,
        adminNotes: correctedEntry!.adminNotes,
        originalClockOut: correctedEntry!.originalClockOut
      }
    });

  } catch (error) {
    console.error('Time entry correction error:', error);
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === 'Admin privileges required' || 
          error.message === 'Time entry not found' ||
          error.message === 'Cannot correct an entry that is still active (not clocked out)' ||
          error.message === 'Clock-out time must be after clock-in time' ||
          error.message === 'Clock-out time cannot be in the future' ||
          error.message === 'Either provide a new clock-out time or set markAsCorrect to true') {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to correct time entry' },
      { status: 500 }
    );
  } finally {
    await session.endSession();
  }
}

/**
 * GET - Get correction details for a time entry
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid time entry ID' },
        { status: 400 }
      );
    }

    const timeEntry = await TimeEntry.findById(id)
      .populate('employeeId', 'name')
      .populate('correctedBy', 'name');

    if (!timeEntry) {
      return NextResponse.json(
        { error: 'Time entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      timeEntry: {
        id: timeEntry._id,
        employee: timeEntry.employeeId,
        clockIn: timeEntry.clockIn,
        clockOut: timeEntry.clockOut,
        hoursWorked: timeEntry.hoursWorked,
        isAutoClockOut: timeEntry.isAutoClockOut,
        autoClockOutReason: timeEntry.autoClockOutReason,
        needsReview: timeEntry.needsReview,
        originalClockOut: timeEntry.originalClockOut,
        adminCorrected: timeEntry.adminCorrected,
        correctedBy: timeEntry.correctedBy,
        correctedAt: timeEntry.correctedAt,
        adminNotes: timeEntry.adminNotes,
        createdAt: timeEntry.createdAt,
        updatedAt: timeEntry.updatedAt
      }
    });

  } catch (error) {
    console.error('Get time entry correction details error:', error);
    return NextResponse.json(
      { error: 'Failed to get time entry details' },
      { status: 500 }
    );
  }
}