import '../models/event.dart';
import '../models/sport.dart';
import '../services/api/api_client.dart';
import '../services/api/api_endpoints.dart';

/// Pagination wrapper for API responses
class PaginatedResponse<T> {
  final List<T> data;
  final int page;
  final int pageSize;
  final int total;
  final bool hasMore;

  PaginatedResponse({
    required this.data,
    required this.page,
    required this.pageSize,
    required this.total,
    required this.hasMore,
  });
}

/// Repository for events operations
class EventsRepository {
  final ApiClient _apiClient;

  EventsRepository(this._apiClient);

  /// Get paginated list of events
  Future<PaginatedResponse<Event>> getEvents({
    int page = 1,
    int pageSize = 20,
    String? sportId,
    String? status,
    bool? featured,
    String? search,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page.toString(),
      'pageSize': pageSize.toString(),
    };

    if (sportId != null) queryParams['sportId'] = sportId;
    if (status != null) queryParams['status'] = status;
    if (featured != null) queryParams['featured'] = featured.toString();
    if (search != null && search.isNotEmpty) queryParams['search'] = search;

    final response = await _apiClient.get(
      ApiEndpoints.events,
      queryParameters: queryParams,
      requiresAuth: false,
    );

    final data = (response['data'] as List<dynamic>?)
            ?.map((e) => Event.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    final pagination = response['pagination'] as Map<String, dynamic>?;

    return PaginatedResponse(
      data: data,
      page: pagination?['page'] as int? ?? page,
      pageSize: pagination?['pageSize'] as int? ?? pageSize,
      total: pagination?['total'] as int? ?? data.length,
      hasMore: pagination?['hasMore'] as bool? ?? false,
    );
  }

  /// Get event by ID
  Future<Event> getEventById(String id) async {
    final response = await _apiClient.get(
      ApiEndpoints.eventById(id),
      requiresAuth: false,
    );

    // API returns {data: {...event...}}
    final data = response['data'] as Map<String, dynamic>;
    return Event.fromJson(data);
  }

  /// Get featured events
  Future<List<Event>> getFeaturedEvents({int limit = 10}) async {
    final response = await _apiClient.get(
      ApiEndpoints.eventsFeatured,
      queryParameters: {'limit': limit.toString()},
      requiresAuth: false,
    );

    return (response['data'] as List<dynamic>?)
            ?.map((e) => Event.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];
  }

  /// Get available sports (that have events)
  Future<List<Sport>> getSports() async {
    final response = await _apiClient.get(
      ApiEndpoints.eventsSports,
      requiresAuth: false,
    );

    return (response['data'] as List<dynamic>?)
            ?.map((s) => Sport.fromJson(s as Map<String, dynamic>))
            .toList() ??
        [];
  }

  /// Get live events
  Future<List<Event>> getLiveEvents({int limit = 50}) async {
    final response = await getEvents(
      status: 'live',
      pageSize: limit,
    );
    return response.data;
  }

  /// Get scheduled events (upcoming)
  Future<List<Event>> getScheduledEvents({
    int page = 1,
    int pageSize = 20,
    String? sportId,
  }) async {
    final response = await getEvents(
      status: 'scheduled',
      page: page,
      pageSize: pageSize,
      sportId: sportId,
    );
    return response.data;
  }

  /// Get events for a specific sport
  Future<PaginatedResponse<Event>> getEventsBySport(
    String sportId, {
    int page = 1,
    int pageSize = 20,
    String? status,
  }) async {
    return getEvents(
      sportId: sportId,
      page: page,
      pageSize: pageSize,
      status: status,
    );
  }
}
