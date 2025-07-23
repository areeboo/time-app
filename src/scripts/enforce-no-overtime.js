#!/usr/bin/env node

/**
 * No-Overtime Policy Enforcement Script
 * 
 * This script should be run by a cron job at closing times:
 * - 8:00 PM Monday through Saturday
 * - 6:00 PM Sunday
 * 
 * Example crontab entries:
 * 0 20 * * 1-6 /path/to/node /path/to/enforce-no-overtime.js
 * 0 18 * * 0 /path/to/node /path/to/enforce-no-overtime.js
 */

const { exec } = require('child_process');
const path = require('path');

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function enforceNoOvertimePolicy() {
  try {
    console.log(`[${new Date().toISOString()}] Starting no-overtime policy enforcement...`);
    
    const response = await fetch(`${API_URL}/api/auto-clockout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'enforce-no-overtime'
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log(`[${new Date().toISOString()}] SUCCESS: No-overtime policy enforced`);
      console.log(`- Clocked out: ${result.clockedOutCount} employees`);
      console.log(`- All entries flagged for admin review`);
      
      if (result.clockedOutEmployees && result.clockedOutEmployees.length > 0) {
        console.log('Affected employees:');
        result.clockedOutEmployees.forEach(emp => {
          console.log(`  - ${emp.employeeName}: ${emp.hoursWorked.toFixed(2)} hours`);
        });
      }
    } else {
      console.error(`[${new Date().toISOString()}] ERROR: Failed to enforce no-overtime policy`);
      console.error(`- Errors: ${result.errors ? result.errors.join(', ') : 'Unknown error'}`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] CRITICAL ERROR:`, error.message);
    process.exit(1);
  }
}

// Only run if called directly (not imported)
if (require.main === module) {
  enforceNoOvertimePolicy();
}

module.exports = { enforceNoOvertimePolicy };