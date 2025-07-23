'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';

interface AdminDashboardProps {
  adminId: string;
}

export function AdminDashboardOverview({ adminId }: AdminDashboardProps) {
  const [activeEmployees, setActiveEmployees] = useState<any>(null);
  const [needsReviewCount, setNeedsReviewCount] = useState(0);
  const [autoClockoutStatus, setAutoClockoutStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    loadDashboardData();
    
    // Update current time every minute
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    // Refresh dashboard data every 5 minutes
    const dataInterval = setInterval(loadDashboardData, 5 * 60 * 1000);

    return () => {
      clearInterval(timeInterval);
      clearInterval(dataInterval);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      const [activeResult, reviewResult, autoClockoutResult] = await Promise.all([
        apiClient.getActiveEmployees(false),
        apiClient.getEntriesNeedingReview(undefined, 'today', 'needs-review'),
        apiClient.getAutoClockoutStatus()
      ]);

      if (activeResult.data) {
        setActiveEmployees(activeResult.data);
      }

      if (reviewResult.data) {
        setNeedsReviewCount(reviewResult.data.stats.totalNeedsReview);
      }

      if (autoClockoutResult.data) {
        setAutoClockoutStatus(autoClockoutResult.data);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeUntilClosing = (milliseconds: number): string => {
    if (milliseconds <= 0) return 'Past closing time';
    
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m until auto clock-out`;
    }
    return `${minutes}m until auto clock-out`;
  };

  const getPriorityAlerts = () => {
    const alerts = [];
    
    if (needsReviewCount > 0) {
      alerts.push({
        type: 'error',
        title: 'Time Corrections Needed',
        message: `${needsReviewCount} time entries need review`,
        action: 'Review Now',
        priority: 1
      });
    }

    if (autoClockoutStatus?.shouldAutoClockout && activeEmployees?.count > 0) {
      alerts.push({
        type: 'warning',
        title: 'Overdue Auto Clock-out',
        message: `${activeEmployees.count} employees still clocked in past closing time`,
        action: 'Clock Out Now',
        priority: 2
      });
    }

    if (activeEmployees?.stats?.longestShift > 10) {
      alerts.push({
        type: 'warning',
        title: 'Long Shift Alert',
        message: `An employee has been clocked in for ${activeEmployees.stats.longestShift.toFixed(1)} hours`,
        action: 'Review Shifts',
        priority: 3
      });
    }

    return alerts.sort((a, b) => a.priority - b.priority);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="animate-pulse">Loading dashboard...</div>
      </div>
    );
  }

  const alerts = getPriorityAlerts();

  return (
    <div className="space-y-6">
      {/* Current Time & Status */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-lg shadow-lg p-6 text-white">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">
              {currentTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              })}
            </h2>
            <p className="text-blue-100">
              {currentTime.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">
              {activeEmployees?.count || 0} Active
            </div>
            <div className="text-blue-100 text-sm">
              {autoClockoutStatus && (
                autoClockoutStatus.shouldAutoClockout ? 'Past closing time' : 
                formatTimeUntilClosing(new Date(autoClockoutStatus.nextClockoutTime).getTime() - currentTime.getTime())
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Priority Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Priority Alerts</h3>
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`rounded-lg p-4 border-l-4 ${
                alert.type === 'error' 
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-800 dark:text-red-200'
                  : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 text-yellow-800 dark:text-yellow-200'
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-semibold">{alert.title}</h4>
                  <p className="text-sm">{alert.message}</p>
                </div>
                <button
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    alert.type === 'error'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  }`}
                >
                  {alert.action}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {activeEmployees?.stats?.totalActive || 0}
          </div>
          <div className="text-gray-600 dark:text-gray-300 text-sm">Currently Active</div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {needsReviewCount}
          </div>
          <div className="text-gray-600 dark:text-gray-300 text-sm">Need Review</div>
        </div>
        
      </div>

      {/* Currently Active Employees */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Currently Clocked In ({activeEmployees?.count || 0})
          </h3>
          <button
            onClick={loadDashboardData}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm"
          >
            Refresh
          </button>
        </div>
        
        {activeEmployees?.employees && activeEmployees.employees.length > 0 ? (
          <div className="space-y-3">
            {activeEmployees.employees.map((employee: any, index: number) => (
              <div
                key={index}
                className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    employee.isAdmin ? 'bg-purple-500' : 'bg-green-500'
                  }`}></div>
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
                      Clocked in at {employee.clockIn}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {employee.hours}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    on the clock
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <div className="text-4xl mb-2">🏢</div>
            <div>No employees currently clocked in</div>
          </div>
        )}
      </div>

    </div>
  );
}