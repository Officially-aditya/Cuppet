export class ConnectorAuthRequiredError extends Error {
  constructor(input: {
    connectorId: string;
    connectorName: string;
    reason: string;
  }) {
    super(input.reason);
    this.name = "ConnectorAuthRequiredError";
    this.connectorId = input.connectorId;
    this.connectorName = input.connectorName;
    this.reason = input.reason;
  }

  readonly connectorId: string;
  readonly connectorName: string;
  readonly reason: string;
}

export function isConnectorAuthRequiredError(
  error: unknown
): error is ConnectorAuthRequiredError {
  return error instanceof ConnectorAuthRequiredError;
}
