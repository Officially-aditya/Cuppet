"use client";

import { FormEvent, useState } from "react";
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
  const [step, setStep] = useState<"start" | "preview">("start");
  const [prompt, setPrompt] = useState("");
  const [selectedRecipeId, setSelectedRecipeId] = useState("custom");
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectRecipe = (recipe: AgentRecipe) => {
    setPrompt(recipe.example_prompt || recipe.description);
    setSelectedRecipeId(recipe.id);
    setError("");
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
  const agentName = String(parsed.name ?? configuration.name ?? "New Cuppet agent");
  const action = String(parsed.action ?? configuration.description ?? prompt);
  const schedule = String(parsed.schedule_label ?? configuration.schedule ?? (parsed.schedule_cron ? "Custom schedule" : "On demand"));
  const access = Array.isArray(parsed.connector_ids) && parsed.connector_ids.length ? parsed.connector_ids.join(", ") : "Only what you connect";

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-agent-title">
        <header className="creation-dialog-header">
          {step === "preview" ? <button className="creation-text-button" onClick={() => { setStep("start"); setError(""); }}>Back</button> : <span aria-hidden="true" />}
          <button className="creation-text-button" onClick={onClose}>Close</button>
        </header>

        {step === "start" && (
          <form className="dialog-body creation-start-step" onSubmit={parse}>
            <div className="creation-intro">
              <p className="eyebrow">Agent setup</p>
              <h1 id="create-agent-title">Create an agent</h1>
              <p>Describe the work in your own words, or begin with an example.</p>
            </div>

            <label className="creation-field">
              <span className="creation-section-label">Describe the work</span>
              <div className="prompt-editor">
                <textarea
                  autoFocus
                  value={prompt}
                  onChange={(event) => { setPrompt(event.target.value); setSelectedRecipeId("custom"); setError(""); }}
                  minLength={3}
                  rows={6}
                  maxLength={4000}
                  placeholder="For example: Send me a concise news brief every morning."
                />
                <small>{prompt.length}/4000</small>
              </div>
            </label>

            <div className="creation-section">
              <p className="creation-section-label">Start with an example</p>
              <div className="recipe-grid">
                <button
                  type="button"
                  className={`recipe-card ${selectedRecipeId === "custom" ? "selected" : ""}`}
                  onClick={() => { setSelectedRecipeId("custom"); setPrompt(""); setError(""); }}
                >
                  <b>Custom agent</b>
                  <p>Write your own prompt from scratch.</p>
                </button>
                {recipes.map((recipe) => (
                  <button
                    type="button"
                    key={recipe.id}
                    className={`recipe-card ${selectedRecipeId === recipe.id ? "selected" : ""}`}
                    onClick={() => selectRecipe(recipe)}
                  >
                    <b>{recipe.name}</b>
                    <p>{recipe.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="form-message error">{error}</p>}
            <footer className="creation-footer">
              <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy || prompt.trim().length < 3}>{busy ? "Preparing…" : "Continue"}</button>
            </footer>
          </form>
        )}

        {step === "preview" && (
          <div className="dialog-body creation-confirm-step">
            <div className="creation-intro">
              <p className="eyebrow">Final review</p>
              <h1 id="create-agent-title">Confirm your agent</h1>
              <p>Review what it will do, when it will run, and which services it needs.</p>
            </div>

            <div className="agent-preview-card creation-review-card">
              <div className="preview-agent-heading">
                <small>Agent name</small>
                <h3>{agentName}</h3>
                <span className="ready-pill">Ready</span>
              </div>
              <p className="preview-review-prompt">{prompt}</p>
            </div>

            <div className="creation-section preview-info-section">
              <p className="creation-section-label">Agent details</p>
              <div className="preview-info-list">
                <article className="preview-info-card"><b>What it does</b><p>{action}</p></article>
                <article className="preview-info-card"><b>When it runs</b><p>{schedule}</p></article>
                <article className="preview-info-card"><b>Connected tools</b><p>{access}</p></article>
                <article className="preview-info-card"><b>Safety</b><p>Read-only by default</p></article>
              </div>
            </div>

            <p className="preview-note">You can refine the name, schedule, notifications, and response length after creating it.</p>
            {error && <p className="form-message error">{error}</p>}
            <footer className="creation-footer">
              <button className="secondary-button" onClick={() => { setStep("start"); setError(""); }}>Back</button>
              <button className="primary-button" onClick={create} disabled={busy}>{busy ? "Creating…" : "Create Agent"}</button>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}
