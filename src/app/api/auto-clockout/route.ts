import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Employee from '@/lib/models/Employee';
import TimeEntry from '@/lib/models/TimeEntry';
import { 
  performAutoClockout, 
  performSelectiveAutoClockout,
  checkAndPerformAutoClockout,
  enforceNoOvertimePolicy,
  getAutoClockoutSchedule,
  shouldAutoClockout,
  getAutoClockoutTime
} from '@/lib/auto-clockout';

/**
 * GET - Get auto-clockout status and schedule information
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    if (action === 'schedule') {
      const schedule = getAutoClockoutSchedule();
      const now = new Date();
      const todayClockoutTime = getAutoClockoutTime(now);
      
      return NextResponse.json({
        schedule,
        today: {
          clockoutTime: todayClockoutTime.toISOString(),
          shouldClockout: shouldAutoClockout(now),
          timeRemaining: Math.max(0, todayClockoutTime.getTime() - now.getTime())
        }
      });
    }
    
    if (action === 'status') {
      // Get count of employees currently clocked in
      const activeCount = await TimeEntry.countDocuments({ clockOut: null });
      const now = new Date();
      
      return NextResponse.json({
        activeEmployees: activeCount,
        shouldAutoClockout: shouldAutoClockout(now),
        nextClockoutTime: getAutoClockoutTime(now).toISOString(),
        businessHours: {
          mondayToSaturday: '8:00 PM',
          sunday: '6:00 PM'
        }
      });
    }
    
    // Default: return basic info
    const schedule = getAutoClockoutSchedule();
    return NextResponse.json({ schedule });
    
  } catch (error) {
    console.error('Auto-clockout GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get auto-clockout information' },
      { status: 500 }
    );
  }
}

/**
 * POST - Trigger auto-clockout manually or automatically
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    let body;
    try {
      body = await request.json();
    } catch {
      body = {}; // Allow empty body for simple trigger
    }
    
    const { 
      action = 'trigger', 
      dryRun = false, 
      targetDate,
      adminEmployeeId,
      selectedEmployees // Array of {employeeId, clockOutTime}
    } = body;
    
    // Verify admin permission if adminEmployeeId provided
    if (adminEmployeeId) {
      const admin = await Employee.findById(adminEmployeeId);
      if (!admin || !admin.isAdmin) {
        return NextResponse.json(
          { error: 'Admin privileges required' },
          { status: 403 }
        );
      }
    }
    
    let result;
    
    switch (action) {
      case 'trigger':
        // Manual trigger - always run regardless of time
        result = await performAutoClockout(
          targetDate ? new Date(targetDate) : new Date(),
          dryRun
        );
        break;
        
      case 'selective':
        // Selective auto-clockout for specific employees
        if (!selectedEmployees || !Array.isArray(selectedEmployees)) {
          return NextResponse.json(
            { error: 'selectedEmployees array is required for selective action' },
            { status: 400 }
          );
        }
        
        // Convert clock-out times to Date objects
        const employeesWithDates = selectedEmployees.map((emp: any) => ({
          employeeId: emp.employeeId,
          clockOutTime: new Date(emp.clockOutTime)
        }));
        
        result = await performSelectiveAutoClockout(employeesWithDates, adminEmployeeId);
        break;
        
      case 'check':
        // Check if auto-clockout should run and perform it
        result = await checkAndPerformAutoClockout();
        break;
        
      case 'enforce-no-overtime':
        // Enforce no-overtime policy by auto-clocking out all active employees
        result = await enforceNoOvertimePolicy();
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "trigger", "selective", "check", or "enforce-no-overtime"' },
          { status: 400 }
        );
    }
    
    // Log the action for audit purposes
    console.log(`Auto-clockout ${action} completed:`, {
      success: result.success,
      clockedOutCount: result.clockedOutCount,
      errors: result.errors.length,
      dryRun,
      adminEmployeeId,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json({
      ...result,
      action,
      dryRun,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Auto-clockout POST error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Auto-clockout operation failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}