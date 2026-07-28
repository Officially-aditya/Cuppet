import { z } from "zod";

const accessName = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z][a-z0-9_.:-]*$/i);

export const accessRequirementSchema = z
  .object({
    service: accessName,
    capabilities: z.array(accessName).min(1).max(16),
    required: z.boolean().default(true),
    preferred_provider_ids: z.array(accessName).max(8).default([]),
    reason: z.string().trim().max(240).optional()
  })
  .strict();

export type AccessRequirement = z.infer<typeof accessRequirementSchema>;

export type AccessProviderKind = "native" | "mcp";
export type AccessAuthMethod = "none" | "oauth2" | "api_key" | "service_account";
export type AccessConnectionStatus =
  | "connected"
  | "disconnected"
  | "action_required";

export type AccessProvider = {
  providerId: string;
  kind: AccessProviderKind;
  displayName: string;
  description: string;
  iconName: string;
  category: string;
  capabilities: string[];
  authMethods: AccessAuthMethod[];
  trusted: boolean;
  connectorId?: string;
  endpoint?: string;
  allowedTools?: string[];
  oauth?: {
    authorizationEndpoint?: string;
    tokenEndpoint?: string;
    issuer?: string;
    resource?: string;
    scopes: string[];
  };
};

export type AccessConnection = {
  id: string;
  userId: string;
  providerId: string;
  providerKind: AccessProviderKind;
  status: AccessConnectionStatus;
  accountLabel?: string;
  externalAccountId?: string;
  endpoint?: string;
  capabilities: string[];
  metadata: Record<string, unknown>;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type AccessResolutionItem = {
  requirement: AccessRequirement;
  status: "connected" | "needs_connection" | "unsupported";
  provider?: AccessProvider;
  connection?: AccessConnection;
  alternatives: AccessProvider[];
};

export type AccessResolution = {
  status: "connected" | "needs_connection" | "unsupported";
  items: AccessResolutionItem[];
  missing: AccessRequirement[];
};

export type AccessConnectionCredential = {
  connectionId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: Date | string;
  scopes: string[];
  metadata: Record<string, unknown>;
};

export function accessCapabilityKey(
  service: string,
  capability: string
): string {
  return `${service}.${capability}`.toLowerCase();
}

export function requirementCapabilityKeys(
  requirement: AccessRequirement
): string[] {
  return requirement.capabilities.map((capability) =>
    accessCapabilityKey(requirement.service, capability)
  );
}

export function providerSupportsRequirement(
  provider: AccessProvider,
  requirement: AccessRequirement
): boolean {
  const capabilities = new Set(provider.capabilities.map((value) => value.toLowerCase()));
  return requirementCapabilityKeys(requirement).every((key) => capabilities.has(key));
}
