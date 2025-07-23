'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Employee, TimeEntry, apiClient } from '@/lib/api';
import { ThemeToggle } from '@/components/theme-toggle';

export default function ClockPage() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const router = useRouter();

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Check if user is logged in and load data
  useEffect(() => {
    const savedEmployee = localStorage.getItem('currentEmployee');
    if (savedEmployee) {
      const emp = JSON.parse(savedEmployee);
      setEmployee(emp);
      loadEmployeeData(emp.id);
    } else {
      router.push('/login');
    }
  }, [router]);

  const loadEmployeeData = async (employeeId: string) => {
    try {
      // Check if already clocked in
      const activeResult = await apiClient.getActiveEntry(employeeId);
      if (activeResult.data) {
        setIsClockedIn(activeResult.data.isClockedIn);
        setCurrentEntry(activeResult.data.activeEntry);
      }

      // Load today's entries
      const today = new Date().toISOString().split('T')[0];
      const entriesResult = await apiClient.getTimeEntries(employeeId);
      if (entriesResult.data) {
        const todayEntries = entriesResult.data.timeEntries.filter(entry => 
          new Date(entry.clockIn).toDateString() === new Date().toDateString()
        );
        setTodayEntries(todayEntries);
      }
    } catch (error) {
      console.error('Error loading employee data:', error);
    }
  };

  const handleClockIn = async () => {
    if (!employee || loading) return;

    setLoading(true);
    try {
      const result = await apiClient.clockIn(employee.id);
      if (result.data) {
        setCurrentEntry(result.data.timeEntry);
        setIsClockedIn(true);
        // Reload today's entries
        loadEmployeeData(employee.id);
      }
    } catch (error) {
      console.error('Clock in error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!employee || !currentEntry || loading) return;

    setLoading(true);
    try {
      const result = await apiClient.clockOut(employee.id);
      if (result.data) {
        setIsClockedIn(false);
        setCurrentEntry(null);
        // Reload today's entries
        loadEmployeeData(employee.id);
      }
    } catch (error) {
      console.error('Clock out error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('currentEmployee');
    router.push('/login');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!employee) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Welcome, {employee.name}!
        </h1>
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

      {/* Current Time Display */}
      <div className="text-center mb-12">
        <div className="text-6xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          {formatTime(currentTime)}
        </div>
        <div className="text-xl text-gray-600 dark:text-gray-300">
          {formatDate(currentTime)}
        </div>
      </div>

      {/* Status */}
      <div className="text-center mb-8">
        <div className={`text-2xl font-semibold ${isClockedIn ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {isClockedIn ? 'CLOCKED IN' : 'CLOCKED OUT'}
        </div>
        {isClockedIn && currentEntry && (
          <div className="text-lg text-gray-600 dark:text-gray-300 mt-2">
            Since: {formatTime(new Date(currentEntry.clockIn))}
          </div>
        )}
      </div>

      {/* Main Action Buttons */}
      <div className="flex justify-center space-x-8">
        {!isClockedIn ? (
          <button
            onClick={handleClockIn}
            disabled={loading}
            className="bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-3xl font-bold py-12 px-20 rounded-2xl shadow-lg transition-all transform hover:scale-105 disabled:transform-none"
          >
            {loading ? 'CLOCKING IN...' : 'CLOCK IN'}
          </button>
        ) : (
          <button
            onClick={handleClockOut}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-3xl font-bold py-12 px-20 rounded-2xl shadow-lg transition-all transform hover:scale-105 disabled:transform-none"
          >
            {loading ? 'CLOCKING OUT...' : 'CLOCK OUT'}
          </button>
        )}
      </div>

      {/* Today's Summary */}
      <div className="mt-12 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Today's Summary</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {todayEntries.length}
            </div>
            <div className="text-gray-600 dark:text-gray-300">Clock-ins Today</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {todayEntries
                .filter(entry => entry.hoursWorked)
                .reduce((total, entry) => total + (entry.hoursWorked || 0), 0)
                .toFixed(1)}h
            </div>
            <div className="text-gray-600 dark:text-gray-300">Hours Worked</div>
          </div>
        </div>
      </div>
    </div>
  );
}