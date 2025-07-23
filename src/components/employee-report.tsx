'use client';

import { useState, useEffect } from 'react';
import { apiClient, Employee } from '@/lib/api';
import { Dropdown } from '@/components/ui/dropdown';

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

interface ReportData {
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
    months: MonthlyData[];
  };
  summary: {
    totalEntries: number;
    totalHours: number;
    averageHoursPerDay: number;
    daysWorked: number;
  };
}

interface EmployeeReportProps {
  adminId: string;
}

export function EmployeeReport({ adminId }: EmployeeReportProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [employeeReviewStatus, setEmployeeReviewStatus] = useState<Map<string, number>>(new Map());
  const [blockingMessage, setBlockingMessage] = useState<string>('');

  useEffect(() => {
    loadEmployees();
    loadEmployeeReviewStatus();
  }, []);

  const loadEmployees = async () => {
    try {
      const result = await apiClient.getEmployees();
      if (result.data) {
        // Filter out admin employees
        const nonAdminEmployees = result.data.employees.filter(emp => !emp.isAdmin);
        setEmployees(nonAdminEmployees);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadEmployeeReviewStatus = async () => {
    try {
      const result = await apiClient.getGroupedEntriesNeedingReview();
      if (result.data) {
        const reviewMap = new Map<string, number>();
        result.data.employeeGroups.forEach(group => {
          reviewMap.set(group._id, group.totalEntries);
        });
        setEmployeeReviewStatus(reviewMap);
      }
    } catch (error) {
      console.error('Error loading employee review status:', error);
    }
  };

  const generateReport = async () => {
    if (!selectedEmployee) return;
    
    // Check if employee has unresolved review flags
    const pendingReviews = employeeReviewStatus.get(selectedEmployee) || 0;
    if (pendingReviews > 0) {
      const employeeName = employees.find(emp => emp.id === selectedEmployee)?.name || 'this employee';
      setBlockingMessage(`Cannot generate report for ${employeeName}. This employee has ${pendingReviews} unresolved time entries that need review. Please resolve all pending reviews in the Time Corrections tab before generating reports.`);
      setReportData(null);
      return;
    }
    
    setBlockingMessage('');
    setLoading(true);
    try {
      const monthNum = selectedMonth === 'all' ? undefined : parseInt(selectedMonth);
      const result = await apiClient.getEmployeeReport(selectedEmployee, selectedYear, monthNum);
      if (result.data) {
        setReportData(result.data);
      }
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!reportData) return;
    
    const csvRows: string[] = [];
    
    // Header
    csvRows.push(`Employee Report: ${reportData.employee.name}`);
    csvRows.push(`Period: ${reportData.reportPeriod.startDate} to ${reportData.reportPeriod.endDate}`);
    csvRows.push(`Total Hours: ${reportData.summary.totalHours.toFixed(2)}`);
    csvRows.push(''); // Empty row
    
    // Headers
    csvRows.push('Date,Day,Hours');
    
    // Data
    reportData.data.months.forEach(month => {
      csvRows.push(`\n${month.monthName} ${month.year} (${month.totalHours.toFixed(2)}h total)`);
      
      month.weeks.forEach(week => {
        csvRows.push(`${week.weekLabel} (${week.totalHours.toFixed(2)}h)`);
        
        week.days.forEach(day => {
          if (day.hours > 0) {
            csvRows.push(`${day.date},${day.dayOfWeek},${day.hours.toFixed(2)}`);
          }
        });
      });
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportData.employee.name}_report_${reportData.reportPeriod.year}${reportData.reportPeriod.month ? `_${reportData.reportPeriod.month.toString().padStart(2, '0')}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const handleEmployeeChange = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    setBlockingMessage('');
    setReportData(null);
  };

  const getEmployeeOptions = () => {
    return employees.map((emp) => {
      const pendingReviews = employeeReviewStatus.get(emp.id) || 0;
      const label = pendingReviews > 0 
        ? `${emp.name} (⚠ ${pendingReviews} pending reviews)`
        : emp.name;
      
      return {
        value: emp.id,
        label: label
      };
    });
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({length: 5}, (_, i) => ({
    value: (currentYear - i).toString(),
    label: (currentYear - i).toString()
  }));

  const monthOptions = [
    { value: 'all', label: 'All Months' },
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  return (
    <div className="space-y-6">
      {/* Report Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">
          Employee Data Analysis & Reports
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <Dropdown
            label="Employee:"
            value={selectedEmployee}
            options={[
              { value: '', label: 'Select Employee' },
              ...getEmployeeOptions()
            ]}
            onChange={handleEmployeeChange}
            className="min-w-[200px]"
          />
          
          <Dropdown
            label="Year:"
            value={selectedYear.toString()}
            options={yearOptions}
            onChange={(value) => setSelectedYear(parseInt(value))}
            className="min-w-[120px]"
          />
          
          <Dropdown
            label="Month:"
            value={selectedMonth}
            options={monthOptions}
            onChange={setSelectedMonth}
            className="min-w-[150px]"
          />
          
          <div className="flex items-end gap-2">
            <button
              onClick={generateReport}
              disabled={!selectedEmployee || loading}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium"
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        {blockingMessage && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start space-x-3">
              <div className="text-red-500 dark:text-red-400 text-xl">⚠</div>
              <div>
                <h3 className="font-semibold text-red-800 dark:text-red-200 mb-1">Report Generation Blocked</h3>
                <p className="text-sm text-red-700 dark:text-red-300">{blockingMessage}</p>
              </div>
            </div>
          </div>
        )}

        {reportData && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                  {reportData.employee.name} - {reportData.data.year}
                  {reportData.reportPeriod.month && ` (${reportData.data.months[0]?.monthName})`}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {reportData.summary.totalHours.toFixed(2)} hours • {reportData.summary.daysWorked} days worked • {reportData.summary.totalEntries} entries
                </p>
              </div>
              <button
                onClick={exportToCSV}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Export CSV
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Excel-Style Report Display */}
      {reportData && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold text-gray-800 dark:text-gray-100">
                    Period
                  </th>
                  <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold text-gray-800 dark:text-gray-100">
                    Date
                  </th>
                  <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold text-gray-800 dark:text-gray-100">
                    Day
                  </th>
                  <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-right font-semibold text-gray-800 dark:text-gray-100">
                    Hours
                  </th>
                </tr>
              </thead>
              <tbody>
                {reportData.data.months.map((month) => (
                  <>
                    {/* Month Header */}
                    <tr key={`month-${month.month}`} className="bg-blue-100 dark:bg-blue-900/30">
                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-bold text-gray-800 dark:text-gray-100" colSpan={3}>
                        {month.monthName} {month.year}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-right font-bold text-gray-800 dark:text-gray-100">
                        {month.totalHours.toFixed(2)}h
                      </td>
                    </tr>
                    
                    {month.weeks.map((week) => (
                      <>
                        {/* Week Header */}
                        <tr key={`week-${month.month}-${week.weekNumber}`} className="bg-gray-50 dark:bg-gray-700">
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-medium text-gray-700 dark:text-gray-300">
                            {week.weekLabel}
                          </td>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(week.startDate)} - {formatDate(week.endDate)}
                          </td>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2"></td>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                            {week.totalHours.toFixed(2)}h
                          </td>
                        </tr>
                        
                        {/* Daily Entries */}
                        {week.days.map((day) => 
                          day.hours > 0 ? (
                            <tr key={day.date} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2"></td>
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100">
                                {formatDate(day.date)}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-900 dark:text-gray-100">
                                {day.dayOfWeek}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-right text-gray-900 dark:text-gray-100">
                                {day.hours.toFixed(2)}h
                              </td>
                            </tr>
                          ) : null
                        )}
                      </>
                    ))}
                  </>
                ))}
                
                {/* Year Total */}
                <tr className="bg-green-100 dark:bg-green-900/30">
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-bold text-gray-800 dark:text-gray-100" colSpan={3}>
                    {reportData.data.year} TOTAL
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-right font-bold text-gray-800 dark:text-gray-100">
                    {reportData.data.totalHours.toFixed(2)}h
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}