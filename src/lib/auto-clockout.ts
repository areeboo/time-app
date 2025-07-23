import mongoose from 'mongoose';
import connectDB from './mongodb';
import TimeEntry from './models/TimeEntry';
import Employee from './models/Employee';
import { withTransactionRetry } from './database';

/**
 * Business hours configuration
 */
export const BUSINESS_HOURS = {
  // Monday = 1, Sunday = 0
  MONDAY_TO_SATURDAY: { day: [1, 2, 3, 4, 5, 6], hour: 20, minute: 0 }, // 8:00 PM
  SUNDAY: { day: [0], hour: 18, minute: 0 } // 6:00 PM
};

/**
 * Get the auto-clockout time for a given date
 */
export function getAutoClockoutTime(date: Date): Date {
  const day = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const autoClockoutDate = new Date(date);
  
  if (day === 0) { // Sunday
    autoClockoutDate.setHours(BUSINESS_HOURS.SUNDAY.hour, BUSINESS_HOURS.SUNDAY.minute, 0, 0);
  } else { // Monday to Saturday
    autoClockoutDate.setHours(BUSINESS_HOURS.MONDAY_TO_SATURDAY.hour, BUSINESS_HOURS.MONDAY_TO_SATURDAY.minute, 0, 0);
  }
  
  return autoClockoutDate;
}

/**
 * Check if current time is past auto-clockout time for today
 */
export function shouldAutoClockout(currentTime: Date = new Date()): boolean {
  const autoClockoutTime = getAutoClockoutTime(currentTime);
  return currentTime >= autoClockoutTime;
}

/**
 * Get the next scheduled auto-clockout time
 */
export function getNextAutoClockoutTime(fromDate: Date = new Date()): Date {
  let nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + 1);
  nextDate.setHours(0, 0, 0, 0);
  
  // Find next business day
  while (nextDate.getDay() === 0 ? false : true) { // Skip if needed (though we have Sunday hours)
    const autoClockoutTime = getAutoClockoutTime(nextDate);
    if (autoClockoutTime > fromDate) {
      return autoClockoutTime;
    }
    nextDate.setDate(nextDate.getDate() + 1);
  }
  
  return getAutoClockoutTime(nextDate);
}

/**
 * Format auto-clockout reason message
 */
export function getAutoClockoutReason(clockoutTime: Date): string {
  const day = clockoutTime.getDay();
  const timeString = clockoutTime.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
  
  return `Auto-clockout at ${timeString} on ${dayName} - End of business hours`;
}

/**
 * Interface for auto-clockout result
 */
export interface AutoClockoutResult {
  success: boolean;
  clockedOutCount: number;
  errors: string[];
  clockedOutEmployees: Array<{
    employeeId: string;
    employeeName: string;
    clockInTime: Date;
    clockOutTime: Date;
    hoursWorked: number;
  }>;
}

/**
 * Perform auto-clockout for all employees with active time entries
 * Enforces no-overtime policy by automatically clocking out at closing time
 */
export async function performAutoClockout(
  targetDate: Date = new Date(),
  dryRun: boolean = false
): Promise<AutoClockoutResult> {
  const session = await mongoose.startSession();
  const result: AutoClockoutResult = {
    success: true,
    clockedOutCount: 0,
    errors: [],
    clockedOutEmployees: []
  };

  try {
    await connectDB();
    
    const autoClockoutTime = getAutoClockoutTime(targetDate);
    const reason = getAutoClockoutReason(autoClockoutTime);
    
    console.log(`${dryRun ? '[DRY RUN] ' : ''}Auto-clockout initiated for ${autoClockoutTime.toISOString()} - No Overtime Policy Enforced`);
    
    await withTransactionRetry(session, async () => {
      // Find all active time entries (employees who are clocked in)
      const activeEntries = await TimeEntry.find({
        clockOut: null
      })
      .populate('employeeId', 'name')
      .session(session);

      console.log(`Found ${activeEntries.length} active time entries`);

      for (const entry of activeEntries) {
        try {
          if (dryRun) {
            // In dry run mode, just log what would happen
            const employee = entry.employeeId as any;
            const mockHoursWorked = (autoClockoutTime.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60);
            
            result.clockedOutEmployees.push({
              employeeId: entry.employeeId.toString(),
              employeeName: employee?.name || 'Unknown',
              clockInTime: entry.clockIn,
              clockOutTime: autoClockoutTime,
              hoursWorked: mockHoursWorked
            });
            
            console.log(`[DRY RUN] Would clock out: ${employee?.name} (${mockHoursWorked.toFixed(2)} hours)`);
            continue;
          }

          // Perform actual auto-clockout with no-overtime policy
          const updatedEntry = await TimeEntry.findByIdAndUpdate(
            entry._id,
            {
              clockOut: autoClockoutTime,
              isAutoClockOut: true,
              autoClockOutReason: `${reason} - NO OVERTIME POLICY: Auto-clocked out at closing time`,
              needsReview: true,  // Always flag for admin review under no-overtime policy
              updatedAt: new Date()
            },
            { 
              new: true,
              session,
              runValidators: true
            }
          );

          if (updatedEntry) {
            const employee = entry.employeeId as any;
            result.clockedOutCount++;
            result.clockedOutEmployees.push({
              employeeId: entry.employeeId.toString(),
              employeeName: employee?.name || 'Unknown',
              clockInTime: entry.clockIn,
              clockOutTime: autoClockoutTime,
              hoursWorked: updatedEntry.hoursWorked || 0
            });

            console.log(`Auto-clocked out: ${employee?.name} at ${autoClockoutTime.toISOString()} (${updatedEntry.hoursWorked?.toFixed(2)} hours)`);
          }
        } catch (entryError) {
          const errorMsg = `Failed to auto-clockout employee ${entry.employeeId}: ${entryError instanceof Error ? entryError.message : String(entryError)}`;
          result.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      if (result.errors.length > 0) {
        result.success = false;
      }
    });

  } catch (error) {
    result.success = false;
    const errorMsg = `Auto-clockout process failed: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errorMsg);
    console.error(errorMsg);
  } finally {
    await session.endSession();
  }

  console.log(`${dryRun ? '[DRY RUN] ' : ''}Auto-clockout completed. Success: ${result.success}, Clocked out: ${result.clockedOutCount}, Errors: ${result.errors.length}`);
  
  return result;
}

/**
 * Perform selective auto-clockout for specific employees with custom times
 */
export async function performSelectiveAutoClockout(
  selectedEmployees: Array<{ employeeId: string; clockOutTime: Date }>,
  adminEmployeeId: string
): Promise<AutoClockoutResult> {
  const session = await mongoose.startSession();
  const result: AutoClockoutResult = {
    success: true,
    clockedOutCount: 0,
    errors: [],
    clockedOutEmployees: []
  };

  try {
    await connectDB();
    
    console.log(`Selective auto-clockout initiated for ${selectedEmployees.length} employees`);
    
    await withTransactionRetry(session, async () => {
      for (const { employeeId, clockOutTime } of selectedEmployees) {
        try {
          // Find the active time entry for this employee
          const activeEntry = await TimeEntry.findOne({
            employeeId: new mongoose.Types.ObjectId(employeeId),
            clockOut: null
          })
          .populate('employeeId', 'name')
          .session(session);

          if (!activeEntry) {
            result.errors.push(`No active time entry found for employee ${employeeId}`);
            continue;
          }

          // Validate clockout time
          if (clockOutTime <= activeEntry.clockIn) {
            result.errors.push(`Clock-out time must be after clock-in time for ${(activeEntry.employeeId as any)?.name}`);
            continue;
          }

          const reason = `Manual auto-clockout by admin at ${clockOutTime.toLocaleString()}`;

          // Perform the clockout
          const updatedEntry = await TimeEntry.findByIdAndUpdate(
            activeEntry._id,
            {
              clockOut: clockOutTime,
              isAutoClockOut: true,
              autoClockOutReason: reason,
              needsReview: false, // Admin manually set the time, so no review needed
              adminCorrected: true,
              correctedBy: new mongoose.Types.ObjectId(adminEmployeeId),
              correctedAt: new Date(),
              updatedAt: new Date()
            },
            { 
              new: true,
              session,
              runValidators: true
            }
          );

          if (updatedEntry) {
            const employee = activeEntry.employeeId as any;
            result.clockedOutCount++;
            result.clockedOutEmployees.push({
              employeeId: employeeId,
              employeeName: employee?.name || 'Unknown',
              clockInTime: activeEntry.clockIn,
              clockOutTime: clockOutTime,
              hoursWorked: updatedEntry.hoursWorked || 0
            });

            console.log(`Manually clocked out: ${employee?.name} at ${clockOutTime.toISOString()} (${updatedEntry.hoursWorked?.toFixed(2)} hours)`);
          }
        } catch (entryError) {
          const errorMsg = `Failed to clock out employee ${employeeId}: ${entryError instanceof Error ? entryError.message : String(entryError)}`;
          result.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      if (result.errors.length > 0 && result.clockedOutCount === 0) {
        result.success = false;
      }
    });

  } catch (error) {
    result.success = false;
    const errorMsg = `Selective auto-clockout process failed: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errorMsg);
    console.error(errorMsg);
  } finally {
    await session.endSession();
  }

  console.log(`Selective auto-clockout completed. Success: ${result.success}, Clocked out: ${result.clockedOutCount}, Errors: ${result.errors.length}`);
  
  return result;
}

/**
 * Check if auto-clockout should run and perform it
 */
export async function checkAndPerformAutoClockout(): Promise<AutoClockoutResult> {
  const now = new Date();
  
  if (!shouldAutoClockout(now)) {
    console.log('Auto-clockout not needed - current time is before business closing time');
    return {
      success: true,
      clockedOutCount: 0,
      errors: [],
      clockedOutEmployees: []
    };
  }
  
  return await performAutoClockout(now);
}

/**
 * Enforce no-overtime policy by auto-clocking out all active employees at closing time
 * This should be called exactly at closing time via scheduled job
 */
export async function enforceNoOvertimePolicy(): Promise<AutoClockoutResult> {
  const now = new Date();
  const closingTime = getAutoClockoutTime(now);
  
  console.log(`NO OVERTIME POLICY: Enforcing automatic clockout at ${closingTime.toISOString()}`);
  
  // Always perform auto-clockout at closing time, regardless of current time
  const result = await performAutoClockout(closingTime);
  
  if (result.clockedOutCount > 0) {
    console.log(`NO OVERTIME POLICY: Auto-clocked out ${result.clockedOutCount} employees at closing time. All entries flagged for admin review.`);
  }
  
  return result;
}

/**
 * Get auto-clockout schedule information
 */
export function getAutoClockoutSchedule(): {
  mondayToSaturday: string;
  sunday: string;
  next: {
    date: Date;
    timeString: string;
  };
} {
  const now = new Date();
  const nextClockout = getNextAutoClockoutTime(now);
  
  return {
    mondayToSaturday: '8:00 PM',
    sunday: '6:00 PM', 
    next: {
      date: nextClockout,
      timeString: nextClockout.toLocaleString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    }
  };
}