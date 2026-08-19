"use client";

import { ArrowLeft, Check, LoaderCircle } from "lucide-react";
import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";

const topics = [
  { id: "product_idea", label: "Product idea" },
  { id: "something_went_wrong", label: "Something went wrong" },
  { id: "general_feedback", label: "General feedback" }
];

export function FeedbackPanel({ onSubmit, onBack, onClose }: { onSubmit: (topic: string, message: string) => Promise<void>; onBack: () => void; onClose?: () => void }) {
  const [topic, setTopic] = useState("product_idea");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [topicOpen, setTopicOpen] = useState(false);
  const topicMenuRef = useRef<HTMLDivElement>(null);
  const selectedTopic = topics.find((item) => item.id === topic)?.label ?? topics[0].label;

  useEffect(() => {
    if (!topicOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!topicMenuRef.current?.contains(event.target as Node)) setTopicOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTopicOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [topicOpen]);

  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { await onSubmit(topic, message.trim()); setSent(true); setMessage(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to send feedback."); } finally { setBusy(false); } };
  return <section className="content-panel feedback-panel flutter-feedback-panel">
    <header className="flutter-feedback-appbar"><Image src="/cuppet-mark.png" alt="Cuppet" width={28} height={28} />{onClose && <button type="button" className="flutter-feedback-close" onClick={onClose}>Close</button>}</header>
    <div className="flutter-feedback-scroll">
      {sent ? <div className="flutter-feedback-confirmation">
        <span className="flutter-feedback-confirmation-icon"><Check size={34} /></span>
        <h2>Thanks for helping Cuppet grow.</h2>
        <p>Your note has been captured. We appreciate you taking the time to share it.</p>
        <button type="button" className="flutter-feedback-back-button" onClick={onBack}><ArrowLeft size={18} />{onClose ? "Close" : "Back to inbox"}</button>
      </div> : <form className="flutter-feedback-form" onSubmit={submit}>
        <h1>Help shape Cuppet</h1>
        <p className="flutter-feedback-lede">Tell us what is working, what is not, or what you would love to see next.</p>
        <div className="flutter-feedback-card">
          <label className="flutter-feedback-label" htmlFor="feedback-topic">What kind of feedback do you have?</label>
          <div className={`flutter-feedback-select-wrap ${topicOpen ? "open" : ""}`} ref={topicMenuRef}>
            <button type="button" id="feedback-topic" className="flutter-feedback-select" disabled={busy} aria-haspopup="listbox" aria-expanded={topicOpen} onClick={() => setTopicOpen((open) => !open)}>
              <span>{selectedTopic}</span>
            </button>
            {topicOpen && <div className="flutter-feedback-menu" role="listbox" aria-label="Feedback topic">
              {topics.map(({ id, label }) => <button type="button" role="option" aria-selected={topic === id} className={`flutter-feedback-option ${topic === id ? "selected" : ""}`} key={id} onClick={() => { setTopic(id); setTopicOpen(false); setError(""); }}>{label}</button>)}
            </div>}
          </div>
          <label className="flutter-feedback-label flutter-feedback-message-label" htmlFor="feedback-message">Your feedback</label>
          <textarea id="feedback-message" rows={6} maxLength={5000} disabled={busy} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Share a little detail so we can learn from it…" />
          {error && <p className="form-message error" role="alert">{error}</p>}
          <div className="flutter-feedback-actions">
            <button type="button" className="flutter-feedback-back-button" disabled={busy} onClick={onBack}><span>{onClose ? "Cancel" : "Back"}</span></button>
            <button type="submit" className="flutter-feedback-submit" disabled={busy || !message.trim()}>{busy ? <LoaderCircle className="spin" size={20} /> : "Send feedback"}</button>
          </div>
        </div>
      </form>}
    </div>
  </section>;
}
