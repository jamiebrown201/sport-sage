import 'package:flutter/foundation.dart';
import '../data/models/event.dart';
import '../data/models/sport.dart';
import '../data/repositories/events_repository.dart';

/// Events provider for managing events state
class EventsProvider extends ChangeNotifier {
  final EventsRepository _eventsRepository;

  List<Event> _events = [];
  List<Event> _liveEvents = [];
  List<Event> _featuredEvents = [];
  List<Sport> _sports = [];
  Event? _selectedEvent;
  Sport? _selectedSport;
  String? _selectedStatus;
  bool _isLoading = false;
  bool _isLoadingMore = false;
  bool _isLoadingEvent = false;
  String? _error;
  int _currentPage = 1;
  bool _hasMore = true;

  EventsProvider(this._eventsRepository);

  // Getters
  List<Event> get events => _events;
  List<Event> get liveEvents => _liveEvents;
  List<Event> get featuredEvents => _featuredEvents;
  List<Sport> get sports => _sports;
  Event? get selectedEvent => _selectedEvent;
  Sport? get selectedSport => _selectedSport;
  String? get selectedStatus => _selectedStatus;
  bool get isLoading => _isLoading;
  bool get isLoadingMore => _isLoadingMore;
  bool get isLoadingEvent => _isLoadingEvent;
  String? get error => _error;
  bool get hasMore => _hasMore;

  // Filtered events helpers
  List<Event> get scheduledEvents =>
      _events.where((e) => e.status == EventStatus.scheduled).toList();

  List<Event> get finishedEvents =>
      _events.where((e) => e.status == EventStatus.finished).toList();

  /// Initialize - load sports and featured events
  Future<void> initialize() async {
    await Future.wait([
      loadSports(),
      loadFeaturedEvents(),
      loadLiveEvents(),
    ]);
  }

  /// Load available sports
  Future<void> loadSports() async {
    try {
      _sports = await _eventsRepository.getSports();
      notifyListeners();
    } catch (e) {
      // Use default sports on error
      _sports = Sport.allSports;
      notifyListeners();
    }
  }

  /// Load featured events
  Future<void> loadFeaturedEvents() async {
    try {
      _featuredEvents = await _eventsRepository.getFeaturedEvents(limit: 10);
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// Load live events
  Future<void> loadLiveEvents() async {
    try {
      _liveEvents = await _eventsRepository.getLiveEvents(limit: 50);
      notifyListeners();
    } catch (e) {
      // Silently fail for live events
    }
  }

  /// Load events with filters
  Future<void> loadEvents({
    bool refresh = false,
    String? sportId,
    String? status,
  }) async {
    if (refresh) {
      _currentPage = 1;
      _hasMore = true;
      _selectedSport = sportId != null
          ? _sports.firstWhere(
              (s) => s.id == sportId,
              orElse: () => _sports.first,
            )
          : null;
      _selectedStatus = status;
    }

    if (!_hasMore && !refresh) return;

    if (refresh) {
      _isLoading = true;
    } else {
      _isLoadingMore = true;
    }
    _error = null;
    notifyListeners();

    try {
      final response = await _eventsRepository.getEvents(
        page: _currentPage,
        pageSize: 20,
        sportId: sportId ?? _selectedSport?.id,
        status: status ?? _selectedStatus,
      );

      if (refresh) {
        _events = response.data;
      } else {
        _events = [..._events, ...response.data];
      }

      _hasMore = response.hasMore;
      _currentPage++;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    } finally {
      _isLoading = false;
      _isLoadingMore = false;
      notifyListeners();
    }
  }

  /// Load event by ID
  Future<Event?> loadEventById(String id) async {
    _isLoadingEvent = true;
    _error = null;
    notifyListeners();

    try {
      _selectedEvent = await _eventsRepository.getEventById(id);
      notifyListeners();
      return _selectedEvent;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return null;
    } finally {
      _isLoadingEvent = false;
      notifyListeners();
    }
  }

  /// Set selected sport filter
  void setSelectedSport(Sport? sport) {
    _selectedSport = sport;
    loadEvents(refresh: true, sportId: sport?.id, status: _selectedStatus);
  }

  /// Set selected status filter
  void setSelectedStatus(String? status) {
    _selectedStatus = status;
    loadEvents(refresh: true, sportId: _selectedSport?.id, status: status);
  }

  /// Clear filters
  void clearFilters() {
    _selectedSport = null;
    _selectedStatus = null;
    loadEvents(refresh: true);
  }

  /// Refresh all events
  Future<void> refresh() async {
    await Future.wait([
      loadEvents(refresh: true),
      loadFeaturedEvents(),
      loadLiveEvents(),
    ]);
  }

  /// Clear selected event
  void clearSelectedEvent() {
    _selectedEvent = null;
    notifyListeners();
  }

  /// Find event by ID from cache
  Event? getEventFromCache(String id) {
    try {
      return _events.firstWhere((e) => e.id == id);
    } catch (_) {
      try {
        return _liveEvents.firstWhere((e) => e.id == id);
      } catch (_) {
        try {
          return _featuredEvents.firstWhere((e) => e.id == id);
        } catch (_) {
          return null;
        }
      }
    }
  }

  /// Update event in cache (for live updates)
  void updateEventInCache(Event updatedEvent) {
    final index = _events.indexWhere((e) => e.id == updatedEvent.id);
    if (index != -1) {
      _events[index] = updatedEvent;
    }

    final liveIndex = _liveEvents.indexWhere((e) => e.id == updatedEvent.id);
    if (liveIndex != -1) {
      _liveEvents[liveIndex] = updatedEvent;
    }

    if (_selectedEvent?.id == updatedEvent.id) {
      _selectedEvent = updatedEvent;
    }

    notifyListeners();
  }

  /// Clear all data (on logout)
  void clear() {
    _events = [];
    _liveEvents = [];
    _featuredEvents = [];
    _selectedEvent = null;
    _selectedSport = null;
    _selectedStatus = null;
    _currentPage = 1;
    _hasMore = true;
    _error = null;
    notifyListeners();
  }
}
