import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import Employee from '@/lib/models/Employee';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    const { pin } = body;

    if (!pin || pin.length !== 4) {
      return NextResponse.json(
        { error: 'Invalid PIN format' },
        { status: 400 }
      );
    }

    // Find employee by PIN (check both legacy pin and new pinHash fields)
    const employees = await Employee.find({});
    let authenticatedEmployee = null;

    for (const employee of employees) {
      let isMatch = false;
      
      // Try new pinHash field first
      if (employee.pinHash) {
        isMatch = await bcrypt.compare(pin, employee.pinHash);
      }
      // Fallback to legacy pin field for existing employees
      else if (employee.pin) {
        isMatch = await bcrypt.compare(pin, employee.pin);
      }
      
      if (isMatch) {
        authenticatedEmployee = employee;
        break;
      }
    }

    if (!authenticatedEmployee) {
      return NextResponse.json(
        { error: 'Invalid PIN' },
        { status: 401 }
      );
    }

    // Return employee data (excluding sensitive info)
    const { pin: _, ...employeeData } = authenticatedEmployee.toObject();
    
    return NextResponse.json({
      employee: {
        id: employeeData._id,
        name: employeeData.name,
        isAdmin: employeeData.isAdmin
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}