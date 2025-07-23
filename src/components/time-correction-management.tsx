'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Dropdown } from '@/components/ui/dropdown';

interface TimeEntry {
  id: string;
  employee: {
    _id: string;
    name: string;
  };
  clockIn: string;
  clockOut: string;
  hoursWorked: number;
  isAutoClockOut: boolean;
  autoClockOutReason?: string;
  needsReview: boolean;
  originalClockOut?: string;
  adminCorrected: boolean;
  correctedBy?: {
    _id: string;
    name: string;
  };
  correctedAt?: string;
  adminNotes?: string;
}

interface TimeCorrectionProps {
  adminId: string;
}

export function TimeCorrectionManagement({ adminId }: TimeCorrectionProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('needs-review');
  const [periodFilter, setPeriodFilter] = useState<string>('today');
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [correctionTime, setCorrectionTime] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    loadEntries();
  }, [statusFilter, periodFilter]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/timeentries/needs-review?status=${statusFilter}&period=${periodFilter}`);
      const data = await response.json();
      
      if (response.ok) {
        setEntries(data.entries || []);
        setStats(data.stats || {});
      } else {
        console.error('Failed to load entries:', data.error);
      }
    } catch (error) {
      console.error('Error loading entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCorrectTime = async (entryId: string, newClockOut?: string, markCorrect = false) => {
    try {
      const response = await fetch(`/api/timeentries/${entryId}/correct`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clockOut: newClockOut,
          adminEmployeeId: adminId,
          adminNotes: adminNotes || undefined,
          markAsCorrect: markCorrect
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        // Refresh the entries list
        await loadEntries();
        setEditingEntry(null);
        setCorrectionTime('');
        setAdminNotes('');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Correction error:', error);
      alert('Failed to correct time entry');
    }
  };

  const handleBatchAction = async (action: string) => {
    if (selectedEntries.size === 0) {
      alert('Please select entries to process');
      return;
    }

    try {
      const response = await fetch('/api/timeentries/needs-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          entryIds: Array.from(selectedEntries),
          adminEmployeeId: adminId,
          adminNotes: adminNotes || undefined
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        await loadEntries();
        setSelectedEntries(new Set());
        setAdminNotes('');
        alert(data.message);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Batch action error:', error);
      alert('Failed to perform batch action');
    }
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

  const selectAll = () => {
    const needsReviewEntries = entries.filter(entry => entry.needsReview);
    if (selectedEntries.size === needsReviewEntries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(needsReviewEntries.map(entry => entry.id)));
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatTimeForInput = (dateStr: string) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const getStatusBadge = (entry: TimeEntry) => {
    if (entry.adminCorrected && !entry.needsReview) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
          ✓ Corrected
        </span>
      );
    }
    if (entry.needsReview) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
          ⚠ Needs Review
        </span>
      );
    }
    if (entry.isAutoClockOut) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200">
          🕐 Auto
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
        ✓ Manual
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Time Correction Dashboard</h2>
        
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {stats.totalNeedsReview}
              </div>
              <div className="text-red-800 dark:text-red-300">Need Review</div>
            </div>
            
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {stats.autoClockoutsNeedingReview}
              </div>
              <div className="text-orange-800 dark:text-orange-300">Auto-Clockouts</div>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.correctedToday}
              </div>
              <div className="text-green-800 dark:text-green-300">Corrected Today</div>
            </div>
          </div>
        )}

        {/* Filters and Controls */}
        <div className="flex flex-wrap gap-6 items-end mb-4">
          <Dropdown
            label="Status:"
            value={statusFilter}
            options={[
              { value: 'needs-review', label: 'Needs Review' },
              { value: 'auto-clockouts', label: 'All Auto-Clockouts' },
              { value: 'corrected', label: 'Corrected Entries' },
              { value: 'all', label: 'All Entries' }
            ]}
            onChange={setStatusFilter}
            className="min-w-[180px]"
          />
          
          <Dropdown
            label="Period:"
            value={periodFilter}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'This Week' },
              { value: 'month', label: 'This Month' }
            ]}
            onChange={setPeriodFilter}
            className="min-w-[140px]"
          />

          <button
            onClick={loadEntries}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Batch Actions */}
        {selectedEntries.size > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <span className="text-blue-800 dark:text-blue-200 font-medium">
                {selectedEntries.size} entries selected
              </span>
              
              <input
                type="text"
                placeholder="Admin notes (optional)"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="border border-blue-300 dark:border-blue-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 flex-1 min-w-64"
              />
              
              <button
                onClick={() => handleBatchAction('mark-correct')}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Mark as Correct
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Time Entries Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Time Entries</h3>
          <button
            onClick={selectAll}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm"
          >
            {selectedEntries.size === entries.filter(e => e.needsReview).length ? 'Deselect All' : 'Select All Needs Review'}
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-600">
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Select</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Employee</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Clock In</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Clock Out</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Hours</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500 dark:text-gray-400">
                    {loading ? 'Loading...' : 'No entries found for the selected criteria.'}
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="py-3 px-4">
                      {entry.needsReview && (
                        <input
                          type="checkbox"
                          checked={selectedEntries.has(entry.id)}
                          onChange={() => toggleEntrySelection(entry.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                      <div>
                        <div className="font-medium">{entry.employee.name}</div>
                        {entry.adminNotes && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Note: {entry.adminNotes}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                      {formatDateTime(entry.clockIn)}
                    </td>
                    <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                      {editingEntry === entry.id ? (
                        <div className="space-y-2">
                          <input
                            type="datetime-local"
                            value={correctionTime}
                            onChange={(e) => setCorrectionTime(e.target.value)}
                            className="border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCorrectTime(entry.id, correctionTime)}
                              className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-sm transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingEntry(null);
                                setCorrectionTime('');
                              }}
                              className="bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded text-sm transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {formatDateTime(entry.clockOut)}
                          {entry.originalClockOut && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Original: {formatDateTime(entry.originalClockOut)}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                      {entry.hoursWorked ? `${entry.hoursWorked.toFixed(1)}h` : '-'}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(entry)}
                      {entry.correctedBy && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          by {entry.correctedBy.name}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {entry.needsReview && editingEntry !== entry.id && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingEntry(entry.id);
                              setCorrectionTime(formatTimeForInput(entry.clockOut));
                            }}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-sm transition-colors"
                          >
                            Edit Time
                          </button>
                          <button
                            onClick={() => handleCorrectTime(entry.id, undefined, true)}
                            className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-sm transition-colors"
                          >
                            Mark Correct
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">How Time Corrections Work</h3>
        <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
          <li>• Auto-clockouts are automatically marked as "Needs Review"</li>
          <li>• Use "Edit Time" to correct the actual clock-out time</li>
          <li>• Use "Mark Correct" if the auto-clockout time is accurate</li>
          <li>• Select multiple entries for batch operations</li>
          <li>• Original auto-clockout times are preserved for audit trails</li>
          <li>• All corrections are logged with admin name and timestamp</li>
        </ul>
      </div>
    </div>
  );
}