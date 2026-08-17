import type {
  Agent,
  AgentMessage,
  AgentRecipe,
  ApiErrorPayload,
  Connector,
  CurrentUserResponse,
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
  recipes: () => apiRequest<{ recipes: AgentRecipe[] }>("/agents/recipes"),
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
  messageAction: (agentId: string, messageId: string, action: "done" | "snooze" | "skip") =>
    apiRequest<Record<string, unknown>>(`/agents/${agentId}/messages/${messageId}/action`, {
      method: "POST",
      body: json({ action })
    }),
  messageFeedback: (messageId: string, value: "helpful" | "not_helpful") =>
    apiRequest<Record<string, unknown>>(`/messages/${messageId}/feedback`, {
      method: "POST",
      body: json({ value })
    }),
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

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
