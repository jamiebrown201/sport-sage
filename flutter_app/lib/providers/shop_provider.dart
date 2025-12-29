import 'package:flutter/foundation.dart';
import '../data/models/mock_models.dart';
import '../data/repositories/mock_repository.dart';

/// Shop provider for managing shop items state
class ShopProvider extends ChangeNotifier {
  final MockRepository _mockRepository;

  List<CosmeticItem> _cosmetics = [];
  List<GemPack> _gemPacks = [];
  List<SubscriptionPlan> _subscriptionPlans = [];
  bool _isLoading = false;
  String? _error;

  ShopProvider(this._mockRepository);

  // Getters
  List<CosmeticItem> get cosmetics => _cosmetics;
  List<GemPack> get gemPacks => _gemPacks;
  List<SubscriptionPlan> get subscriptionPlans => _subscriptionPlans;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Filtered cosmetics
  List<CosmeticItem> get ownedCosmetics =>
      _cosmetics.where((c) => c.isOwned).toList();

  List<CosmeticItem> get availableCosmetics =>
      _cosmetics.where((c) => !c.isOwned).toList();

  List<CosmeticItem> getByType(CosmeticType type) =>
      _cosmetics.where((c) => c.type == type).toList();

  // Best value gem pack
  GemPack? get bestValuePack {
    try {
      return _gemPacks.firstWhere((p) => p.isBestValue);
    } catch (_) {
      return _gemPacks.isNotEmpty ? _gemPacks.last : null;
    }
  }

  /// Load shop items
  Future<void> loadShopItems() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await Future.wait([
        _loadCosmetics(),
        _loadGemPacks(),
        _loadSubscriptionPlans(),
      ]);
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _loadCosmetics() async {
    _cosmetics = await _mockRepository.getCosmeticItems();
    notifyListeners();
  }

  Future<void> _loadGemPacks() async {
    _gemPacks = await _mockRepository.getGemPacks();
    notifyListeners();
  }

  Future<void> _loadSubscriptionPlans() async {
    _subscriptionPlans = await _mockRepository.getSubscriptionPlans();
    notifyListeners();
  }

  /// Purchase cosmetic (mock)
  bool purchaseCosmetic(String cosmeticId, int userGems) {
    final index = _cosmetics.indexWhere((c) => c.id == cosmeticId);
    if (index == -1) return false;

    final cosmetic = _cosmetics[index];
    if (cosmetic.isOwned || userGems < cosmetic.priceGems) return false;

    _cosmetics[index] = CosmeticItem(
      id: cosmetic.id,
      name: cosmetic.name,
      description: cosmetic.description,
      type: cosmetic.type,
      imageUrl: cosmetic.imageUrl,
      priceGems: cosmetic.priceGems,
      isOwned: true,
      isEquipped: false,
    );

    notifyListeners();
    return true;
  }

  /// Equip cosmetic (mock)
  void equipCosmetic(String cosmeticId) {
    final type = _cosmetics.firstWhere((c) => c.id == cosmeticId).type;

    // Unequip all of same type first
    for (int i = 0; i < _cosmetics.length; i++) {
      if (_cosmetics[i].type == type && _cosmetics[i].isEquipped) {
        _cosmetics[i] = CosmeticItem(
          id: _cosmetics[i].id,
          name: _cosmetics[i].name,
          description: _cosmetics[i].description,
          type: _cosmetics[i].type,
          imageUrl: _cosmetics[i].imageUrl,
          priceGems: _cosmetics[i].priceGems,
          isOwned: _cosmetics[i].isOwned,
          isEquipped: false,
        );
      }
    }

    // Equip the selected one
    final index = _cosmetics.indexWhere((c) => c.id == cosmeticId);
    if (index != -1 && _cosmetics[index].isOwned) {
      _cosmetics[index] = CosmeticItem(
        id: _cosmetics[index].id,
        name: _cosmetics[index].name,
        description: _cosmetics[index].description,
        type: _cosmetics[index].type,
        imageUrl: _cosmetics[index].imageUrl,
        priceGems: _cosmetics[index].priceGems,
        isOwned: true,
        isEquipped: true,
      );
    }

    notifyListeners();
  }

  /// Find subscription plan by tier
  SubscriptionPlan? findPlanByTier(String tier) {
    try {
      return _subscriptionPlans.firstWhere((p) => p.tier == tier);
    } catch (_) {
      return null;
    }
  }

  /// Clear shop data (on logout)
  void clear() {
    _cosmetics = [];
    _gemPacks = [];
    _subscriptionPlans = [];
    _error = null;
    notifyListeners();
  }
}
