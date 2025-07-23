import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import TimeEntry from '@/lib/models/TimeEntry';
import Employee from '@/lib/models/Employee';
import mongoose from 'mongoose';

interface DailyData {
  date: string;
  dayOfWeek: string;
  hours: number;
  entries: Array<{
    clockIn: string;
    clockOut: string;
    hours: number;
  }>;
}

interface WeeklyData {
  weekNumber: number;
  weekLabel: string;
  startDate: string;
  endDate: string;
  totalHours: number;
  days: DailyData[];
}

interface MonthlyData {
  month: number;
  monthName: string;
  year: number;
  totalHours: number;
  weeks: WeeklyData[];
}

interface YearlyData {
  year: number;
  totalHours: number;
  months: MonthlyData[];
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')) : undefined;
    
    if (!employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }
    
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return NextResponse.json(
        { error: 'Invalid employee ID format' },
        { status: 400 }
      );
    }
    
    // Get employee details
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }
    
    // Build date range query
    let startDate: Date;
    let endDate: Date;
    
    if (month) {
      // Specific month and year
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    } else {
      // Entire year
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    }
    
    // Get all time entries for the period
    const entries = await TimeEntry.find({
      employeeId: new mongoose.Types.ObjectId(employeeId),
      clockIn: { $gte: startDate, $lte: endDate },
      clockOut: { $ne: null },
      hoursWorked: { $ne: null }
    }).sort({ clockIn: 1 });
    
    // Helper functions
    const getWeekNumber = (date: Date, monthStart: Date): number => {
      const daysDiff = Math.floor((date.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24));
      return Math.floor(daysDiff / 7) + 1;
    };
    
    const getWeekDateRange = (date: Date, weekNum: number, monthStart: Date) => {
      const weekStart = new Date(monthStart);
      weekStart.setDate(monthStart.getDate() + (weekNum - 1) * 7);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      // Don't go beyond month end
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      if (weekEnd > monthEnd) {
        weekEnd.setTime(monthEnd.getTime());
      }
      
      return { weekStart, weekEnd };
    };
    
    const formatDate = (date: Date): string => {
      return date.toISOString().split('T')[0];
    };
    
    const getDayOfWeek = (date: Date): string => {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    };
    
    const getMonthName = (monthNum: number): string => {
      return new Date(2024, monthNum - 1, 1).toLocaleDateString('en-US', { month: 'long' });
    };
    
    // Process entries into hierarchical structure
    const yearlyData: YearlyData = {
      year,
      totalHours: 0,
      months: []
    };
    
    // Group entries by month
    const entriesByMonth = new Map<number, any[]>();
    entries.forEach(entry => {
      const entryDate = new Date(entry.clockIn);
      const monthKey = entryDate.getMonth() + 1;
      
      if (!entriesByMonth.has(monthKey)) {
        entriesByMonth.set(monthKey, []);
      }
      entriesByMonth.get(monthKey)!.push(entry);
    });
    
    // Process each month
    const monthsToProcess = month ? [month] : Array.from({length: 12}, (_, i) => i + 1);
    
    for (const currentMonth of monthsToProcess) {
      const monthEntries = entriesByMonth.get(currentMonth) || [];
      const monthStart = new Date(year, currentMonth - 1, 1);
      const monthEnd = new Date(year, currentMonth, 0);
      
      const monthlyData: MonthlyData = {
        month: currentMonth,
        monthName: getMonthName(currentMonth),
        year,
        totalHours: 0,
        weeks: []
      };
      
      // Group entries by week within month
      const entriesByWeek = new Map<number, any[]>();
      monthEntries.forEach(entry => {
        const entryDate = new Date(entry.clockIn);
        const weekNum = getWeekNumber(entryDate, monthStart);
        
        if (!entriesByWeek.has(weekNum)) {
          entriesByWeek.set(weekNum, []);
        }
        entriesByWeek.get(weekNum)!.push(entry);
      });
      
      // Determine how many weeks are in this month
      const weeksInMonth = getWeekNumber(monthEnd, monthStart);
      
      // Process each week
      for (let weekNum = 1; weekNum <= weeksInMonth; weekNum++) {
        const weekEntries = entriesByWeek.get(weekNum) || [];
        const { weekStart, weekEnd } = getWeekDateRange(monthStart, weekNum, monthStart);
        
        const weeklyData: WeeklyData = {
          weekNumber: weekNum,
          weekLabel: `Week ${weekNum}`,
          startDate: formatDate(weekStart),
          endDate: formatDate(weekEnd),
          totalHours: 0,
          days: []
        };
        
        // Group entries by day within week
        const entriesByDay = new Map<string, any[]>();
        weekEntries.forEach(entry => {
          const entryDate = new Date(entry.clockIn);
          const dayKey = formatDate(entryDate);
          
          if (!entriesByDay.has(dayKey)) {
            entriesByDay.set(dayKey, []);
          }
          entriesByDay.get(dayKey)!.push(entry);
        });
        
        // Process each day in the week
        for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
          const dayKey = formatDate(d);
          const dayEntries = entriesByDay.get(dayKey) || [];
          
          const dailyData: DailyData = {
            date: dayKey,
            dayOfWeek: getDayOfWeek(d),
            hours: 0,
            entries: []
          };
          
          dayEntries.forEach(entry => {
            const hours = entry.hoursWorked || 0;
            dailyData.hours += hours;
            dailyData.entries.push({
              clockIn: entry.clockIn.toISOString(),
              clockOut: entry.clockOut.toISOString(),
              hours: hours
            });
          });
          
          weeklyData.days.push(dailyData);
          weeklyData.totalHours += dailyData.hours;
        }
        
        monthlyData.weeks.push(weeklyData);
        monthlyData.totalHours += weeklyData.totalHours;
      }
      
      // Only include months that have data or if we're viewing a specific month
      if (monthlyData.totalHours > 0 || month) {
        yearlyData.months.push(monthlyData);
        yearlyData.totalHours += monthlyData.totalHours;
      }
    }
    
    return NextResponse.json({
      employee: {
        id: employee._id,
        name: employee.name,
        isAdmin: employee.isAdmin
      },
      reportPeriod: {
        year,
        month: month || null,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
      },
      data: yearlyData,
      summary: {
        totalEntries: entries.length,
        totalHours: yearlyData.totalHours,
        averageHoursPerDay: entries.length > 0 ? (yearlyData.totalHours / entries.length) : 0,
        daysWorked: entries.length
      }
    });
    
  } catch (error) {
    console.error('Employee report error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}