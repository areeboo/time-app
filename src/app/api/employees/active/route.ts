import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import TimeEntry from '@/lib/models/TimeEntry';
import Employee from '@/lib/models/Employee';

/**
 * GET - Get currently active employees (clocked in)
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get('details') === 'true';
    
    // Find all active time entries (no clock-out time)
    const activeEntries = await TimeEntry.find({
      clockOut: null
    })
    .populate('employeeId', 'name isAdmin')
    .sort({ clockIn: 1 }); // Sort by clock-in time (earliest first)

    // Process the data
    const activeEmployees = activeEntries.map(entry => {
      const employee = entry.employeeId as any;
      const clockInTime = new Date(entry.clockIn);
      const now = new Date();
      const hoursWorked = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
      
      return {
        entryId: entry._id,
        employeeId: employee._id,
        name: employee.name,
        isAdmin: employee.isAdmin,
        clockIn: entry.clockIn,
        currentHours: hoursWorked,
        clockInFormatted: clockInTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        shiftDuration: formatShiftDuration(hoursWorked)
      };
    });

    // Calculate summary stats
    const stats = {
      totalActive: activeEmployees.length,
      activeAdmins: activeEmployees.filter(emp => emp.isAdmin).length,
      activeEmployees: activeEmployees.filter(emp => !emp.isAdmin).length,
      longestShift: activeEmployees.length > 0 ? Math.max(...activeEmployees.map(emp => emp.currentHours)) : 0,
      shortestShift: activeEmployees.length > 0 ? Math.min(...activeEmployees.map(emp => emp.currentHours)) : 0,
      averageShiftLength: activeEmployees.length > 0 
        ? activeEmployees.reduce((sum, emp) => sum + emp.currentHours, 0) / activeEmployees.length 
        : 0
    };

    if (includeDetails) {
      return NextResponse.json({
        activeEmployees,
        stats,
        timestamp: new Date().toISOString()
      });
    } else {
      // Simple response for dashboard widgets
      return NextResponse.json({
        count: activeEmployees.length,
        employees: activeEmployees.map(emp => ({
          name: emp.name,
          clockIn: emp.clockInFormatted,
          hours: emp.shiftDuration,
          isAdmin: emp.isAdmin
        })),
        stats
      });
    }

  } catch (error) {
    console.error('Get active employees error:', error);
    return NextResponse.json(
      { error: 'Failed to get active employees' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to format shift duration
 */
function formatShiftDuration(hours: number): string {
  if (hours < 1) {
    const minutes = Math.floor(hours * 60);
    return `${minutes}m`;
  } else {
    const wholeHours = Math.floor(hours);
    const minutes = Math.floor((hours - wholeHours) * 60);
    return minutes > 0 ? `${wholeHours}h ${minutes}m` : `${wholeHours}h`;
  }
}