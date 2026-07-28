import type {
  AccessConnection,
  AccessProvider,
  AccessRequirement
} from "../types.js";

export type AccessAdapterContext = {
  userId: string;
  provider: AccessProvider;
  connection: AccessConnection;
  requirement: AccessRequirement;
};

export interface AccessAdapter {
  readonly providerId: string;
  supports(requirement: AccessRequirement): boolean;
  execute<T>(
    operation: string,
    input: Record<string, unknown>,
    context: AccessAdapterContext
  ): Promise<T>;
}
