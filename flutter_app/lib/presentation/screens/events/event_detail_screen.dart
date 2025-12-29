import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/colors.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/event.dart';
import '../../../data/models/market.dart';
import '../../../providers/events_provider.dart';
import '../../../providers/accumulator_provider.dart';
import '../../../providers/predictions_provider.dart';
import '../../../providers/wallet_provider.dart';

/// Event detail screen with markets and bet slip
class EventDetailScreen extends StatefulWidget {
  final String eventId;

  const EventDetailScreen({
    super.key,
    required this.eventId,
  });

  @override
  State<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends State<EventDetailScreen> {
  @override
  void initState() {
    super.initState();
    // Defer data loading to after the first frame to avoid setState during build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadEvent();
    });
  }

  Future<void> _loadEvent() async {
    await context.read<EventsProvider>().loadEventById(widget.eventId);
  }

  @override
  Widget build(BuildContext context) {
    final eventsProvider = context.watch<EventsProvider>();
    final accumulatorProvider = context.watch<AccumulatorProvider>();
    final event = eventsProvider.selectedEvent;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: Text(event?.competition.name ?? 'Event'),
      ),
      body: eventsProvider.isLoadingEvent
          ? const Center(child: CircularProgressIndicator())
          : event == null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.error_outline,
                        size: 64,
                        color: AppColors.textSecondary,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Event not found',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                )
              : Stack(
                  children: [
                    CustomScrollView(
                      slivers: [
                        // Event header
                        SliverToBoxAdapter(
                          child: _EventHeader(event: event),
                        ),

                        // Markets
                        SliverPadding(
                          padding: const EdgeInsets.all(16),
                          sliver: SliverList(
                            delegate: SliverChildBuilderDelegate(
                              (context, index) {
                                final market = event.markets[index];
                                return _MarketCard(
                                  event: event,
                                  market: market,
                                );
                              },
                              childCount: event.markets.length,
                            ),
                          ),
                        ),

                        // Bottom padding for bet slip
                        SliverPadding(
                          padding: EdgeInsets.only(
                            bottom: accumulatorProvider.isEmpty ? 16 : 100,
                          ),
                        ),
                      ],
                    ),

                    // Bet slip
                    if (!accumulatorProvider.isEmpty)
                      Positioned(
                        left: 16,
                        right: 16,
                        bottom: 16,
                        child: _BetSlip(),
                      ),
                  ],
                ),
    );
  }
}

class _EventHeader extends StatelessWidget {
  final Event event;

  const _EventHeader({required this.event});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          // Status badge
          if (event.isLive)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: AppColors.error.withOpacity(0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: AppColors.error,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    event.period ?? 'LIVE',
                    style: TextStyle(
                      color: AppColors.error,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),

          // Teams and score
          Row(
            children: [
              Expanded(
                child: Column(
                  children: [
                    Container(
                      width: 60,
                      height: 60,
                      decoration: BoxDecoration(
                        color: AppColors.cardElevated,
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          event.homeName.substring(0, 1),
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.bold,
                            fontSize: 24,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      event.homeName,
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),

              // Score or time
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: event.isLive || event.isFinished
                    ? Column(
                        children: [
                          Text(
                            '${event.homeScore ?? 0} - ${event.awayScore ?? 0}',
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 28,
                            ),
                          ),
                          if (event.isFinished)
                            Text(
                              'Full Time',
                              style: TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 12,
                              ),
                            ),
                        ],
                      )
                    : Column(
                        children: [
                          Text(
                            Formatters.time(event.startTime),
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 24,
                            ),
                          ),
                          Text(
                            Formatters.date(event.startTime),
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
              ),

              Expanded(
                child: Column(
                  children: [
                    Container(
                      width: 60,
                      height: 60,
                      decoration: BoxDecoration(
                        color: AppColors.cardElevated,
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          event.awayName.substring(0, 1),
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.bold,
                            fontSize: 24,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      event.awayName,
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MarketCard extends StatelessWidget {
  final Event event;
  final Market market;

  const _MarketCard({
    required this.event,
    required this.market,
  });

  @override
  Widget build(BuildContext context) {
    final accumulatorProvider = context.watch<AccumulatorProvider>();

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              market.name,
              style: TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const Divider(color: AppColors.divider, height: 1),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: market.outcomes.map((outcome) {
                final isSelected = accumulatorProvider.isSelected(
                  event.id,
                  market.id,
                  outcome.id,
                );

                return GestureDetector(
                  onTap: event.isOpenForPredictions
                      ? () {
                          accumulatorProvider.toggleSelection(
                            event: event,
                            market: market,
                            outcome: outcome,
                          );
                        }
                      : null,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? AppColors.primary.withOpacity(0.2)
                          : AppColors.cardElevated,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isSelected
                            ? AppColors.primary
                            : Colors.transparent,
                        width: 2,
                      ),
                    ),
                    child: Column(
                      children: [
                        Text(
                          outcome.shortName,
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          Formatters.odds(outcome.odds),
                          style: TextStyle(
                            color: isSelected
                                ? AppColors.primary
                                : AppColors.textPrimary,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _BetSlip extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final accumulatorProvider = context.watch<AccumulatorProvider>();
    final walletProvider = context.watch<WalletProvider>();
    final predictionsProvider = context.read<PredictionsProvider>();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 12,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                accumulatorProvider.isSingle
                    ? 'Single Bet'
                    : '${accumulatorProvider.selectionCount}-Fold',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              TextButton(
                onPressed: () => accumulatorProvider.clear(),
                child: Text(
                  'Clear',
                  style: TextStyle(color: AppColors.error),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Total Odds',
                style: TextStyle(color: AppColors.textSecondary),
              ),
              Text(
                Formatters.odds(accumulatorProvider.totalOdds),
                style: TextStyle(
                  color: AppColors.primary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Potential Return',
                style: TextStyle(color: AppColors.textSecondary),
              ),
              Text(
                '${accumulatorProvider.potentialReturn} coins',
                style: TextStyle(
                  color: AppColors.success,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: walletProvider.canAfford(accumulatorProvider.stake)
                  ? () async {
                      // Place bet
                      if (accumulatorProvider.isSingle) {
                        final selection = accumulatorProvider.selections.first;
                        await predictionsProvider.createSinglePrediction(
                          eventId: selection.event.id,
                          marketId: selection.market.id,
                          outcomeId: selection.outcome.id,
                          stake: accumulatorProvider.stake,
                          odds: selection.outcome.odds,
                        );
                      } else {
                        // TODO: Implement accumulator creation
                      }

                      if (context.mounted) {
                        walletProvider.deductCoins(accumulatorProvider.stake);
                        accumulatorProvider.clear();
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Prediction placed!'),
                            backgroundColor: AppColors.success,
                          ),
                        );
                      }
                    }
                  : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.background,
                disabledBackgroundColor: AppColors.primary.withOpacity(0.5),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(
                'Place Bet (${accumulatorProvider.stake} coins)',
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
