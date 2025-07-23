import { redirect } from 'next/navigation';
import connectDB from '@/lib/mongodb';
import Employee from '@/lib/models/Employee';

async function checkSystemStatus() {
  try {
    await connectDB();
    const employeeCount = await Employee.countDocuments();
    
    if (employeeCount === 0) {
      redirect('/setup');
    } else {
      redirect('/login');
    }
  } catch (error) {
    redirect('/login');
  }
}

export default async function Home() {
  await checkSystemStatus();
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-4">
          Time Clock System
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-8">
          Redirecting...
        </p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
      </div>
    </div>
  );
}
