class AgentRecipeField {
  const AgentRecipeField({
    required this.id,
    required this.label,
    required this.type,
    required this.required,
    this.description,
    this.defaultValue,
    this.placeholder,
    this.options = const [],
    this.min,
    this.max,
  });

  factory AgentRecipeField.fromJson(Map<String, dynamic> json) {
    return AgentRecipeField(
      id: json['id']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      type: json['type']?.toString() ?? 'text',
      required: json['required'] == true,
      description: json['description']?.toString(),
      defaultValue: json['default_value'],
      placeholder: json['placeholder']?.toString(),
      options: (json['options'] is List ? json['options'] as List : const [])
          .whereType<Map>()
          .map((option) => Map<String, dynamic>.from(option))
          .toList(growable: false),
      min: json['min'] is num ? json['min'] as num : null,
      max: json['max'] is num ? json['max'] as num : null,
    );
  }

  final String id;
  final String label;
  final String type;
  final bool required;
  final String? description;
  final Object? defaultValue;
  final String? placeholder;
  final List<Map<String, dynamic>> options;
  final num? min;
  final num? max;
}

class AgentRecipe {
  const AgentRecipe({
    required this.id,
    required this.version,
    required this.promptProfileVersion,
    required this.name,
    required this.description,
    required this.icon,
    required this.examplePrompt,
    required this.requiredConnectors,
    required this.fields,
  });

  factory AgentRecipe.fromJson(Map<String, dynamic> json) {
    final display =
        json['display'] is Map
            ? Map<String, dynamic>.from(json['display'] as Map)
            : const <String, dynamic>{};
    return AgentRecipe(
      id: json['recipe_id']?.toString() ?? '',
      version: (json['recipe_version'] as num?)?.toInt() ?? 1,
      promptProfileVersion:
          (json['prompt_profile_version'] as num?)?.toInt() ?? 1,
      name: display['name']?.toString() ?? 'Agent',
      description: display['description']?.toString() ?? '',
      icon: display['icon']?.toString() ?? 'spark',
      examplePrompt: display['example_prompt']?.toString() ?? '',
      requiredConnectors: (json['required_connectors'] is List
              ? json['required_connectors'] as List
              : const [])
          .map((value) => value.toString())
          .toList(growable: false),
      fields: (json['fields'] is List ? json['fields'] as List : const [])
          .whereType<Map>()
          .map(
            (field) =>
                AgentRecipeField.fromJson(Map<String, dynamic>.from(field)),
          )
          .toList(growable: false),
    );
  }

  final String id;
  final int version;
  final int promptProfileVersion;
  final String name;
  final String description;
  final String icon;
  final String examplePrompt;
  final List<String> requiredConnectors;
  final List<AgentRecipeField> fields;

  Map<String, dynamic> get defaultInputs => {
    for (final field in fields)
      if (field.defaultValue != null) field.id: field.defaultValue,
  };
}
