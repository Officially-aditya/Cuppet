import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { ingestAgentEvent } from "./engine.js";
import {
  type GooglePushConnector,
  verifiedGoogleSubscription
} from "./google-subscriptions.js";

const slackEnvelopeSchema = z
  .object({
    type: z.string(),
    challenge: z.string().max(1000).optional(),
    event_id: z.string().max(300).optional(),
    team_id: z.string().max(200).optional(),
    event_time: z.number().optional(),
    event: z
      .object({
        type: z.string().max(100),
        subtype: z.string().max(100).optional(),
        text: z.string().max(20_000).optional(),
        channel: z.string().max(200).optional(),
        user: z.string().max(200).optional(),
        bot_id: z.string().max(200).optional(),
        ts: z.string().max(100).optional(),
        event_ts: z.string().max(100).optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough();

const githubPayloadSchema = z
  .object({
    action: z.string().max(100).optional(),
    installation: z
      .object({
        id: z.number().or(z.string()),
        account: z
          .object({ login: z.string().max(300).optional() })
          .optional()
      })
      .optional(),
    repository: z
      .object({
        id: z.number().or(z.string()),
        full_name: z.string().max(500).optional()
      })
      .optional(),
    sender: z.object({ login: z.string().max(300).optional() }).optional()
  })
  .passthrough();

const gmailPushSchema = z.object({
  message: z.object({
    data: z.string().max(20_000),
    messageId: z.string().max(500),
    publishTime: z.string().datetime().optional()
  }),
  subscription: z.string().max(1000).optional()
});

const gmailDataSchema = z.object({
  emailAddress: z.string().email().max(500),
  historyId: z.string().max(200)
});

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  app.post("/events/slack", { bodyLimit: 256 * 1024 }, async (request, reply) => {
    if (!config.SLACK_SIGNING_SECRET) {
      return reply.code(503).send({ error: "slack_events_not_configured" });
    }
    if (!verifySlackRequest(request, config.SLACK_SIGNING_SECRET)) {
      return reply.code(401).send({ error: "invalid_slack_signature" });
    }

    const parsed = slackEnvelopeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_slack_event" });
    }
    if (parsed.data.type === "url_verification") {
      if (!parsed.data.challenge) {
        return reply.code(400).send({ error: "missing_slack_challenge" });
      }
      return reply.send({ challenge: parsed.data.challenge });
    }
    const event = parsed.data.event;
    if (
      parsed.data.type !== "event_callback" ||
      !parsed.data.event_id ||
      !parsed.data.team_id ||
      !event
    ) {
      return reply.code(202).send({ accepted: true, ignored: true });
    }
    if (event.bot_id || event.subtype === "bot_message") {
      return reply.code(202).send({ accepted: true, ignored: true });
    }

    const result = await ingestAgentEvent({
      source: "slack",
      externalEventId: parsed.data.event_id,
      eventType: `slack.${event.type}`,
      externalAccountId: parsed.data.team_id,
      subjectId: event.channel,
      payload: {
        text: event.text ?? "",
        channel: event.channel,
        user: event.user,
        timestamp: event.ts ?? event.event_ts,
        subtype: event.subtype
      },
      occurredAt: new Date((parsed.data.event_time ?? Date.now() / 1000) * 1000)
    });
    return reply.code(202).send(eventResponse(result));
  });

  app.post("/events/github", { bodyLimit: 1024 * 1024 }, async (request, reply) => {
    if (!config.GITHUB_WEBHOOK_SECRET) {
      return reply.code(503).send({ error: "github_events_not_configured" });
    }
    if (!verifyGitHubRequest(request, config.GITHUB_WEBHOOK_SECRET)) {
      return reply.code(401).send({ error: "invalid_github_signature" });
    }
    const deliveryId = header(request, "x-github-delivery");
    const eventName = header(request, "x-github-event");
    const parsed = githubPayloadSchema.safeParse(request.body);
    if (!deliveryId || !eventName || !parsed.success) {
      return reply.code(400).send({ error: "invalid_github_event" });
    }
    if (eventName === "ping") {
      return reply.code(202).send({ accepted: true, ping: true });
    }
    const installation = parsed.data.installation;
    const externalAccountId =
      installation?.account?.login ??
      (installation?.id === undefined ? null : String(installation.id));
    if (!externalAccountId) {
      return reply.code(202).send({ accepted: true, ignored: true });
    }

    const result = await ingestAgentEvent({
      source: "github",
      externalEventId: deliveryId,
      eventType: `github.${eventName}`,
      externalAccountId,
      subjectId:
        parsed.data.repository?.id === undefined
          ? undefined
          : String(parsed.data.repository.id),
      payload: {
        action: parsed.data.action,
        repository: parsed.data.repository?.full_name,
        sender: parsed.data.sender?.login,
        installation_id: installation?.id
      },
      occurredAt: new Date()
    });
    return reply.code(202).send(eventResponse(result));
  });

  app.post("/events/gmail", async (request, reply) => {
    const token = (request.query as { token?: string }).token;
    if (
      !config.GMAIL_PUBSUB_VERIFICATION_TOKEN ||
      !token ||
      !safeEqual(token, config.GMAIL_PUBSUB_VERIFICATION_TOKEN)
    ) {
      return reply.code(401).send({ error: "invalid_gmail_push_token" });
    }
    const push = gmailPushSchema.safeParse(request.body);
    if (!push.success) {
      return reply.code(400).send({ error: "invalid_gmail_push" });
    }
    let data: unknown;
    try {
      data = JSON.parse(Buffer.from(push.data.message.data, "base64").toString("utf8"));
    } catch {
      return reply.code(400).send({ error: "invalid_gmail_push_data" });
    }
    const gmail = gmailDataSchema.safeParse(data);
    if (!gmail.success) {
      return reply.code(400).send({ error: "invalid_gmail_notification" });
    }

    const result = await ingestAgentEvent({
      source: "gmail",
      externalEventId: push.data.message.messageId,
      eventType: "gmail.mailbox_changed",
      externalAccountId: gmail.data.emailAddress,
      subjectId: gmail.data.historyId,
      payload: { history_id: gmail.data.historyId },
      occurredAt: push.data.message.publishTime
        ? new Date(push.data.message.publishTime)
        : new Date()
    });
    return reply.code(202).send(eventResponse(result));
  });

  app.post("/events/google/:connectorId", async (request, reply) => {
    const connectorId = (request.params as { connectorId?: string }).connectorId;
    if (connectorId !== "calendar" && connectorId !== "drive") {
      return reply.code(404).send({ error: "unsupported_google_event_source" });
    }
    const channelId = header(request, "x-goog-channel-id");
    const channelToken = header(request, "x-goog-channel-token");
    const messageNumber = header(request, "x-goog-message-number");
    const resourceState = header(request, "x-goog-resource-state");
    if (!channelId || !channelToken || !messageNumber || !resourceState) {
      return reply.code(400).send({ error: "invalid_google_notification" });
    }
    const subscription = await verifiedGoogleSubscription({
      connectorId: connectorId as GooglePushConnector,
      channelId,
      channelToken
    });
    if (!subscription) {
      return reply.code(401).send({ error: "invalid_google_channel" });
    }
    if (resourceState === "sync") {
      return reply.code(204).send();
    }
    const result = await ingestAgentEvent({
      source: connectorId,
      externalEventId: `${channelId}:${messageNumber}`,
      eventType: `${connectorId}.${resourceState}`,
      externalAccountId: subscription.userId,
      subjectId: subscription.resourceId,
      targetUserIds: [subscription.userId],
      payload: {
        resource_state: resourceState,
        changed: header(request, "x-goog-changed"),
        resource_uri: header(request, "x-goog-resource-uri")
      },
      occurredAt: new Date()
    });
    return reply.code(202).send(eventResponse(result));
  });
}

export function verifySlackSignature(input: {
  rawBody: Buffer;
  timestamp: string;
  signature: string;
  signingSecret: string;
  nowSeconds?: number;
}): boolean {
  const timestamp = Number(input.timestamp);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > 5 * 60) {
    return false;
  }
  const expected = `v0=${createHmac("sha256", input.signingSecret)
    .update(`v0:${input.timestamp}:`)
    .update(input.rawBody)
    .digest("hex")}`;
  return safeEqual(expected, input.signature);
}

export function verifyGitHubSignature(input: {
  rawBody: Buffer;
  signature: string;
  webhookSecret: string;
}): boolean {
  const expected = `sha256=${createHmac("sha256", input.webhookSecret)
    .update(input.rawBody)
    .digest("hex")}`;
  return safeEqual(expected, input.signature);
}

function verifySlackRequest(request: FastifyRequest, secret: string): boolean {
  const timestamp = header(request, "x-slack-request-timestamp");
  const signature = header(request, "x-slack-signature");
  return Boolean(
    request.rawBody &&
      timestamp &&
      signature &&
      verifySlackSignature({
        rawBody: request.rawBody,
        timestamp,
        signature,
        signingSecret: secret
      })
  );
}

function verifyGitHubRequest(request: FastifyRequest, secret: string): boolean {
  const signature = header(request, "x-hub-signature-256");
  return Boolean(
    request.rawBody &&
      signature &&
      verifyGitHubSignature({
        rawBody: request.rawBody,
        signature,
        webhookSecret: secret
      })
  );
}

function header(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function eventResponse(result: {
  duplicate: boolean;
  queuedAgentIds: string[];
  suppressedAgentIds: string[];
}) {
  return {
    accepted: true,
    duplicate: result.duplicate,
    queued: result.queuedAgentIds.length,
    suppressed: result.suppressedAgentIds.length
  };
}
