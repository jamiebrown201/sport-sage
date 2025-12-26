// Events Store - Manages real events data from API
import { create } from 'zustand';
import { Event, Sport } from '@/types';
import { eventsApi, ListEventsParams } from '../api/events';

interface EventsState {
  // Data
  events: Event[];
  liveEvents: Event[];
  scheduledEvents: Event[];
  sports: (Sport & { eventCount: number })[];

  // Selected event for detail view
  selectedEvent: Event | null;

  // Filters
  selectedSport: string | null;
  searchQuery: string;

  // Pagination
  page: number;
  hasMore: boolean;
  total: number;

  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  error: string | null;

  // Last fetch timestamps for cache invalidation
  lastFetch: number | null;

  // Actions
  fetchEvents: (params?: ListEventsParams) => Promise<void>;
  fetchMoreEvents: () => Promise<void>;
  refreshEvents: () => Promise<void>;
  fetchLiveEvents: () => Promise<void>;
  fetchScheduledEvents: () => Promise<void>;
  fetchSports: () => Promise<void>;
  fetchEventById: (eventId: string) => Promise<Event | null>;
  setSelectedSport: (sportSlug: string | null) => void;
  setSearchQuery: (query: string) => void;
  clearError: () => void;
}

// Cache duration: 30 seconds for events (they update frequently)
const CACHE_DURATION = 30 * 1000;

export const useEventsStore = create<EventsState>((set, get) => ({
  // Initial state
  events: [],
  liveEvents: [],
  scheduledEvents: [],
  sports: [],
  selectedEvent: null,
  selectedSport: null,
  searchQuery: '',
  page: 1,
  hasMore: false,
  total: 0,
  isLoading: false,
  isRefreshing: false,
  isLoadingMore: false,
  error: null,
  lastFetch: null,

  fetchEvents: async (params: ListEventsParams = {}) => {
    const { isLoading, selectedSport, lastFetch } = get();

    // Don't fetch if already loading
    if (isLoading) return;

    // Check cache
    const now = Date.now();
    if (lastFetch && now - lastFetch < CACHE_DURATION && !params.sport) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await eventsApi.listEvents({
        sport: params.sport || selectedSport || undefined,
        status: params.status,
        pageSize: params.pageSize || 20,
        page: 1,
      });

      set({
        events: response.data,
        page: 1,
        hasMore: response.pagination.hasMore,
        total: response.pagination.total,
        isLoading: false,
        lastFetch: Date.now(),
      });
    } catch (error) {
      console.error('Failed to fetch events:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch events',
        isLoading: false,
      });
    }
  },

  fetchMoreEvents: async () => {
    const { isLoadingMore, hasMore, page, selectedSport } = get();

    if (isLoadingMore || !hasMore) return;

    set({ isLoadingMore: true });

    try {
      const response = await eventsApi.listEvents({
        sport: selectedSport || undefined,
        page: page + 1,
        pageSize: 20,
      });

      set(state => ({
        events: [...state.events, ...response.data],
        page: page + 1,
        hasMore: response.pagination.hasMore,
        isLoadingMore: false,
      }));
    } catch (error) {
      console.error('Failed to load more events:', error);
      set({ isLoadingMore: false });
    }
  },

  refreshEvents: async () => {
    const { selectedSport } = get();

    set({ isRefreshing: true, lastFetch: null });

    try {
      const response = await eventsApi.listEvents({
        sport: selectedSport || undefined,
        pageSize: 20,
        page: 1,
      });

      set({
        events: response.data,
        page: 1,
        hasMore: response.pagination.hasMore,
        total: response.pagination.total,
        isRefreshing: false,
        lastFetch: Date.now(),
      });
    } catch (error) {
      console.error('Failed to refresh events:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to refresh events',
        isRefreshing: false,
      });
    }
  },

  fetchLiveEvents: async () => {
    try {
      const liveEvents = await eventsApi.getLiveEvents();
      set({ liveEvents });
    } catch (error) {
      console.error('Failed to fetch live events:', error);
    }
  },

  fetchScheduledEvents: async () => {
    try {
      const scheduledEvents = await eventsApi.getScheduledEvents(10);
      set({ scheduledEvents });
    } catch (error) {
      console.error('Failed to fetch scheduled events:', error);
    }
  },

  fetchSports: async () => {
    try {
      const sports = await eventsApi.listSports();
      set({ sports });
    } catch (error) {
      console.error('Failed to fetch sports:', error);
    }
  },

  fetchEventById: async (eventId: string) => {
    try {
      const event = await eventsApi.getEvent(eventId);
      set({ selectedEvent: event });
      return event;
    } catch (error) {
      console.error('Failed to fetch event:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to fetch event' });
      return null;
    }
  },

  setSelectedSport: (sportSlug: string | null) => {
    set({ selectedSport: sportSlug, lastFetch: null });
    get().fetchEvents({ sport: sportSlug || undefined });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  clearError: () => set({ error: null }),
}));

// Selectors
export const selectLiveEvents = (state: EventsState) => state.liveEvents;
export const selectScheduledEvents = (state: EventsState) => state.scheduledEvents;
export const selectAllEvents = (state: EventsState) => state.events;
export const selectSports = (state: EventsState) => state.sports;
export const selectIsLoading = (state: EventsState) => state.isLoading;
