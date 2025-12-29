import 'package:flutter/material.dart';

/// Sport Sage color palette
/// Dark theme with gold accents
class AppColors {
  // Background Colors
  static const Color background = Color(0xFF0D1B2A);
  static const Color card = Color(0xFF1B263B);
  static const Color cardElevated = Color(0xFF243447);
  static const Color surface = Color(0xFF1B263B);

  // Primary (Gold)
  static const Color primary = Color(0xFFFFD600);
  static const Color primaryDim = Color(0x1AFFD600);
  static const Color primaryMuted = Color(0x4DFFD600);
  static const Color primaryDark = Color(0xFFD4AF37);

  // Currency Colors
  static const Color coins = Color(0xFFFFD700);
  static const Color coinsBackground = Color(0x1AFFD700);
  static const Color stars = Color(0xFFFFF9C4);
  static const Color starsBackground = Color(0x1AFFF9C4);
  static const Color gems = Color(0xFFE040FB);
  static const Color gemsBackground = Color(0x1AE040FB);

  // Semantic Colors
  static const Color success = Color(0xFF4CAF50);
  static const Color successBackground = Color(0x1A4CAF50);
  static const Color error = Color(0xFFEF5350);
  static const Color errorBackground = Color(0x1AEF5350);
  static const Color warning = Color(0xFFFF9800);
  static const Color warningBackground = Color(0x1AFF9800);
  static const Color info = Color(0xFF2196F3);
  static const Color infoBackground = Color(0x1A2196F3);

  // Text Colors
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFFA0AEC0);
  static const Color textMuted = Color(0xFF718096);
  static const Color textDisabled = Color(0xFF4A5568);

  // Border & Divider
  static const Color border = Color(0xFF2D3748);
  static const Color borderLight = Color(0xFF4A5568);
  static const Color divider = Color(0xFF2D3748);

  // Odds Colors (for betting odds display)
  static const Color oddsHigh = Color(0xFFFF6B6B); // > 3.0 (long shot)
  static const Color oddsMedium = Color(0xFFFFD93D); // 1.5 - 3.0
  static const Color oddsLow = Color(0xFF6BCB77); // < 1.5 (favorite)

  // Prediction Status Colors
  static const Color pending = Color(0xFFFFD600);
  static const Color won = Color(0xFF4CAF50);
  static const Color lost = Color(0xFFEF5350);
  static const Color voidColor = Color(0xFF718096);
  static const Color cashout = Color(0xFF2196F3);

  // Subscription Tier Colors
  static const Color free = Color(0xFF718096);
  static const Color pro = Color(0xFF00BCD4);
  static const Color elite = Color(0xFFFFD600);

  // Rarity Colors (for cosmetics)
  static const Color common = Color(0xFF718096);
  static const Color rare = Color(0xFF2196F3);
  static const Color epic = Color(0xFF9C27B0);
  static const Color legendary = Color(0xFFFF9800);

  // Live Indicator
  static const Color live = Color(0xFFFF0000);
  static const Color liveBackground = Color(0x1AFF0000);

  // Sport-specific Colors
  static const Color football = Color(0xFF4CAF50);
  static const Color basketball = Color(0xFFFF9800);
  static const Color tennis = Color(0xFFCDDC39);
  static const Color cricket = Color(0xFF8BC34A);
  static const Color darts = Color(0xFFE91E63);
  static const Color golf = Color(0xFF00BCD4);
  static const Color boxing = Color(0xFFF44336);
  static const Color mma = Color(0xFF9C27B0);

  // Overlay Colors
  static const Color overlay = Color(0x80000000);
  static const Color overlayLight = Color(0x40000000);

  // Helper method to get odds color based on value
  static Color getOddsColor(double odds) {
    if (odds >= 3.0) return oddsHigh;
    if (odds >= 1.5) return oddsMedium;
    return oddsLow;
  }

  // Helper method to get prediction status color
  static Color getPredictionStatusColor(String status) {
    switch (status) {
      case 'pending':
        return pending;
      case 'won':
        return won;
      case 'lost':
        return lost;
      case 'void':
        return voidColor;
      case 'cashout':
        return cashout;
      default:
        return textMuted;
    }
  }

  // Helper method to get rarity color
  static Color getRarityColor(String rarity) {
    switch (rarity.toLowerCase()) {
      case 'common':
        return common;
      case 'rare':
        return rare;
      case 'epic':
        return epic;
      case 'legendary':
        return legendary;
      default:
        return common;
    }
  }
}
