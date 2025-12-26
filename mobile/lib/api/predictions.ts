// Predictions API Service
import { httpClient } from './client';
import { Prediction, PredictionEvent, PredictionOutcome } from '@/types';

// API Response Types
interface ApiPrediction {
  id: string;
  type: 'single' | 'accumulator';
  stake: number;
  odds: number;
  totalOdds: number;
  potentialCoins: number;
  potentialStars: number;
  status: 'pending' | 'won' | 'lost' | 'void' | 'cashout';
  settledCoins: number | null;
  settledStars: number | null;
  settledAt: string | null;
  createdAt: string;
  event: {
    id: string;
    homeTeamName: string | null;
    awayTeamName: string | null;
    player1Name: string | null;
    player2Name: string | null;
    startTime: string;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
  } | null;
  outcome: {
    id: string;
    name: string;
    odds: number;
    isWinner: boolean | null;
  } | null;
}

// Transform API prediction to app Prediction type
function transformPrediction(apiPrediction: ApiPrediction): Prediction {
  return {
    id: apiPrediction.id,
    type: apiPrediction.type,
    stake: apiPrediction.stake,
    odds: apiPrediction.odds,
    totalOdds: apiPrediction.totalOdds,
    potentialCoins: apiPrediction.potentialCoins,
    potentialStars: apiPrediction.potentialStars,
    status: apiPrediction.status,
    settledCoins: apiPrediction.settledCoins,
    settledStars: apiPrediction.settledStars,
    settledAt: apiPrediction.settledAt,
    createdAt: apiPrediction.createdAt,
    event: apiPrediction.event,
    outcome: apiPrediction.outcome,
  };
}

export interface CreatePredictionParams {
  eventId: string;
  outcomeId: string;
  stake: number;
}

export interface ListPredictionsParams {
  status?: 'pending' | 'won' | 'lost' | 'void';
  page?: number;
  pageSize?: number;
}

export interface PredictionsListResponse {
  data: Prediction[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

export interface PredictionStatsResponse {
  totalPredictions: number;
  totalWins: number;
  totalLosses: number;
  pendingCount: number;
  winRate: number;
  totalCoinsWagered: number;
  totalCoinsWon: number;
  totalStarsEarned: number;
}

class PredictionsApi {
  /**
   * Create a new prediction (bet on an event)
   */
  async createPrediction(params: CreatePredictionParams): Promise<Prediction> {
    const response = await httpClient.post<{ data: ApiPrediction; user: any }>('/api/predictions', params);
    return transformPrediction(response.data);
  }

  /**
   * List user's predictions with optional filters
   */
  async listPredictions(params: ListPredictionsParams = {}): Promise<PredictionsListResponse> {
    const queryParams: Record<string, string | number | undefined> = {};
    if (params.status) queryParams.status = params.status;
    if (params.page) queryParams.page = params.page;
    if (params.pageSize) queryParams.pageSize = params.pageSize;

    const response = await httpClient.get<{ data: ApiPrediction[]; pagination: PredictionsListResponse['pagination'] }>(
      '/api/predictions',
      { params: queryParams }
    );

    return {
      data: response.data.map(transformPrediction),
      pagination: response.pagination,
    };
  }

  /**
   * Get a single prediction by ID
   */
  async getPrediction(predictionId: string): Promise<Prediction> {
    const response = await httpClient.get<{ data: ApiPrediction }>(`/api/predictions/${predictionId}`);
    return transformPrediction(response.data);
  }

  /**
   * Get user's prediction statistics
   */
  async getStats(): Promise<PredictionStatsResponse> {
    const response = await httpClient.get<{ data: PredictionStatsResponse }>('/api/predictions/stats');
    return response.data;
  }

  /**
   * Get user's pending predictions
   */
  async getPendingPredictions(): Promise<Prediction[]> {
    const response = await this.listPredictions({ status: 'pending', pageSize: 50 });
    return response.data;
  }
}

export const predictionsApi = new PredictionsApi();
