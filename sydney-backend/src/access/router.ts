import { createHash } from "node:crypto";
import { ConnectorAuthRequiredError } from "../connectors/errors.js";
import type { AccessAdapter } from "./adapters/access-adapter.js";
import {
  resumeAccessRequestContinuation,
  saveAccessRequestContinuation
} from "./repository.js";
import { resolveAccess } from "./resolver.js";
import {
  accessCapabilityKey,
  type AccessRequirement
} from "./types.js";

export class AccessExecutionRouter {
  private readonly adapters = new Map<string, AccessAdapter>();

  registerAdapter(adapter: AccessAdapter): void {
    this.adapters.set(adapter.providerId, adapter);
  }

  async preflight(userId: string, requirements: AccessRequirement[]) {
    return resolveAccess(userId, requirements);
  }

  async execute<T>(input: {
    userId: string;
    requirements: AccessRequirement[];
    operation: string;
    arguments: Record<string, unknown>;
    providerId?: string;
  }): Promise<T> {
    const resolution = await this.preflight(input.userId, input.requirements);
    if (resolution.status !== "connected") {
      await this.assertRequirements(input.userId, input.requirements);
    }
    const item = resolution.items.find(
      (candidate) =>
        candidate.status === "connected" &&
        (!input.providerId || candidate.provider?.providerId === input.providerId)
    );
    if (!item?.provider || !item.connection) {
      await this.assertRequirements(input.userId, input.requirements);
      throw new Error("No access execution provider was selected.");
    }
    const adapter = this.adapters.get(item.provider.providerId);
    if (!adapter || !adapter.supports(item.requirement)) {
      throw new Error(`No access adapter is registered for ${item.provider.providerId}.`);
    }
    return adapter.execute<T>(input.operation, input.arguments, {
      userId: input.userId,
      provider: item.provider,
      connection: item.connection,
      requirement: item.requirement
    });
  }

  async assertRequirements(
    userId: string,
    requirements: AccessRequirement[],
    options: { agentId?: string } = {}
  ): Promise<void> {
    const resolution = await this.preflight(userId, requirements);
    const requestHash = options.agentId
      ? createHash("sha256")
          .update(options.agentId)
          .update("\n")
          .update(JSON.stringify(requirements))
          .digest("hex")
      : undefined;
    if (resolution.status === "connected") {
      if (requestHash) await resumeAccessRequestContinuation(userId, requestHash);
      return;
    }
    const missing = resolution.items.find((item) => item.status !== "connected");
    if (!missing) return;
    if (requestHash && options.agentId) {
      await saveAccessRequestContinuation({
        userId,
        agentId: options.agentId,
        requestHash,
        requirements: resolution.missing,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    }
    const provider = missing.provider;
    throw new ConnectorAuthRequiredError({
      connectorId: provider?.connectorId ?? provider?.providerId ?? accessCapabilityKey(
        missing.requirement.service,
        missing.requirement.capabilities[0] ?? "read"
      ),
      connectorName: provider?.displayName ?? missing.requirement.service,
      reason:
        missing.status === "unsupported"
          ? `No trusted access provider supports ${missing.requirement.service}.`
          : `Access is required for ${missing.requirement.reason ?? missing.requirement.service}.`,
      accessRequirements: resolution.missing
    });
  }
}

export const accessExecutionRouter = new AccessExecutionRouter();
