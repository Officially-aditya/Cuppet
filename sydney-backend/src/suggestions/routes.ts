import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isUuid } from "../api/ids.js";
import { requireAuth } from "../auth/middleware.js";
import { publishRealtimeEvent } from "../realtime/events.js";
import {
  decideSuggestion,
  getSuggestionExplanationForUser,
  SuggestionDecisionError
} from "./decision-service.js";
import {
  ContinuationError,
  resumeAcceptedCapabilitySuggestion
} from "./continuation-service.js";

const decisionSchema = z.object({
  decision: z.enum(["accept", "not_now", "dismiss", "less_like_this", "explain"])
}).strict();

export async function suggestionRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/assistant/suggestions/:suggestionId/decision",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { suggestionId } = request.params as { suggestionId: string };
      if (!isUuid(suggestionId)) {
        return reply.code(404).send({ error: { code: "SUGGESTION_NOT_FOUND", message: "Suggestion not found." } });
      }
      const parsed = decisionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "INVALID_SUGGESTION_DECISION", message: parsed.error.issues[0]?.message } });
      }
      if (parsed.data.decision === "explain") {
        const explanation = await getSuggestionExplanationForUser({
          userId: request.auth!.userId,
          suggestionId
        });
        return explanation
          ? { explanation }
          : reply.code(404).send({ error: { code: "SUGGESTION_NOT_FOUND", message: "Suggestion not found." } });
      }
      try {
        const result = await decideSuggestion({
          userId: request.auth!.userId,
          suggestionId,
          decision: parsed.data.decision
        });
        if (result.next_message) {
          await publishRealtimeEvent({
            type: "message.created",
            user_id: request.auth!.userId,
            agent_id: result.next_message.agent_id,
            message_id: result.next_message.id,
            data: { role: "agent", suggestion_confirmation: true }
          }).catch(() => undefined);
        }
        return { ...result };
      } catch (error) {
        if (error instanceof SuggestionDecisionError) {
          return reply.code(error.statusCode).send({
            error: { code: error.code, message: error.message }
          });
        }
        throw error;
      }
    }
  );

  app.get(
    "/assistant/suggestions/:suggestionId/explanation",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { suggestionId } = request.params as { suggestionId: string };
      if (!isUuid(suggestionId)) {
        return reply.code(404).send({ error: { code: "SUGGESTION_NOT_FOUND", message: "Suggestion not found." } });
      }
      const explanation = await getSuggestionExplanationForUser({
        userId: request.auth!.userId,
        suggestionId
      });
      return explanation
        ? { explanation }
        : reply.code(404).send({ error: { code: "SUGGESTION_NOT_FOUND", message: "Suggestion not found." } });
    }
  );

  app.post(
    "/assistant/suggestions/:suggestionId/continue",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { suggestionId } = request.params as { suggestionId: string };
      if (!isUuid(suggestionId)) {
        return reply.code(404).send({
          error: { code: "SUGGESTION_NOT_FOUND", message: "Suggestion not found." }
        });
      }
      try {
        return await resumeAcceptedCapabilitySuggestion({
          userId: request.auth!.userId,
          suggestionId
        });
      } catch (error) {
        if (error instanceof ContinuationError) {
          return reply.code(error.statusCode).send({
            error: { code: error.code, message: error.message }
          });
        }
        throw error;
      }
    }
  );
}
