import { ArrowLeft, MoreHorizontal, ClipboardList, Clock, Key, Calendar, FileText } from "lucide-react";
import { Screen } from "../types";

interface ConfirmAgentScreenProps {
  onNavigate: (screen: Screen) => void;
  agentPrompt: string;
}

export default function ConfirmAgentScreen({ onNavigate, agentPrompt }: ConfirmAgentScreenProps) {
  const currentPrompt = agentPrompt || "Summarize the key points from recent meetings and prepare a draft agenda for tomorrow.";

  const handleCreateAgent = () => {
    onNavigate(Screen.SetupTracker);
  };

  return (
    <div id="confirmagent-container" className="bg-surface text-on-surface font-sans min-h-screen flex flex-col w-full max-w-md mx-auto relative pb-32">
      {/* TopAppBar */}
      <header className="sticky top-0 w-full bg-surface border-b border-line z-40 flex justify-between items-center px-page h-16">
        <button
          onClick={() => onNavigate(Screen.NewAgent)}
          aria-label="Go back"
          className="text-on-surface-variant hover:bg-surface-container rounded-full p-2 flex items-center justify-center transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-outline" />
        </button>
        <h1 className="font-bold text-lg text-ink font-inter tracking-tight">Confirm</h1>
        <button
          aria-label="More options"
          className="text-on-surface-variant hover:bg-surface-container rounded-full p-2 flex items-center justify-center transition-colors cursor-pointer"
        >
          <MoreHorizontal className="w-5 h-5 text-outline" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow pt-4 px-page pb-8 flex flex-col gap-4 overflow-y-auto">
        {/* Agent Identity Card */}
        <section className="bg-surface-container-lowest rounded-xl p-4 border border-line flex flex-col gap-2 items-center text-center shadow-xs">
          <div className="w-16 h-16 rounded-full bg-primary-soft text-primary flex items-center justify-center font-bold text-xl mb-1">
            S
          </div>
          <h2 className="font-bold text-xl text-ink font-inter">Sydney</h2>
          <p className="text-sm text-muted-ink max-w-[90%] leading-relaxed italic">
            "{currentPrompt}"
          </p>
        </section>

        {/* What it does Card */}
        <section className="bg-surface-container-lowest rounded-xl p-4 border border-line flex flex-col gap-3 shadow-xs">
          <h3 className="font-bold text-sm text-ink flex items-center gap-2 uppercase tracking-wider">
            <ClipboardList className="w-4 h-4 text-primary" />
            What it does
          </h3>
          <ul className="flex flex-col gap-2 pl-4 list-disc text-sm text-on-surface-variant font-inter">
            <li>Reviews recent calendar events</li>
            <li>Extracts key discussion points</li>
            <li>Drafts a structured agenda for upcoming meetings</li>
          </ul>
        </section>

        {/* When it runs Card */}
        <section className="bg-surface-container-lowest rounded-xl p-4 border border-line flex flex-col gap-3 shadow-xs">
          <h3 className="font-bold text-sm text-ink flex items-center gap-2 uppercase tracking-wider">
            <Clock className="w-4 h-4 text-primary" />
            When it runs
          </h3>
          <p className="text-sm text-on-surface-variant ml-4 font-inter">Whenever you message it</p>
        </section>

        {/* What it needs Card */}
        <section className="bg-surface-container-lowest rounded-xl p-4 border border-line flex flex-col gap-3 shadow-xs">
          <h3 className="font-bold text-sm text-ink flex items-center gap-2 uppercase tracking-wider">
            <Key className="w-4 h-4 text-primary" />
            What it needs
          </h3>
          <div className="ml-4 flex flex-wrap gap-2">
            <div className="bg-surface-container py-1.5 px-3 rounded-full text-xs font-semibold text-on-surface-variant flex items-center gap-1.5 border border-line">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              Calendar Access
            </div>
            <div className="bg-surface-container py-1.5 px-3 rounded-full text-xs font-semibold text-on-surface-variant flex items-center gap-1.5 border border-line">
              <FileText className="w-3.5 h-3.5 text-primary" />
              Notes Access
            </div>
          </div>
        </section>
      </main>

      {/* Action Bar Fixed Bottom matching screen layout */}
      <div className="absolute bottom-0 left-0 w-full bg-surface border-t border-line p-page flex flex-col gap-2 z-30">
        <button
          onClick={handleCreateAgent}
          className="w-full text-white font-semibold py-3.5 rounded-full hover:opacity-95 transition-opacity text-center bg-primary-container shadow-xs cursor-pointer text-sm"
        >
          Create agent
        </button>
        <button
          onClick={() => onNavigate(Screen.NewAgent)}
          className="w-full bg-surface border font-semibold py-3.5 rounded-full hover:bg-primary-soft transition-colors text-center text-primary-container border-primary-container cursor-pointer text-sm"
        >
          Edit sentence
        </button>
      </div>
    </div>
  );
}
