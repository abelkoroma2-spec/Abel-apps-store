import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

const _supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const _supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

const _ink = Color(0xFF173C32);
const _leaf = Color(0xFF237653);
const _paper = Color(0xFFF5F6F0);
const _coral = Color(0xFFFF765E);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  String? configurationError;

  if (_supabaseUrl.isEmpty || _supabaseAnonKey.isEmpty) {
    configurationError = 'Supabase is not configured. Start Flutter with SUPABASE_URL and SUPABASE_ANON_KEY.';
  } else {
    try {
      await Supabase.initialize(
        url: _supabaseUrl,
        publishableKey: _supabaseAnonKey,
        debug: false,
      );
    } catch (error) {
      configurationError = error.toString();
    }
  }

  runApp(AbelAppsStore(configurationError: configurationError));
}

class AppVersion {
  const AppVersion({
    required this.version,
    required this.apkPath,
    required this.sizeBytes,
    required this.notes,
    required this.releasedAt,
  });

  factory AppVersion.fromJson(Map<String, dynamic> json) {
    return AppVersion(
      version: json['version'] as String? ?? '',
      apkPath: json['apk_path'] as String? ?? '',
      sizeBytes: (json['size_bytes'] as num?)?.toInt() ?? 0,
      notes: json['notes'] as String? ?? '',
      releasedAt:
          DateTime.tryParse(json['released_at'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }

  final String version;
  final String apkPath;
  final int sizeBytes;
  final String notes;
  final DateTime releasedAt;

  String get sizeLabel {
    if (sizeBytes >= 1048576) {
      return '${(sizeBytes / 1048576).toStringAsFixed(1)} MB';
    }
    return '${(sizeBytes / 1024).ceil()} KB';
  }
}

class StoreApp {
  const StoreApp({
    required this.id,
    required this.name,
    required this.category,
    required this.shortDescription,
    required this.description,
    required this.features,
    required this.iconUrl,
    required this.downloads,
    required this.versions,
  });

  factory StoreApp.fromJson(Map<String, dynamic> json) {
    final versions = <AppVersion>[];
    for (final value in json['versions'] as List<dynamic>? ?? const []) {
      if (value is Map) {
        versions.add(AppVersion.fromJson(Map<String, dynamic>.from(value)));
      }
    }
    versions.sort(
      (first, second) => second.releasedAt.compareTo(first.releasedAt),
    );

    return StoreApp(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Untitled app',
      category: json['category'] as String? ?? 'Other',
      shortDescription: json['short_desc'] as String? ?? '',
      description: json['description'] as String? ?? '',
      features: List<String>.from(json['features'] as List? ?? const []),
      iconUrl: json['icon_url'] as String?,
      downloads: (json['downloads'] as num?)?.toInt() ?? 0,
      versions: versions,
    );
  }

  final String id;
  final String name;
  final String category;
  final String shortDescription;
  final String description;
  final List<String> features;
  final String? iconUrl;
  final int downloads;
  final List<AppVersion> versions;

  AppVersion? get latestVersion => versions.isEmpty ? null : versions.first;

  Color get iconColor => switch (category) {
    'Education' => const Color(0xFFBFE4D2),
    'Games' => const Color(0xFFFFD77A),
    'Music' => const Color(0xFFF7B7A7),
    'Tools' => const Color(0xFFB9D7E8),
    _ => const Color(0xFFE6D1A8),
  };

  IconData get fallbackIcon => switch (category) {
    'Education' => Icons.menu_book_rounded,
    'Games' => Icons.extension_rounded,
    'Music' => Icons.music_note_rounded,
    'Tools' => Icons.build_rounded,
    _ => Icons.apps_rounded,
  };
}

Future<List<StoreApp>> _fetchApps() async {
  final rows = await Supabase.instance.client
      .from('apps')
      .select('*, versions(*)')
      .eq('published', true)
      .order('created_at', ascending: false);

  return rows
      .map((row) => StoreApp.fromJson(Map<String, dynamic>.from(row)))
      .toList();
}

class AbelAppsStore extends StatelessWidget {
  const AbelAppsStore({super.key, this.initialApps, this.configurationError});

  final List<StoreApp>? initialApps;
  final String? configurationError;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Abel Apps Store',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: _leaf),
        scaffoldBackgroundColor: _paper,
        useMaterial3: true,
      ),
      home: StoreHome(
        initialApps: initialApps,
        configurationError: configurationError,
      ),
    );
  }
}

class StoreHome extends StatefulWidget {
  const StoreHome({super.key, this.initialApps, this.configurationError});

  final List<StoreApp>? initialApps;
  final String? configurationError;

  @override
  State<StoreHome> createState() => _StoreHomeState();
}

class _StoreHomeState extends State<StoreHome> {
  final _searchController = TextEditingController();
  late Future<List<StoreApp>> _appsFuture;
  String _query = '';
  String _category = 'All';
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _appsFuture = _loadApps();
  }

  Future<List<StoreApp>> _loadApps() {
    if (widget.initialApps != null) return Future.value(widget.initialApps);
    if (widget.configurationError != null) {
      return Future.error(StateError(widget.configurationError!));
    }
    return _fetchApps();
  }

  void _retryLoading() {
    setState(() => _appsFuture = _loadApps());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 760),
            child: _tab == 0 ? _buildExplore() : _buildOtherTab(),
          ),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (index) => setState(() => _tab = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.grid_view_rounded),
            label: 'Explore',
          ),
          NavigationDestination(
            icon: Icon(Icons.download_outlined),
            label: 'Downloads',
          ),
          NavigationDestination(
            icon: Icon(Icons.info_outline_rounded),
            label: 'About',
          ),
        ],
      ),
    );
  }

  Widget _buildExplore() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(22, 16, 22, 30),
      children: [
        _buildBrand(),
        const SizedBox(height: 22),
        _buildIntro(),
        const SizedBox(height: 18),
        _buildSearch(),
        const SizedBox(height: 12),
        _buildCategories(),
        const SizedBox(height: 18),
        FutureBuilder<List<StoreApp>>(
          future: _appsFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Padding(
                padding: EdgeInsets.symmetric(vertical: 38),
                child: Center(child: CircularProgressIndicator()),
              );
            }
            if (snapshot.hasError) return _buildLoadError(snapshot.error!);

            final query = _query.toLowerCase();
            final apps = (snapshot.data ?? const <StoreApp>[]).where((app) {
              final matchesCategory =
                  _category == 'All' || app.category == _category;
              final searchable =
                  '${app.name} ${app.shortDescription} ${app.category}'
                      .toLowerCase();
              return matchesCategory && searchable.contains(query);
            }).toList();

            if (apps.isEmpty) {
              return _buildEmptySearch(snapshot.data?.isEmpty ?? true);
            }

            return Column(
              children: apps
                  .map(
                    (app) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _buildAppTile(app),
                    ),
                  )
                  .toList(),
            );
          },
        ),
      ],
    );
  }

  Widget _buildBrand() {
    return Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: const BoxDecoration(color: _ink, shape: BoxShape.circle),
          child: const Icon(Icons.apps_rounded, color: Colors.white, size: 22),
        ),
        const SizedBox(width: 10),
        const Text(
          'ABEL',
          style: TextStyle(
            color: _ink,
            fontSize: 14,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.2,
          ),
        ),
        const Text(
          '  /  APPS STORE',
          style: TextStyle(
            color: _leaf,
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.7,
          ),
        ),
      ],
    );
  }

  Widget _buildIntro() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(22, 24, 22, 22),
      decoration: const BoxDecoration(
        color: _ink,
        borderRadius: BorderRadius.all(Radius.circular(8)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'MADE BY ABEL',
            style: TextStyle(
              color: Color(0xFF9ED9B9),
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.4,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Small apps.\nBig ideas.',
            style: TextStyle(
              color: Colors.white,
              fontSize: 34,
              height: 1.05,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 10),
          const Text(
            'Explore useful Android apps made with care.',
            style: TextStyle(color: Color(0xFFD7E5DC), fontSize: 14),
          ),
          const SizedBox(height: 18),
          Container(width: 42, height: 4, color: _coral),
        ],
      ),
    );
  }

  Widget _buildSearch() {
    return TextField(
      controller: _searchController,
      onChanged: (value) => setState(() => _query = value.trim()),
      decoration: InputDecoration(
        hintText: 'Search apps',
        prefixIcon: const Icon(Icons.search_rounded),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFE1E5DC)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFE1E5DC)),
        ),
      ),
    );
  }

  Widget _buildCategories() {
    const categories = [
      'All',
      'Education',
      'Games',
      'Music',
      'Business',
      'Tools',
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: categories.map((category) {
          final selected = _category == category;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(category),
              selected: selected,
              showCheckmark: false,
              onSelected: (_) => setState(() => _category = category),
              backgroundColor: Colors.white,
              selectedColor: const Color(0xFFD9EBDD),
              side: BorderSide(
                color: selected
                    ? const Color(0xFFA6CEB0)
                    : const Color(0xFFE1E5DC),
              ),
              labelStyle: TextStyle(
                color: selected ? _ink : const Color(0xFF56625A),
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(6),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildAppTile(StoreApp app) {
    final version = app.latestVersion;
    return InkWell(
      onTap: () => _showAppDetails(app),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: const Color(0xFFE1E5DC)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            _buildAppIcon(app, 58),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    app.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: _ink,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    app.shortDescription,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFF657168),
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    version == null
                        ? 'APK COMING SOON'
                        : 'V${version.version}  /  ${version.sizeLabel}',
                    style: const TextStyle(
                      color: _leaf,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Color(0xFF657168)),
          ],
        ),
      ),
    );
  }

  Widget _buildAppIcon(StoreApp app, double size) {
    final icon = Icon(app.fallbackIcon, color: _ink, size: size * 0.52);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: app.iconColor,
        borderRadius: BorderRadius.circular(8),
      ),
      clipBehavior: Clip.antiAlias,
      child: app.iconUrl == null
          ? icon
          : Image.network(
              app.iconUrl!,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) => icon,
            ),
    );
  }

  Widget _buildLoadError(Object error) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 28),
      child: Column(
        children: [
          const Icon(Icons.cloud_off_rounded, color: _leaf, size: 34),
          const SizedBox(height: 10),
          const Text(
            'Could not load apps',
            style: TextStyle(color: _ink, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            error.toString(),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFF657168), fontSize: 12),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _retryLoading,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Try again'),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptySearch(bool noPublishedApps) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 36),
      child: Column(
        children: [
          Icon(
            noPublishedApps ? Icons.apps_rounded : Icons.search_off_rounded,
            color: _leaf,
            size: 34,
          ),
          const SizedBox(height: 10),
          Text(
            noPublishedApps ? 'No apps published yet' : 'No apps found',
            style: const TextStyle(color: _ink, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            noPublishedApps
                ? 'Published apps will appear here.'
                : 'Try another search or category.',
            style: TextStyle(color: Colors.grey.shade700),
          ),
        ],
      ),
    );
  }

  Widget _buildOtherTab() {
    final isDownloads = _tab == 1;
    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 16, 22, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildBrand(),
          const SizedBox(height: 34),
          Text(
            isDownloads ? 'Downloads' : 'About Abel Apps',
            style: const TextStyle(
              color: _ink,
              fontSize: 28,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 14),
          if (isDownloads)
            const Text(
              'Your downloaded apps will appear here.',
              style: TextStyle(color: Color(0xFF657168)),
            )
          else
            const Text(
              'A small collection of Android apps built by Abel. Each app is shared here when it is ready.',
              style: TextStyle(
                color: Color(0xFF46534A),
                fontSize: 16,
                height: 1.5,
              ),
            ),
        ],
      ),
    );
  }

  void _showAppDetails(StoreApp app) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: _paper,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(22, 8, 22, 28),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    _buildAppIcon(app, 62),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            app.name,
                            style: const TextStyle(
                              color: _ink,
                              fontSize: 19,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${app.category}  /  ${app.downloads} downloads',
                            style: const TextStyle(color: Color(0xFF657168)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Text(
                  app.description.isEmpty
                      ? app.shortDescription
                      : app.description,
                  style: const TextStyle(
                    color: _ink,
                    fontSize: 15,
                    height: 1.5,
                  ),
                ),
                if (app.features.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  const Text(
                    'Features',
                    style: TextStyle(
                      color: _ink,
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  ...app.features.map(
                    (feature) => Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(
                        '- $feature',
                        style: const TextStyle(color: Color(0xFF46534A)),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: app.latestVersion == null
                        ? null
                        : () => _downloadApp(app),
                    icon: Icon(
                      app.latestVersion == null
                          ? Icons.schedule_rounded
                          : Icons.download_rounded,
                    ),
                    label: Text(
                      app.latestVersion == null
                          ? 'APK coming soon'
                          : 'Download APK (${app.latestVersion!.sizeLabel})',
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _downloadApp(StoreApp app) async {
    final version = app.latestVersion;
    if (version == null || version.apkPath.isEmpty) return;

    final url = Supabase.instance.client.storage
        .from('apks')
        .getPublicUrl(version.apkPath);
    final launched = await launchUrl(
      Uri.parse(url),
      mode: LaunchMode.externalApplication,
    );

    if (!launched && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open the APK download.')),
      );
      return;
    }

    try {
      await Supabase.instance.client.rpc(
        'record_download',
        params: {'p_app': app.id},
      );
    } catch (_) {
      // The file link remains usable if download-count tracking is unavailable.
    }
  }
}
