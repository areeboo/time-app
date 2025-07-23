import bcrypt from 'bcryptjs';
import connectDB from '../lib/mongodb';
import Employee from '../lib/models/Employee';
import TimeEntry from '../lib/models/TimeEntry';

async function seedDatabase() {
  try {
    await connectDB();
    
    // Clear existing data
    await Employee.deleteMany({});
    await TimeEntry.deleteMany({});
    
    console.log('🗑️  Cleared existing employees and time entries');
    
    // Create sample employees with hashed PINs
    const employeeData = [
      { name: 'Sample Employee 1', pin: '1111', isAdmin: false },
      { name: 'Sample Employee 2', pin: '2222', isAdmin: true },
      { name: 'Sample Employee 3', pin: '3333', isAdmin: false },
      { name: 'Sample Employee 4', pin: '4444', isAdmin: false },
      { name: 'Sample Employee 5', pin: '5555', isAdmin: false },
      { name: 'Sample Employee 6', pin: '6666', isAdmin: true },
      { name: 'Sample Employee 7', pin: '7777', isAdmin: false },
      { name: 'Sample Employee 8', pin: '8888', isAdmin: false }
    ];

    // Hash PINs and create employees
    const employees = await Promise.all(employeeData.map(async (emp) => ({
      name: emp.name,
      pinHash: await bcrypt.hash(emp.pin, 10),
      adminPin: emp.pin,
      isAdmin: emp.isAdmin
    })));
    
    const createdEmployees = await Employee.insertMany(employees);
    console.log(`✅ Created ${createdEmployees.length} employees`);
    
    // Create sample time entries for the past few weeks
    const timeEntries = [];
    const now = new Date();
    
    for (const employee of createdEmployees) {
      // Create 5-8 time entries per employee over the past 3 weeks
      const numEntries = Math.floor(Math.random() * 4) + 5; // 5-8 entries
      
      for (let i = 0; i < numEntries; i++) {
        // Random day in the past 3 weeks
        const daysAgo = Math.floor(Math.random() * 21) + 1;
        const entryDate = new Date(now);
        entryDate.setDate(entryDate.getDate() - daysAgo);
        
        // Random start time between 7 AM and 2 PM
        const startHour = Math.floor(Math.random() * 8) + 7;
        const startMinute = Math.floor(Math.random() * 60);
        
        const clockIn = new Date(entryDate);
        clockIn.setHours(startHour, startMinute, 0, 0);
        
        // Most entries should be complete (80% chance)
        const shouldComplete = Math.random() < 0.8;
        let clockOut = null;
        
        if (shouldComplete) {
          // Work 6-10 hours
          const workHours = Math.floor(Math.random() * 5) + 6;
          const workMinutes = Math.floor(Math.random() * 60);
          clockOut = new Date(clockIn);
          clockOut.setHours(clockIn.getHours() + workHours, clockIn.getMinutes() + workMinutes);
        }
        
        timeEntries.push({
          employeeId: employee._id,
          clockIn,
          clockOut
        });
      }
    }
    
    // Add a few current "clocked in" sessions
    const activeEmployees = createdEmployees.slice(0, 3);
    for (const employee of activeEmployees) {
      const today = new Date();
      const clockIn = new Date(today);
      clockIn.setHours(9, 0, 0, 0); // Started at 9 AM today
      
      timeEntries.push({
        employeeId: employee._id,
        clockIn,
        clockOut: null
      });
    }
    
    await TimeEntry.insertMany(timeEntries);
    console.log(`✅ Created ${timeEntries.length} time entries`);
    
    console.log('✅ Database seeded successfully!');
    console.log('📝 Sample accounts:');
    employeeData.forEach((emp) => {
      console.log(`   ${emp.isAdmin ? 'Admin' : 'Employee'}: ${emp.name} (PIN: ${emp.pin})`);
    });
    console.log(`📊 Generated ${timeEntries.length} time entries with historical data`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();