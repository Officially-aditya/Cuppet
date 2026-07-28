import type { AccessRequirement } from "../access/types.js";

export class ConnectorAuthRequiredError extends Error {
  constructor(input: {
    connectorId: string;
    connectorName: string;
    reason: string;
    accessRequirements?: AccessRequirement[];
  }) {
    super(input.reason);
    this.name = "ConnectorAuthRequiredError";
    this.connectorId = input.connectorId;
    this.connectorName = input.connectorName;
    this.reason = input.reason;
    this.accessRequirements = input.accessRequirements;
  }

  readonly connectorId: string;
  readonly connectorName: string;
  readonly reason: string;
  readonly accessRequirements?: AccessRequirement[];
}

export function isConnectorAuthRequiredError(
  error: unknown
): error is ConnectorAuthRequiredError {
  return error instanceof ConnectorAuthRequiredError;
}
