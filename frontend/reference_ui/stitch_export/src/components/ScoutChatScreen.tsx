import React, { useState } from "react";
import { ArrowLeft, MoreHorizontal, Send, ShieldCheck, Info, CheckCircle2 } from "lucide-react";
import { Screen, ChatMessage } from "../types";
import { INITIAL_SCOUT_CHAT } from "../data";

interface ScoutChatScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function ScoutChatScreen({ onNavigate }: ScoutChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_SCOUT_CHAT);
  const [text, setText] = useState("");

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const newMsg: ChatMessage = {
      id: "scout-msg-" + Date.now(),
      sender: "user",
      content: text.trim(),
    };

    setMessages((prev) => [...prev, newMsg]);
    setText("");

    // Simulate smart agent response
    setTimeout(() => {
      const responseMsg: ChatMessage = {
        id: "scout-reply-" + Date.now(),
        sender: "agent",
        content: "Understood! I will continue scanning active newsletters and update your market trends log.",
      };
      setMessages((prev) => [...prev, responseMsg]);
    }, 1500);
  };

  return (
    <div id="scoutchat-container" className="bg-surface text-ink font-sans min-h-screen flex flex-col antialiased w-full max-w-md mx-auto relative overflow-hidden h-screen">
      {/* TopAppBar */}
      <header className="sticky top-0 w-full bg-surface border-b border-line z-40 flex justify-between items-center px-page h-16">
        <button
          onClick={() => onNavigate(Screen.Inbox)}
          className="p-2 -ml-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-outline" />
        </button>
        <h1 className="font-bold text-base text-ink absolute left-1/2 -translate-x-1/2 font-inter">
          Research Scout
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate(Screen.Connectors)}
            className="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant cursor-pointer"
          >
            <ShieldCheck className="w-5 h-5 text-outline" />
          </button>
          <button
            onClick={() => onNavigate(Screen.Settings)}
            className="p-2 -mr-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant cursor-pointer"
          >
            <Info className="w-5 h-5 text-outline" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow overflow-y-auto pt-4 pb-24 px-page flex flex-col gap-4">
        {messages.map((msg) => {
          if (msg.sender === "system") {
            return (
              <div key={msg.id} className="flex justify-center w-full select-none">
                <div className="bg-system-bubble border border-line px-4 py-2 rounded-full max-w-[85%] text-center">
                  <p className="text-[11px] text-subtle-ink leading-none font-inter leading-relaxed">
                    {msg.content}
                  </p>
                </div>
              </div>
            );
          }

          if (msg.sender === "user") {
            return (
              <div key={msg.id} className="flex w-full justify-end animate-fade-in">
                <div className="bg-[#1d7a5c] text-white rounded-2xl rounded-tr-none p-3.5 max-w-[82%] shadow-xs text-sm font-inter">
                  <p className="leading-relaxed">{msg.content}</p>
                </div>
              </div>
            );
          }

          // Renders the stylized research ready report block from screen 9
          if (msg.templateType === "report") {
            return (
              <div key={msg.id} className="flex flex-col gap-1 w-full animate-fade-in">
                <div className="flex items-center gap-1 px-1">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span className="font-bold text-[10px] text-primary uppercase tracking-wider font-inter">
                    Ready
                  </span>
                </div>
                <div className="bg-agent-bubble border border-line rounded-2xl rounded-bl-none p-4 w-[85%] shadow-xs flex flex-col gap-4">
                  <div>
                    <h3 className="font-bold text-sm text-ink mb-1 font-inter">Market pulse</h3>
                    <p className="text-xs text-on-surface-variant leading-relaxed font-inter">
                      {msg.content}
                    </p>
                  </div>
                  
                  {/* Detailed Metric grid boxes */}
                  <div className="flex flex-wrap gap-2">
                    <div className="bg-surface-container-low border border-line rounded-lg px-3 py-1.5 flex flex-col min-w-[70px]">
                      <span className="text-[9px] font-bold text-muted-ink uppercase font-inter leading-none">
                        Sources
                      </span>
                      <span className="font-bold text-sm text-ink font-inter mt-1">18</span>
                    </div>
                    <div className="bg-surface-container-low border border-line rounded-lg px-3 py-1.5 flex flex-col min-w-[70px]">
                      <span className="text-[9px] font-bold text-muted-ink uppercase font-inter leading-none">
                        Signals
                      </span>
                      <span className="font-bold text-sm text-ink font-inter mt-1 font-inter">5</span>
                    </div>
                    <div className="bg-surface-container-low border border-line rounded-lg px-3 py-1.5 flex flex-col min-w-[70px]">
                      <span className="text-[9px] font-bold text-muted-ink uppercase font-inter leading-none">
                        Filtered
                      </span>
                      <span className="font-bold text-sm text-ink font-inter mt-1">42%</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // System standard info template
          if (msg.templateType === "streak") {
            return (
              <div key={msg.id} className="flex w-full animate-fade-in">
                <div className="bg-agent-bubble border border-line rounded-2xl rounded-bl-none p-4 w-[85%] shadow-xs flex items-center gap-3">
                  <Info className="text-info w-5 h-5 shrink-0" />
                  <p className="text-xs text-on-surface-variant leading-normal font-inter">
                    {msg.content}
                  </p>
                </div>
              </div>
            );
          }

          // Standard reply bubble
          return (
            <div key={msg.id} className="flex gap-2 w-full animate-fade-in">
              <div className="bg-agent-bubble border border-line rounded-2xl rounded-bl-none p-3.5 max-w-[82%] text-sm font-inter">
                <p className="leading-relaxed text-ink">{msg.content}</p>
              </div>
            </div>
          );
        })}
      </main>

      {/* Reply input row */}
      <div className="absolute bottom-0 left-0 w-full bg-surface px-page py-3 border-t border-line z-30">
        <form onSubmit={handleSendMessage} className="bg-agent-bubble border border-line rounded-full flex items-center px-4 py-2 focus-within:border-primary transition-colors shadow-xs">
          <input
            type="text"
            className="flex-1 bg-transparent border-none p-0 text-sm text-ink placeholder:text-muted-ink outline-none focus:ring-0 font-inter"
            placeholder="Message agent"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="submit"
            className="ml-2 p-2 rounded-full bg-primary text-on-primary hover:bg-primary-container transition-colors flex items-center justify-center h-8 w-8 cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}
