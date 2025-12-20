import { User, UserStats } from '@/types';

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date >= today) {
    return `Today at ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (date >= yesterday) {
    return `Yesterday at ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeUntil(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff < 0) {
    return 'Started';
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function calculateWinRate(wins: number, losses: number): number {
  const total = wins + losses;
  if (total === 0) return 0;
  return (wins / total) * 100;
}

export function calculatePotentialReturn(stake: number, odds: number): number {
  return Math.floor(stake * odds);
}

export function calculatePotentialStars(
  stake: number,
  odds: number,
  multiplier: number = 1.0
): number {
  const potentialReturn = calculatePotentialReturn(stake, odds);
  const profit = potentialReturn - stake;
  return Math.floor(profit * multiplier);
}

export function getTopupAmount(currentCoins: number, tier: 'free' | 'pro' | 'elite'): number {
  const targetAmount = tier === 'free' ? 500 : 1000;
  return Math.max(0, targetAmount - currentCoins);
}

export function canClaimDailyTopup(coins: number, lastTopupDate?: string): boolean {
  if (coins >= 200) return false;
  if (!lastTopupDate) return true;

  const today = new Date().toDateString();
  const lastClaim = new Date(lastTopupDate).toDateString();
  return today !== lastClaim;
}

export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
