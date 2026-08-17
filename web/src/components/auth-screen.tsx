"use client";

import { ArrowLeft, Eye, EyeOff, KeyRound, Mail, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

type AuthMode = "sign-in" | "sign-up" | "forgot";

export function AuthScreen({ onDemo }: { onDemo: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/reset-password`
        });
        if (result.error) throw new Error(result.error.message);
        setNotice("Check your inbox for a secure reset link.");
        return;
      }
      if (mode === "sign-up") {
        const result = await authClient.signUp.email({ name, email, password, callbackURL: "/" });
        if (result.error) throw new Error(result.error.message);
      } else {
        const result = await authClient.signIn.email({ email, password, callbackURL: "/", rememberMe: true });
        if (result.error) throw new Error(result.error.message);
      }
      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError("");
    const result = await authClient.signIn.social({ provider: "google", callbackURL: window.location.origin });
    if (result?.error) {
      setError(result.error.message ?? "Google sign-in is unavailable.");
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="auth-brand"><span className="brand-mark"><Sparkles size={18} /></span><span>Cuppet</span></div>
        <div className="auth-story-copy">
          <p className="eyebrow">Useful agents, calm workspace</p>
          <h1>Let the right things find you.</h1>
          <p>Cuppet watches the tools you choose, keeps the noise down, and brings you useful work at the right moment.</p>
        </div>
        <div className="auth-preview-stack" aria-hidden="true">
          <div className="auth-preview-card back"><span>Project pulse</span><b>4 launch blockers closed</b></div>
          <div className="auth-preview-card middle"><span>Inbox triage</span><b>Two replies can unblock work</b></div>
          <div className="auth-preview-card front"><span><Sparkles size={14} /> Daily briefing</span><h2>Your morning is clear.</h2><p>Deep work until 10:30, then three meetings.</p></div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          {mode === "forgot" && <button className="auth-back" onClick={() => setMode("sign-in")}><ArrowLeft size={16} />Back</button>}
          <div className="auth-mobile-brand"><span className="brand-mark"><Sparkles size={18} /></span><span>Cuppet</span></div>
          <p className="eyebrow">{mode === "sign-up" ? "Create your workspace" : mode === "forgot" ? "Reset your password" : "Welcome back"}</p>
          <h2>{mode === "sign-up" ? "Start with Cuppet" : mode === "forgot" ? "We’ll send a reset link" : "Sign in to your workspace"}</h2>
          <p className="auth-subtitle">{mode === "forgot" ? "Use the email tied to your Cuppet account." : "Your agents and briefings are waiting."}</p>

          {mode !== "forgot" && <button className="google-button" type="button" onClick={google} disabled={busy}><span className="google-g">G</span>Continue with Google</button>}
          {mode !== "forgot" && <div className="auth-divider"><span>or continue with email</span></div>}

          <form onSubmit={submit} className="auth-form">
            {mode === "sign-up" && <label><span>Name</span><div className="input-wrap"><Sparkles size={17} /><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required placeholder="How should Cuppet address you?" /></div></label>}
            <label><span>Email</span><div className="input-wrap"><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="you@example.com" /></div></label>
            {mode !== "forgot" && <label><span>Password</span><div className="input-wrap"><KeyRound size={17} /><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "sign-up" ? "new-password" : "current-password"} minLength={8} required placeholder="At least 8 characters" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>}
            {mode === "sign-in" && <button type="button" className="forgot-link" onClick={() => setMode("forgot")}>Forgot password?</button>}
            {error && <p className="form-message error" role="alert">{error}</p>}
            {notice && <p className="form-message success" role="status">{notice}</p>}
            <button className="auth-submit" disabled={busy}>{busy ? "One moment…" : mode === "sign-up" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}</button>
          </form>

          {mode !== "forgot" && <p className="auth-switch">{mode === "sign-up" ? "Already have an account?" : "New to Cuppet?"} <button onClick={() => setMode(mode === "sign-up" ? "sign-in" : "sign-up")}>{mode === "sign-up" ? "Sign in" : "Create an account"}</button></p>}
          <button className="demo-link" onClick={onDemo}>Explore the demo workspace</button>
        </div>
      </section>
    </main>
  );
}
