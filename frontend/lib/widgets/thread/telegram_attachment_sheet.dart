import 'dart:typed_data';
import 'package:camera/camera.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:photo_manager/photo_manager.dart';

import '../../design/tokens.dart';

class PickedAttachmentItem {
  const PickedAttachmentItem({
    required this.bytes,
    required this.name,
    required this.size,
  });

  final Uint8List bytes;
  final String name;
  final int size;
}

enum AttachmentTab { gallery, file }

class TelegramAttachmentSheet extends StatefulWidget {
  const TelegramAttachmentSheet({
    required this.onFilesPicked,
    super.key,
  });

  final Function(List<PickedAttachmentItem> files, bool storeInDrive) onFilesPicked;

  @override
  State<TelegramAttachmentSheet> createState() => _TelegramAttachmentSheetState();
}

class _TelegramAttachmentSheetState extends State<TelegramAttachmentSheet> {
  AttachmentTab _activeTab = AttachmentTab.gallery;
  bool _saveToDrive = false;

  CameraController? _cameraController;
  bool _cameraInitialized = false;

  List<AssetEntity> _galleryAssets = [];
  bool _loadingGallery = true;

  final ImagePicker _imagePicker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _initCamera();
    _loadGalleryPhotos();
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      if (cameras.isNotEmpty) {
        final controller = CameraController(
          cameras.first,
          ResolutionPreset.medium,
          enableAudio: false,
        );
        await controller.initialize();
        if (mounted) {
          setState(() {
            _cameraController = controller;
            _cameraInitialized = true;
          });
        } else {
          await controller.dispose();
        }
      }
    } catch (_) {}
  }

  Future<void> _loadGalleryPhotos() async {
    try {
      final PermissionState ps = await PhotoManager.requestPermissionExtend();
      if (ps.isAuth || ps.hasAccess) {
        final List<AssetPathEntity> paths = await PhotoManager.getAssetPathList(
          onlyAll: true,
          type: RequestType.image,
        );
        if (paths.isNotEmpty) {
          final List<AssetEntity> entities = await paths.first.getAssetListRange(
            start: 0,
            end: 45,
          );
          if (mounted) {
            setState(() {
              _galleryAssets = entities;
              _loadingGallery = false;
            });
            return;
          }
        }
      }
    } catch (_) {}
    if (mounted) {
      setState(() => _loadingGallery = false);
    }
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    super.dispose();
  }

  Future<void> _captureFromCamera() async {
    try {
      final xfile = await _imagePicker.pickImage(
        source: ImageSource.camera,
        imageQuality: 85,
      );
      if (xfile != null && mounted) {
        final bytes = await xfile.readAsBytes();
        final size = bytes.length;
        final name = xfile.name.isNotEmpty
            ? xfile.name
            : 'photo_${DateTime.now().millisecondsSinceEpoch}.jpg';
        Navigator.pop(context);
        widget.onFilesPicked(
          [PickedAttachmentItem(bytes: bytes, name: name, size: size)],
          _saveToDrive,
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open camera interface.')),
        );
      }
    }
  }

  Future<void> _selectAsset(AssetEntity asset) async {
    try {
      final file = await asset.file;
      if (file != null && mounted) {
        final bytes = await file.readAsBytes();
        final size = bytes.length;
        final name = asset.title ?? 'photo_${DateTime.now().millisecondsSinceEpoch}.jpg';
        Navigator.pop(context);
        widget.onFilesPicked(
          [PickedAttachmentItem(bytes: bytes, name: name, size: size)],
          _saveToDrive,
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not read photo.')),
        );
      }
    }
  }

  Future<void> _pickFromGallery() async {
    try {
      final images = await _imagePicker.pickMultiImage(imageQuality: 85);
      if (images.isNotEmpty && mounted) {
        final items = <PickedAttachmentItem>[];
        for (final img in images) {
          final bytes = await img.readAsBytes();
          items.add(
            PickedAttachmentItem(
              bytes: bytes,
              name: img.name.isNotEmpty
                  ? img.name
                  : 'image_${DateTime.now().millisecondsSinceEpoch}.jpg',
              size: bytes.length,
            ),
          );
        }
        Navigator.pop(context);
        widget.onFilesPicked(items, _saveToDrive);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not access photo gallery.')),
        );
      }
    }
  }

  Future<void> _pickFiles() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        allowMultiple: true,
        withData: true,
        type: FileType.custom,
        allowedExtensions: const [
          'jpg',
          'jpeg',
          'png',
          'webp',
          'pdf',
          'txt',
          'md',
          'markdown',
          'csv',
          'json',
        ],
      );
      if (result != null && result.files.isNotEmpty && mounted) {
        final items = <PickedAttachmentItem>[];
        for (final f in result.files) {
          if (f.bytes != null) {
            items.add(
              PickedAttachmentItem(
                bytes: f.bytes!,
                name: f.name,
                size: f.size,
              ),
            );
          }
        }
        if (items.isNotEmpty) {
          Navigator.pop(context);
          widget.onFilesPicked(items, _saveToDrive);
        }
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open file picker.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    final sheetHeight = mediaQuery.size.height * 0.58;

    return Container(
      height: sheetHeight,
      decoration: const BoxDecoration(
        color: CuppetWorkspaceColors.card,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(24),
        ),
      ),
      child: Column(
        children: [
          // Drag handle
          const SizedBox(height: SydneySpacing.sm),
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: CuppetWorkspaceColors.panelBorder,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: SydneySpacing.xs),

          // Google Drive toggle option header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: SydneySpacing.lg),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Save backup copy to Google Drive',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: CuppetWorkspaceColors.ink,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        'Requires linked Google Drive connector',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: CuppetWorkspaceColors.muted,
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
                ),
                Transform.scale(
                  scale: 0.8,
                  child: Switch.adaptive(
                    value: _saveToDrive,
                    onChanged: (val) => setState(() => _saveToDrive = val),
                    activeColor: CuppetWorkspaceColors.primary,
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: CuppetWorkspaceColors.panelBorder),

          // Tab content area
          Expanded(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 250),
              child: _activeTab == AttachmentTab.gallery
                  ? _buildGalleryTab(context)
                  : _buildFileTab(context),
            ),
          ),

          // Bottom pill navigation bar with reduced width (by ~75%)
          _buildPillBottomBar(context),
        ],
      ),
    );
  }

  Widget _buildGalleryTab(BuildContext context) {
    // Grid: 1st tile is Live Camera, followed by preloaded gallery photos + 1 fallback tile
    final totalCount = 1 + _galleryAssets.length + 1;

    return Padding(
      key: const ValueKey('tab-gallery'),
      padding: const EdgeInsets.all(SydneySpacing.md),
      child: GridView.builder(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          mainAxisSpacing: SydneySpacing.sm,
          crossAxisSpacing: SydneySpacing.sm,
        ),
        itemCount: totalCount,
        itemBuilder: (context, index) {
          if (index == 0) {
            // Live Camera Tile: tapping opens camera interface
            return _buildCameraTile(context);
          }

          final assetIndex = index - 1;
          if (assetIndex < _galleryAssets.length) {
            // Preloaded Gallery Photo Tile
            final asset = _galleryAssets[assetIndex];
            return GestureDetector(
              onTap: () => _selectAsset(asset),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: FutureBuilder<Uint8List?>(
                  future: asset.thumbnailDataWithSize(const ThumbnailSize(300, 300)),
                  builder: (context, snapshot) {
                    if (snapshot.hasData && snapshot.data != null) {
                      return Image.memory(
                        snapshot.data!,
                        fit: BoxFit.cover,
                      );
                    }
                    return Container(
                      color: CuppetWorkspaceColors.softSage,
                    );
                  },
                ),
              ),
            );
          }

          // Fallback / More Photos Tile
          return GestureDetector(
            onTap: _pickFromGallery,
            child: Container(
              decoration: BoxDecoration(
                color: CuppetWorkspaceColors.softSage,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: CuppetWorkspaceColors.panelBorder),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.add_photo_alternate_rounded,
                    color: CuppetWorkspaceColors.primaryInk,
                    size: 24,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'More Photos',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: CuppetWorkspaceColors.ink,
                      fontWeight: FontWeight.w700,
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildCameraTile(BuildContext context) {
    return GestureDetector(
      onTap: _captureFromCamera,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.black87,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: CuppetWorkspaceColors.border, width: 1.5),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (_cameraInitialized && _cameraController != null)
              FittedBox(
                fit: BoxFit.cover,
                child: SizedBox(
                  width: _cameraController!.value.previewSize?.height ?? 100,
                  height: _cameraController!.value.previewSize?.width ?? 100,
                  child: CameraPreview(_cameraController!),
                ),
              )
            else
              Container(
                color: const Color(0xFF1E1E24),
                child: const Center(
                  child: Icon(
                    Icons.camera_alt_rounded,
                    color: Colors.white70,
                    size: 26,
                  ),
                ),
              ),

            // Live badge overlay
            Positioned(
              top: 5,
              left: 5,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.6),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 5,
                      height: 5,
                      decoration: const BoxDecoration(
                        color: Color(0xFF22C55E),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 3),
                    const Text(
                      'LIVE',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 8,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Center capture icon indicator
            Center(
              child: Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.35),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white.withOpacity(0.85), width: 1.5),
                ),
                child: const Icon(
                  Icons.camera_rounded,
                  color: Colors.white,
                  size: 16,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFileTab(BuildContext context) {
    return Padding(
      key: const ValueKey('tab-file'),
      padding: const EdgeInsets.all(SydneySpacing.lg),
      child: Column(
        children: [
          _buildFileCategoryTile(
            context,
            icon: Icons.description_outlined,
            title: 'Documents & PDFs',
            subtitle: 'PDF, TXT, MD, CSV, JSON',
            onTap: _pickFiles,
          ),
          const SizedBox(height: SydneySpacing.md),
          _buildFileCategoryTile(
            context,
            icon: Icons.folder_open_rounded,
            title: 'Browse Files',
            subtitle: 'Select files from device storage',
            onTap: _pickFiles,
          ),
        ],
      ),
    );
  }

  Widget _buildFileCategoryTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(SydneySpacing.md),
        decoration: BoxDecoration(
          color: CuppetWorkspaceColors.softSage,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: CuppetWorkspaceColors.panelBorder),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: CuppetWorkspaceColors.card,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: CuppetWorkspaceColors.border),
              ),
              child: Icon(icon, color: CuppetWorkspaceColors.primaryInk, size: 24),
            ),
            const SizedBox(width: SydneySpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: CuppetWorkspaceColors.muted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: CuppetWorkspaceColors.muted,
            ),
          ],
        ),
      ),
    );
  }

  /// Cylinder width reduced by 75% (width: 175px) centered at the bottom
  Widget _buildPillBottomBar(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: SydneySpacing.md),
      child: Center(
        child: Container(
          width: 175,
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: CuppetWorkspaceColors.softSage,
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: CuppetWorkspaceColors.panelBorder),
          ),
          child: Row(
            children: [
              Expanded(
                child: _buildNavItem(
                  context,
                  tab: AttachmentTab.gallery,
                  label: 'Gallery',
                ),
              ),
              Expanded(
                child: _buildNavItem(
                  context,
                  tab: AttachmentTab.file,
                  label: 'File',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(
    BuildContext context, {
    required AttachmentTab tab,
    required String label,
  }) {
    final isSelected = _activeTab == tab;
    return GestureDetector(
      onTap: () => setState(() => _activeTab = tab),
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? CuppetWorkspaceColors.card : Colors.transparent,
          borderRadius: BorderRadius.circular(26),
          boxShadow: isSelected
              ? const [
                  BoxShadow(
                    color: Color(0x0F000000),
                    blurRadius: 4,
                    offset: Offset(0, 1),
                  ),
                ]
              : null,
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
              color: isSelected
                  ? CuppetWorkspaceColors.ink
                  : CuppetWorkspaceColors.muted,
            ),
          ),
        ),
      ),
    );
  }
}
