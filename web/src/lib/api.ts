import type {
  Agent,
  AgentMessage,
  AgentRecipe,
  ApiErrorPayload,
  Connector,
  CurrentUserResponse,
  MessageFeedbackType,
  PersonalizationConsent,
  PersonalizationResponse,
  PersonalizationSettings,
  PreferenceProfileItem,
  PreferenceProfileResponse,
  RecipeField,
  UserPreferences
} from "./types";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
    credentials: "include"
  });
  if (!response.ok) {
    let payload: ApiErrorPayload | undefined;
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = undefined;
    }
    const nested = typeof payload?.error === "object" ? payload.error : undefined;
    const message =
      nested?.message ??
      (typeof payload?.error === "string" ? payload.error : undefined) ??
      payload?.message ??
      `Request failed (${response.status})`;
    throw new ApiError(message, response.status, nested?.code);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const json = (value: unknown) => JSON.stringify(value);

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeRecipeField(value: unknown): RecipeField | null {
  const raw = recordValue(value);
  const id = stringValue(raw.id) ?? stringValue(raw.key) ?? stringValue(raw.name) ?? stringValue(raw.label);
  if (!id) return null;
  const label = stringValue(raw.label) ?? stringValue(raw.name) ?? id;
  const options: RecipeField["options"] = Array.isArray(raw.options)
    ? raw.options.flatMap((option: unknown): Array<string | { label: string; value: string }> => {
        if (typeof option === "string") return [option];
        const normalized = recordValue(option);
        const optionValue = stringValue(normalized.value);
        const optionLabel = stringValue(normalized.label) ?? optionValue;
        return optionValue && optionLabel ? [{ value: optionValue, label: optionLabel }] : [];
      })
    : undefined;
  const defaultValue = raw.default !== undefined ? raw.default : raw.default_value;
  return {
    id,
    key: stringValue(raw.key) ?? id,
    name: stringValue(raw.name) ?? label,
    label,
    description: stringValue(raw.description),
    type: stringValue(raw.type),
    required: raw.required === true,
    ...(defaultValue !== undefined ? { default: defaultValue, default_value: defaultValue } : {}),
    display_default_value: stringValue(raw.display_default_value),
    placeholder: stringValue(raw.placeholder),
    ...(options ? { options } : {}),
    min: numberValue(raw.min),
    max: numberValue(raw.max)
  };
}

/** Normalize the backend's public recipe shape into the UI's flat recipe model. */
export function normalizeAgentRecipe(value: unknown): AgentRecipe | null {
  const raw = recordValue(value);
  const display = recordValue(raw.display);
  const id = stringValue(raw.id) ?? stringValue(raw.recipe_id);
  if (!id) return null;
  const fields = Array.isArray(raw.fields)
    ? raw.fields.flatMap((field) => {
        const normalized = normalizeRecipeField(field);
        return normalized ? [normalized] : [];
      })
    : [];
  const connectors = Array.isArray(raw.required_connectors)
    ? raw.required_connectors.filter((connector): connector is string => typeof connector === "string")
    : [];
  const name = stringValue(raw.name) ?? stringValue(display.name) ?? "Agent";
  const description = stringValue(raw.description) ?? stringValue(display.description) ?? "A useful Cuppet agent.";
  const icon = stringValue(raw.icon) ?? stringValue(display.icon);
  const category = stringValue(raw.category) ?? stringValue(display.category);
  const examplePrompt = stringValue(raw.example_prompt) ?? stringValue(display.example_prompt) ?? description;
  return {
    ...raw,
    id,
    version: numberValue(raw.version) ?? numberValue(raw.recipe_version),
    prompt_profile_version: numberValue(raw.prompt_profile_version),
    name,
    description,
    icon,
    category,
    example_prompt: examplePrompt,
    required_connectors: connectors,
    fields,
    display: {
      name,
      description,
      icon,
      category,
      example_prompt: examplePrompt,
      visible: display.visible === true,
      sort_order: numberValue(display.sort_order)
    }
  };
}

export const api = {
  me: () => apiRequest<CurrentUserResponse>("/users/me"),
  updateMe: (value: { name?: string; image?: string; avatar?: number }) =>
    apiRequest<{ user: CurrentUserResponse["user"] }>("/users/me", {
      method: "PATCH",
      body: json(value)
    }),
  updatePreferences: (value: Partial<UserPreferences>) =>
    apiRequest<{ preferences: UserPreferences }>("/users/me/preferences", {
      method: "PATCH",
      body: json(value)
    }),
  deleteAccount: () => apiRequest<{ success: boolean }>("/users/me", { method: "DELETE" }),
  agents: () => apiRequest<{ agents: Agent[] }>("/agents"),
  agent: (agentId: string) => apiRequest<{ agent: Agent }>(`/agents/${agentId}`),
  recipes: async () => {
    const response = await apiRequest<{ recipes?: unknown[] }>("/agents/recipes");
    return {
      recipes: (response.recipes ?? []).flatMap((recipe) => {
        const normalized = normalizeAgentRecipe(recipe);
        return normalized ? [normalized] : [];
      })
    };
  },
  parseAgent: (value: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>("/agents/parse", { method: "POST", body: json(value) }),
  createAgent: (value: Record<string, unknown>) =>
    apiRequest<{ agent: Agent }>("/agents", { method: "POST", body: json(value) }),
  updateAgent: (agentId: string, value: Record<string, unknown>) =>
    apiRequest<{ agent: Agent }>(`/agents/${agentId}`, { method: "PATCH", body: json(value) }),
  deleteAgent: (agentId: string) => apiRequest<void>(`/agents/${agentId}`, { method: "DELETE" }),
  runAgent: (agentId: string) => apiRequest<{ message: string }>(`/agents/${agentId}/run`, { method: "POST" }),
  messages: (agentId: string) => apiRequest<{ messages: AgentMessage[] }>(`/agents/${agentId}/messages?limit=100`),
  sendMessage: (agentId: string, value: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(`/agents/${agentId}/messages`, { method: "POST", body: json(value) }),
  clearMessages: (agentId: string) => apiRequest<void>(`/agents/${agentId}/messages`, { method: "DELETE" }),
  messageAction: (agentId: string, messageId: string, action: string) =>
    apiRequest<Record<string, unknown>>(`/agents/${agentId}/messages/${messageId}/action`, {
      method: "POST",
      body: json({ action, date: new Date().toISOString().slice(0, 10) })
    }),
  assistantAction: (agentId: string, action: { decision: string; pending_action_id: string; [key: string]: unknown }) =>
    apiRequest<Record<string, unknown>>(`/agents/${agentId}/messages`, {
      method: "POST",
      body: json({ action: action.decision, payload: { ...action, pending_action_id: action.pending_action_id } })
    }),
  handoffToAssistant: (agentId: string, messageId: string) =>
    apiRequest<{ assistant_agent_id: string }>(`/agents/${agentId}/messages/${messageId}/assistant-handoff`, { method: "POST" }),
  messageActivity: (messageId: string, value: { activity_type: string; subject_type: string; subject_key: string }) =>
    apiRequest<{ stored: boolean }>(`/messages/${messageId}/activity`, { method: "POST", body: json(value) }),
  suggestionDecision: (suggestionId: string, decision: string) =>
    apiRequest<Record<string, unknown>>(`/assistant/suggestions/${encodeURIComponent(suggestionId)}/decision`, { method: "POST", body: json({ decision }) }),
  suggestionExplanation: (suggestionId: string) =>
    apiRequest<{ explanation?: Record<string, unknown> }>(`/assistant/suggestions/${encodeURIComponent(suggestionId)}/explanation`),
  continueSuggestion: (suggestionId: string) =>
    apiRequest<Record<string, unknown>>(`/assistant/suggestions/${encodeURIComponent(suggestionId)}/continue`, { method: "POST" }),
  messageFeedback: (messageId: string, value: MessageFeedbackType, subjectKey?: string) =>
    apiRequest<Record<string, unknown>>(`/messages/${messageId}/feedback`, {
      method: "POST",
      body: json({
        feedback_type: value,
        ...(subjectKey ? { subject_type: "topic", subject_key: subjectKey } : {})
      })
    }),
  personalization: () => apiRequest<PersonalizationResponse>("/users/me/personalization"),
  preferenceProfile: async () => {
    const [settings, profile] = await Promise.all([
      api.personalization(),
      apiRequest<PreferenceProfileResponse>("/users/me/preference-profile")
    ]);
    return {
      ...settings,
      items: profile.items ?? [],
      settings: settings.settings ?? defaultPersonalizationSettings(),
      consents: settings.consents ?? [],
      recent_suggestions: settings.recent_suggestions ?? []
    };
  },
  updatePersonalization: (value: Partial<PersonalizationSettings>) =>
    apiRequest<{ settings: PersonalizationSettings }>("/users/me/personalization", {
      method: "PATCH",
      body: json(value)
    }),
  grantPersonalizationConsent: (purpose: string, source = "settings") =>
    apiRequest<{ consent: PersonalizationConsent }>("/users/me/personalization/consents", {
      method: "POST",
      body: json({ purpose, source })
    }),
  revokePersonalizationConsent: (purpose: string) =>
    apiRequest<{ consent: PersonalizationConsent }>(`/users/me/personalization/consents/${encodeURIComponent(purpose)}`, { method: "DELETE" }),
  updatePreferenceItem: (itemId: string, value: { key?: string; weight?: number }) =>
    apiRequest<{ item: PreferenceProfileItem }>(`/users/me/preference-profile/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      body: json(value)
    }),
  deletePreferenceItem: (itemId: string) =>
    apiRequest<void>(`/users/me/preference-profile/${encodeURIComponent(itemId)}`, { method: "DELETE" }),
  resetPreferenceProfile: () => apiRequest<void>("/users/me/preference-profile", { method: "DELETE" }),
  createPreferenceExclusion: (value: { subject_type: string; subject_key: string }) =>
    apiRequest<Record<string, unknown>>("/users/me/preference-profile/exclusions", { method: "POST", body: json(value) }),
  connectBrowserActivity: () =>
    apiRequest<{ connection: { token: string } }>("/users/me/personalization/browser-connection", { method: "POST" }),
  disconnectBrowserActivity: () => apiRequest<void>("/users/me/personalization/browser-connection", { method: "DELETE" }),
  exportPreferenceProfile: () => apiRequest<Record<string, unknown>>("/users/me/preference-profile/export"),
  briefings: () => apiRequest<{ briefings: AgentMessage[] }>("/briefings"),
  connectors: () => apiRequest<Connector[]>("/connectors"),
  connectorStatus: (connectorId: string, connected: boolean) =>
    apiRequest<Connector>(`/connectors/${connectorId}/status`, {
      method: "POST",
      body: json({ connected })
    }),
  connectorOAuthStart: (connectorId: string) =>
    apiRequest<{ authUrl: string; callbackUrl?: string; providerId?: string }>(
      `/connectors/${connectorId}/oauth/start`,
      { method: "POST", body: json({ callbackUrl: `${window.location.origin}/oauth/callback` }) }
    ),
  completeAccessOAuth: (providerId: string, callbackUrl: string) =>
    apiRequest<Record<string, unknown>>(`/access/providers/${providerId}/oauth/complete`, {
      method: "POST",
      body: json({ callbackUrl })
    }),
  feedback: (topic: string, message: string) =>
    apiRequest<{ feedback: { id: string } }>("/feedback", {
      method: "POST",
      body: json({ topic, message })
    }),
  memories: () => apiRequest<{ memories: Array<{ id: string; content?: string; text?: string; created_at?: string }>; compacted_memory?: unknown }>("/users/me/assistant-memories"),
  deleteMemory: (memoryId: string) => apiRequest<void>(`/users/me/assistant-memories/${memoryId}`, { method: "DELETE" }),
  deleteMemories: () => apiRequest<{ deleted: number }>("/users/me/assistant-memories", { method: "DELETE" }),
  archiveState: () => apiRequest<{ enabled: boolean; status: string; folder_link: string | null; last_success_at: string | null; error_code: string | null; action_required: boolean }>("/users/me/message-archive"),
  updateArchive: (enabled: boolean) => apiRequest<{ enabled: boolean; status: string; authorization?: { auth_url: string } }>("/users/me/message-archive", { method: "PUT", body: json({ enabled, callback_url: `${window.location.origin}/oauth/callback` }) }),
  deleteArchives: () => apiRequest<{ deleted_files?: number }>("/users/me/message-archive/files", { method: "DELETE", body: json({ confirmation: "DELETE_DRIVE_ARCHIVES" }) }),
  registerNotification: (token: string) => apiRequest<{ success: boolean }>("/notifications/register", { method: "POST", body: json({ token, device_info: { platform: "web", app_version: "0.1.0", model: navigator.userAgent.slice(0, 120) } }) }),
  unregisterNotification: (token: string) => apiRequest<{ success: boolean }>("/notifications/unregister", { method: "POST", body: json({ token }) }),
  upload: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiRequest<{ file: { id: string; name: string; mime_type: string; size: number } }>("/uploads", {
      method: "POST",
      body: form
    });
  }
};

export function defaultPersonalizationSettings(): PersonalizationSettings {
  return {
    enabled: false,
    learning_paused: false,
    frequency: "balanced",
    in_chat: true,
    proactive: false,
    push: false,
    quiet_hours_start: "21:00",
    quiet_hours_end: "08:00"
  };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
