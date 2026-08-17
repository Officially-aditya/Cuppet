import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AgentMessage } from "@/lib/types";
import { MessageRenderer, messageText } from "./message-renderer";

const briefing: AgentMessage = {
  id: "message-1",
  agent_id: "agent-1",
  role: "agent",
  created_at: "2026-08-17T08:00:00.000Z",
  source_refs: [{ source: "Gmail" }],
  content: {
    template: "briefing_card",
    data: {
      eyebrow: "Good morning",
      title: "Your day at a glance",
      summary: "Two decisions deserve a look.",
      sections: [
        {
          id: "inbox",
          title: "Inbox",
          source: "Gmail",
          items: [{ title: "Approve the handoff", detail: "Maya is waiting." }]
        }
      ]
    }
  }
};

describe("MessageRenderer", () => {
  it("renders structured briefing content and sources", () => {
    const { container } = render(<MessageRenderer message={briefing} />);
    expect(screen.getByRole("heading", { name: "Your day at a glance" })).toBeInTheDocument();
    expect(screen.getByText("Approve the handoff")).toBeInTheDocument();
    expect(screen.getByText("1 source")).toBeInTheDocument();
    expect(container.querySelector(".message-card svg")).not.toBeInTheDocument();
  });

  it("extracts a useful preview from known payload fields", () => {
    expect(messageText({ template: "plain_text", data: { body: "A calm update" } })).toBe("A calm update");
    expect(messageText({ template: "all_clear", data: { message: "Nothing urgent" } })).toBe("Nothing urgent");
  });
});
