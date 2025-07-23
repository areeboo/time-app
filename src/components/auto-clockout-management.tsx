'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';

interface ActiveEmployee {
  entryId: string;
  employeeId: string;
  name: string;
  isAdmin: boolean;
  clockIn: string;
  currentHours: number;
  clockInFormatted: string;
  shiftDuration: string;
}

interface AutoClockoutProps {
  adminId: string;
}

export function AutoClockoutManagement({ adminId }: AutoClockoutProps) {
  const [status, setStatus] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [activeEmployees, setActiveEmployees] = useState<ActiveEmployee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [clockoutTimes, setClockoutTimes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  useEffect(() => {
    loadData();
    // Refresh data every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statusResult, scheduleResult, activeResult] = await Promise.all([
        apiClient.getAutoClockoutStatus(),
        apiClient.getAutoClockoutSchedule(),
        apiClient.getActiveEmployees(true)
      ]);
      
      if (statusResult.data) {
        setStatus(statusResult.data);
      }
      if (scheduleResult.data) {
        setSchedule(scheduleResult.data);
      }
      if (activeResult.data?.activeEmployees) {
        setActiveEmployees(activeResult.data.activeEmployees);
        
        // Initialize clockout times to current time
        const currentTime = new Date();
        const timeString = formatDateTimeForInput(currentTime);
        const newClockoutTimes: Record<string, string> = {};
        
        activeResult.data.activeEmployees.forEach((emp: ActiveEmployee) => {
          newClockoutTimes[emp.employeeId] = timeString;
        });
        
        setClockoutTimes(newClockoutTimes);
      }
    } catch (error) {
      console.error('Error loading auto-clockout data:', error);
    }
  };

  const handleSelectiveClockout = async () => {
    if (selectedEmployees.size === 0) {
      alert('Please select at least one employee to clock out');
      return;
    }

    const employeesToClockout = Array.from(selectedEmployees).map(employeeId => ({
      employeeId,
      clockOutTime: clockoutTimes[employeeId]
    }));

    const confirmMessage = `This will clock out ${selectedEmployees.size} selected employee(s). Continue?`;
    if (!confirm(confirmMessage)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auto-clockout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'selective',
          selectedEmployees: employeesToClockout,
          adminEmployeeId: adminId
        })
      });

      const result = await response.json();
      setLastResult(result);
      
      if (result.success) {
        setSelectedEmployees(new Set());
        await loadData();
      }
    } catch (error) {
      console.error('Selective auto-clockout error:', error);
      setLastResult({
        success: false,
        error: 'Failed to perform selective auto-clockout',
        clockedOutCount: 0,
        errors: ['Network or server error']
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEnforceNoOvertime = async () => {
    const confirmMessage = `ENFORCE NO-OVERTIME POLICY: This will immediately clock out ALL active employees at closing time and flag them for review. This action cannot be undone. Continue?`;
    if (!confirm(confirmMessage)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auto-clockout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enforce-no-overtime',
          adminEmployeeId: adminId
        })
      });

      const result = await response.json();
      setLastResult(result);
      
      if (result.success) {
        await loadData();
      }
    } catch (error) {
      console.error('No-overtime enforcement error:', error);
      setLastResult({
        success: false,
        error: 'Failed to enforce no-overtime policy',
        clockedOutCount: 0,
        errors: ['Network or server error']
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (milliseconds: number): string => {
    if (milliseconds <= 0) return 'Past closing time';
    
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  const formatDateTimeForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleEmployeeSelection = (employeeId: string, selected: boolean) => {
    const newSelection = new Set(selectedEmployees);
    if (selected) {
      newSelection.add(employeeId);
    } else {
      newSelection.delete(employeeId);
    }
    setSelectedEmployees(newSelection);
  };

  const handleClockoutTimeChange = (employeeId: string, time: string) => {
    setClockoutTimes(prev => ({
      ...prev,
      [employeeId]: time
    }));
  };

  const selectAllEmployees = () => {
    if (selectedEmployees.size === activeEmployees.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(activeEmployees.map(emp => emp.employeeId)));
    }
  };

  if (!status || !schedule) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="animate-pulse">Loading auto-clockout information...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Auto Clock-out Management</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {activeEmployees.length}
            </div>
            <div className="text-blue-800 dark:text-blue-300">Active Employees</div>
          </div>
          
          <div className={`rounded-lg p-4 ${status.shouldAutoClockout 
            ? 'bg-red-50 dark:bg-red-900/20' 
            : 'bg-green-50 dark:bg-green-900/20'
          }`}>
            <div className={`text-2xl font-bold ${status.shouldAutoClockout 
              ? 'text-red-600 dark:text-red-400' 
              : 'text-green-600 dark:text-green-400'
            }`}>
              {status.shouldAutoClockout ? 'OVERDUE' : 'ON TIME'}
            </div>
            <div className={`text-sm ${status.shouldAutoClockout 
              ? 'text-red-800 dark:text-red-300' 
              : 'text-green-800 dark:text-green-300'
            }`}>
              {status.shouldAutoClockout ? 'Past closing time' : 'Business hours'}
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
              {formatTimeRemaining(schedule.today?.timeRemaining || 0)}
            </div>
            <div className="text-gray-800 dark:text-gray-300">Until Auto Clock-out</div>
          </div>
        </div>

        {/* Manual Clock Out All Employees Section */}
        <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-orange-800 dark:text-orange-200">Manual Clock Out All Employees</h3>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                All employees are automatically clocked out at closing time to prevent overtime. 
                Entries are flagged for admin review to ensure accuracy.
              </p>
            </div>
            {activeEmployees.length > 0 && (
              <button
                onClick={handleEnforceNoOvertime}
                disabled={loading}
                className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {loading ? 'Processing...' : 'Enforce Now'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Active Employees Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Select Employees to Clock Out ({activeEmployees.length})
          </h3>
          <div className="flex gap-2">
            <button
              onClick={selectAllEmployees}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm"
            >
              {selectedEmployees.size === activeEmployees.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {activeEmployees.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <div className="text-4xl mb-2">🏢</div>
            <div>No employees currently clocked in</div>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {activeEmployees.map((employee) => (
                <div
                  key={employee.employeeId}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedEmployees.has(employee.employeeId)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedEmployees.has(employee.employeeId)}
                        onChange={(e) => handleEmployeeSelection(employee.employeeId, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {employee.name}
                          {employee.isAdmin && (
                            <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 px-2 py-1 rounded">
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Clocked in at {employee.clockInFormatted} • {employee.shiftDuration} on clock
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Clock out at:
                      </label>
                      <input
                        type="datetime-local"
                        value={clockoutTimes[employee.employeeId] || ''}
                        onChange={(e) => handleClockoutTimeChange(employee.employeeId, e.target.value)}
                        className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        disabled={!selectedEmployees.has(employee.employeeId)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Clock Out Action */}
            {selectedEmployees.size > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-blue-800 dark:text-blue-200">
                      {selectedEmployees.size} employee(s) selected for clock-out
                    </div>
                    <div className="text-sm text-blue-600 dark:text-blue-400">
                      Each employee will be clocked out at their specified time
                    </div>
                  </div>
                  <button
                    onClick={handleSelectiveClockout}
                    disabled={loading}
                    className="bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Processing...' : 'Clock Out Selected'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Business Hours Schedule */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Business Hours & Schedule</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Auto Clock-out Times</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Monday - Saturday:</span>
                <span className="font-medium">{status.businessHours.mondayToSaturday}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Sunday:</span>
                <span className="font-medium">{status.businessHours.sunday}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Next Auto Clock-out</h3>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <div className="font-medium text-blue-800 dark:text-blue-200">
                {schedule.schedule.next.timeString}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                Today: {new Date(schedule.today.clockoutTime).toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Last Operation Results */}
      {lastResult && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            Last Operation Results
          </h2>
          
          <div className={`mb-4 p-4 rounded-lg ${lastResult.success 
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            <div className={`font-semibold ${lastResult.success 
              ? 'text-green-800 dark:text-green-200' 
              : 'text-red-800 dark:text-red-200'
            }`}>
              {lastResult.success ? '✓ Success' : '✗ Failed'}
            </div>
          </div>
          
          {lastResult.clockedOutCount > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2">
                Clocked Out: {lastResult.clockedOutCount} employee(s)
              </h3>
              <div className="max-h-48 overflow-y-auto">
                {lastResult.clockedOutEmployees?.map((emp: any, index: number) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600 last:border-b-0">
                    <span className="font-medium">{emp.employeeName}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {emp.hoursWorked.toFixed(2)} hours
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {lastResult.errors && lastResult.errors.length > 0 && (
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">Errors:</h3>
              <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                {lastResult.errors.map((error: string, index: number) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Manual Clock Out All Employees</h3>
        <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
          <li>• <strong>NO OVERTIME ALLOWED:</strong> All employees auto-clocked out at closing time</li>
          <li>• Closing times: 8 PM (Mon-Sat) and 6 PM (Sunday)</li>
          <li>• All auto-clockouts are flagged for admin review</li>
          <li>• Use "Enforce Now" to immediately apply no-overtime policy</li>
          <li>• Selective clock-out: Choose specific employees with custom times</li>
          <li>• Admin-set times are automatically marked as corrected</li>
        </ul>
      </div>
    </div>
  );
}