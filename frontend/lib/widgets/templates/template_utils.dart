// Shared helpers for agent message templates.

/// Coerces a dynamic JSON list into a list of string-keyed maps.
List<Map<String, dynamic>> templateMaps(Object? value) {
  if (value is! List) {
    return const [];
  }
  return value
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .toList();
}

/// Coerces a dynamic JSON list into strings.
List<String> templateStrings(Object? value) {
  if (value is! List) {
    return const [];
  }
  return value.map((item) => item.toString()).toList();
}

/// Coerces a dynamic JSON object into a string-keyed map.
Map<String, dynamic> templateMap(Object? value) {
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }
  return const {};
}

/// Removes a markdown bold wrapper from structured display titles.
String cleanDisplayTitle(Object? value, {String fallback = ''}) {
  final text = value?.toString().trim() ?? '';
  if (text.isEmpty) return fallback;

  final boldMatch = RegExp(r'^\*\*(.+?)\*\*$').firstMatch(text);
  if (boldMatch != null) return boldMatch.group(1)!.trim();

  return text;
}
