/**
 * Database configuration check
 */

export function checkDatabaseConfig(): { configured: boolean; message: string } {
  if (process.env.DATABASE_URL) {
    return {
      configured: true,
      message: `Local PostgreSQL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`
    };
  }
  if (process.env.DATABASE_RESOURCE_ARN && process.env.DATABASE_SECRET_ARN) {
    return { configured: true, message: 'AWS Aurora Data API' };
  }
  return {
    configured: false,
    message: 'Database not configured. Set DATABASE_RESOURCE_ARN and DATABASE_SECRET_ARN.'
  };
}
