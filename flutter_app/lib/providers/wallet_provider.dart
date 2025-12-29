import 'package:flutter/foundation.dart';
import '../data/models/wallet.dart';
import '../data/models/transaction.dart';
import '../data/repositories/wallet_repository.dart';

/// Wallet provider for managing wallet state
class WalletProvider extends ChangeNotifier {
  final WalletRepository _walletRepository;

  Wallet? _wallet;
  List<Transaction> _transactions = [];
  TopupStatus? _topupStatus;
  bool _isLoading = false;
  bool _isLoadingTransactions = false;
  bool _isClaimingTopup = false;
  String? _error;
  int _transactionsPage = 1;
  bool _hasMoreTransactions = true;

  WalletProvider(this._walletRepository);

  // Getters
  Wallet? get wallet => _wallet;
  List<Transaction> get transactions => _transactions;
  TopupStatus? get topupStatus => _topupStatus;
  bool get isLoading => _isLoading;
  bool get isLoadingTransactions => _isLoadingTransactions;
  bool get isClaimingTopup => _isClaimingTopup;
  String? get error => _error;
  bool get hasMoreTransactions => _hasMoreTransactions;

  // Convenience getters
  int get coins => _wallet?.coins ?? 0;
  int get stars => _wallet?.stars ?? 0;
  int get gems => _wallet?.gems ?? 0;
  bool get canClaimTopup => _topupStatus?.canClaim ?? _wallet?.canClaimDailyTopup ?? false;

  /// Load wallet data
  Future<void> loadWallet() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _wallet = await _walletRepository.getWallet();
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Load topup status
  Future<void> loadTopupStatus() async {
    try {
      _topupStatus = await _walletRepository.getTopupStatus();
      notifyListeners();
    } catch (e) {
      // Silently fail - use wallet's canClaimDailyTopup
    }
  }

  /// Load transactions (paginated)
  Future<void> loadTransactions({bool refresh = false}) async {
    if (refresh) {
      _transactionsPage = 1;
      _hasMoreTransactions = true;
    }

    if (!_hasMoreTransactions && !refresh) return;

    _isLoadingTransactions = true;
    notifyListeners();

    try {
      final response = await _walletRepository.getTransactions(
        page: _transactionsPage,
        pageSize: 20,
      );

      if (refresh) {
        _transactions = response.data;
      } else {
        _transactions = [..._transactions, ...response.data];
      }

      _hasMoreTransactions = response.hasMore;
      _transactionsPage++;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    } finally {
      _isLoadingTransactions = false;
      notifyListeners();
    }
  }

  /// Claim daily topup
  Future<TopupResult?> claimTopup() async {
    _isClaimingTopup = true;
    _error = null;
    notifyListeners();

    try {
      final result = await _walletRepository.claimTopup();

      // Update local wallet state
      if (_wallet != null) {
        _wallet = _wallet!.copyWith(
          coins: result.newBalance,
          canClaimDailyTopup: false,
          nextTopupAt: result.nextClaimAt,
        );
      }

      // Update topup status
      _topupStatus = TopupStatus(
        canClaim: false,
        amount: result.coinsAdded,
        lastClaimedAt: DateTime.now(),
        nextClaimAt: result.nextClaimAt,
        hoursUntilNextClaim: 24,
      );

      notifyListeners();
      return result;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return null;
    } finally {
      _isClaimingTopup = false;
      notifyListeners();
    }
  }

  /// Refresh all wallet data
  Future<void> refresh() async {
    await Future.wait([
      loadWallet(),
      loadTopupStatus(),
      loadTransactions(refresh: true),
    ]);
  }

  /// Update coins after prediction
  void deductCoins(int amount) {
    if (_wallet != null) {
      _wallet = _wallet!.copyWith(coins: _wallet!.coins - amount);
      notifyListeners();
    }
  }

  /// Add coins after win
  void addCoins(int amount) {
    if (_wallet != null) {
      _wallet = _wallet!.copyWith(coins: _wallet!.coins + amount);
      notifyListeners();
    }
  }

  /// Add stars after win
  void addStars(int amount) {
    if (_wallet != null) {
      _wallet = _wallet!.copyWith(stars: _wallet!.stars + amount);
      notifyListeners();
    }
  }

  /// Check if user can afford a stake
  bool canAfford(int amount) => coins >= amount;

  /// Clear wallet data (on logout)
  void clear() {
    _wallet = null;
    _transactions = [];
    _topupStatus = null;
    _transactionsPage = 1;
    _hasMoreTransactions = true;
    _error = null;
    notifyListeners();
  }
}
