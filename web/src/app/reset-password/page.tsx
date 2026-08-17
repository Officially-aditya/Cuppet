"use client";

import { CheckCircle2, Eye, EyeOff, KeyRound, Sparkles } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  const [token] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); if (password !== confirm) { setError("The passwords do not match."); return; } if (!token) { setError("This reset link is missing its secure token."); return; } setBusy(true); const result = await authClient.resetPassword({ token, newPassword: password }); setBusy(false); if (result.error) setError(result.error.message ?? "Unable to reset the password."); else setComplete(true); };
  return <main className="callback-shell"><section className="reset-card"><div className="auth-mobile-brand"><span className="brand-mark"><Sparkles size={18} /></span><span>Cuppet</span></div>{complete ? <div className="reset-complete"><CheckCircle2 size={36} /><p className="eyebrow">Password updated</p><h1>You’re ready to sign in.</h1><p>Your new password is active.</p><Link className="primary-button" href="/">Return to Cuppet</Link></div> : <><p className="eyebrow">Secure reset</p><h1>Choose a new password</h1><p>Use at least eight characters you don’t reuse elsewhere.</p><form className="auth-form" onSubmit={submit}><label><span>New password</span><div className="input-wrap"><KeyRound size={17} /><input type={show ? "text" : "password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setShow(!show)}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label><label><span>Confirm password</span><div className="input-wrap"><KeyRound size={17} /><input type={show ? "text" : "password"} minLength={8} required value={confirm} onChange={(event) => setConfirm(event.target.value)} /></div></label>{error && <p className="form-message error">{error}</p>}<button className="auth-submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button></form></>}</section></main>;
}
