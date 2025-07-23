// API utility functions for frontend

export interface Employee {
  id: string;
  name: string;
  isAdmin: boolean;
}

export interface TimeEntry {
  _id: string;
  employeeId: string;
  clockIn: string;
  clockOut?: string;
  hoursWorked?: number;
  isAutoClockOut?: boolean;
  autoClockOutReason?: string;
  needsReview?: boolean;
  originalClockOut?: string;
  adminCorrected?: boolean;
  correctedBy?: string;
  correctedAt?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiClient {
  private baseUrl = '/api';

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'An error occurred' };
      }

      return { data };
    } catch (error) {
      return { error: 'Network error' };
    }
  }

  // Authentication
  async login(pin: string): Promise<ApiResponse<{ employee: Employee }>> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
  }

  // Employees
  async getEmployees(): Promise<ApiResponse<{ employees: Employee[] }>> {
    return this.request('/employees');
  }

  async createEmployee(employee: { name: string; pin: string; isAdmin: boolean }): Promise<ApiResponse<{ employee: Employee }>> {
    return this.request('/employees', {
      method: 'POST',
      body: JSON.stringify(employee),
    });
  }

  async updateEmployee(id: string, employee: { name: string; pin?: string; isAdmin: boolean }): Promise<ApiResponse<{ employee: Employee }>> {
    return this.request(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(employee),
    });
  }

  async deleteEmployee(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/employees/${id}`, {
      method: 'DELETE',
    });
  }

  async getEmployeePin(id: string): Promise<ApiResponse<{ pin: string }>> {
    return this.request(`/employees/${id}/pin`);
  }

  async getActiveEmployees(includeDetails: boolean = false): Promise<ApiResponse<{
    count?: number;
    employees?: Array<{
      name: string;
      clockIn: string;
      hours: string;
      isAdmin: boolean;
    }>;
    activeEmployees?: Array<{
      entryId: string;
      employeeId: string;
      name: string;
      isAdmin: boolean;
      clockIn: string;
      currentHours: number;
      clockInFormatted: string;
      shiftDuration: string;
    }>;
    stats: {
      totalActive: number;
      activeAdmins: number;
      activeEmployees: number;
      longestShift: number;
      shortestShift: number;
      averageShiftLength: number;
    };
    timestamp?: string;
  }>> {
    return this.request(`/employees/active?details=${includeDetails}`);
  }

  // Time Entries
  async getTimeEntries(employeeId?: string, period?: string): Promise<ApiResponse<{ timeEntries: TimeEntry[] }>> {
    const params = new URLSearchParams();
    if (employeeId) params.append('employeeId', employeeId);
    if (period) params.append('period', period);
    
    return this.request(`/timeentries?${params.toString()}`);
  }

  async clockIn(employeeId: string): Promise<ApiResponse<{ timeEntry: TimeEntry; message: string }>> {
    return this.request('/timeentries', {
      method: 'POST',
      body: JSON.stringify({ employeeId, action: 'clockIn' }),
    });
  }

  async clockOut(employeeId: string): Promise<ApiResponse<{ timeEntry: TimeEntry; message: string }>> {
    return this.request('/timeentries', {
      method: 'POST',
      body: JSON.stringify({ employeeId, action: 'clockOut' }),
    });
  }

  async getActiveEntry(employeeId: string): Promise<ApiResponse<{ activeEntry: TimeEntry | null; isClockedIn: boolean }>> {
    return this.request(`/timeentries/active?employeeId=${employeeId}`);
  }

  // Analytics
  async getAnalytics(employeeId?: string, period?: string): Promise<ApiResponse<{
    analytics: {
      totalHours: number;
      totalShifts: number;
      averageHours: number;
      entries: TimeEntry[];
    }
  }>> {
    const params = new URLSearchParams();
    if (employeeId) params.append('employeeId', employeeId);
    if (period) params.append('period', period);
    
    return this.request(`/analytics?${params.toString()}`);
  }

  // Database seeding
  async seedDatabase(): Promise<ApiResponse<{ message: string; employees: any[] }>> {
    return this.request('/seed', {
      method: 'POST',
    });
  }

  // Auto-clockout
  async getAutoClockoutStatus(): Promise<ApiResponse<{
    activeEmployees: number;
    shouldAutoClockout: boolean;
    nextClockoutTime: string;
    businessHours: {
      mondayToSaturday: string;
      sunday: string;
    };
  }>> {
    return this.request('/auto-clockout?action=status');
  }

  async getAutoClockoutSchedule(): Promise<ApiResponse<{
    schedule: {
      mondayToSaturday: string;
      sunday: string;
      next: {
        date: string;
        timeString: string;
      };
    };
    today: {
      clockoutTime: string;
      shouldClockout: boolean;
      timeRemaining: number;
    };
  }>> {
    return this.request('/auto-clockout?action=schedule');
  }

  async triggerAutoClockout(adminEmployeeId: string, dryRun: boolean = false): Promise<ApiResponse<{
    success: boolean;
    clockedOutCount: number;
    errors: string[];
    clockedOutEmployees: Array<{
      employeeId: string;
      employeeName: string;
      clockInTime: string;
      clockOutTime: string;
      hoursWorked: number;
    }>;
    action: string;
    dryRun: boolean;
    timestamp: string;
  }>> {
    return this.request('/auto-clockout', {
      method: 'POST',
      body: JSON.stringify({
        action: 'trigger',
        dryRun,
        adminEmployeeId
      }),
    });
  }

  async selectiveAutoClockout(
    adminEmployeeId: string, 
    selectedEmployees: Array<{ employeeId: string; clockOutTime: string }>
  ): Promise<ApiResponse<{
    success: boolean;
    clockedOutCount: number;
    errors: string[];
    clockedOutEmployees: Array<{
      employeeId: string;
      employeeName: string;
      clockInTime: string;
      clockOutTime: string;
      hoursWorked: number;
    }>;
    action: string;
    timestamp: string;
  }>> {
    return this.request('/auto-clockout', {
      method: 'POST',
      body: JSON.stringify({
        action: 'selective',
        selectedEmployees,
        adminEmployeeId
      }),
    });
  }

  async enforceNoOvertimePolicy(adminEmployeeId: string): Promise<ApiResponse<{
    success: boolean;
    clockedOutCount: number;
    errors: string[];
    clockedOutEmployees: Array<{
      employeeId: string;
      employeeName: string;
      clockInTime: string;
      clockOutTime: string;
      hoursWorked: number;
    }>;
    action: string;
    timestamp: string;
  }>> {
    return this.request('/auto-clockout', {
      method: 'POST',
      body: JSON.stringify({
        action: 'enforce-no-overtime',
        adminEmployeeId
      }),
    });
  }

  // Time Corrections
  async correctTimeEntry(
    entryId: string, 
    adminEmployeeId: string, 
    clockOut?: string, 
    adminNotes?: string, 
    markAsCorrect: boolean = false
  ): Promise<ApiResponse<{
    success: boolean;
    message: string;
    timeEntry: TimeEntry;
  }>> {
    return this.request(`/timeentries/${entryId}/correct`, {
      method: 'PUT',
      body: JSON.stringify({
        clockOut,
        adminEmployeeId,
        adminNotes,
        markAsCorrect
      }),
    });
  }

  async getEntriesNeedingReview(
    employeeId?: string,
    period: string = 'week',
    status: string = 'needs-review'
  ): Promise<ApiResponse<{
    entries: TimeEntry[];
    stats: {
      totalNeedsReview: number;
      autoClockoutsNeedingReview: number;
      correctedToday: number;
      totalResults: number;
    };
  }>> {
    const params = new URLSearchParams();
    if (employeeId) params.append('employeeId', employeeId);
    params.append('period', period);
    params.append('status', status);
    
    return this.request(`/timeentries/needs-review?${params.toString()}`);
  }

  async batchCorrectEntries(
    action: 'mark-correct' | 'batch-correct',
    entryIds: string[],
    adminEmployeeId: string,
    clockOutTime?: string,
    adminNotes?: string
  ): Promise<ApiResponse<{
    success: boolean;
    message: string;
    modifiedCount: number;
    action: string;
  }>> {
    return this.request('/timeentries/needs-review', {
      method: 'POST',
      body: JSON.stringify({
        action,
        entryIds,
        adminEmployeeId,
        clockOutTime,
        adminNotes
      }),
    });
  }

  async getGroupedEntriesNeedingReview(
    employeeId?: string
  ): Promise<ApiResponse<{
    employeeGroups: Array<{
      _id: string;
      employeeName: string;
      isAdmin: boolean;
      totalEntries: number;
      totalHours: number;
      oldestReviewDays: number;
      avgDaysSinceReview: number;
      priority: 'high' | 'medium' | 'low';
      entries: Array<{
        id: string;
        clockIn: string;
        clockOut: string;
        hoursWorked: number;
        isAutoClockOut: boolean;
        autoClockOutReason?: string;
        originalClockOut?: string;
        daysSinceReview: number;
        updatedAt: string;
      }>;
    }>;
    stats: {
      totalNeedsReview: number;
      totalEmployeesWithReviews: number;
      totalHoursNeedingReview: number;
    };
  }>> {
    const params = new URLSearchParams();
    if (employeeId) params.append('employeeId', employeeId);
    
    return this.request(`/timeentries/needs-review/grouped?${params.toString()}`);
  }

  // Employee Reports
  async getEmployeeReport(
    employeeId: string,
    year: number,
    month?: number
  ): Promise<ApiResponse<{
    employee: {
      id: string;
      name: string;
      isAdmin: boolean;
    };
    reportPeriod: {
      year: number;
      month: number | null;
      startDate: string;
      endDate: string;
    };
    data: {
      year: number;
      totalHours: number;
      months: Array<{
        month: number;
        monthName: string;
        year: number;
        totalHours: number;
        weeks: Array<{
          weekNumber: number;
          weekLabel: string;
          startDate: string;
          endDate: string;
          totalHours: number;
          days: Array<{
            date: string;
            dayOfWeek: string;
            hours: number;
            entries: Array<{
              clockIn: string;
              clockOut: string;
              hours: number;
            }>;
          }>;
        }>;
      }>;
    };
    summary: {
      totalEntries: number;
      totalHours: number;
      averageHoursPerDay: number;
      daysWorked: number;
    };
  }>> {
    const params = new URLSearchParams();
    params.append('employeeId', employeeId);
    params.append('year', year.toString());
    if (month) params.append('month', month.toString());
    
    return this.request(`/reports/employee?${params.toString()}`);
  }

  // Bootstrap admin
  async checkBootstrap(): Promise<ApiResponse<{ canBootstrap: boolean; employeeCount: number; message: string }>> {
    return this.request('/bootstrap');
  }

  async createBootstrapAdmin(name: string, pin: string): Promise<ApiResponse<{ message: string; admin: Employee }>> {
    return this.request('/bootstrap', {
      method: 'POST',
      body: JSON.stringify({ name, pin }),
    });
  }
}

export const apiClient = new ApiClient();