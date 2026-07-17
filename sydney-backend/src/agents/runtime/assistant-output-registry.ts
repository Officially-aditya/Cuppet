import { z } from "zod";

// Assistant-only cards stay separate from scheduled agent output contracts.
// Their action payloads are constructed by trusted server code, never by an LLM.
export const assistantOutputRegistry = {
  system: z.object({ text: z.string().optional(), message: z.string().optional() }).passthrough(),
  agent_selection: z
    .object({
      question: z.string(),
      options: z.array(z.object({ id: z.string(), label: z.string() }).passthrough())
    })
    .passthrough(),
  action_confirmation: z
    .object({
      action_label: z.string(),
      actions: z.array(
        z
          .object({
            type: z.literal("assistant_pending_action"),
            decision: z.enum(["confirm", "cancel"])
          })
          .passthrough()
      )
    })
    .passthrough()
} as const;
