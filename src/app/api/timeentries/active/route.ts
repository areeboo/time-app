import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import TimeEntry from '@/lib/models/TimeEntry';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    
    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    // Find active time entry (where clockOut is null)
    const activeEntry = await TimeEntry.findOne({
      employeeId: new mongoose.Types.ObjectId(employeeId),
      clockOut: null
    });
    
    return NextResponse.json({ 
      activeEntry: activeEntry ? activeEntry.toObject() : null,
      isClockedIn: !!activeEntry
    });
  } catch (error) {
    console.error('Get active entry error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}