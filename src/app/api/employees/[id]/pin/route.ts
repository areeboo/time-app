import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Employee from '@/lib/models/Employee';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// Get current PIN for an employee (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid employee ID' },
        { status: 400 }
      );
    }

    const employee = await Employee.findById(id);
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Return adminPin directly for instant access
    if (employee.adminPin) {
      console.log(`Returning adminPin for employee ${id}`);
      return NextResponse.json({ pin: employee.adminPin });
    }

    // Fallback for legacy employees - try brute force on old pin field
    if (employee.pin && !employee.adminPin) {
      console.log(`Legacy employee ${id} - attempting PIN recovery...`);
      
      // Try common PINs first
      const commonPins = ['1234', '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '4321', '1122', '2211'];
      
      for (const pin of commonPins) {
        const isMatch = await bcrypt.compare(pin, employee.pin);
        if (isMatch) {
          console.log(`Found common PIN ${pin} for legacy employee ${id}`);
          return NextResponse.json({ pin });
        }
      }
      
      return NextResponse.json(
        { error: 'PIN recovery not available for legacy employees. Please reset PIN.' },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: 'No PIN data available' },
      { status: 404 }
    );

  } catch (error) {
    console.error('Get PIN error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}