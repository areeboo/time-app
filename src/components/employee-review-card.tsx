'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';

interface ReviewEntry {
  id: string;
  clockIn: string;
  clockOut: string;
  hoursWorked: number;
  isAutoClockOut: boolean;
  autoClockOutReason?: string;
  originalClockOut?: string;
  daysSinceReview: number;
  updatedAt: string;
}

interface EmployeeGroup {
  _id: string;
  employeeName: string;
  isAdmin: boolean;
  totalEntries: number;
  totalHours: number;
  oldestReviewDays: number;
  avgDaysSinceReview: number;
  priority: 'high' | 'medium' | 'low';
  entries: ReviewEntry[];
}

interface EmployeeReviewCardProps {
  employee: EmployeeGroup;
  adminId: string;
  onUpdate: () => void;
}

export function EmployeeReviewCard({ employee, adminId, onUpdate }: EmployeeReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [batchTime, setBatchTime] = useState('');
  const [batchNotes, setBatchNotes] = useState('');

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'medium': return 'border-orange-500 bg-orange-50 dark:bg-orange-900/20';
      default: return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return 'High Priority (3+ days)';
      case 'medium': return 'Medium Priority (1-2 days)';
      default: return 'Recent (< 1 day)';
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const toggleEntrySelection = (entryId: string) => {
    const newSelection = new Set(selectedEntries);
    if (newSelection.has(entryId)) {
      newSelection.delete(entryId);
    } else {
      newSelection.add(entryId);
    }
    setSelectedEntries(newSelection);
  };

  const selectAllEntries = () => {
    if (selectedEntries.size === employee.entries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(employee.entries.map(entry => entry.id)));
    }
  };

  const handleBatchApprove = async () => {
    if (selectedEntries.size === 0) return;
    
    setLoading(true);
    try {
      await apiClient.batchCorrectEntries(
        'mark-correct',
        Array.from(selectedEntries),
        adminId,
        undefined,
        batchNotes || undefined
      );
      setSelectedEntries(new Set());
      setBatchNotes('');
      onUpdate();
    } catch (error) {
      console.error('Batch approve error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchCorrect = async () => {
    if (selectedEntries.size === 0 || !batchTime) return;
    
    setLoading(true);
    try {
      await apiClient.batchCorrectEntries(
        'batch-correct',
        Array.from(selectedEntries),
        adminId,
        batchTime,
        batchNotes || undefined
      );
      setSelectedEntries(new Set());
      setBatchTime('');
      setBatchNotes('');
      onUpdate();
    } catch (error) {
      console.error('Batch correct error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIndividualCorrect = async (entryId: string, clockOut: string) => {
    setLoading(true);
    try {
      await apiClient.correctTimeEntry(entryId, adminId, clockOut);
      onUpdate();
    } catch (error) {
      console.error('Individual correct error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIndividualApprove = async (entryId: string) => {
    setLoading(true);
    try {
      await apiClient.correctTimeEntry(entryId, adminId, undefined, undefined, true);
      onUpdate();
    } catch (error) {
      console.error('Individual approve error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`rounded-lg border-l-4 p-6 shadow-lg ${getPriorityColor(employee.priority)}`}>
      {/* Employee Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              {employee.employeeName}
              {employee.isAdmin && (
                <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 px-2 py-1 rounded">
                  Admin
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {getPriorityText(employee.priority)} • {employee.totalEntries} entries • {employee.totalHours.toFixed(1)}h total
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <span className="text-lg font-bold text-gray-700 dark:text-gray-300">
            {employee.totalEntries}
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 px-3 py-1 rounded text-sm border border-blue-300 dark:border-blue-600"
            disabled={loading}
          >
            {isExpanded ? 'Collapse' : 'Review'}
          </button>
        </div>
      </div>

      {/* Expanded Review Interface */}
      {isExpanded && (
        <div className="mt-6 space-y-4">
          {/* Batch Operations */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-3">
              Batch Operations ({selectedEntries.size} selected)
            </h4>
            
            <div className="flex flex-wrap gap-3 items-end">
              <button
                onClick={selectAllEntries}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm underline"
                disabled={loading}
              >
                {selectedEntries.size === employee.entries.length ? 'Deselect All' : 'Select All'}
              </button>
              
              <div className="flex gap-2">
                <input
                  type="time"
                  value={batchTime}
                  onChange={(e) => setBatchTime(e.target.value)}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  disabled={loading}
                />
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  disabled={loading}
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleBatchApprove}
                  disabled={selectedEntries.size === 0 || loading}
                  className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-3 py-1 rounded text-sm"
                >
                  Approve Selected
                </button>
                <button
                  onClick={handleBatchCorrect}
                  disabled={selectedEntries.size === 0 || !batchTime || loading}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-3 py-1 rounded text-sm"
                >
                  Correct Selected
                </button>
              </div>
            </div>
          </div>

          {/* Individual Entries */}
          <div className="space-y-2">
            {employee.entries.map((entry) => (
              <div key={entry.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedEntries.has(entry.id)}
                      onChange={() => toggleEntrySelection(entry.id)}
                      className="rounded"
                      disabled={loading}
                    />
                    
                    <div className="text-sm">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {formatDate(entry.clockIn)} • {entry.hoursWorked.toFixed(1)}h
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">
                        In: {formatDateTime(entry.clockIn)} → Out: {formatDateTime(entry.clockOut)}
                      </div>
                      {entry.isAutoClockOut && (
                        <div className="text-orange-600 dark:text-orange-400 text-xs">
                          Auto: {entry.autoClockOutReason} • {entry.daysSinceReview} days ago
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      disabled={loading}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleIndividualCorrect(entry.id, e.target.value);
                        }
                      }}
                    />
                    <button
                      onClick={() => handleIndividualApprove(entry.id)}
                      disabled={loading}
                      className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-2 py-1 rounded text-xs"
                    >
                      ✓
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}