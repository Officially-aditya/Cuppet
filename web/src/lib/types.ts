export type AgentStatus = "active" | "paused" | "error";

export type Agent = {
  id: string;
  name: string;
  avatar?: string;
  prompt?: string;
  description?: string;
  parsed_intent?: Record<string, unknown>;
  connector_ids?: string[];
  schedule_cron?: string | null;
  is_assistant?: boolean;
  status: AgentStatus;
  safety_level?: "read" | "suggest" | "act";
  last_message_preview?: string;
  latest_message_at?: string;
  last_message_at?: string | null;
  unread_count?: number;
  created_at?: string;
  updated_at?: string;
  configuration?: AgentConfiguration;
  agent_preview?: AgentConfiguration;
};

export type AgentConfiguration = {
  name?: string;
  description?: string;
  schedule?: string | null;
  schedule_cron?: string | null;
  connectors?: string[];
  [key: string]: unknown;
};

export type MessageContent = {
  template?: string;
  version?: string;
  data?: Record<string, unknown>;
  presentation?: {
    group_id?: string;
    part_index?: number;
    part_count?: number;
    feedback_eligible?: boolean;
    feedback_reason?: string;
  };
  [key: string]: unknown;
};

export type AgentMessage = {
  id: string;
  agent_id: string;
  role: "agent" | "user" | "system";
  content: MessageContent | string;
  source_refs?: Array<Record<string, unknown>>;
  read_at?: string | null;
  created_at: string;
};

export type MessageFeedbackType = "useful" | "not_useful";

export type PersonalizationResponse = {
  feedback?: Array<{
    message_id: string;
    feedback_type: string;
  }>;
  [key: string]: unknown;
};

export type Connector = {
  id: string;
  provider_id?: string;
  connection_id?: string;
  name: string;
  description: string;
  icon_name?: string;
  category: string;
  required_scopes?: string[];
  auth_configured?: boolean;
  auth_method?: string;
  status: "connected" | "disconnected" | "action_required";
};

export type RecipeField = {
  id?: string;
  key?: string;
  name?: string;
  label?: string;
  description?: string;
  type?: string;
  required?: boolean;
  default?: unknown;
  default_value?: unknown;
  options?: Array<string | { label: string; value: string }>;
  display_default_value?: string;
  placeholder?: string;
  min?: number;
  max?: number;
};

export type AgentRecipe = {
  id: string;
  version?: number;
  prompt_profile_version?: number;
  name: string;
  description: string;
  icon?: string;
  category?: string;
  example_prompt?: string;
  required_connectors?: string[];
  fields?: RecipeField[];
  input_schema?: { fields?: RecipeField[] };
  display?: {
    name?: string;
    description?: string;
    icon?: string;
    category?: string;
    example_prompt?: string;
    visible?: boolean;
    sort_order?: number;
  };
  [key: string]: unknown;
};

export type CurrentUser = {
  id: string;
  name?: string | null;
  email: string;
  image?: string | null;
  avatar?: number | null;
};

export type UserPreferences = {
  time_zone: string;
  follow_device_time_zone: boolean;
};

export type CurrentUserResponse = {
  user: CurrentUser;
  session?: Record<string, unknown>;
  preferences: UserPreferences;
};

export type ViewKey =
  | "overview"
  | "inbox"
  | "agents"
  | "connectors"
  | "settings"
  | "feedback";

export type ApiErrorPayload = {
  error?: { code?: string; message?: string } | string;
  message?: string;
};
