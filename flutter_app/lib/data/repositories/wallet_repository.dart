import '../models/wallet.dart';
import '../models/transaction.dart';
import '../services/api/api_client.dart';
import '../services/api/api_endpoints.dart';

/// Pagination wrapper for transactions
class PaginatedTransactions {
  final List<Transaction> data;
  final int page;
  final int pageSize;
  final int total;
  final bool hasMore;

  PaginatedTransactions({
    required this.data,
    required this.page,
    required this.pageSize,
    required this.total,
    required this.hasMore,
  });
}

/// Repository for wallet operations
class WalletRepository {
  final ApiClient _apiClient;

  WalletRepository(this._apiClient);

  /// Get wallet balances
  Future<Wallet> getWallet() async {
    final response = await _apiClient.get(
      ApiEndpoints.wallet,
      requiresAuth: true,
    );

    return Wallet.fromJson(response);
  }

  /// Get transaction history
  Future<PaginatedTransactions> getTransactions({
    int page = 1,
    int pageSize = 20,
    String? type,
    String? currency,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page.toString(),
      'pageSize': pageSize.toString(),
    };

    if (type != null) queryParams['type'] = type;
    if (currency != null) queryParams['currency'] = currency;

    final response = await _apiClient.get(
      ApiEndpoints.walletTransactions,
      queryParameters: queryParams,
      requiresAuth: true,
    );

    final data = (response['data'] as List<dynamic>?)
            ?.map((t) => Transaction.fromJson(t as Map<String, dynamic>))
            .toList() ??
        [];

    final pagination = response['pagination'] as Map<String, dynamic>?;

    return PaginatedTransactions(
      data: data,
      page: pagination?['page'] as int? ?? page,
      pageSize: pagination?['pageSize'] as int? ?? pageSize,
      total: pagination?['total'] as int? ?? data.length,
      hasMore: pagination?['hasMore'] as bool? ?? false,
    );
  }

  /// Get topup status
  Future<TopupStatus> getTopupStatus() async {
    final response = await _apiClient.get(
      ApiEndpoints.walletTopupStatus,
      requiresAuth: true,
    );

    return TopupStatus.fromJson(response);
  }

  /// Claim daily topup
  Future<TopupResult> claimTopup() async {
    final response = await _apiClient.post(
      ApiEndpoints.walletTopup,
      requiresAuth: true,
    );

    return TopupResult.fromJson(response);
  }

  /// Get recent transactions
  Future<List<Transaction>> getRecentTransactions({int limit = 10}) async {
    final response = await getTransactions(pageSize: limit);
    return response.data;
  }

  /// Get coin transactions only
  Future<List<Transaction>> getCoinTransactions({
    int page = 1,
    int pageSize = 20,
  }) async {
    final response = await getTransactions(
      page: page,
      pageSize: pageSize,
      currency: 'coins',
    );
    return response.data;
  }

  /// Get star transactions only
  Future<List<Transaction>> getStarTransactions({
    int page = 1,
    int pageSize = 20,
  }) async {
    final response = await getTransactions(
      page: page,
      pageSize: pageSize,
      currency: 'stars',
    );
    return response.data;
  }
}
