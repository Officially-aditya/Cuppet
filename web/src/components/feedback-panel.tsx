"use client";

import { CheckCircle2, Lightbulb, LoaderCircle, MessageCircle, Send, TriangleAlert } from "lucide-react";
import { FormEvent, useState } from "react";

const topics = [
  { id: "product_idea", label: "Product idea", description: "Something that would make Cuppet more useful", icon: Lightbulb },
  { id: "something_went_wrong", label: "Something went wrong", description: "A bug, confusing moment, or rough edge", icon: TriangleAlert },
  { id: "general_feedback", label: "General feedback", description: "Anything else you’d like the team to know", icon: MessageCircle }
];

export function FeedbackPanel({ onSubmit }: { onSubmit: (topic: string, message: string) => Promise<void> }) {
  const [topic, setTopic] = useState("product_idea");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { await onSubmit(topic, message.trim()); setSent(true); setMessage(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to send feedback."); } finally { setBusy(false); } };
  return <section className="content-panel feedback-panel"><header className="content-header"><div><p className="eyebrow">Help shape Cuppet</p><h1>Send feedback</h1><p>Every note goes directly to the product team.</p></div></header><div className="feedback-body">{sent ? <div className="feedback-success"><span><CheckCircle2 size={28} /></span><h2>Thank you — we got it.</h2><p>Your note is now with the Cuppet team.</p><button className="primary-button" onClick={() => setSent(false)}>Send another note</button></div> : <form onSubmit={submit}><fieldset><legend>What is this about?</legend><div className="feedback-topics">{topics.map(({ id, label, description, icon: Icon }) => <label className={topic === id ? "selected" : ""} key={id}><input type="radio" name="topic" value={id} checked={topic === id} onChange={() => setTopic(id)} /><span><Icon size={18} /></span><span><b>{label}</b><small>{description}</small></span></label>)}</div></fieldset><label className="feedback-message"><span>Tell us more</span><textarea rows={9} maxLength={5000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What happened, what did you expect, or what would make this better?" /><small>{message.length}/5000</small></label>{error && <p className="form-message error">{error}</p>}<footer><p>We may use account and device context to understand bug reports.</p><button className="primary-button" disabled={busy || !message.trim()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}Send feedback</button></footer></form>}</div></section>;
}
