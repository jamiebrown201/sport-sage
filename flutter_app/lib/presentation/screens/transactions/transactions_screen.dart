import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/transaction.dart';
import '../../../providers/wallet_provider.dart';

/// Transaction history screen
class TransactionsScreen extends StatefulWidget {
  const TransactionsScreen({super.key});

  @override
  State<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends State<TransactionsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<WalletProvider>().loadTransactions(refresh: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final walletProvider = context.watch<WalletProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: const Text('Transaction History'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () => walletProvider.loadTransactions(refresh: true),
        color: AppColors.primary,
        child: walletProvider.isLoadingTransactions &&
                walletProvider.transactions.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : walletProvider.transactions.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.receipt_long_outlined,
                          size: 64,
                          color: AppColors.textSecondary,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'No transactions yet',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: walletProvider.transactions.length +
                        (walletProvider.hasMoreTransactions ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == walletProvider.transactions.length) {
                        if (!walletProvider.isLoadingTransactions) {
                          walletProvider.loadTransactions();
                        }
                        return const Padding(
                          padding: EdgeInsets.all(16),
                          child: Center(child: CircularProgressIndicator()),
                        );
                      }

                      final transaction = walletProvider.transactions[index];
                      return _TransactionCard(transaction: transaction);
                    },
                  ),
      ),
    );
  }
}

class _TransactionCard extends StatelessWidget {
  final Transaction transaction;

  const _TransactionCard({required this.transaction});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListTile(
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: _getIconColor().withOpacity(0.2),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            _getIcon(),
            color: _getIconColor(),
            size: 22,
          ),
        ),
        title: Text(
          transaction.type.displayName,
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w500,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (transaction.description != null)
              Text(
                transaction.description!,
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 12,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            Text(
              Formatters.relativeDate(transaction.createdAt),
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 11,
              ),
            ),
          ],
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              transaction.displayAmount,
              style: TextStyle(
                color: transaction.isCredit ? AppColors.success : AppColors.error,
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  transaction.currency.symbol,
                  style: const TextStyle(fontSize: 10),
                ),
                const SizedBox(width: 2),
                Text(
                  transaction.currency.displayName,
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  IconData _getIcon() {
    switch (transaction.type) {
      case TransactionType.welcomeBonus:
        return Icons.card_giftcard;
      case TransactionType.dailyTopup:
        return Icons.add_circle_outline;
      case TransactionType.predictionStake:
        return Icons.sports;
      case TransactionType.predictionWin:
        return Icons.emoji_events;
      case TransactionType.predictionRefund:
        return Icons.refresh;
      case TransactionType.referralBonus:
        return Icons.people;
      case TransactionType.challengeReward:
        return Icons.flag;
      case TransactionType.achievementReward:
        return Icons.military_tech;
      case TransactionType.purchase:
        return Icons.shopping_cart;
      case TransactionType.subscription:
        return Icons.star;
    }
  }

  Color _getIconColor() {
    if (transaction.isCredit) {
      return AppColors.success;
    }
    return AppColors.error;
  }
}
