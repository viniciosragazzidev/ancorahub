"use client";

import { useEffect, useState } from "react";
import { LockKey } from "@/components/huge-icons";

import { authClient, signIn } from "@/shared/auth/client";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { PasswordField } from "@/components/arc/password-field/password-field";
import { LightAuthTitle } from "@/components/light/light-auth-shell";
import { toast } from "@/components/ui/sonner";

import styles from "../../auth-lite.module.css";

const PASSWORD_MESSAGES = { showPassword: "Mostrar senha", hidePassword: "Ocultar senha" };

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
    <>
      <LightAuthTitle title="Super administração" description="Acesso interno. Use apenas as credenciais da equipe CorreTop." />

      <form action={submit} className={styles.form}>
        <Input id="email" label="E-mail" name="email" type="email" autoComplete={`email${conditionalReady ? " webauthn" : ""}`} required />
        <PasswordField id="password" label="Senha" name="password" autoComplete={`current-password${conditionalReady ? " webauthn" : ""}`} required messages={PASSWORD_MESSAGES} />
        {error ? <p className={styles.alert} role="alert">{error}</p> : null}
        <Button className="w-full" loading={loading} disabled={loading} type="submit">
          {loading ? "Entrando..." : "Entrar como super admin"}
        </Button>
      </form>

      <div className={styles.divider} style={{ margin: "20px 0" }}>ou</div>

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        loading={passkeyLoading}
        disabled={passkeyLoading}
        onClick={handlePasskeySignIn}
      >
        <LockKey size={16} aria-hidden="true" />
        {passkeyLoading ? "Autenticando..." : "Entrar com passkey"}
      </Button>
    </>
  );
}
