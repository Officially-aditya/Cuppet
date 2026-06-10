import React, { useState } from "react";
import { ArrowLeft, MoreHorizontal, Check, PlusCircle, Send, CheckSquare, RefreshCw } from "lucide-react";
import { Screen, ChatMessage } from "../types";
import { INITIAL_TRACKER_CHAT } from "../data";

interface SetupTrackerScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function SetupTrackerScreen({ onNavigate }: SetupTrackerScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_TRACKER_CHAT);
  const [textInput, setTextInput] = useState("");

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    const newMsg: ChatMessage = {
      id: "user-msg-" + Date.now(),
      sender: "user",
      content: textInput.trim(),
    };

    setMessages((prev) => [...prev, newMsg]);
    setTextInput("");

    // Simulate Agent responds to user message
    setTimeout(() => {
      const responseMsg: ChatMessage = {
        id: "agent-reply-" + Date.now(),
        sender: "agent",
        content: "Awesome! I'll scan the connector logs as soon as you approve Calendar and Google Calendar connections.",
      };
      setMessages((prev) => [...prev, responseMsg]);
    }, 1200);
  };

  return (
    <div id="tracker-container" className="bg-surface text-on-surface antialiased flex flex-col h-screen overflow-hidden w-full max-w-md mx-auto relative">
      {/* TopAppBar */}
      <header className="sticky top-0 w-full z-40 bg-surface flex items-center justify-between px-page h-16 border-b border-line">
        <button
          onClick={() => onNavigate(Screen.Inbox)}
          className="text-on-surface-variant hover:bg-primary-soft transition-colors p-2 rounded-full cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-outline" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-soft text-primary flex items-center justify-center font-bold text-sm">
            S
          </div>
          <h1 className="font-bold text-base text-primary font-inter">Sydney</h1>
        </div>
        <button className="text-on-surface-variant hover:bg-primary-soft transition-colors p-2 rounded-full cursor-pointer">
          <MoreHorizontal className="w-5 h-5 text-outline" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pt-4 pb-28 px-page flex flex-col gap-4">
        {messages.map((msg) => {
          if (msg.sender === "system") {
            const isAwaiting = msg.content === "Awaiting connection";
            return (
              <div key={msg.id} className="flex justify-center my-1">
                <span className="bg-system-bubble text-on-surface-variant text-xs font-semibold px-4 py-1.5 rounded-full flex items-center gap-1.5 select-none font-inter border border-line">
                  {isAwaiting && <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin" />}
                  {msg.content}
                </span>
              </div>
            );
          }

          if (msg.sender === "user") {
            return (
              <div key={msg.id} className="flex justify-end w-full animate-fade-in">
                <div className="bg-user-bubble text-ink rounded-2xl rounded-br-none px-4 py-3 max-w-[82%] text-sm font-medium font-inter border border-[#bec9c2]">
                  {msg.content}
                </div>
              </div>
            );
          }

          // Render Agent setup progress card matches Screen 7 exactly
          if (msg.templateType === "progress") {
            return (
              <div key={msg.id} className="flex items-start gap-2 w-full">
                <div className="w-6 h-6 rounded-full bg-primary-soft text-primary flex items-center justify-center text-xs font-semibold shrink-0 select-none mt-1">
                  S
                </div>
                <div className="bg-agent-bubble border border-line rounded-2xl rounded-bl-none p-4 w-[85%] shadow-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckSquare className="w-5 h-5 text-primary" />
                    <h2 className="font-bold text-sm text-on-surface font-inter">Agent setup guide</h2>
                  </div>
                  <p className="text-xs text-on-surface-variant mb-4 leading-relaxed font-inter">
                    {msg.content}
                  </p>

                  {/* Progress bar info */}
                  <div className="mb-4">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider font-inter">
                        Progress
                      </span>
                      <span className="text-[10px] font-bold text-primary font-inter">
                        2 of 4 complete
                      </span>
                    </div>
                    <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                      <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: "50%" }}></div>
                    </div>
                  </div>

                  {/* Step Item checkboxes */}
                  <div className="flex flex-col gap-3 font-inter">
                    {/* Step 1: Done */}
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="text-white w-3 h-3 font-bold" />
                      </div>
                      <div>
                        <p className="text-xs text-on-surface line-through font-medium opacity-50">
                          Describe the job
                        </p>
                      </div>
                    </div>

                    {/* Step 2: Done */}
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="text-white w-3 h-3 font-bold" />
                      </div>
                      <div>
                        <p className="text-xs text-on-surface line-through font-medium opacity-50">
                          Review the plan
                        </p>
                      </div>
                    </div>

                    {/* Step 3: Current Connect Tools (Connect Now Trigger) */}
                    <div className="flex items-start gap-3 relative">
                      <div className="absolute left-[9px] -top-3 bottom-full w-px bg-line h-3"></div>
                      <div className="w-5 h-5 rounded-full border-2 border-primary bg-agent-bubble flex items-center justify-center shrink-0 mt-0.5 relative z-10">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-primary">Connect tools</p>
                        <p className="text-[11px] text-on-surface-variant mt-1 leading-normal font-inter">
                          Authenticate your accounts so I can read data.
                        </p>
                        <button
                          onClick={() => onNavigate(Screen.Connectors)}
                          className="mt-2 bg-[#1d7a5c] text-white font-bold text-xs px-4 py-2 rounded-full hover:bg-primary transition-colors cursor-pointer"
                        >
                          Connect Now
                        </button>
                      </div>
                    </div>

                    {/* Step 4: Pending */}
                    <div className="flex items-start gap-3 opacity-50">
                      <div className="w-5 h-5 rounded-full border-2 border-outline-variant bg-agent-bubble shrink-0 mt-0.5"></div>
                      <div>
                        <p className="text-xs text-on-surface-variant font-medium">
                          Start receiving updates
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // General Agent responses
          return (
            <div key={msg.id} className="flex gap-2 w-full animate-fade-in">
              <div className="w-6 h-6 rounded-full bg-primary-soft text-primary flex items-center justify-center text-xs font-semibold shrink-0 select-none mt-1">
                S
              </div>
              <div className="bg-agent-bubble border border-line rounded-2xl rounded-bl-none p-3.5 max-w-[82%] text-sm font-inter">
                {msg.content}
              </div>
            </div>
          );
        })}
      </main>

      {/* Message input fixed bottom reply bar */}
      <div className="absolute bottom-0 left-0 w-full bg-surface border-t border-line px-page py-3 z-30">
        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
          <button
            type="button"
            className="text-on-surface-variant hover:bg-surface-container p-2 rounded-full cursor-pointer transition-colors"
          >
            <PlusCircle className="w-6 h-6 text-outline" />
          </button>
          
          <div className="flex-1 bg-surface-container-lowest border border-line rounded-full flex items-center px-4 py-2.5 focus-within:border-primary transition-all">
            <input
              type="text"
              className="w-full bg-transparent border-none p-0 text-sm text-on-surface placeholder:text-subtle-ink outline-none focus:ring-0 font-inter"
              placeholder="Message Sydney..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
            />
          </div>
          
          <button
            type="submit"
            className="bg-primary text-white p-2.5 rounded-full hover:opacity-95 transition-opacity w-10 h-10 flex items-center justify-center shrink-0 cursor-pointer shadow-xs"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}
