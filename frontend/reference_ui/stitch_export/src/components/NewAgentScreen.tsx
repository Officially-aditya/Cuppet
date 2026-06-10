import { useState } from "react";
import { ArrowLeft, MoreHorizontal, Mic, Sparkles, Sliders, ArrowRight, FileText, TrendingUp, AlertTriangle, ListTodo } from "lucide-react";
import { Screen } from "../types";

interface NewAgentScreenProps {
  onNavigate: (screen: Screen) => void;
  agentPrompt: string;
  setAgentPrompt: (prompt: string) => void;
}

export default function NewAgentScreen({ onNavigate, agentPrompt, setAgentPrompt }: NewAgentScreenProps) {
  const [activeChips, setActiveChips] = useState<string[]>([]);
  const [isDictating, setIsDictating] = useState(false);

  const chips = [
    { id: "summarize", text: "Summarize", icon: FileText, appendText: " and summarize key discussion points" },
    { id: "track", text: "Track progress", icon: TrendingUp, appendText: " and track milestones as we go" },
    { id: "flag", text: "Flag urgency", icon: AlertTriangle, appendText: " and flag escalations immediately" },
    { id: "checklist", text: "Checklist", icon: ListTodo, appendText: " and prepare a structured todo checklist" },
  ];

  const toggleChip = (chipId: string, appendText: string) => {
    if (activeChips.includes(chipId)) {
      setActiveChips(activeChips.filter(c => c !== chipId));
      // Remove text if wanted, or keep it simple. Let's just remove the text block:
      setAgentPrompt(agentPrompt.replace(appendText, ""));
    } else {
      setActiveChips([...activeChips, chipId]);
      setAgentPrompt(agentPrompt + appendText);
    }
  };

  const handleAISuggest = () => {
    const templates = [
      "Track recent calendar events, extract key decision points, and draft a structured agenda for upcoming meetings.",
      "Watch customer feedback for urgent bug reports and flag high priority items.",
      "Summarize the latest category shifts for the market pulse and filter out noise.",
      "Analyze sales pipelines and prepare a briefing summary every Monday morning."
    ];
    // Rotate through suggestions
    const index = Math.floor(Math.random() * templates.length);
    setAgentPrompt(templates[index]);
  };

  const handleVoiceDictate = () => {
    setIsDictating(true);
    setTimeout(() => {
      setAgentPrompt("Summarize key points from recent meetings and prepare a draft agenda for tomorrow.");
      setIsDictating(false);
    }, 1500);
  };

  const currentPromptContent = agentPrompt || "Watch my customer escalations and brief me each morning.";

  const handleReviewClick = () => {
    if (!agentPrompt.trim()) {
      setAgentPrompt("Summarize key points from recent meetings and prepare a draft agenda.");
    }
    onNavigate(Screen.ConfirmAgent);
  };

  return (
    <div id="newagent-container" className="bg-surface text-ink antialiased h-screen w-full flex flex-col font-sans max-w-md mx-auto relative pb-28">
      {/* TopAppBar Component */}
      <header className="sticky top-0 w-full bg-surface z-40 border-b border-line">
        <div className="flex justify-between items-center px-page h-16 w-full">
          <button
            onClick={() => onNavigate(Screen.Inbox)}
            aria-label="Go back"
            className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg text-ink flex-1 text-center truncate px-4">
            New agent
          </h1>
          <button
            aria-label="More options"
            className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Scrollable Canvas */}
      <main className="flex-1 overflow-y-auto px-page pt-4 pb-4 flex flex-col gap-6">
        {/* Animated Custom Robot Icon */}
        <div className="w-full flex justify-center py-2 relative">
          <div className="w-24 h-24 rounded-[32px] bg-primary-soft flex items-center justify-center relative shadow-sm border border-line">
            <span className="text-4xl text-primary font-bold">🤖</span>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-surface-container-highest border-2 border-surface flex items-center justify-center text-xs font-bold text-muted-ink">
              +
            </div>
          </div>
        </div>

        {/* User prompt question section */}
        <section className="flex flex-col gap-2 w-full">
          <label htmlFor="agent-prompt" className="font-bold text-base text-ink px-1">
            What should this agent handle?
          </label>
          <div className="relative w-full rounded-2xl bg-surface-container-lowest border border-line focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all duration-200 shadow-sm overflow-hidden">
            <textarea
              id="agent-prompt"
              className="w-full bg-transparent border-none p-4 text-[#1a1c1b] placeholder-subtle-ink min-h-[140px] resize-none outline-none focus:ring-0 text-sm font-inter"
              placeholder="Watch my customer escalations and brief me each morning."
              rows={4}
              value={agentPrompt}
              onChange={(e) => setAgentPrompt(e.target.value)}
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleVoiceDictate}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-muted-ink transition-colors cursor-pointer ${
                  isDictating ? "bg-red-100 text-red-500 animate-pulse" : "bg-surface-container hover:bg-surface-container-high"
                }`}
                title="Use microphone"
              >
                <Mic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleAISuggest}
                className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
                title="Generate suggestion with AI"
              >
                <Sparkles className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </section>

        {/* Suggested capabilities chips */}
        <section className="flex flex-col gap-3 w-full">
          <h2 className="text-xs font-bold text-muted-ink uppercase tracking-wider px-1">
            Common capabilities
          </h2>
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => {
              const IconComp = chip.icon;
              const isActive = activeChips.includes(chip.id);
              return (
                <button
                  key={chip.id}
                  onClick={() => toggleChip(chip.id, chip.appendText)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? "bg-primary-soft border-primary-fixed text-primary"
                      : "bg-surface-container-lowest border-line text-ink hover:bg-surface-container-low"
                  }`}
                >
                  <IconComp className={`w-4 h-4 ${isActive ? "text-primary" : "text-subtle-ink"}`} />
                  {chip.text}
                </button>
              );
            })}
          </div>
        </section>

        {/* Settings Box preview matching specs layout block */}
        <section className="flex flex-col gap-3 w-full p-4 rounded-2xl bg-surface-container-low border border-line/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-ink">
              <Sliders className="w-4 h-4 text-muted-ink" />
              <span className="font-bold text-xs uppercase tracking-wider">Agent Settings</span>
            </div>
            <button className="text-primary hover:underline font-bold text-xs">Edit</button>
          </div>
          <div className="flex flex-col gap-2 mt-1">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              <span className="text-xs text-ink font-medium">Runs continuously in background</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              <span className="text-xs text-ink font-medium">Connects to Inbox &amp; Calendar</span>
            </div>
          </div>
        </section>
      </main>

      {/* Action footer area */}
      <div className="absolute bottom-0 left-0 w-full bg-surface pb-6 pt-2 px-page border-t border-line/50 z-30">
        <button
          onClick={handleReviewClick}
          className="w-full py-4 rounded-xl bg-primary hover:bg-[#176049] text-white font-semibold shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          Review agent
          <ArrowRight className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}
