'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { ThemeToggle } from '@/components/theme-toggle';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await apiClient.login(pin);
      
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        // Store employee info in localStorage (simple session management)
        localStorage.setItem('currentEmployee', JSON.stringify(result.data.employee));
        
        // Redirect to appropriate dashboard
        if (result.data.employee.isAdmin) {
          router.push('/admin');
        } else {
          router.push('/clock');
        }
      }
    } catch (error) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (digit: string) => {
    console.log('Button clicked:', digit, 'Current PIN length:', pin.length);
    if (pin.length < 4) {
      setPin(prev => {
        const newPin = prev + digit;
        console.log('New PIN:', newPin);
        return newPin;
      });
      setError(''); // Clear error when typing
    }
  };

  const clearPin = () => {
    setPin('');
    setError('');
  };

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const key = event.key;
      
      if (key >= '0' && key <= '9') {
        handlePinInput(key);
      } else if (key === 'Backspace' || key === 'Delete') {
        if (pin.length > 0) {
          setPin(prev => prev.slice(0, -1));
          setError('');
        }
      } else if (key === 'Enter') {
        if (pin.length === 4) {
          handleLogin();
        }
      } else if (key === 'Escape') {
        clearPin();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [pin]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800 dark:text-gray-100">
          Employee Login
        </h1>
        
        {/* PIN Display */}
        <div className="mb-6">
          <div className="text-center mb-4">
            <span className="text-lg text-gray-600 dark:text-gray-300">Enter your PIN:</span>
          </div>
          <div className="flex justify-center space-x-2 mb-4">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className="w-12 h-12 border-2 border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-2xl text-gray-800 dark:text-gray-200"
              >
                {pin[i] ? '*' : ''}
              </div>
            ))}
          </div>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => (
            <button
              key={digit}
              onClick={() => handlePinInput(digit.toString())}
              className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 dark:active:bg-blue-800 text-white text-xl font-bold py-4 px-6 rounded-lg transition-colors transform active:scale-95"
            >
              {digit}
            </button>
          ))}
          <button
            onClick={clearPin}
            className="bg-red-500 hover:bg-red-600 active:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 dark:active:bg-red-800 text-white text-lg font-bold py-4 px-6 rounded-lg transition-colors transform active:scale-95"
          >
            Clear
          </button>
          <button
            onClick={() => handlePinInput('0')}
            className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 dark:active:bg-blue-800 text-white text-xl font-bold py-4 px-6 rounded-lg transition-colors transform active:scale-95"
          >
            0
          </button>
          <button
            onClick={handleLogin}
            disabled={pin.length !== 4 || loading}
            className={`text-white text-lg font-bold py-4 px-6 rounded-lg transition-colors transform active:scale-95 ${
              pin.length === 4 && !loading
                ? 'bg-green-500 hover:bg-green-600 active:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 dark:active:bg-green-800' 
                : 'bg-gray-400 dark:bg-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-red-500 dark:text-red-400 text-center mb-4">
            {error}
          </div>
        )}

        {/* Instructions */}
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
          <p className="text-xs">
            Use keyboard: 0-9 to enter, Backspace to delete, Enter to login, Escape to clear
          </p>
        </div>
      </div>
    </div>
  );
}