import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Employee from '@/lib/models/Employee';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

export async function GET() {
  try {
    await connectDB();
    
    const employees = await Employee.find({});
    
    // Return employees with adminPin for direct viewing
    const employeesWithAdminPins = employees.map(emp => ({
      id: emp._id,
      name: emp.name,
      isAdmin: emp.isAdmin,
      pin: emp.adminPin || '****', // Use adminPin if available, otherwise masked
      createdAt: emp.createdAt,
      updatedAt: emp.updatedAt
    }));
    
    return NextResponse.json({ employees: employeesWithAdminPins });
  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await mongoose.startSession();
  
  try {
    await connectDB();
    
    const { name, pin, isAdmin } = await request.json();

    if (!name || !pin) {
      return NextResponse.json(
        { error: 'Name and PIN are required' },
        { status: 400 }
      );
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN must be exactly 4 digits' },
        { status: 400 }
      );
    }

    let newEmployee;

    await session.withTransaction(async () => {
      // Check if PIN already exists with better indexing
      const existingByAdminPin = await Employee.findOne({ adminPin: pin }).session(session);
      if (existingByAdminPin) {
        throw new Error('PIN already exists');
      }

      // Check legacy hashed pins
      const employeesWithLegacyPins = await Employee.find({
        pin: { $exists: true },
        adminPin: { $exists: false }
      }).session(session);

      for (const employee of employeesWithLegacyPins) {
        const isMatch = await bcrypt.compare(pin, employee.pin);
        if (isMatch) {
          throw new Error('PIN already exists');
        }
      }

      // Hash the PIN for authentication
      const hashedPin = await bcrypt.hash(pin, 10);

      const employeeData = {
        name: name.trim(),
        pinHash: hashedPin,    // For authentication
        adminPin: pin,         // For admin viewing
        isAdmin: isAdmin || false
      };

      // Create employee within transaction
      const [createdEmployee] = await Employee.create([employeeData], { session });
      newEmployee = createdEmployee;
    }, {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' }
    });
    
    return NextResponse.json({
      employee: {
        id: newEmployee!._id,
        name: newEmployee!.name,
        isAdmin: newEmployee!.isAdmin,
        createdAt: newEmployee!.createdAt
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Create employee error:', error);
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === 'PIN already exists' || 
          error.message === 'PIN must be exactly 4 digits' ||
          error.message === 'Name and PIN are required') {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await session.endSession();
  }
}