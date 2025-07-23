'use client';

import { useState, useEffect } from 'react';
import { apiClient, Employee } from '@/lib/api';
import { EmployeeReviewCard } from '@/components/employee-review-card';
import { Dropdown } from '@/components/ui/dropdown';

interface EmployeeGroup {
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
}

interface Stats {
  totalNeedsReview: number;
  totalEmployeesWithReviews: number;
  totalHoursNeedingReview: number;
}

interface TimeCorrectionProps {
  adminId: string;
}

export function TimeCorrectionManagement({ adminId }: TimeCorrectionProps) {
  const [employeeGroups, setEmployeeGroups] = useState<EmployeeGroup[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('all');
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [globalBatchTime, setGlobalBatchTime] = useState('');
  const [globalBatchNotes, setGlobalBatchNotes] = useState('');

  useEffect(() => {
    loadEmployeeGroups();
    loadEmployees();
  }, []);

  useEffect(() => {
    loadEmployeeGroups();
  }, [selectedEmployeeFilter]);

  const loadEmployees = async () => {
    try {
      const result = await apiClient.getEmployees();
      if (result.data) {
        setEmployees(result.data.employees);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadEmployeeGroups = async () => {
    setLoading(true);
    try {
      const employeeId = selectedEmployeeFilter === 'all' ? undefined : selectedEmployeeFilter;
      const result = await apiClient.getGroupedEntriesNeedingReview(employeeId);
      if (result.data) {
        setEmployeeGroups(result.data.employeeGroups);
        setStats(result.data.stats);
      }
    } catch (error) {
      console.error('Error loading employee groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalBatchApprove = async () => {
    if (selectedEmployees.size === 0) return;
    
    setLoading(true);
    try {
      // Get all entry IDs from selected employees
      const entryIds: string[] = [];
      employeeGroups
        .filter(emp => selectedEmployees.has(emp._id))
        .forEach(emp => {
          emp.entries.forEach(entry => entryIds.push(entry.id));
        });
      
      await apiClient.batchCorrectEntries(
        'mark-correct',
        entryIds,
        adminId,
        undefined,
        globalBatchNotes || undefined
      );
      
      setSelectedEmployees(new Set());
      setGlobalBatchNotes('');
      loadEmployeeGroups();
    } catch (error) {
      console.error('Global batch approve error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalBatchCorrect = async () => {
    if (selectedEmployees.size === 0 || !globalBatchTime) return;
    
    setLoading(true);
    try {
      // Get all entry IDs from selected employees
      const entryIds: string[] = [];
      employeeGroups
        .filter(emp => selectedEmployees.has(emp._id))
        .forEach(emp => {
          emp.entries.forEach(entry => entryIds.push(entry.id));
        });
      
      await apiClient.batchCorrectEntries(
        'batch-correct',
        entryIds,
        adminId,
        globalBatchTime,
        globalBatchNotes || undefined
      );
      
      setSelectedEmployees(new Set());
      setGlobalBatchTime('');
      setGlobalBatchNotes('');
      loadEmployeeGroups();
    } catch (error) {
      console.error('Global batch correct error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleEmployeeSelection = (employeeId: string) => {
    const newSelection = new Set(selectedEmployees);
    if (newSelection.has(employeeId)) {
      newSelection.delete(employeeId);
    } else {
      newSelection.add(employeeId);
    }
    setSelectedEmployees(newSelection);
  };

  const selectAllEmployees = () => {
    if (selectedEmployees.size === employeeGroups.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(employeeGroups.map(emp => emp._id)));
    }
  };

  if (loading && employeeGroups.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="animate-pulse">Loading employee reviews...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              Employee Time Reviews
            </h2>
            {stats && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {stats.totalNeedsReview} entries from {stats.totalEmployeesWithReviews} employees • {stats.totalHoursNeedingReview.toFixed(1)}h total
              </p>
            )}
          </div>
          
          <button
            onClick={loadEmployeeGroups}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-4">
          <Dropdown
            label="Employee Filter:"
            value={selectedEmployeeFilter}
            options={[
              { value: 'all', label: 'All Employees' },
              ...employees.map((emp) => ({
                value: emp.id,
                label: emp.name + (emp.isAdmin ? ' (Admin)' : '')
              }))
            ]}
            onChange={setSelectedEmployeeFilter}
            className="min-w-[200px]"
          />
        </div>

        {/* Global Batch Operations */}
        {selectedEmployees.size > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-3">
              Global Batch Operations ({selectedEmployees.size} employees selected)
            </h3>
            
            <div className="flex flex-wrap gap-3 items-end">
              <button
                onClick={selectAllEmployees}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm underline"
                disabled={loading}
              >
                {selectedEmployees.size === employeeGroups.length ? 'Deselect All' : 'Select All Visible'}
              </button>
              
              <div className="flex gap-2">
                <input
                  type="time"
                  value={globalBatchTime}
                  onChange={(e) => setGlobalBatchTime(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  disabled={loading}
                />
                <input
                  type="text"
                  placeholder="Global notes (optional)"
                  value={globalBatchNotes}
                  onChange={(e) => setGlobalBatchNotes(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  disabled={loading}
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleGlobalBatchApprove}
                  disabled={loading}
                  className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  Approve All Selected
                </button>
                <button
                  onClick={handleGlobalBatchCorrect}
                  disabled={!globalBatchTime || loading}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  Correct All Selected
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Employee Cards */}
      {employeeGroups.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-2">
            No Reviews Needed
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {selectedEmployeeFilter === 'all' 
              ? 'All time entries have been reviewed and approved.'
              : 'This employee has no entries needing review.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {employeeGroups.map((employee) => (
            <div key={employee._id} className="relative">
              <div className="absolute left-4 top-4 z-10">
                <input
                  type="checkbox"
                  checked={selectedEmployees.has(employee._id)}
                  onChange={() => toggleEmployeeSelection(employee._id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <div className="pl-8">
                <EmployeeReviewCard
                  employee={employee}
                  adminId={adminId}
                  onUpdate={loadEmployeeGroups}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}