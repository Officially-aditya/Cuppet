import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens.dart';
import '../../models/assistant_memory.dart';
import '../../providers/memory_provider.dart';
import '../../widgets/workspace_primitives.dart';

class MemoryScreen extends ConsumerWidget {
  const MemoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final memories = ref.watch(assistantMemoriesProvider);
    final compacted = ref.watch(compactedMemoryProvider).asData?.value;
    return Scaffold(
      backgroundColor: CuppetWorkspaceColors.background,
      appBar: const WorkspaceAppBar(
        eyebrow: 'Settings',
        title: 'Memory',
        subtitle: 'Confirmed details used only by Assistant.',
      ),
      body: SafeArea(
        child: memories.when(
          loading:
              () => const Center(
                child: CircularProgressIndicator(
                  color: CuppetWorkspaceColors.primary,
                ),
              ),
          error:
              (error, _) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(SydneySpacing.page),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(error.toString(), textAlign: TextAlign.center),
                      const SizedBox(height: SydneySpacing.md),
                      OutlinedButton(
                        onPressed:
                            () => ref.invalidate(assistantMemoriesProvider),
                        child: const Text('Try again'),
                      ),
                    ],
                  ),
                ),
              ),
          data:
              (items) => ListView(
                padding: const EdgeInsets.fromLTRB(
                  SydneySpacing.page,
                  SydneySpacing.lg,
                  SydneySpacing.page,
                  SydneySpacing.xl,
                ),
                children: [
                  const Text(
                    'Cuppet stores explicit preferences immediately and asks before saving repeated inferred facts. Connector results and attachments are never remembered automatically.',
                  ),
                  const SizedBox(height: SydneySpacing.lg),
                  if (items.isEmpty && compacted == null)
                    const WorkspaceCard(
                      key: ValueKey('memory-empty-state'),
                      child: Text(
                        'No confirmed memories yet. Tell Assistant “Remember that…” to add one.',
                      ),
                    )
                  else ...[
                    for (final memory in items) ...[
                      _MemoryCard(
                        memory: memory,
                        onDelete: () => _deleteOne(context, ref, memory),
                      ),
                      const SizedBox(height: SydneySpacing.md),
                    ],
                    if (compacted != null) ...[
                      _CompactedMemoryCard(
                        memory: compacted,
                        onDelete: () => _deleteCompacted(context, ref),
                      ),
                      const SizedBox(height: SydneySpacing.md),
                    ],
                    const SizedBox(height: SydneySpacing.md),
                    OutlinedButton.icon(
                      key: const ValueKey('delete-all-memories'),
                      onPressed: () => _deleteAll(context, ref),
                      icon: const Icon(Icons.delete_forever_outlined),
                      label: const Text('Delete all memories'),
                    ),
                  ],
                ],
              ),
        ),
      ),
    );
  }

  Future<void> _deleteOne(
    BuildContext context,
    WidgetRef ref,
    AssistantMemory memory,
  ) async {
    try {
      await ref.read(memoryServiceProvider).deleteMemory(memory.id);
      ref.invalidate(assistantMemoriesProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Memory deleted.')));
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    }
  }

  Future<void> _deleteAll(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (dialogContext) => AlertDialog(
            title: const Text('Delete all memories?'),
            content: const Text(
              'This permanently removes every active and compacted Assistant memory. Your agents and conversations are not affected.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                key: const ValueKey('confirm-delete-all-memories'),
                onPressed: () => Navigator.of(dialogContext).pop(true),
                child: const Text('Delete all'),
              ),
            ],
          ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(memoryServiceProvider).deleteAllMemories();
      ref.invalidate(assistantMemoriesProvider);
      ref.invalidate(compactedMemoryProvider);
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    }
  }

  Future<void> _deleteCompacted(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (dialogContext) => AlertDialog(
            title: const Text('Delete compacted memory?'),
            content: const Text(
              'This permanently removes the compacted memory summary. Active confirmed memories are not affected.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                key: const ValueKey('confirm-delete-compacted-memory'),
                onPressed: () => Navigator.of(dialogContext).pop(true),
                child: const Text('Delete summary'),
              ),
            ],
          ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(memoryServiceProvider).deleteCompactedMemory();
      ref.invalidate(compactedMemoryProvider);
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    }
  }
}

class _CompactedMemoryCard extends StatelessWidget {
  const _CompactedMemoryCard({required this.memory, required this.onDelete});

  final CompactedMemory memory;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return WorkspaceCard(
      key: const ValueKey('compacted-memory-card'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.inventory_2_outlined,
                color: CuppetWorkspaceColors.primaryInk,
              ),
              const SizedBox(width: SydneySpacing.sm),
              Expanded(
                child: Text(
                  'Compacted memory',
                  style: Theme.of(
                    context,
                  ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              IconButton(
                tooltip: 'Delete compacted memory',
                onPressed: onDelete,
                icon: const Icon(Icons.delete_outline_rounded),
              ),
            ],
          ),
          const SizedBox(height: SydneySpacing.sm),
          Text(memory.summary),
          const SizedBox(height: SydneySpacing.xs),
          Text(
            '${memory.itemCount} compacted ${memory.itemCount == 1 ? 'item' : 'items'} · Read-only summary',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: CuppetWorkspaceColors.muted,
            ),
          ),
        ],
      ),
    );
  }
}

class _MemoryCard extends StatelessWidget {
  const _MemoryCard({required this.memory, required this.onDelete});

  final AssistantMemory memory;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return WorkspaceCard(
      key: ValueKey('memory-${memory.id}'),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.psychology_alt_outlined,
            color: CuppetWorkspaceColors.primaryInk,
          ),
          const SizedBox(width: SydneySpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  memory.text,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: CuppetWorkspaceColors.ink,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: SydneySpacing.xs),
                Text(
                  memory.type.replaceAll('_', ' '),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: CuppetWorkspaceColors.muted,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Delete memory',
            onPressed: onDelete,
            icon: const Icon(Icons.delete_outline_rounded),
          ),
        ],
      ),
    );
  }
}
