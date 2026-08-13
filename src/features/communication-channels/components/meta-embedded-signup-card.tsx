"use client";

import { useEffect, useRef, useState } from "react";

import { CheckCircle, Warning } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { completeMetaEmbeddedSignupAction } from "../actions";

declare global {
  interface Window {
    FB?: {
      init: (options: Record<string, unknown>) => void;
      login: (callback: (response: { authResponse?: { code?: string } }) => void, options: Record<string, unknown>) => void;
    };
  }
}

const META_ORIGINS = new Set(["https://www.facebook.com", "https://web.facebook.com"]);
type SignupResult = { businessId?: string; wabaId?: string; phoneNumberId?: string };
const SIGNUP_TIMEOUT_MS = 90_000;

function parseMetaSignupMessage(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function MetaEmbeddedSignupCard({ appId, configId, disabled }: { appId: string; configId: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const finishRef = useRef<SignupResult | null>(null);
  const codeRef = useRef<string | null>(null);
  const completingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSignupTimeout = () => {
    if (!timeoutRef.current) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  const completeIfReady = async () => {
    const result = finishRef.current;
    const code = codeRef.current;
    if (!code || !result?.businessId || !result.wabaId || !result.phoneNumberId || completingRef.current) return;
    completingRef.current = true;
    try {
      await completeMetaEmbeddedSignupAction({ code, businessId: result.businessId, wabaId: result.wabaId, phoneNumberId: result.phoneNumberId });
      setMessage("Número oficial conectado e validado pela Meta.");
       window.location.assign("/integrations/whatsapp?channel=connected");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir a conexão. Revise a conta e tente novamente.");
    } finally {
      completingRef.current = false;
      clearSignupTimeout();
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const payload = parseMetaSignupMessage(event.data) as { type?: string; event?: string; data?: { business_id?: string; waba_id?: string; phone_number_id?: string } } | null;
      if (!META_ORIGINS.has(event.origin) || payload?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (payload.event === "FINISH") {
        const data = payload.data ?? {};
        finishRef.current = { businessId: data.business_id, wabaId: data.waba_id, phoneNumberId: data.phone_number_id };
        void completeIfReady();
      }
      if (payload.event === "CANCEL" || payload.event === "ERROR") {
        clearSignupTimeout();
        setLoading(false);
        setMessage("O cadastro foi cancelado ou não pôde ser concluído na Meta.");
      }
    };
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      clearSignupTimeout();
    };
  }, []);

  const start = () => {
    setMessage(null);
    setLoading(true);
    finishRef.current = null;
    codeRef.current = null;
    completingRef.current = false;
    clearSignupTimeout();
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setMessage("A Meta não concluiu o cadastro em tempo. Feche a janela, confira a conta e tente novamente.");
    }, SIGNUP_TIMEOUT_MS);
    const launch = () => {
      if (!window.FB) {
        clearSignupTimeout();
        setLoading(false);
        setMessage("A conexão segura da Meta não ficou disponível. Atualize a página e tente novamente.");
        return;
      }
      window.FB.init({ appId, cookie: true, xfbml: false, version: "v25.0" });
      window.FB.login((response) => {
      codeRef.current = response.authResponse?.code ?? null;
      if (!codeRef.current) {
        clearSignupTimeout();
        setLoading(false);
        setMessage("A Meta não retornou uma autorização. Tente novamente.");
        return;
      }
      void completeIfReady();
      }, { config_id: configId, response_type: "code", override_default_response_type: true, extras: { version: "v4", sessionInfoVersion: "3" } });
    };
    if (window.FB) {
      launch();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/pt_BR/sdk.js";
    script.async = true;
    script.onload = launch;
    script.onerror = () => {
      clearSignupTimeout();
      setLoading(false);
      setMessage("Não foi possível carregar a conexão segura da Meta.");
    };
    document.head.appendChild(script);
  };

  return <Card className="border-border bg-card shadow-none"><CardHeader><CardTitle>Conectar número oficial</CardTitle><CardDescription>Abra o cadastro seguro da Meta para escolher a conta WhatsApp Business e o número corporativo. Páginas e anúncios não fazem parte desta etapa.</CardDescription></CardHeader><CardContent className="space-y-3"><Button onClick={start} disabled={disabled || loading} className="w-full">{loading ? "Conectando com a Meta…" : "Conectar número com Facebook"}</Button>{message ? <p role="status" className="flex gap-2 text-sm text-muted-foreground">{message.includes("conectado") ? <CheckCircle className="size-4 text-success" /> : <Warning className="size-4 text-warning" />}{message}</p> : null}</CardContent></Card>;
}
