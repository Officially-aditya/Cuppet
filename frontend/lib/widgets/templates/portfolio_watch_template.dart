import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../sydney_primitives.dart';
import 'template_utils.dart';

class PortfolioWatchTemplate extends StatelessWidget {
  const PortfolioWatchTemplate({required this.data, super.key});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final title = data['title']?.toString() ?? 'Portfolio Watch';
    final text = data['text']?.toString();
    final footer = data['footer']?.toString();
    final stocks = templateMaps(data['stocks']);
    final events = templateMaps(data['material_events']);
    final drivers = templateStrings(data['drivers']);
    final asOf = data['as_of']?.toString();
    final quality =
        data['data_quality'] is Map
            ? Map<String, dynamic>.from(data['data_quality'] as Map)
            : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (text != null && text.isNotEmpty) ...[
          MarkdownText(
            text: text,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: SydneyColors.onSurface,
              height: 1.45,
            ),
          ),
          const SizedBox(height: SydneySpacing.md),
        ],
        if (asOf != null || quality != null) ...[
          Wrap(
            spacing: SydneySpacing.xs,
            runSpacing: SydneySpacing.xs,
            children: [
              if (asOf != null) _MarketMeta(label: 'As of', value: asOf),
              if (quality != null)
                _MarketMeta(
                  label: 'Data',
                  value: quality['status']?.toString() ?? 'partial',
                ),
            ],
          ),
          if (quality?['detail'] != null) ...[
            const SizedBox(height: SydneySpacing.xs),
            Text(
              quality!['detail'].toString(),
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: SydneyColors.subtleInk),
            ),
          ],
          const SizedBox(height: SydneySpacing.md),
        ],
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.trending_up_rounded,
              color: SydneyColors.primary,
              size: 16,
            ),
            const SizedBox(width: SydneySpacing.xs),
            Text(
              'LIVE UPDATES',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: SydneyColors.primary,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        const SizedBox(height: SydneySpacing.md),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(SydneySpacing.md),
          decoration: BoxDecoration(
            color: SydneyColors.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(SydneyRadius.md),
            border: Border.all(color: SydneyColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title.toUpperCase(),
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: SydneyColors.onSurfaceVariant,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: SydneySpacing.md),
              if (stocks.isEmpty)
                Text(
                  'No stock data available.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: SydneyColors.subtleInk,
                  ),
                )
              else
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  crossAxisSpacing: SydneySpacing.sm,
                  mainAxisSpacing: SydneySpacing.sm,
                  childAspectRatio: 1.3,
                  children: [
                    for (final stock in stocks) _StockCard(stock: stock),
                  ],
                ),
              if (footer != null && footer.isNotEmpty) ...[
                const SizedBox(height: SydneySpacing.md),
                const Divider(height: 1, color: SydneyColors.line),
                const SizedBox(height: SydneySpacing.sm),
                Text(
                  footer,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: SydneyColors.subtleInk,
                    fontSize: 10,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (events.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.md),
          Text(
            'MATERIAL EVENTS',
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: SydneyColors.primary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: SydneySpacing.sm),
          for (final event in events)
            Padding(
              padding: const EdgeInsets.only(bottom: SydneySpacing.xs),
              child: _MaterialEvent(event: event),
            ),
        ],
        if (drivers.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.sm),
          Text(
            'Supported drivers',
            style: Theme.of(
              context,
            ).textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          for (final driver in drivers)
            Text(
              '• $driver',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: SydneyColors.onSurfaceVariant,
                height: 1.35,
              ),
            ),
        ],
      ],
    );
  }
}

class _MarketMeta extends StatelessWidget {
  const _MarketMeta({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: SydneyColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(SydneyRadius.xs),
      ),
      child: Text(
        '$label: $value',
        style: Theme.of(
          context,
        ).textTheme.labelSmall?.copyWith(color: SydneyColors.mutedInk),
      ),
    );
  }
}

class _MaterialEvent extends StatelessWidget {
  const _MaterialEvent({required this.event});

  final Map<String, dynamic> event;

  @override
  Widget build(BuildContext context) {
    final headline = event['headline']?.toString() ?? 'Market event';
    final summary = event['summary']?.toString();
    final ticker = event['ticker']?.toString();
    final category = event['category']?.toString();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(SydneySpacing.sm),
      decoration: BoxDecoration(
        color: SydneyColors.surface,
        borderRadius: BorderRadius.circular(SydneyRadius.sm),
        border: Border.all(color: SydneyColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (ticker != null || category != null)
            Text(
              [ticker, category].whereType<String>().join(' · ').toUpperCase(),
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: SydneyColors.primary,
                fontWeight: FontWeight.w800,
              ),
            ),
          Text(
            headline,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: SydneyColors.ink,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (summary != null && summary.isNotEmpty)
            Text(
              summary,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: SydneyColors.onSurfaceVariant,
              ),
            ),
        ],
      ),
    );
  }
}

class _StockCard extends StatelessWidget {
  const _StockCard({required this.stock});

  final Map<String, dynamic> stock;

  @override
  Widget build(BuildContext context) {
    final name = stock['name']?.toString() ?? 'Stock';
    final ticker = stock['ticker']?.toString() ?? '';
    final price = stock['price']?.toString() ?? 'N/A';
    final change = stock['change']?.toString() ?? '0.00%';
    final range = stock['range']?.toString() ?? '';

    final isPositive = !change.startsWith('-');
    final changeColor =
        isPositive ? const Color(0xFF2E7D32) : const Color(0xFFC62828);
    final changeBg =
        isPositive ? const Color(0xFFE8F5E9) : const Color(0xFFFFEBEE);

    return Container(
      padding: const EdgeInsets.all(SydneySpacing.sm),
      decoration: BoxDecoration(
        color: SydneyColors.surface,
        borderRadius: BorderRadius.circular(SydneyRadius.sm),
        border: Border.all(color: SydneyColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      ticker.isNotEmpty ? ticker : name,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.2,
                        color: SydneyColors.ink,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: changeBg,
                      borderRadius: BorderRadius.circular(SydneyRadius.xs),
                    ),
                    child: Text(
                      change,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: changeColor,
                        fontWeight: FontWeight.w900,
                        fontSize: 9.5,
                      ),
                    ),
                  ),
                ],
              ),
              if (ticker.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  name,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: SydneyColors.subtleInk,
                    fontSize: 9.5,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                price.startsWith('₹') ? price : '₹$price',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: SydneyColors.ink,
                  fontSize: 16,
                ),
              ),
              if (range.isNotEmpty &&
                  range != 'Gainer' &&
                  range != 'Loser') ...[
                const SizedBox(height: 2),
                Text(
                  range.replaceFirst('Range: ', ''),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: SydneyColors.subtleInk,
                    fontSize: 8.5,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
