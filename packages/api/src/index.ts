// API package exports
export * from './utils/response';
export * from './utils/logger';
export * from './middleware/auth';
export * from './middleware/validation';

// Handler exports for CDK references
export { handler as authHandler } from './handlers/auth';
export { handler as eventsHandler } from './handlers/events';
export { handler as predictionsHandler } from './handlers/predictions';
export { handler as walletHandler } from './handlers/wallet';
export { handler as leaderboardHandler } from './handlers/leaderboard';
export { handler as socialHandler } from './handlers/social';
export { handler as shopHandler } from './handlers/shop';
export { handler as challengesHandler } from './handlers/challenges';
export { handler as achievementsHandler } from './handlers/achievements';
