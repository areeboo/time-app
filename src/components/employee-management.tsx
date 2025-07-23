'use client';

import { useState, useEffect } from 'react';
import { Employee, apiClient } from '@/lib/api';

interface EmployeeManagementProps {
  onEmployeeChange: () => void;
}

export function EmployeeManagement({ onEmployeeChange }: EmployeeManagementProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    pin: '',
    isAdmin: false
  });
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadEmployees();
  }, []);

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

  const resetForm = () => {
    setFormData({ name: '', pin: '', isAdmin: false });
    setAdminPassword('');
    setError('');
    setEditingEmployee(null);
    setShowAddForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    if (!editingEmployee && (!formData.pin || formData.pin.length !== 4)) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    if (formData.pin && (formData.pin.length !== 4 || !/^\d{4}$/.test(formData.pin))) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    if (formData.isAdmin && adminPassword !== '1234') {
      setError('Incorrect admin password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let result;
      if (editingEmployee) {
        // Update existing employee
        const updateData: any = {
          name: formData.name.trim(),
          isAdmin: formData.isAdmin
        };
        if (formData.pin) {
          updateData.pin = formData.pin;
        }
        result = await apiClient.updateEmployee(editingEmployee.id, updateData);
      } else {
        // Create new employee
        result = await apiClient.createEmployee({
          name: formData.name.trim(),
          pin: formData.pin,
          isAdmin: formData.isAdmin
        });
      }

      if (result.error) {
        setError(result.error);
      } else {
        resetForm();
        loadEmployees();
        onEmployeeChange();
      }
    } catch (error) {
      setError('Operation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      pin: '',
      isAdmin: employee.isAdmin
    });
    setShowAddForm(true);
  };

  const handleDelete = async (employee: Employee) => {
    if (!confirm(`Are you sure you want to delete ${employee.name}? This will also delete all their time entries.`)) {
      return;
    }

    setLoading(true);
    try {
      const result = await apiClient.deleteEmployee(employee.id);
      if (result.error) {
        setError(result.error);
      } else {
        loadEmployees();
        onEmployeeChange();
      }
    } catch (error) {
      setError('Delete failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (value: string) => {
    if (/^\d*$/.test(value) && value.length <= 4) {
      setFormData({ ...formData, pin: value });
      setError('');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          Employee Management
        </h2>
        <button
          onClick={() => setShowAddForm(true)}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Add Employee
        </button>
      </div>

      {error && (
        <div className="mb-4 text-red-500 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="mb-6 p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
            {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                maxLength={50}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                PIN (4 digits) {editingEmployee && '(leave blank to keep current)'}
              </label>
              <input
                type="password"
                value={formData.pin}
                onChange={(e) => handlePinInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                maxLength={4}
                placeholder="0000"
                required={!editingEmployee}
              />
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.isAdmin}
                  onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Admin privileges
                </span>
              </label>
            </div>

            {formData.isAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Admin Password
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="Enter admin password"
                  required
                />
              </div>
            )}

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {loading ? 'Saving...' : (editingEmployee ? 'Update' : 'Create')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={loading}
                className="bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Employee List */}
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Name</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">PIN</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Role</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Created</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No employees found.
                </td>
              </tr>
            ) : (
              employees.map((employee) => (
                <EmployeeRow 
                  key={employee.id} 
                  employee={employee} 
                  loading={loading}
                  onEdit={() => handleEdit(employee)}
                  onDelete={() => handleDelete(employee)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmployeeRow({ 
  employee, 
  loading, 
  onEdit, 
  onDelete 
}: { 
  employee: Employee & { pin?: string; createdAt?: string }; 
  loading: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showPin, setShowPin] = useState(false);

  const handleTogglePin = () => {
    setShowPin(!showPin);
  };

  return (
    <tr className="border-b border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
        {employee.name}
      </td>
      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
        <div className="flex items-center space-x-2">
          <span className="font-mono">
            {showPin ? (employee.pin || 'N/A') : '****'}
          </span>
          <button
            onClick={handleTogglePin}
            className="text-blue-500 hover:text-blue-700 text-xs underline"
          >
            {showPin ? 'Hide' : 'Show'}
          </button>
        </div>
      </td>
      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
        <span className={`px-2 py-1 rounded-full text-xs ${
          employee.isAdmin 
            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
        }`}>
          {employee.isAdmin ? 'Admin' : 'Employee'}
        </span>
      </td>
      <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
        {employee.createdAt ? new Date(employee.createdAt).toLocaleDateString() : 'N/A'}
      </td>
      <td className="py-3 px-4">
        <div className="flex space-x-2">
          <button
            onClick={onEdit}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
          >
            Edit
          </button>
          {!employee.isAdmin && (
            <button
              onClick={onDelete}
              disabled={loading}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}