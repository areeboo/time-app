import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import Employee from '@/lib/models/Employee';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const { name, pin } = await request.json();

    // Check if any employees already exist
    const existingEmployees = await Employee.countDocuments();
    if (existingEmployees > 0) {
      return NextResponse.json(
        { error: 'Database already contains employees. Bootstrap is only available for empty databases.' },
        { status: 400 }
      );
    }

    // Validate input
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

    // Hash the PIN for authentication
    const hashedPin = await bcrypt.hash(pin, 10);

    // Create the initial admin with dual PIN storage
    const admin = new Employee({
      name: name.trim(),
      pinHash: hashedPin,    // For authentication
      adminPin: pin,         // For admin viewing
      isAdmin: true
    });

    await admin.save();

    return NextResponse.json({
      message: 'Bootstrap admin created successfully',
      admin: {
        id: admin._id,
        name: admin.name,
        isAdmin: admin.isAdmin
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Bootstrap error:', error);
    return NextResponse.json(
      { error: 'Failed to create bootstrap admin' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await connectDB();
    
    const employeeCount = await Employee.countDocuments();
    
    return NextResponse.json({
      canBootstrap: employeeCount === 0,
      employeeCount,
      message: employeeCount === 0 
        ? 'Database is empty. Bootstrap admin can be created.' 
        : 'Database contains employees. Bootstrap not available.'
    });
  } catch (error) {
    console.error('Bootstrap check error:', error);
    return NextResponse.json(
      { error: 'Failed to check bootstrap status' },
      { status: 500 }
    );
  }
}