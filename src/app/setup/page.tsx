'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { ThemeToggle } from '@/components/theme-toggle';

export default function SetupPage() {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [canBootstrap, setCanBootstrap] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkBootstrapStatus();
  }, []);

  const checkBootstrapStatus = async () => {
    try {
      const result = await apiClient.checkBootstrap();
      if (result.data) {
        setCanBootstrap(result.data.canBootstrap);
        if (!result.data.canBootstrap) {
          // Database has employees, redirect to login
          router.push('/login');
        }
      }
    } catch (error) {
      setError('Failed to check system status');
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !pin) {
      setError('Please fill in all fields');
      return;
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await apiClient.createBootstrapAdmin(name.trim(), pin);
      
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        // Store admin info and redirect
        localStorage.setItem('currentEmployee', JSON.stringify(result.data.admin));
        router.push('/admin');
      }
    } catch (error) {
      setError('Failed to create admin. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (value: string) => {
    if (/^\d*$/.test(value) && value.length <= 4) {
      setPin(value);
      setError('');
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Checking system status...</p>
        </div>
      </div>
    );
  }

  if (!canBootstrap) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            System Already Initialized
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            The time clock system is already set up. Please use the login page.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            Welcome!
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Set up your Time Clock System by creating the first admin account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Admin Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter admin name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              maxLength={50}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Admin PIN (4 digits)
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => handlePinInput(e.target.value)}
              placeholder="0000"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center text-lg tracking-widest"
              maxLength={4}
              pattern="\d{4}"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Choose a 4-digit PIN you'll remember
            </p>
          </div>

          {error && (
            <div className="text-red-500 dark:text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim() || pin.length !== 4}
            className={`w-full text-white font-bold py-3 px-6 rounded-lg transition-colors ${
              loading || !name.trim() || pin.length !== 4
                ? 'bg-gray-400 dark:bg-gray-500 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'
            }`}
          >
            {loading ? 'Creating Admin...' : 'Create Admin & Start'}
          </button>
        </form>

        <div className="text-center mt-6 text-xs text-gray-500 dark:text-gray-400">
          <p>This setup only appears when the system is first installed.</p>
          <p>After creating the admin, you can add employees from the admin dashboard.</p>
        </div>
      </div>
    </div>
  );
}