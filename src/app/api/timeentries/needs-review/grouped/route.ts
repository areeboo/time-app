import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import TimeEntry from '@/lib/models/TimeEntry';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    
    // Build base query for entries needing review
    let matchQuery: any = { needsReview: true };
    
    // Filter by specific employee if requested
    if (employeeId && employeeId !== 'all') {
      if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        return NextResponse.json(
          { error: 'Invalid employee ID format' },
          { status: 400 }
        );
      }
      matchQuery.employeeId = new mongoose.Types.ObjectId(employeeId);
    }
    
    // Aggregate entries by employee
    const employeeGroups = await TimeEntry.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $unwind: '$employee' },
      {
        $addFields: {
          // Calculate days since review was flagged
          daysSinceReview: {
            $ceil: {
              $divide: [
                { $subtract: [new Date(), '$updatedAt'] },
                1000 * 60 * 60 * 24 // milliseconds in a day
              ]
            }
          }
        }
      },
      // Sort entries within each employee group (oldest first)
      {
        $sort: {
          employeeId: 1,
          daysSinceReview: -1, // Oldest reviews first within each employee
          updatedAt: 1 // Then by when it was flagged (earliest first)
        }
      },
      {
        $group: {
          _id: '$employeeId',
          employeeName: { $first: '$employee.name' },
          isAdmin: { $first: '$employee.isAdmin' },
          entries: {
            $push: {
              id: '$_id',
              clockIn: '$clockIn',
              clockOut: '$clockOut',
              hoursWorked: '$hoursWorked',
              isAutoClockOut: '$isAutoClockOut',
              autoClockOutReason: '$autoClockOutReason',
              originalClockOut: '$originalClockOut',
              daysSinceReview: '$daysSinceReview',
              updatedAt: '$updatedAt'
            }
          },
          totalEntries: { $sum: 1 },
          totalHours: { $sum: '$hoursWorked' },
          oldestReviewDays: { $max: '$daysSinceReview' },
          avgDaysSinceReview: { $avg: '$daysSinceReview' }
        }
      },
      {
        $addFields: {
          priority: {
            $cond: {
              if: { $gte: ['$oldestReviewDays', 3] },
              then: 'high',
              else: {
                $cond: {
                  if: { $gte: ['$oldestReviewDays', 1] },
                  then: 'medium',
                  else: 'low'
                }
              }
            }
          }
        }
      },
      {
        $sort: {
          oldestReviewDays: -1, // Sort by oldest reviews first (most urgent)
          totalEntries: -1
        }
      }
    ]);
    
    // Get overall statistics
    const totalStats = await TimeEntry.aggregate([
      { $match: { needsReview: true } },
      {
        $group: {
          _id: null,
          totalNeedsReview: { $sum: 1 },
          totalEmployeesWithReviews: { $addToSet: '$employeeId' },
          totalHoursNeedingReview: { $sum: '$hoursWorked' }
        }
      },
      {
        $addFields: {
          totalEmployeesWithReviews: { $size: '$totalEmployeesWithReviews' }
        }
      }
    ]);
    
    const stats = totalStats[0] || {
      totalNeedsReview: 0,
      totalEmployeesWithReviews: 0,
      totalHoursNeedingReview: 0
    };
    
    return NextResponse.json({
      employeeGroups,
      stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Employee grouped reviews error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}