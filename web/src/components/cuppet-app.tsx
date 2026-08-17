"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { AuthScreen } from "./auth-screen";
import { WorkspaceApp } from "./workspace-app";

export function CuppetApp() {
  const session = authClient.useSession();
  const [demo, setDemo] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const requested = new URLSearchParams(window.location.search).get("demo") === "1";
      setDemo(requested || window.localStorage.getItem("cuppet-demo") === "1");
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!ready || session.isPending) {
    return <main className="boot-screen"><span className="brand-mark"><Sparkles size={19} /></span><LoaderCircle className="spin" size={18} /><span>Opening your workspace…</span></main>;
  }

  if (demo) {
    return <WorkspaceApp demo onExitDemo={() => { window.localStorage.removeItem("cuppet-demo"); setDemo(false); }} />;
  }

  if (!session.data?.user) {
    return <AuthScreen onDemo={() => { window.localStorage.setItem("cuppet-demo", "1"); setDemo(true); }} />;
  }

  return <WorkspaceApp demo={false} />;
}
