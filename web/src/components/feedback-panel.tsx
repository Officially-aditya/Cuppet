"use client";

import { ArrowLeft, Check, LoaderCircle } from "lucide-react";
import Image from "next/image";
import { FormEvent, useState } from "react";

const topics = [
  { id: "product_idea", label: "Product idea" },
  { id: "something_went_wrong", label: "Something went wrong" },
  { id: "general_feedback", label: "General feedback" }
];

export function FeedbackPanel({ onSubmit, onBack }: { onSubmit: (topic: string, message: string) => Promise<void>; onBack: () => void }) {
  const [topic, setTopic] = useState("product_idea");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { await onSubmit(topic, message.trim()); setSent(true); setMessage(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to send feedback."); } finally { setBusy(false); } };
  return <section className="content-panel feedback-panel flutter-feedback-panel">
    <header className="flutter-feedback-appbar"><Image src="/cuppet-mark.png" alt="Cuppet" width={28} height={28} /></header>
    <div className="flutter-feedback-scroll">
      {sent ? <div className="flutter-feedback-confirmation">
        <span className="flutter-feedback-confirmation-icon"><Check size={34} /></span>
        <h2>Thanks for helping Cuppet grow.</h2>
        <p>Your note has been captured. We appreciate you taking the time to share it.</p>
        <button type="button" className="flutter-feedback-back-button" onClick={onBack}><ArrowLeft size={18} />Back to inbox</button>
      </div> : <form className="flutter-feedback-form" onSubmit={submit}>
        <h1>Help shape Cuppet</h1>
        <p className="flutter-feedback-lede">Tell us what is working, what is not, or what you would love to see next.</p>
        <div className="flutter-feedback-card">
          <label className="flutter-feedback-label" htmlFor="feedback-topic">What kind of feedback do you have?</label>
          <div className="flutter-feedback-select-wrap">
            <select id="feedback-topic" value={topic} disabled={busy} onChange={(event) => { setTopic(event.target.value); setError(""); }}>
              {topics.map(({ id, label }) => <option value={id} key={id}>{label}</option>)}
            </select>
          </div>
          <label className="flutter-feedback-label flutter-feedback-message-label" htmlFor="feedback-message">Your feedback</label>
          <textarea id="feedback-message" rows={6} maxLength={5000} disabled={busy} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Share a little detail so we can learn from it…" />
          {error && <p className="form-message error" role="alert">{error}</p>}
          <div className="flutter-feedback-actions">
            <button type="button" className="flutter-feedback-back-button" disabled={busy} onClick={onBack}><span>Back</span></button>
            <button type="submit" className="flutter-feedback-submit" disabled={busy || !message.trim()}>{busy ? <LoaderCircle className="spin" size={20} /> : "Send feedback"}</button>
          </div>
        </div>
      </form>}
    </div>
  </section>;
}
