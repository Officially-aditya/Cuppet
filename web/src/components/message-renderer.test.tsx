import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AgentMessage, MessageContent } from "@/lib/types";
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

  it("only shows feedback for eligible final agent messages and hides it after selection", () => {
    const onFeedback = vi.fn();
    const baseContent = briefing.content as MessageContent;
    const eligible: AgentMessage = {
      ...briefing,
      id: "eligible-message",
      content: {
        ...baseContent,
        presentation: { feedback_eligible: true, part_index: 0, part_count: 2 }
      }
    };
    const { rerender } = render(<MessageRenderer message={eligible} onFeedback={onFeedback} />);
    expect(screen.queryByRole("button", { name: "Useful" })).not.toBeInTheDocument();

    rerender(<MessageRenderer message={{ ...eligible, content: { ...baseContent, presentation: { feedback_eligible: true, part_index: 1, part_count: 1 } } }} onFeedback={onFeedback} />);
    expect(screen.getByRole("button", { name: "Useful" })).toBeInTheDocument();
    screen.getByRole("button", { name: "Useful" }).click();
    expect(onFeedback).toHaveBeenCalledWith("eligible-message", "useful");

    rerender(<MessageRenderer message={eligible} onFeedback={onFeedback} feedbackType="useful" />);
    expect(screen.queryByRole("button", { name: "Useful" })).not.toBeInTheDocument();

    rerender(<MessageRenderer message={{ ...eligible, role: "system" }} onFeedback={onFeedback} />);
    expect(screen.queryByRole("button", { name: "Useful" })).not.toBeInTheDocument();
  });
});
