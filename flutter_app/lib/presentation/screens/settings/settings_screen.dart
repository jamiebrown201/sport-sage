import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/colors.dart';
import '../../../providers/settings_provider.dart';
import '../../../providers/auth_provider.dart';

/// Settings screen
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final settingsProvider = context.watch<SettingsProvider>();
    final authProvider = context.watch<AuthProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: const Text('Settings'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Account section
          _SectionHeader(title: 'Account'),
          _InfoTile(
            icon: Icons.email_outlined,
            title: 'Email',
            value: authProvider.user?.email ?? 'Not set',
          ),
          _InfoTile(
            icon: Icons.person_outline,
            title: 'Username',
            value: '@${authProvider.user?.username ?? 'user'}',
          ),

          const SizedBox(height: 24),

          // Notifications section
          _SectionHeader(title: 'Notifications'),
          _SwitchTile(
            icon: Icons.notifications_outlined,
            title: 'Push Notifications',
            value: settingsProvider.pushNotifications,
            onChanged: settingsProvider.setPushNotifications,
          ),
          _SwitchTile(
            icon: Icons.alarm,
            title: 'Prediction Reminders',
            subtitle: 'Get notified before events start',
            value: settingsProvider.predictionReminders,
            onChanged: settingsProvider.setPredictionReminders,
          ),
          _SwitchTile(
            icon: Icons.sports_score,
            title: 'Result Notifications',
            subtitle: 'Get notified when predictions settle',
            value: settingsProvider.resultNotifications,
            onChanged: settingsProvider.setResultNotifications,
          ),
          _SwitchTile(
            icon: Icons.campaign_outlined,
            title: 'Promotional Notifications',
            value: settingsProvider.promotionalNotifications,
            onChanged: settingsProvider.setPromotionalNotifications,
          ),

          const SizedBox(height: 24),

          // Privacy section
          _SectionHeader(title: 'Privacy'),
          _SwitchTile(
            icon: Icons.leaderboard_outlined,
            title: 'Show on Leaderboard',
            value: settingsProvider.showOnLeaderboard,
            onChanged: settingsProvider.setShowOnLeaderboard,
          ),
          _SwitchTile(
            icon: Icons.visibility_outlined,
            title: 'Show Online Status',
            value: settingsProvider.showOnlineStatus,
            onChanged: settingsProvider.setShowOnlineStatus,
          ),
          _SwitchTile(
            icon: Icons.person_add_outlined,
            title: 'Allow Friend Requests',
            value: settingsProvider.allowFriendRequests,
            onChanged: settingsProvider.setAllowFriendRequests,
          ),

          const SizedBox(height: 24),

          // Display section
          _SectionHeader(title: 'Display'),
          _SwitchTile(
            icon: Icons.view_compact_outlined,
            title: 'Compact Mode',
            subtitle: 'Show more content on screen',
            value: settingsProvider.compactMode,
            onChanged: settingsProvider.setCompactMode,
          ),
          _SwitchTile(
            icon: Icons.calculate_outlined,
            title: 'Decimal Odds',
            subtitle: 'Show odds as decimals (1.50 vs 1/2)',
            value: settingsProvider.showOddsAsDecimal,
            onChanged: settingsProvider.setShowOddsAsDecimal,
          ),

          const SizedBox(height: 24),

          // Support section
          _SectionHeader(title: 'Support'),
          _ActionTile(
            icon: Icons.help_outline,
            title: 'Help & FAQ',
            onTap: () {
              // TODO: Open help
            },
          ),
          _ActionTile(
            icon: Icons.policy_outlined,
            title: 'Terms of Service',
            onTap: () {
              // TODO: Open terms
            },
          ),
          _ActionTile(
            icon: Icons.privacy_tip_outlined,
            title: 'Privacy Policy',
            onTap: () {
              // TODO: Open privacy policy
            },
          ),
          _ActionTile(
            icon: Icons.feedback_outlined,
            title: 'Send Feedback',
            onTap: () {
              // TODO: Open feedback
            },
          ),

          const SizedBox(height: 24),

          // Danger zone
          _SectionHeader(title: 'Danger Zone'),
          _ActionTile(
            icon: Icons.restore,
            title: 'Reset Settings',
            iconColor: AppColors.warning,
            onTap: () async {
              final confirm = await showDialog<bool>(
                context: context,
                builder: (context) => AlertDialog(
                  backgroundColor: AppColors.card,
                  title: const Text('Reset Settings?'),
                  content: const Text(
                    'This will reset all settings to their default values.',
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text('Cancel'),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(context, true),
                      child: Text(
                        'Reset',
                        style: TextStyle(color: AppColors.warning),
                      ),
                    ),
                  ],
                ),
              );

              if (confirm == true) {
                await settingsProvider.resetToDefaults();
              }
            },
          ),
          _ActionTile(
            icon: Icons.logout,
            title: 'Sign Out',
            iconColor: AppColors.error,
            onTap: () async {
              await authProvider.signOut();
            },
          ),

          const SizedBox(height: 32),

          // App version
          Center(
            child: Text(
              'Sport Sage v1.0.0',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
              ),
            ),
          ),

          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        title,
        style: TextStyle(
          color: AppColors.textSecondary,
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String value;

  const _InfoTile({
    required this.icon,
    required this.title,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListTile(
        leading: Icon(icon, color: AppColors.textSecondary),
        title: Text(
          title,
          style: TextStyle(color: AppColors.textPrimary),
        ),
        trailing: Text(
          value,
          style: TextStyle(color: AppColors.textSecondary),
        ),
      ),
    );
  }
}

class _SwitchTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _SwitchTile({
    required this.icon,
    required this.title,
    this.subtitle,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListTile(
        leading: Icon(icon, color: AppColors.textSecondary),
        title: Text(
          title,
          style: TextStyle(color: AppColors.textPrimary),
        ),
        subtitle: subtitle != null
            ? Text(
                subtitle!,
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 12,
                ),
              )
            : null,
        trailing: Switch(
          value: value,
          onChanged: onChanged,
          activeColor: AppColors.primary,
        ),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final Color? iconColor;
  final VoidCallback onTap;

  const _ActionTile({
    required this.icon,
    required this.title,
    this.iconColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListTile(
        onTap: onTap,
        leading: Icon(icon, color: iconColor ?? AppColors.textSecondary),
        title: Text(
          title,
          style: TextStyle(
            color: iconColor ?? AppColors.textPrimary,
          ),
        ),
        trailing: Icon(
          Icons.chevron_right,
          color: AppColors.textSecondary,
        ),
      ),
    );
  }
}
