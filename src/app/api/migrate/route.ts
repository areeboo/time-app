import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import Employee from '@/lib/models/Employee';

export async function POST() {
  try {
    await connectDB();
    
    // Find employees with legacy format (have pin but no adminPin)
    const legacyEmployees = await Employee.find({
      pin: { $exists: true, $ne: null },
      adminPin: { $exists: false }
    });

    if (legacyEmployees.length === 0) {
      return NextResponse.json({
        message: 'No legacy employees found to migrate'
      });
    }

    const migrationResults = [];
    const commonPins = ['1234', '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '4321', '1122', '2211'];

    for (const employee of legacyEmployees) {
      console.log(`Migrating employee ${employee.name} (${employee._id})`);
      
      let foundPin = null;
      
      // Try to recover PIN from common pins
      for (const pin of commonPins) {
        const isMatch = await bcrypt.compare(pin, employee.pin);
        if (isMatch) {
          foundPin = pin;
          break;
        }
      }

      if (foundPin) {
        // Update employee with new format
        await Employee.findByIdAndUpdate(employee._id, {
          pinHash: employee.pin,  // Move old hashed pin to pinHash
          adminPin: foundPin      // Store recovered pin for admin access
        });
        
        migrationResults.push({
          id: employee._id,
          name: employee.name,
          status: 'migrated',
          pin: foundPin
        });
        
        console.log(`Successfully migrated ${employee.name} with PIN ${foundPin}`);
      } else {
        // Mark as needs manual intervention
        migrationResults.push({
          id: employee._id,
          name: employee.name,
          status: 'needs_manual_reset',
          reason: 'PIN could not be recovered'
        });
        
        console.log(`Could not recover PIN for ${employee.name} - needs manual reset`);
      }
    }

    return NextResponse.json({
      message: `Migration completed for ${legacyEmployees.length} employees`,
      results: migrationResults,
      summary: {
        total: legacyEmployees.length,
        migrated: migrationResults.filter(r => r.status === 'migrated').length,
        needsManualReset: migrationResults.filter(r => r.status === 'needs_manual_reset').length
      }
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await connectDB();
    
    const totalEmployees = await Employee.countDocuments();
    const legacyEmployees = await Employee.countDocuments({
      pin: { $exists: true, $ne: null },
      adminPin: { $exists: false }
    });
    const migratedEmployees = await Employee.countDocuments({
      pinHash: { $exists: true },
      adminPin: { $exists: true }
    });

    return NextResponse.json({
      migration_status: {
        total_employees: totalEmployees,
        legacy_employees: legacyEmployees,
        migrated_employees: migratedEmployees,
        migration_needed: legacyEmployees > 0
      }
    });

  } catch (error) {
    console.error('Migration status error:', error);
    return NextResponse.json(
      { error: 'Failed to check migration status' },
      { status: 500 }
    );
  }
}