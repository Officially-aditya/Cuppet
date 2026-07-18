import 'dart:convert';

Map<String, dynamic> recoverTemplatePayload(
  String template,
  Map<String, dynamic> data,
) {
  if (!_recoverableTemplates.contains(template)) {
    return data;
  }

  final candidates = <String>[];
  var containsMalformedNewsJson = false;
  _collectStrings(data, candidates, 0);
  for (final candidate in candidates) {
    if (!candidate.contains('{')) continue;
    if (template == 'news_brief' && _looksLikeNewsJson(candidate)) {
      containsMalformedNewsJson = true;
    }

    for (final decoded in _decodeObjectCandidates(candidate)) {
      final payload = _payloadForTemplate(template, decoded);
      if (payload != null && _matchesTemplate(template, payload)) {
        return _mergeRecovered(data, payload);
      }
    }

    if (template == 'news_brief') {
      final partial = _recoverPartialNews(candidate);
      if (partial != null) {
        return _mergeRecovered(data, partial);
      }
    }
  }
  if (containsMalformedNewsJson) {
    return _mergeRecovered(data, {
      'items': [
        {
          'summary':
              'I couldn’t assemble a complete, verifiable news brief for this run. Please try again.',
        },
      ],
    });
  }
  return data;
}

const _recoverableTemplates = {
  'data_summary',
  'news_brief',
  'study_guide',
  'dsa_question',
  'content_extractor',
  'portfolio_watch',
  'briefing_card',
};

void _collectStrings(Object? value, List<String> result, int depth) {
  if (depth > 5 || result.length >= 30) return;
  if (value is String) {
    if (value.length <= 100000) result.add(value);
    return;
  }
  if (value is Map) {
    for (final entry in value.values) {
      _collectStrings(entry, result, depth + 1);
    }
  } else if (value is List) {
    for (final entry in value) {
      _collectStrings(entry, result, depth + 1);
    }
  }
}

Iterable<Map<String, dynamic>> _decodeObjectCandidates(String value) sync* {
  for (final candidate in _jsonObjects(value)) {
    try {
      final decoded = jsonDecode(candidate);
      if (decoded is Map) {
        yield Map<String, dynamic>.from(decoded);
      }
    } on FormatException {
      // A later complete object or the news-specific salvage path may work.
    }
  }
}

Map<String, dynamic>? _payloadForTemplate(
  String template,
  Map<String, dynamic> decoded,
) {
  final encodedTemplate = decoded['template']?.toString();
  if (encodedTemplate != null && encodedTemplate != template) {
    return null;
  }
  final nested = decoded['data'];
  return nested is Map ? Map<String, dynamic>.from(nested) : decoded;
}

bool _matchesTemplate(String template, Map<String, dynamic> value) {
  return switch (template) {
    'news_brief' => value['items'] is List,
    'data_summary' =>
      value['title'] != null &&
          [
            'summary',
            'description',
            'text',
            'metrics',
            'items',
            'timeline',
            'messages',
            'action_items',
          ].any(value.containsKey),
    'study_guide' => value['topic'] != null && value['definition'] != null,
    'dsa_question' => value['problem'] != null && value['examples'] is List,
    'content_extractor' => value['ideas'] is List,
    'portfolio_watch' => value['stocks'] is List,
    'briefing_card' => value['sections'] is List,
    _ => false,
  };
}

Map<String, dynamic> _mergeRecovered(
  Map<String, dynamic> original,
  Map<String, dynamic> recovered,
) {
  final merged = <String, dynamic>{...original, ...recovered};
  final originalTitle = original['title'];
  if (originalTitle is String && originalTitle.trim().isNotEmpty) {
    merged['title'] = originalTitle;
  }
  return merged;
}

Map<String, dynamic>? _recoverPartialNews(String value) {
  final items = _objectArrayMembers(value, 'items');
  if (items.isEmpty) return null;

  final recovered = <String, dynamic>{'items': items.take(5).toList()};
  final tldr = _completeArray(value, 'tldr');
  if (tldr != null) recovered['tldr'] = tldr.take(3).toList();
  final perspectives = _objectArrayMembers(value, 'perspectives');
  if (perspectives.isNotEmpty) {
    recovered['perspectives'] = perspectives.take(6).toList();
  }
  final timeline = _objectArrayMembers(value, 'timeline');
  if (timeline.isNotEmpty) {
    recovered['timeline'] = timeline.take(5).toList();
  }
  final whyItMatters = _jsonString(value, 'why_it_matters');
  if (whyItMatters != null) {
    recovered['why_it_matters'] = whyItMatters;
  }
  return recovered;
}

bool _looksLikeNewsJson(String value) {
  return value.contains('{') &&
      (RegExp(r'"items"\s*:').hasMatch(value) ||
          RegExp(r'"tldr"\s*:').hasMatch(value));
}

List<dynamic>? _completeArray(String value, String key) {
  final contents = _arrayContents(value, key, allowTruncated: false);
  if (contents == null) return null;
  try {
    final decoded = jsonDecode('[$contents]');
    return decoded is List ? decoded : null;
  } on FormatException {
    return null;
  }
}

List<Map<String, dynamic>> _objectArrayMembers(String value, String key) {
  final contents = _arrayContents(value, key, allowTruncated: true);
  if (contents == null) return const [];
  return [for (final decoded in _decodeObjectCandidates(contents)) decoded];
}

String? _arrayContents(
  String value,
  String key, {
  required bool allowTruncated,
}) {
  final match = RegExp('"$key"\\s*:\\s*\\[').firstMatch(value);
  if (match == null) return null;
  final start = match.end;
  final end = _matchingDelimiter(value, start - 1, '[', ']');
  if (end == -1) {
    return allowTruncated ? value.substring(start) : null;
  }
  return value.substring(start, end);
}

String? _jsonString(String value, String key) {
  final match = RegExp(
    '"$key"\\s*:\\s*("(?:\\\\.|[^"\\\\])*")',
  ).firstMatch(value);
  if (match == null) return null;
  try {
    final decoded = jsonDecode(match.group(1)!);
    return decoded is String && decoded.trim().isNotEmpty
        ? decoded.trim()
        : null;
  } on FormatException {
    return null;
  }
}

Iterable<String> _jsonObjects(String value) sync* {
  for (var index = 0; index < value.length; index++) {
    if (value[index] != '{') continue;
    final end = _matchingDelimiter(value, index, '{', '}');
    if (end != -1) {
      yield value.substring(index, end + 1);
    }
  }
}

int _matchingDelimiter(String value, int start, String open, String close) {
  var depth = 0;
  var inString = false;
  var escaped = false;
  for (var index = start; index < value.length; index++) {
    final character = value[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character == r'\') {
        escaped = true;
      } else if (character == '"') {
        inString = false;
      }
      continue;
    }
    if (character == '"') {
      inString = true;
    } else if (character == open) {
      depth++;
    } else if (character == close) {
      depth--;
      if (depth == 0) return index;
    }
  }
  return -1;
}
