import { Mail, BarChart2, Users, Settings, Pin, Plus, Menu, Network } from "lucide-react";
import { Screen, AgentThread } from "../types";

interface InboxScreenProps {
  threads: AgentThread[];
  onNavigate: (screen: Screen) => void;
  onSelectThread: (threadId: string) => void;
}

export default function InboxScreen({ threads, onNavigate, onSelectThread }: InboxScreenProps) {
  const handleThreadClick = (thread: AgentThread) => {
    if (thread.id === "scout") {
      onSelectThread("scout");
      onNavigate(Screen.ScoutChat);
    } else if (thread.id === "assistant") {
      onNavigate(Screen.NewAgent);
    } else if (thread.id === "opswatch") {
      onSelectThread("opswatch");
      onNavigate(Screen.SetupTracker); // Operations setup tracker simulator
    }
  };

  return (
    <div id="inbox-container" className="bg-background min-h-screen text-on-surface antialiased flex flex-col relative pb-24 pt-16 w-full max-w-md mx-auto">
      {/* TopAppBar */}
      <header className="bg-background border-b border-line text-primary docked full-width top-0 flex justify-between items-center px-page h-16 w-full z-40 fixed max-w-md mx-auto">
        <div className="flex items-center gap-sm">
          <Menu className="w-6 h-6 text-primary cursor-pointer hover:opacity-80" />
          <h1 className="font-title-lg text-title-lg text-ink font-bold tracking-tight select-none ml-2">
            Inbox
          </h1>
        </div>
        <div className="flex items-center gap-sm text-primary">
          <button
            onClick={() => onNavigate(Screen.Connectors)}
            className="p-2 hover:bg-surface-container transition-colors rounded-full flex items-center justify-center cursor-pointer"
          >
            <Network className="w-5 h-5 text-primary" />
          </button>
          <button
            onClick={() => onNavigate(Screen.Settings)}
            className="p-2 hover:bg-surface-container transition-colors rounded-full flex items-center justify-center cursor-pointer"
          >
            <Settings className="w-5 h-5 text-primary" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full px-page py-lg flex flex-col gap-lg mt-2 overflow-y-auto">
        {/* System Copy Pill Container */}
        <div className="flex justify-center">
          <div className="bg-system-bubble text-on-surface-variant font-body-sm text-xs px-4 py-2 rounded-full text-center">
            Assistant is pinned so you always have a place to start.
          </div>
        </div>

        {/* Thread List */}
        <div className="flex flex-col gap-md">
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => handleThreadClick(thread)}
              className="w-full bg-surface-container-lowest border border-line rounded-lg p-4 flex items-start gap-4 hover:bg-surface-container-low transition-colors text-left relative overflow-hidden group cursor-pointer"
            >
              {thread.isPinned && (
                <div className="absolute top-2 right-2 text-muted-ink opacity-60 group-hover:opacity-100 transition-opacity">
                  <Pin className="w-4 h-4 text-[#006046] rotate-45" />
                </div>
              )}
              
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-center shrink-0 ${thread.colorClass}`}>
                {thread.initials}
              </div>
              
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-[17px] font-bold text-ink truncate font-inter">
                    {thread.name}
                  </h2>
                  {thread.hasBadge && (
                    <div className="w-3 h-3 rounded-full bg-primary shrink-0"></div>
                  )}
                </div>
                <p className={`text-sm text-on-surface-variant truncate font-inter ${thread.hasBadge ? "font-semibold text-ink" : ""}`}>
                  {thread.preview}
                </p>
                <p className="text-xs text-muted-ink truncate font-inter mt-0.5">
                  {thread.detail}
                </p>
              </div>
            </button>
          ))}
        </div>
      </main>

      {/* Floating Action Button "New" */}
      <button
        onClick={() => onNavigate(Screen.NewAgent)}
        className="fixed bottom-24 right-6 bg-primary-container hover:bg-primary text-white px-5 py-3 rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 z-30 cursor-pointer"
      >
        <Plus className="w-5 h-5 text-white" />
        <span className="font-semibold text-sm">New</span>
      </button>

      {/* BottomNavBar */}
      <nav className="bg-surface border-t border-line docked full-width bottom-0 rounded-t-xl fixed bottom-0 w-full max-w-md mx-auto z-40 flex justify-around items-center px-4 py-2">
        <button
          onClick={() => onNavigate(Screen.Inbox)}
          className="flex flex-col items-center justify-center bg-primary-soft text-primary rounded-full p-3 hover:bg-surface-variant transition-all scale-95 duration-200 cursor-pointer"
        >
          <Mail className="w-5 h-5 text-[#1d7a5c]" />
        </button>
        <button
          onClick={() => onNavigate(Screen.ScoutChat)}
          className="flex flex-col items-center justify-center text-muted-ink p-3 hover:bg-surface-variant transition-all scale-95 duration-200 cursor-pointer"
        >
          <BarChart2 className="w-5 h-5 text-muted-ink" />
        </button>
        <button
          onClick={() => onNavigate(Screen.Connectors)}
          className="flex flex-col items-center justify-center text-muted-ink p-3 hover:bg-surface-variant transition-all scale-95 duration-200 cursor-pointer"
        >
          <Users className="w-5 h-5 text-muted-ink" />
        </button>
        <button
          onClick={() => onNavigate(Screen.Settings)}
          className="flex flex-col items-center justify-center text-muted-ink p-3 hover:bg-surface-variant transition-all scale-95 duration-200 cursor-pointer"
        >
          <Settings className="w-5 h-5 text-muted-ink" />
        </button>
      </nav>
    </div>
  );
}
