import { NextRequest, NextResponse } from 'next/server';
import { checkAndPerformAutoClockout } from '@/lib/auto-clockout';

/**
 * POST - Cron job endpoint for automatic daily auto-clockout
 * This endpoint should be called by a cron service (like Vercel Cron, GitHub Actions, or external cron service)
 * 
 * Expected to be called every evening around closing time
 * Recommended schedule: "0 18,20 * * *" (6 PM and 8 PM daily)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify this is being called by an authorized cron service
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'auto-clockout-secret';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('Unauthorized auto-clockout cron attempt:', {
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        timestamp: new Date().toISOString()
      });
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('Auto-clockout cron job started:', {
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent')
    });
    
    // Perform the auto-clockout check and execution
    const result = await checkAndPerformAutoClockout();
    
    // Log the result for monitoring
    console.log('Auto-clockout cron job completed:', {
      ...result,
      timestamp: new Date().toISOString()
    });
    
    // Return success response for cron monitoring
    return NextResponse.json({
      success: result.success,
      message: `Auto-clockout completed: ${result.clockedOutCount} employees clocked out`,
      details: {
        clockedOutCount: result.clockedOutCount,
        errors: result.errors,
        clockedOutEmployees: result.clockedOutEmployees.map(emp => ({
          name: emp.employeeName,
          hoursWorked: emp.hoursWorked.toFixed(2)
        }))
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Auto-clockout cron job failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Auto-clockout cron job failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * GET - Health check for cron job endpoint
 */
export async function GET() {
  return NextResponse.json({
    service: 'auto-clockout-cron',
    status: 'active',
    timestamp: new Date().toISOString(),
    schedule: 'Daily at 6 PM and 8 PM',
    description: 'Automatic employee clock-out service'
  });
}