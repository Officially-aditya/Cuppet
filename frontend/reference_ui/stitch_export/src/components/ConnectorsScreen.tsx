import { useState } from "react";
import { ArrowLeft, Network, Mail, Calendar, Hash, CheckCircle2 } from "lucide-react";
import { Screen, Connector } from "../types";
import { INITIAL_CONNECTORS } from "../data";

interface ConnectorsScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function ConnectorsScreen({ onNavigate }: ConnectorsScreenProps) {
  const [connectors, setConnectors] = useState<Connector[]>(INITIAL_CONNECTORS);

  const toggleConnector = (connectorId: string) => {
    setConnectors((prev) =>
      prev.map((c) => {
        if (c.id === connectorId) {
          if (c.status === "connected") {
            return { ...c, status: "none", summary: c.summary };
          } else if (c.status === "linked" || c.status === "none") {
            return { ...c, status: "connected" };
          } else if (c.status === "review") {
            return { ...c, status: "connected" };
          }
        }
        return c;
      })
    );
  };

  return (
    <div id="connectors-container" className="bg-background text-ink min-h-screen flex flex-col antialiased w-full max-w-md mx-auto relative pb-16">
      {/* Top App Bar */}
      <header className="flex justify-between items-center px-page h-16 w-full bg-background border-b border-line sticky top-0 z-40">
        <button
          onClick={() => onNavigate(Screen.Inbox)}
          aria-label="Menu list"
          className="flex items-center justify-center p-2 rounded-full hover:bg-surface-container transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-6 h-6 text-primary" />
        </button>
        <h1 className="font-bold text-lg text-ink font-inter">Connectors</h1>
        <button
          aria-label="Agent workspace hub"
          className="flex items-center justify-center p-2 rounded-full hover:bg-surface-container transition-colors cursor-pointer"
        >
          <Network className="w-5 h-5 text-primary" />
        </button>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-grow px-page py-6 w-full flex flex-col">
        {/* Welcome titles header section */}
        <section className="mb-6">
          <h2 className="text-3xl font-bold font-inter text-ink mb-1">Connectors</h2>
          <p className="text-sm text-subtle-ink font-inter leading-relaxed">
            Connectors are approved here, but tokens stay with the backend.
          </p>
        </section>

        {/* Dynamic Connectors Rows */}
        <section className="flex flex-col gap-4">
          {connectors.map((c) => {
            const isGmail = c.id === "gmail";
            const isCalendar = c.id === "calendar";
            const isSlack = c.id === "slack";

            return (
              <div
                key={c.id}
                className={`border rounded-xl p-4 flex items-center justify-between shadow-xs transition-all relative overflow-hidden bg-surface-container-lowest ${
                  isSlack && c.status === "review" ? "border-warning" : "border-line"
                }`}
              >
                {/* Visual Accent slice for Slack Warning required status */}
                {isSlack && c.status === "review" && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-warning"></div>
                )}

                <div className={`flex items-center gap-4 ${isSlack && c.status === "review" ? "pl-1" : ""}`}>
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                      isSlack && c.status === "review"
                        ? "bg-warning-soft text-warning"
                        : "bg-surface-container text-[#1d7a5c]"
                    }`}
                  >
                    {isGmail && <Mail className="w-5 h-5" />}
                    {isCalendar && <Calendar className="w-5 h-5" />}
                    {isSlack && <Hash className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1a1c1b] text-base font-inter">{c.name}</h3>
                    <p
                      className={`text-xs font-inter font-medium ${
                        isSlack && c.status === "review" ? "text-warning" : "text-subtle-ink"
                      }`}
                    >
                      {c.status === "review" ? "Action required" : c.summary}
                    </p>
                  </div>
                </div>

                {/* Interactive State Toggle Actions */}
                {c.status === "connected" ? (
                  <button
                    onClick={() => toggleConnector(c.id)}
                    className="px-4 py-2 rounded-full bg-primary-soft text-primary font-bold text-xs hover:bg-primary-container hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 font-bold" />
                    Connected
                  </button>
                ) : c.status === "review" ? (
                  <button
                    onClick={() => toggleConnector(c.id)}
                    className="px-4 py-2 rounded-full bg-warning-soft text-warning font-bold text-xs border border-warning hover:bg-warning hover:text-white transition-all cursor-pointer"
                  >
                    Review
                  </button>
                ) : (
                  <button
                    onClick={() => toggleConnector(c.id)}
                    className="px-4 py-2 rounded-full bg-surface-container text-[#1a1c1b] font-bold text-xs border border-line hover:bg-surface-container-high transition-colors cursor-pointer animate-pulse"
                  >
                    Link
                  </button>
                )}
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
