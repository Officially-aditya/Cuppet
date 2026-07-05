import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../sydney_primitives.dart';

class PortfolioWatchTemplate extends StatelessWidget {
  const PortfolioWatchTemplate({required this.data, super.key});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final title = data['title']?.toString() ?? 'Portfolio Watch';
    final text = data['text']?.toString();
    final footer = data['footer']?.toString();
    final stocks = _maps(data['stocks']);

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
                    for (final stock in stocks)
                      _StockCard(stock: stock),
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
      ],
    );
  }

  List<Map<String, dynamic>> _maps(Object? value) {
    if (value is! List) {
      return const [];
    }
    return value
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
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
    final changeColor = isPositive ? const Color(0xFF2E7D32) : const Color(0xFFC62828);
    final changeBg = isPositive ? const Color(0xFFE8F5E9) : const Color(0xFFFFEBEE);

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
              if (range.isNotEmpty && range != 'Gainer' && range != 'Loser') ...[
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
