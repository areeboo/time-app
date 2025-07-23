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
    
    let matchStage: any = { clockOut: { $ne: null }, hoursWorked: { $ne: null } };
    
    if (employeeId && employeeId !== 'all') {
      // Validate that employeeId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(employeeId)) {
        return NextResponse.json(
          { error: 'Invalid employee ID format' },
          { status: 400 }
        );
      }
      matchStage.employeeId = new mongoose.Types.ObjectId(employeeId);
    }
    
    // Filter by time period
    if (period === 'today') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      matchStage.clockIn = { $gte: startOfToday, $lt: endOfToday };
    } else if (period === 'week') {
      const now = new Date();
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      matchStage.clockIn = { $gte: startOfWeek };
    } else if (period === 'month') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      matchStage.clockIn = { $gte: startOfMonth };
    }
    
    const analytics = await TimeEntry.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalHours: { $sum: '$hoursWorked' },
          totalShifts: { $sum: 1 },
          averageHours: { $avg: '$hoursWorked' }
        }
      }
    ]);
    
    const result = analytics[0] || {
      totalHours: 0,
      totalShifts: 0,
      averageHours: 0
    };
    
    // Get recent entries for the table
    const recentEntries = await TimeEntry.find(matchStage)
      .populate('employeeId', 'name')
      .sort({ clockIn: -1 })
      .limit(20);
    
    return NextResponse.json({
      analytics: {
        totalHours: Number(result.totalHours.toFixed(1)),
        totalShifts: result.totalShifts,
        averageHours: Number(result.averageHours.toFixed(1)),
        entries: recentEntries
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}