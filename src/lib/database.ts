import mongoose from 'mongoose';

/**
 * Database utility functions for handling concurrency and retries
 */

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 1000,
};

/**
 * Check if an error is transient and worth retrying
 */
function isTransientError(error: any): boolean {
  if (!error) return false;
  
  // MongoDB transient errors
  const transientCodes = [
    'ENOTFOUND',
    'ECONNRESET', 
    'ECONNREFUSED',
    'ETIMEDOUT',
    'NETWORK_ERROR',
    'TransientTransactionError',
    'UnknownTransactionCommitResult'
  ];
  
  // Check error code
  if (error.code && transientCodes.some(code => error.code.includes(code))) {
    return true;
  }
  
  // Check error message
  if (error.message && transientCodes.some(code => error.message.includes(code))) {
    return true;
  }
  
  // Mongoose specific errors
  if (error.name === 'MongoNetworkError' || 
      error.name === 'MongoTimeoutError' ||
      error.name === 'MongoServerSelectionError') {
    return true;
  }
  
  // Transaction retry labels
  if (error.hasErrorLabel && (
    error.hasErrorLabel('TransientTransactionError') ||
    error.hasErrorLabel('UnknownTransactionCommitResult')
  )) {
    return true;
  }
  
  return false;
}

/**
 * Execute a database operation with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === opts.maxRetries || !isTransientError(error)) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt),
        opts.maxDelayMs
      );
      
      console.warn(`Database operation failed (attempt ${attempt + 1}/${opts.maxRetries + 1}). Retrying in ${delay}ms...`, {
        error: error instanceof Error ? error.message : String(error)
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Execute a transaction with retry logic for transient failures
 */
export async function withTransactionRetry<T>(
  session: mongoose.ClientSession,
  transactionFn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  return withRetry(async () => {
    let result: T;
    
    await session.withTransaction(async () => {
      result = await transactionFn();
    }, {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' }
    });
    
    return result!;
  }, options);
}

/**
 * Create a unique constraint violation safe operation
 * Useful for operations that might fail due to unique constraints in concurrent environments
 */
export async function withUniqueConstraintSafety<T>(
  operation: () => Promise<T>,
  isUniqueViolation: (error: any) => boolean,
  fallbackValue?: T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isUniqueViolation(error)) {
      if (fallbackValue !== undefined) {
        return fallbackValue;
      }
      // Re-throw with a more specific message
      throw new Error('Resource already exists or was modified concurrently');
    }
    throw error;
  }
}