"use client";

import { ArrowLeft, ArrowRight, Bot, Check, LoaderCircle, Search, Sparkles, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { AgentRecipe } from "@/lib/types";

export function CreateAgentDialog({
  recipes,
  onClose,
  onParse,
  onCreate
}: {
  recipes: AgentRecipe[];
  onClose: () => void;
  onParse: (prompt: string) => Promise<Record<string, unknown>>;
  onCreate: (prompt: string) => Promise<void>;
}) {
  const [step, setStep] = useState<"start" | "describe" | "preview">("start");
  const [prompt, setPrompt] = useState("");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const filtered = useMemo(() => recipes.filter((recipe) => `${recipe.name} ${recipe.description}`.toLowerCase().includes(query.toLowerCase())), [query, recipes]);

  const selectRecipe = (recipe: AgentRecipe) => {
    setPrompt(recipe.example_prompt || recipe.description);
    setStep("describe");
  };

  const parse = async (event: FormEvent) => {
    event.preventDefault();
    if (prompt.trim().length < 3) return;
    setBusy(true);
    setError("");
    try {
      setPreview(await onParse(prompt.trim()));
      setStep("preview");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cuppet couldn’t shape that agent yet.");
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      await onCreate(prompt.trim());
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create the agent.");
    } finally {
      setBusy(false);
    }
  };

  const parsed = (preview?.parsed_intent && typeof preview.parsed_intent === "object" ? preview.parsed_intent : {}) as Record<string, unknown>;
  const configuration = ((preview?.agent_preview ?? preview?.configuration) && typeof (preview?.agent_preview ?? preview?.configuration) === "object" ? (preview?.agent_preview ?? preview?.configuration) : {}) as Record<string, unknown>;

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-agent-title">
        <header><div>{step !== "start" && <button className="icon-button" onClick={() => setStep(step === "preview" ? "describe" : "start")} aria-label="Go back"><ArrowLeft size={18} /></button>}<span className="dialog-mark"><Sparkles size={18} /></span><span><p className="eyebrow">New agent</p><h2 id="create-agent-title">{step === "start" ? "What should Cuppet watch?" : step === "describe" ? "Describe the outcome" : "A first look"}</h2></span></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></header>

        {step === "start" && <div className="dialog-body start-step">
          <button className="blank-agent-card" onClick={() => setStep("describe")}><span><Sparkles size={21} /></span><div><b>Describe it in your own words</b><p>Tell Cuppet what should happen and when.</p></div><ArrowRight size={18} /></button>
          <div className="template-heading"><span>Or start with a recipe</span><div className="search-input"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipes" /></div></div>
          <div className="recipe-grid">{filtered.map((recipe) => <button key={recipe.id} onClick={() => selectRecipe(recipe)}><span className="recipe-icon"><Bot size={18} /></span><b>{recipe.name}</b><p>{recipe.description}</p><small>{recipe.category || "Agent recipe"}</small></button>)}</div>
        </div>}

        {step === "describe" && <form className="dialog-body describe-step" onSubmit={parse}>
          <div className="prompt-helper"><span><Sparkles size={18} /></span><p>Write it like a request to a thoughtful teammate. Include the source, useful outcome, and timing if it matters.</p></div>
          <label><span>What should this agent do?</span><textarea autoFocus value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={8} maxLength={4000} placeholder="Every weekday at 8 AM, check my calendar and important email, then give me a short briefing with anything that needs a decision." /><small>{prompt.length}/4000</small></label>
          <div className="prompt-examples"><span>Try:</span><button type="button" onClick={() => setPrompt("Watch my Gmail and tell me when a message needs a decision from me.")}>Triage my inbox</button><button type="button" onClick={() => setPrompt("Every Friday afternoon, summarize meaningful progress and blockers across GitHub and Slack.")}>Weekly project pulse</button></div>
          {error && <p className="form-message error">{error}</p>}
          <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy || prompt.trim().length < 3}>{busy ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}Preview agent</button></footer>
        </form>}

        {step === "preview" && <div className="dialog-body preview-step">
          <div className="agent-preview-card"><div className="preview-agent-heading"><span className="agent-avatar coral"><Bot size={20} /></span><span><small>Agent name</small><h3>{String(parsed.name ?? configuration.name ?? "New Cuppet agent")}</h3></span><span className="ready-pill"><Check size={13} />Ready</span></div><div className="preview-summary"><p className="eyebrow">What it will do</p><p>{String(parsed.action ?? configuration.description ?? prompt)}</p></div><div className="preview-details"><div><small>Schedule</small><b>{String(parsed.schedule_label ?? configuration.schedule ?? (parsed.schedule_cron ? "Custom schedule" : "On demand"))}</b></div><div><small>Access</small><b>{Array.isArray(parsed.connector_ids) && parsed.connector_ids.length ? parsed.connector_ids.join(", ") : "Only what you connect"}</b></div><div><small>Safety</small><b>Read-only by default</b></div></div></div>
          <p className="preview-note">You can refine the name, schedule, notifications, and response length after creating it.</p>
          {error && <p className="form-message error">{error}</p>}
          <footer><button className="secondary-button" onClick={() => setStep("describe")}>Edit description</button><button className="primary-button" onClick={create} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}Create agent</button></footer>
        </div>}
      </section>
    </div>
  );
}
