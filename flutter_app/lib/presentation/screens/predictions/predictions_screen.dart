import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/prediction.dart';
import '../../../providers/predictions_provider.dart';

/// User predictions screen
class PredictionsScreen extends StatefulWidget {
  const PredictionsScreen({super.key});

  @override
  State<PredictionsScreen> createState() => _PredictionsScreenState();
}

class _PredictionsScreenState extends State<PredictionsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadPredictions();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadPredictions() async {
    await context.read<PredictionsProvider>().loadPredictions(refresh: true);
  }

  @override
  Widget build(BuildContext context) {
    final predictionsProvider = context.watch<PredictionsProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: const Text('My Predictions'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          tabs: const [
            Tab(text: 'All'),
            Tab(text: 'Pending'),
            Tab(text: 'Settled'),
          ],
          onTap: (index) {
            String? status;
            if (index == 1) status = 'pending';
            if (index == 2) status = 'won'; // Will also fetch lost
            predictionsProvider.setStatusFilter(status);
          },
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _loadPredictions,
        color: AppColors.primary,
        child: predictionsProvider.isLoading && predictionsProvider.predictions.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : predictionsProvider.predictions.isEmpty
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
                          'No predictions yet',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Start making predictions on events!',
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: predictionsProvider.predictions.length +
                        (predictionsProvider.hasMore ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == predictionsProvider.predictions.length) {
                        if (!predictionsProvider.isLoadingMore) {
                          predictionsProvider.loadPredictions();
                        }
                        return const Padding(
                          padding: EdgeInsets.all(16),
                          child: Center(child: CircularProgressIndicator()),
                        );
                      }

                      final prediction = predictionsProvider.predictions[index];
                      return _PredictionCard(prediction: prediction);
                    },
                  ),
      ),
    );
  }
}

class _PredictionCard extends StatelessWidget {
  final Prediction prediction;

  const _PredictionCard({required this.prediction});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _getBorderColor(),
          width: prediction.isSettled ? 2 : 0,
        ),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        _StatusBadge(status: prediction.status),
                        const SizedBox(width: 8),
                        Text(
                          prediction.isSingle ? 'Single' : '${prediction.selectionCount}-Fold',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      Formatters.relativeDate(prediction.createdAt),
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Event and selection
                if (prediction.event != null) ...[
                  Text(
                    prediction.event!.title,
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  if (prediction.outcome != null)
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.cardElevated,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            prediction.outcome!.name,
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '@ ${Formatters.odds(prediction.odds)}',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                ],

                // For accumulators, show selection count
                if (prediction.isAccumulator && prediction.selections != null) ...[
                  ...prediction.selections!.take(3).map((selection) => Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Row(
                          children: [
                            _SelectionStatusIcon(status: selection.status),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                selection.event.title,
                                style: TextStyle(
                                  color: AppColors.textPrimary,
                                  fontSize: 13,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Text(
                              Formatters.odds(selection.odds),
                              style: TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      )),
                  if (prediction.selections!.length > 3)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        '+${prediction.selections!.length - 3} more',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                    ),
                ],
              ],
            ),
          ),

          // Footer
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.cardElevated,
              borderRadius: const BorderRadius.vertical(
                bottom: Radius.circular(16),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Stake',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 11,
                      ),
                    ),
                    Text(
                      '${prediction.stake} coins',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(
                      'Odds',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 11,
                      ),
                    ),
                    Text(
                      Formatters.odds(prediction.totalOdds),
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      prediction.isSettled ? 'Return' : 'Potential',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 11,
                      ),
                    ),
                    Text(
                      prediction.isSettled
                          ? '${prediction.settledCoins ?? 0} coins'
                          : '${prediction.potentialCoins} coins',
                      style: TextStyle(
                        color: prediction.status == PredictionStatus.won
                            ? AppColors.success
                            : AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Color _getBorderColor() {
    switch (prediction.status) {
      case PredictionStatus.won:
        return AppColors.success;
      case PredictionStatus.lost:
        return AppColors.error;
      default:
        return Colors.transparent;
    }
  }
}

class _StatusBadge extends StatelessWidget {
  final PredictionStatus status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _getColor().withOpacity(0.2),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        status.displayName,
        style: TextStyle(
          color: _getColor(),
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Color _getColor() {
    switch (status) {
      case PredictionStatus.won:
        return AppColors.success;
      case PredictionStatus.lost:
        return AppColors.error;
      case PredictionStatus.pending:
        return AppColors.warning;
      case PredictionStatus.voidStatus:
        return AppColors.textSecondary;
      case PredictionStatus.cashout:
        return AppColors.primary;
    }
  }
}

class _SelectionStatusIcon extends StatelessWidget {
  final PredictionStatus status;

  const _SelectionStatusIcon({required this.status});

  @override
  Widget build(BuildContext context) {
    IconData icon;
    Color color;

    switch (status) {
      case PredictionStatus.won:
        icon = Icons.check_circle;
        color = AppColors.success;
        break;
      case PredictionStatus.lost:
        icon = Icons.cancel;
        color = AppColors.error;
        break;
      default:
        icon = Icons.radio_button_unchecked;
        color = AppColors.textSecondary;
    }

    return Icon(icon, size: 16, color: color);
  }
}
