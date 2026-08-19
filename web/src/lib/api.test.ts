import { afterEach, describe, expect, it, vi } from "vitest";
import { api, apiRequest, normalizeAgentRecipe } from "./api";

describe("apiRequest", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses same-origin API routes with cookies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest<{ ok: boolean }>("/health")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("surfaces structured backend errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: "AGENT_NOT_FOUND", message: "Agent not found." } }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    await expect(apiRequest("/agents/missing")).rejects.toMatchObject({
      message: "Agent not found.",
      status: 404,
      code: "AGENT_NOT_FOUND"
    });
  });

  it("normalizes backend recipe profiles for the creation dialog", () => {
    expect(normalizeAgentRecipe({
      recipe_id: "email_digest",
      recipe_version: 1,
      display: {
        name: "Email agent",
        description: "Ranks Gmail replies and deadlines.",
        icon: "mail",
        category: "work",
        example_prompt: "Create an Email agent."
      },
      required_connectors: ["gmail"],
      fields: [{ id: "scope", label: "Message scope", type: "enum", required: true, default_value: "unread" }]
    })).toMatchObject({
      id: "email_digest",
      name: "Email agent",
      description: "Ranks Gmail replies and deadlines.",
      example_prompt: "Create an Email agent.",
      required_connectors: ["gmail"],
      fields: [{ id: "scope", label: "Message scope", default: "unread", default_value: "unread" }]
    });
  });

  it("posts the mobile-compatible message feedback payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ stored: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.messageFeedback("message-1", "not_useful", "machine-learning");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/messages/message-1/feedback",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          feedback_type: "not_useful",
          subject_type: "topic",
          subject_key: "machine-learning"
        })
      })
    );
  });
});
