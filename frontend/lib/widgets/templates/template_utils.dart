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
