import 'package:intl/intl.dart';

/// Formatting utilities for Sport Sage
class Formatters {
  // Date/Time formatters
  static final DateFormat _timeFormat = DateFormat('HH:mm');
  static final DateFormat _dateFormat = DateFormat('dd MMM');
  static final DateFormat _fullDateFormat = DateFormat('dd MMM yyyy');
  static final DateFormat _dateTimeFormat = DateFormat('dd MMM, HH:mm');
  static final DateFormat _dayFormat = DateFormat('EEEE');
  static final DateFormat _shortDayFormat = DateFormat('EEE');

  /// Format time only (e.g., "14:30")
  static String time(DateTime dateTime) {
    return _timeFormat.format(dateTime.toLocal());
  }

  /// Format date only (e.g., "28 Dec")
  static String date(DateTime dateTime) {
    return _dateFormat.format(dateTime.toLocal());
  }

  /// Format full date (e.g., "28 Dec 2025")
  static String fullDate(DateTime dateTime) {
    return _fullDateFormat.format(dateTime.toLocal());
  }

  /// Format date and time (e.g., "28 Dec, 14:30")
  static String dateTime(DateTime dateTime) {
    return _dateTimeFormat.format(dateTime.toLocal());
  }

  /// Format day name (e.g., "Saturday")
  static String dayName(DateTime dateTime) {
    return _dayFormat.format(dateTime.toLocal());
  }

  /// Format short day name (e.g., "Sat")
  static String shortDayName(DateTime dateTime) {
    return _shortDayFormat.format(dateTime.toLocal());
  }

  /// Format relative time (e.g., "in 2h", "Tomorrow", "28 Dec")
  static String relativeDate(DateTime dateTime) {
    final now = DateTime.now();
    final local = dateTime.toLocal();
    final difference = local.difference(now);

    // Past events
    if (difference.isNegative) {
      if (difference.inMinutes.abs() < 60) {
        return '${difference.inMinutes.abs()}m ago';
      }
      if (difference.inHours.abs() < 24) {
        return '${difference.inHours.abs()}h ago';
      }
      if (difference.inDays.abs() == 1) {
        return 'Yesterday';
      }
      return date(dateTime);
    }

    // Future events
    if (difference.inMinutes < 60) {
      return 'in ${difference.inMinutes}m';
    }
    if (difference.inHours < 24) {
      return 'in ${difference.inHours}h';
    }
    if (difference.inDays == 0) {
      return 'Today, ${time(dateTime)}';
    }
    if (difference.inDays == 1) {
      return 'Tomorrow, ${time(dateTime)}';
    }
    if (difference.inDays < 7) {
      return '${dayName(dateTime)}, ${time(dateTime)}';
    }

    return Formatters.dateTime(dateTime);
  }

  /// Format event status for display
  static String eventStatus(String status, DateTime? startTime, String? period) {
    switch (status) {
      case 'live':
        return period ?? 'LIVE';
      case 'finished':
        return 'FT';
      case 'cancelled':
        return 'Cancelled';
      case 'postponed':
        return 'Postponed';
      case 'scheduled':
      default:
        if (startTime != null) {
          return relativeDate(startTime);
        }
        return 'Upcoming';
    }
  }

  /// Format number with thousands separator (e.g., "1,234")
  static String number(int value) {
    return NumberFormat('#,###').format(value);
  }

  /// Format decimal number (e.g., "1.85")
  static String decimal(double value, [int decimalPlaces = 2]) {
    return value.toStringAsFixed(decimalPlaces);
  }

  /// Format odds (e.g., "1.85")
  static String odds(double value) {
    // Show 2 decimal places, but trim trailing zeros
    final formatted = value.toStringAsFixed(2);
    if (formatted.endsWith('0') && !formatted.endsWith('.00')) {
      return value.toStringAsFixed(1);
    }
    return formatted;
  }

  /// Format percentage (e.g., "75%")
  static String percentage(double value) {
    return '${value.toStringAsFixed(0)}%';
  }

  /// Format percentage from ratio (e.g., 0.75 -> "75%")
  static String percentageFromRatio(double ratio) {
    return '${(ratio * 100).toStringAsFixed(0)}%';
  }

  /// Format currency (coins, stars, gems)
  static String currency(int value, {bool compact = false}) {
    if (compact && value >= 1000) {
      if (value >= 1000000) {
        return '${(value / 1000000).toStringAsFixed(1)}M';
      }
      return '${(value / 1000).toStringAsFixed(1)}K';
    }
    return number(value);
  }

  /// Format win rate (e.g., "62%")
  static String winRate(int wins, int losses) {
    if (wins + losses == 0) return '0%';
    final rate = (wins / (wins + losses)) * 100;
    return '${rate.toStringAsFixed(0)}%';
  }

  /// Format streak (e.g., "🔥 5")
  static String streak(int value) {
    if (value <= 0) return '-';
    return '$value';
  }

  /// Format ordinal number (e.g., "1st", "2nd", "3rd")
  static String ordinal(int value) {
    if (value >= 11 && value <= 13) {
      return '${value}th';
    }
    switch (value % 10) {
      case 1:
        return '${value}st';
      case 2:
        return '${value}nd';
      case 3:
        return '${value}rd';
      default:
        return '${value}th';
    }
  }

  /// Format duration (e.g., "2h 30m")
  static String duration(Duration duration) {
    if (duration.inHours > 0) {
      final minutes = duration.inMinutes % 60;
      if (minutes > 0) {
        return '${duration.inHours}h ${minutes}m';
      }
      return '${duration.inHours}h';
    }
    if (duration.inMinutes > 0) {
      return '${duration.inMinutes}m';
    }
    return '${duration.inSeconds}s';
  }

  /// Capitalize first letter
  static String capitalize(String text) {
    if (text.isEmpty) return text;
    return text[0].toUpperCase() + text.substring(1).toLowerCase();
  }

  /// Format username for display
  static String username(String username) {
    return '@$username';
  }

  /// Truncate text with ellipsis
  static String truncate(String text, int maxLength) {
    if (text.length <= maxLength) return text;
    return '${text.substring(0, maxLength)}...';
  }

  /// Format potential return (e.g., "+185 coins")
  static String potentialReturn(int stake, double odds) {
    final potential = (stake * odds).floor();
    final profit = potential - stake;
    return '+$profit';
  }
}
