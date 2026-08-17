import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./api";

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
});
