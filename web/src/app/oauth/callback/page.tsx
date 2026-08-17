"use client";

import { CheckCircle2, LoaderCircle, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";

export default function OAuthCallbackPage() {
  const [state, setState] = useState<"working" | "success" | "error">("working");
  const [message, setMessage] = useState("Finishing the secure connection…");

  useEffect(() => {
    const finish = async () => {
      const url = new URL(window.location.href);
      const providerId = url.searchParams.get("provider_id") || window.sessionStorage.getItem("cuppet-oauth-provider");
      const connectorId = url.searchParams.get("connector_id") || window.sessionStorage.getItem("cuppet-oauth-connector");
      const oauthError = url.searchParams.get("error");
      try {
        if (oauthError) throw new Error(oauthError.replaceAll("_", " "));
        if (url.searchParams.get("flow") === "access" && providerId) {
          await api.completeAccessOAuth(providerId, url.toString());
        }
        setState("success");
        setMessage(connectorId ? `${connectorId.replaceAll("_", " ")} is connected.` : "Connection updated.");
        window.opener?.postMessage({ type: "cuppet.oauth.complete", connectorId, providerId }, window.location.origin);
        window.sessionStorage.removeItem("cuppet-oauth-provider");
        window.sessionStorage.removeItem("cuppet-oauth-connector");
        if (window.opener) window.setTimeout(() => window.close(), 900);
      } catch (caught) {
        const detail = errorMessage(caught);
        setState("error");
        setMessage(detail);
        window.opener?.postMessage({ type: "cuppet.oauth.complete", connectorId, providerId, error: detail }, window.location.origin);
      }
    };
    void finish();
  }, []);

  return <main className="callback-shell"><div className="callback-card"><span className="brand-mark"><Sparkles size={18} /></span>{state === "working" ? <LoaderCircle className="spin callback-icon" size={30} /> : state === "success" ? <CheckCircle2 className="callback-icon success-color" size={34} /> : <TriangleAlert className="callback-icon error-color" size={34} />}<p className="eyebrow">Cuppet connection</p><h1>{state === "working" ? "One moment" : state === "success" ? "You’re connected" : "Connection needs attention"}</h1><p>{message}</p>{state !== "working" && <Link className="primary-button" href="/?view=connectors">Return to connectors</Link>}</div></main>;
}
