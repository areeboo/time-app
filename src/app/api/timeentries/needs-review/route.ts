import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import TimeEntry from '@/lib/models/TimeEntry';
import Employee from '@/lib/models/Employee';
import mongoose from 'mongoose';

/**
 * GET - Get time entries that need review
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const period = searchParams.get('period') || 'week';
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status') || 'needs-review'; // 'needs-review', 'corrected', 'all'
    
    // Build query based on status filter
    let query: any = {};
    
    if (status === 'needs-review') {
      query.needsReview = true;
    } else if (status === 'corrected') {
      query.adminCorrected = true;
    } else if (status === 'auto-clockouts') {
      query.isAutoClockOut = true;
    }
    // 'all' means no additional filters
    
    // Filter by employee if specified
    if (employeeId && employeeId !== 'all') {
      if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        return NextResponse.json(
          { error: 'Invalid employee ID format' },
          { status: 400 }
        );
      }
      query.employeeId = new mongoose.Types.ObjectId(employeeId);
    }
    
    // For needs-review, we don't filter by period - show all pending reviews
    // Period filtering only applies to other status types
    if (status !== 'needs-review' && period !== 'all') {
      if (period === 'today') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        query.clockIn = { $gte: startOfDay, $lte: endOfDay };
      } else if (period === 'week') {
        const now = new Date();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        startOfWeek.setHours(0, 0, 0, 0);
        query.clockIn = { $gte: startOfWeek };
      } else if (period === 'month') {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        query.clockIn = { $gte: startOfMonth };
      }
    }
    
    // Find entries matching criteria
    const entries = await TimeEntry.find(query)
      .populate('employeeId', 'name')
      .populate('correctedBy', 'name')
      .sort({ clockIn: -1 })
      .limit(limit);

    // Get summary statistics
    const stats = await Promise.all([
      TimeEntry.countDocuments({ needsReview: true }),
      TimeEntry.countDocuments({ 
        isAutoClockOut: true, 
        needsReview: true 
      }),
      TimeEntry.countDocuments({ 
        adminCorrected: true,
        correctedAt: { 
          $gte: new Date(new Date().setHours(0, 0, 0, 0)) 
        }
      })
    ]);

    const [totalNeedsReview, autoClockoutsNeedingReview, correctedToday] = stats;

    return NextResponse.json({
      entries: entries.map(entry => ({
        id: entry._id,
        employee: entry.employeeId,
        clockIn: entry.clockIn,
        clockOut: entry.clockOut,
        hoursWorked: entry.hoursWorked,
        isAutoClockOut: entry.isAutoClockOut,
        autoClockOutReason: entry.autoClockOutReason,
        needsReview: entry.needsReview,
        originalClockOut: entry.originalClockOut,
        adminCorrected: entry.adminCorrected,
        correctedBy: entry.correctedBy,
        correctedAt: entry.correctedAt,
        adminNotes: entry.adminNotes,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      })),
      stats: {
        totalNeedsReview,
        autoClockoutsNeedingReview,
        correctedToday,
        totalResults: entries.length
      }
    });

  } catch (error) {
    console.error('Get needs review entries error:', error);
    return NextResponse.json(
      { error: 'Failed to get entries needing review' },
      { status: 500 }
    );
  }
}

/**
 * POST - Batch operations for entries needing review
 */
export async function POST(request: NextRequest) {
  const session = await mongoose.startSession();
  
  try {
    await connectDB();
    
    const body = await request.json();
    const { 
      action, 
      entryIds, 
      adminEmployeeId,
      clockOutTime,  // For batch corrections
      adminNotes 
    } = body;

    if (!adminEmployeeId) {
      return NextResponse.json(
        { error: 'Admin employee ID is required' },
        { status: 400 }
      );
    }

    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json(
        { error: 'Entry IDs array is required' },
        { status: 400 }
      );
    }

    // Verify admin permissions
    const admin = await Employee.findById(adminEmployeeId);
    if (!admin || !admin.isAdmin) {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      );
    }

    let updateData: any = {
      needsReview: false,
      correctedBy: new mongoose.Types.ObjectId(adminEmployeeId),
      correctedAt: new Date()
    };

    if (adminNotes) {
      updateData.adminNotes = adminNotes;
    }

    let result;

    await session.withTransaction(async () => {
      if (action === 'mark-correct') {
        // Mark entries as correct without changing times
        updateData.adminCorrected = true;
        
        result = await TimeEntry.updateMany(
          { 
            _id: { $in: entryIds.map(id => new mongoose.Types.ObjectId(id)) },
            clockOut: { $exists: true, $ne: null }  // Only update completed entries
          },
          updateData,
          { session, runValidators: true }
        );
      } else if (action === 'batch-correct' && clockOutTime) {
        // Apply same clock-out time to multiple entries
        const newClockOut = new Date(clockOutTime);
        
        if (newClockOut > new Date()) {
          throw new Error('Clock-out time cannot be in the future');
        }

        updateData.clockOut = newClockOut;
        updateData.adminCorrected = true;

        result = await TimeEntry.updateMany(
          { 
            _id: { $in: entryIds.map(id => new mongoose.Types.ObjectId(id)) },
            clockOut: { $exists: true, $ne: null },
            clockIn: { $lt: newClockOut }  // Ensure clock-out is after clock-in
          },
          updateData,
          { session, runValidators: true }
        );
      } else {
        throw new Error('Invalid action or missing required parameters');
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully ${action === 'mark-correct' ? 'marked as correct' : 'corrected'} ${result.modifiedCount} entries`,
      modifiedCount: result.modifiedCount,
      action
    });

  } catch (error) {
    console.error('Batch correction error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Invalid action or missing required parameters' ||
          error.message === 'Clock-out time cannot be in the future') {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to perform batch operation' },
      { status: 500 }
    );
  } finally {
    await session.endSession();
  }
}