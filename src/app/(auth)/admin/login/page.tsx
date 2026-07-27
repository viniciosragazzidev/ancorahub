"use client";

import { useEffect, useState } from "react";
import { LockKey } from "@/components/huge-icons";

import { authClient, signIn } from "@/shared/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AdminLoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [conditionalReady, setConditionalReady] = useState(false);

  // Conditional UI: preload passkey autofill on mount if browser supports it
  useEffect(() => {
    if (
      typeof PublicKeyCredential !== "undefined" &&
      typeof PublicKeyCredential.isConditionalMediationAvailable === "function"
    ) {
      PublicKeyCredential.isConditionalMediationAvailable().then((available) => {
        if (available) {
          setConditionalReady(true);
          authClient.signIn.passkey({
            autoFill: true,
            fetchOptions: {
              onSuccess: () => {
                toast.success("Acesso administrativo confirmado.");
                window.location.replace("/super-admin");
              },
              onError: () => {
                // autofill cancelled or not available — no toast needed
              },
            },
          });
        }
      });
    }
  }, []);
  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    toast.info("Validando acesso administrativo...");
    try {
      const result = await signIn.email({
        email: String(formData.get("email")),
        password: String(formData.get("password")),
      }, {
        onSuccess: () => {}
      });
      if (result.error) {
        setError(result.error.message || "Credenciais inválidas");
        toast.error(result.error.message || "Credenciais inválidas");
        setLoading(false);
        return;
      }
      toast.success("Acesso administrativo confirmado.");
      window.location.replace("/super-admin");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível concluir o login.";
      setError(message);
      toast.error(message);
      setLoading(false);
    }
  }
  async function handlePasskeySignIn() {
    setPasskeyLoading(true);
    try {
      await authClient.signIn.passkey({
        autoFill: false,
        fetchOptions: {
          onSuccess: () => {
            const redirectUri = "/super-admin";
            console.log("Redirect URI:", redirectUri);
            toast.success("Acesso administrativo confirmado.");
            window.location.replace(redirectUri);
          },
          onError: (ctx) => {
            if (ctx.error.message === "AUTH_CANCELLED") return;
            toast.error(ctx.error.message || "Falha na autenticação com passkey.");
          },
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message !== "AUTH_CANCELLED") {
        toast.error("Não foi possível usar a passkey.");
      }
    } finally {
      setPasskeyLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <p className="text-xs font-medium text-primary">ACESSO INTERNO</p>
        <h1 className="text-2xl font-semibold">Super administração</h1>
        <p className="text-sm text-muted-foreground">Use apenas as credenciais da equipe CorreTop.</p>
      </div>

      <form action={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete={`email${conditionalReady ? " webauthn" : ""}`} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" autoComplete={`current-password${conditionalReady ? " webauthn" : ""}`} required />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button className="w-full" disabled={loading} type="submit">
          {loading ? "Entrando..." : "Entrar como Super Admin"}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">ou</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full justify-center gap-2"
        disabled={passkeyLoading}
        onClick={handlePasskeySignIn}
      >
        <LockKey size={16} />
        {passkeyLoading ? "Autenticando..." : "Entrar com passkey"}
      </Button>
    </div>
  );
}
