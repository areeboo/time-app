'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Employee, TimeEntry, apiClient } from '@/lib/api';
import { ThemeToggle } from '@/components/theme-toggle';
import { EmployeeManagement } from '@/components/employee-management';
import { AutoClockoutManagement } from '@/components/auto-clockout-management';
import { TimeCorrectionManagement } from '@/components/time-correction-management';
import { AdminDashboardOverview } from '@/components/admin-dashboard-overview';

export default function AdminPage() {
  const [admin, setAdmin] = useState<Employee | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('week');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [analytics, setAnalytics] = useState({
    totalHours: '0.0',
    totalShifts: 0,
    averageHours: '0.0',
    entries: [] as TimeEntry[]
  });
  const [needsReviewCount, setNeedsReviewCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'analytics' | 'employees' | 'auto-clockout' | 'time-corrections'>('analytics');
  const router = useRouter();

  // Check if user is logged in admin and load data
  useEffect(() => {
    const savedEmployee = localStorage.getItem('currentEmployee');
    if (savedEmployee) {
      const emp = JSON.parse(savedEmployee);
      if (emp.isAdmin) {
        setAdmin(emp);
        loadData();
      } else {
        router.push('/clock');
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  // Load data when filters change
  useEffect(() => {
    if (admin && activeTab === 'analytics') {
      loadData();
    }
  }, [selectedEmployee, selectedPeriod, admin, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load employees
      const employeesResult = await apiClient.getEmployees();
      if (employeesResult.data) {
        setEmployees(employeesResult.data.employees);
      }

      // Load analytics
      const analyticsResult = await apiClient.getAnalytics(
        selectedEmployee === 'all' ? undefined : selectedEmployee,
        selectedPeriod === 'all' ? undefined : selectedPeriod
      );
      if (analyticsResult.data) {
        const analytics = analyticsResult.data.analytics;
        setAnalytics({
          ...analytics,
          totalHours: analytics.totalHours.toFixed(1),
          averageHours: analytics.averageHours.toFixed(1)
        });
      }

      // Load needs review count
      const reviewResult = await apiClient.getEntriesNeedingReview();
      if (reviewResult.data) {
        setNeedsReviewCount(reviewResult.data.stats.totalNeedsReview);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeChange = () => {
    // Reload data when employees are modified
    if (activeTab === 'analytics') {
      loadData();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('currentEmployee');
    router.push('/login');
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEmployeeName = (employeeId: string) => {
    const emp = employees.find(e => e.id === employeeId);
    return emp ? emp.name : 'Unknown';
  };

  if (!admin) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Admin Dashboard</h1>
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-gray-600">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'analytics'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              Analytics & Reports
            </button>
            <button
              onClick={() => setActiveTab('auto-clockout')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'auto-clockout'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              Manual Clock-out
            </button>
            <button
              onClick={() => setActiveTab('time-corrections')}
              className={`py-2 px-1 border-b-2 font-medium text-sm relative ${
                activeTab === 'time-corrections'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              Time Corrections
              {needsReviewCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                  {needsReviewCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('employees')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'employees'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              Employee Management
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'analytics' && (
        <>
          {/* High Priority Dashboard Overview */}
          <AdminDashboardOverview adminId={admin.id} />
          
          {/* Detailed Analytics Section */}
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">Detailed Analytics</h2>
            
            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Employee:
                </label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">All Employees</option>
                  {employees.filter((emp) => !emp.isAdmin).map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Period:
                </label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="all">All Time</option>
                </select>
              </div>
            </div>
          </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
            {loading ? '...' : analytics.totalHours}
          </div>
          <div className="text-gray-600 dark:text-gray-300">Total Hours</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
            {loading ? '...' : analytics.totalShifts}
          </div>
          <div className="text-gray-600 dark:text-gray-300">Total Shifts</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
            {loading ? '...' : analytics.averageHours}
          </div>
          <div className="text-gray-600 dark:text-gray-300">Average Hours/Shift</div>
        </div>
      </div>

      {/* Recent Entries Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Recent Time Entries</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-600">
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Employee</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Clock In</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Clock Out</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Hours</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Type</th>
              </tr>
            </thead>
            <tbody>
              {analytics.entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No time entries found for the selected criteria.
                  </td>
                </tr>
              ) : (
                analytics.entries
                  .slice(0, 20)
                  .map((entry: any) => (
                    <tr key={entry._id} className="border-b border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                        {entry.employeeId?.name || getEmployeeName(entry.employeeId)}
                      </td>
                      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{formatDateTime(entry.clockIn)}</td>
                      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                        {entry.clockOut ? formatDateTime(entry.clockOut) : 'Still clocked in'}
                      </td>
                      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                        {entry.hoursWorked ? `${entry.hoursWorked.toFixed(1)}h` : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          {entry.needsReview ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
                              ⚠ Needs Review
                            </span>
                          ) : entry.adminCorrected ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                              ✏️ Corrected
                            </span>
                          ) : entry.isAutoClockOut ? (
                            <span 
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200"
                              title={entry.autoClockOutReason || 'Auto clock-out'}
                            >
                              🕐 Auto
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                              ✓ Manual
                            </span>
                          )}
                          {entry.originalClockOut && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Original: {formatDateTime(entry.originalClockOut)}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

          </div>
        </>
      )}

      {/* Employee Management Tab */}
      {activeTab === 'employees' && (
        <EmployeeManagement onEmployeeChange={handleEmployeeChange} />
      )}

      {/* Auto Clock-out Management Tab */}
      {activeTab === 'auto-clockout' && (
        <AutoClockoutManagement adminId={admin.id} />
      )}

      {/* Time Corrections Tab */}
      {activeTab === 'time-corrections' && (
        <TimeCorrectionManagement adminId={admin.id} />
      )}
    </div>
  );
}