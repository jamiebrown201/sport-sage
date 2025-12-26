// Events API Service
import { httpClient, ApiResponse } from './client';
import { Event, Sport, Outcome } from '@/types';

// API Response Types (from backend)
interface ApiSport {
  id: string;
  name: string;
  slug: string;
  iconName: string;
  eventCount?: number;
}

interface ApiOutcome {
  id: string;
  name: string;
  odds: number;
  previousOdds: number | null;
  isSuspended: boolean;
}

interface ApiMarket {
  id: string;
  type: string;
  name: string;
  line: number | null;
  isSuspended: boolean;
  isMainMarket: boolean;
  outcomes: ApiOutcome[];
}

interface ApiEvent {
  id: string;
  sport: ApiSport;
  competition: {
    id: string;
    name: string;
    shortName: string | null;
    country: string | null;
  } | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  player1Name: string | null;
  player2Name: string | null;
  startTime: string;
  status: 'scheduled' | 'live' | 'finished' | 'cancelled' | 'postponed';
  homeScore: number | null;
  awayScore: number | null;
  period: string | null;
  minute: number | null;
  isFeatured: boolean;
  predictionCount: number;
  markets: ApiMarket[];
  sponsoredEvent: {
    sponsorName: string;
    sponsorLogoUrl: string;
    title: string;
    description: string;
    bonusStarsMultiplier: number;
  } | null;
}

// Transform API event to app Event type
function transformEvent(apiEvent: ApiEvent): Event {
  const mainMarket = apiEvent.markets.find(m => m.isMainMarket) || apiEvent.markets[0];

  return {
    id: apiEvent.id,
    sport: {
      id: apiEvent.sport.id,
      name: apiEvent.sport.name,
      slug: apiEvent.sport.slug as any,
      icon: apiEvent.sport.iconName,
    },
    competition: apiEvent.competition?.name || 'Unknown',
    homeTeam: apiEvent.homeTeamName || undefined,
    awayTeam: apiEvent.awayTeamName || undefined,
    player1: apiEvent.player1Name || undefined,
    player2: apiEvent.player2Name || undefined,
    startTime: apiEvent.startTime,
    status: apiEvent.status === 'postponed' || apiEvent.status === 'cancelled' ? 'cancelled' : apiEvent.status,
    homeScore: apiEvent.homeScore ?? undefined,
    awayScore: apiEvent.awayScore ?? undefined,
    liveScore: apiEvent.status === 'live' || apiEvent.status === 'finished' ? {
      home: apiEvent.homeScore ?? 0,
      away: apiEvent.awayScore ?? 0,
      time: apiEvent.period || apiEvent.minute?.toString() || undefined,
      period: apiEvent.period || undefined,
    } : undefined,
    markets: mainMarket ? [{
      id: mainMarket.id,
      type: 'match_winner',
      outcomes: mainMarket.outcomes.map(o => ({
        id: o.id,
        name: o.name,
        odds: o.odds,
      })),
    }] : [],
    sponsoredEvent: apiEvent.sponsoredEvent ? {
      id: apiEvent.id,
      sponsorName: apiEvent.sponsoredEvent.sponsorName,
      sponsorLogoUrl: apiEvent.sponsoredEvent.sponsorLogoUrl,
      title: apiEvent.sponsoredEvent.title,
      description: apiEvent.sponsoredEvent.description,
      startDate: apiEvent.startTime,
      endDate: apiEvent.startTime,
      prizeDescription: '',
      brandingColor: '#6366f1',
    } : undefined,
  };
}

// Transform API sport to app Sport type
function transformSport(apiSport: ApiSport): Sport & { eventCount: number } {
  return {
    id: apiSport.id,
    name: apiSport.name,
    slug: apiSport.slug as any,
    icon: apiSport.iconName,
    eventCount: apiSport.eventCount || 0,
  };
}

export interface ListEventsParams {
  sport?: string;
  status?: 'scheduled' | 'live' | 'finished';
  date?: string;
  page?: number;
  pageSize?: number;
}

export interface EventsResponse {
  data: Event[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

export interface SportsResponse {
  data: (Sport & { eventCount: number })[];
}

class EventsApi {
  /**
   * List events with filters (public endpoint - no auth required)
   */
  async listEvents(params: ListEventsParams = {}): Promise<EventsResponse> {
    const queryParams: Record<string, string | number | undefined> = {};
    if (params.sport) queryParams.sport = params.sport;
    if (params.status) queryParams.status = params.status;
    if (params.date) queryParams.date = params.date;
    if (params.page) queryParams.page = params.page;
    if (params.pageSize) queryParams.pageSize = params.pageSize;

    const response = await httpClient.get<{ data: ApiEvent[]; pagination: EventsResponse['pagination'] }>(
      '/api/events',
      { params: queryParams, requiresAuth: false }
    );

    return {
      data: response.data.map(transformEvent),
      pagination: response.pagination,
    };
  }

  /**
   * Get a single event by ID (public endpoint - no auth required)
   */
  async getEvent(eventId: string): Promise<Event> {
    const response = await httpClient.get<{ data: ApiEvent }>(
      `/api/events/${eventId}`,
      { requiresAuth: false }
    );
    return transformEvent(response.data);
  }

  /**
   * Get featured events (public endpoint - no auth required)
   */
  async getFeaturedEvents(): Promise<Event[]> {
    const response = await httpClient.get<{ data: ApiEvent[] }>(
      '/api/events/featured',
      { requiresAuth: false }
    );
    return response.data.map(transformEvent);
  }

  /**
   * List available sports with event counts (public endpoint - no auth required)
   */
  async listSports(): Promise<(Sport & { eventCount: number })[]> {
    const response = await httpClient.get<{ data: ApiSport[] }>(
      '/api/events/sports',
      { requiresAuth: false }
    );
    return response.data.map(transformSport);
  }

  /**
   * Get live events
   */
  async getLiveEvents(): Promise<Event[]> {
    const response = await this.listEvents({ status: 'live', pageSize: 20 });
    return response.data;
  }

  /**
   * Get scheduled events (upcoming)
   */
  async getScheduledEvents(pageSize = 20): Promise<Event[]> {
    const response = await this.listEvents({ status: 'scheduled', pageSize });
    return response.data;
  }
}

export const eventsApi = new EventsApi();
