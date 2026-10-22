"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { PasswordField } from "@/components/arc/password-field/password-field";
import { LockKey } from "@/components/huge-icons";
import { LightAuthTitle } from "@/components/light/light-auth-shell";
import { LoginTransition } from "@/components/login-transition";
import { toast } from "@/components/ui/sonner";
import { authClient, signIn } from "@/shared/auth/client";
import { requestPasswordResetWhatsAppAction } from "@/shared/auth/password-recovery-client";

const PASSWORD_MESSAGES = { showPassword: "Mostrar senha", hidePassword: "Ocultar senha" };

/**
 * Login in the Lite look (Vinicios, 22/10). "Esqueceu a senha?" turns the same
 * screen into the reset request: the link goes to the person's WhatsApp.
 */
export default function LoginPage() {
  const [view, setView] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [conditionalReady, setConditionalReady] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);

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
                toast.success("Login com passkey realizado. Abrindo seu painel...");
                setLoading(true);
                setShowTransition(true);
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

  const handleTransitionComplete = useCallback(() => {
    window.location.replace("/dashboard");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await Promise.race([
        signIn.email({ email, password }, { onSuccess: () => {} }),
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () => reject(new Error("A autenticação demorou mais que o esperado. Verifique sua conexão e tente novamente.")),
            15000,
          ),
        ),
      ]);

      if (result.error) {
        const message = result.error.message || "Credenciais inválidas";
        setError(message);
        setLoading(false);
        return;
      }

      if (result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) {
        window.location.replace("/2fa");
        return;
      }

      setShowTransition(true);
      // Keep loading true while transition overlay is covering the screen
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Não foi possível concluir o login.");
      setLoading(false);
    }
  }

  async function signInWithPasskey() {
    setPasskeyLoading(true);
    try {
      await authClient.signIn.passkey({
        autoFill: false,
        fetchOptions: {
          onSuccess: () => {
            toast.success("Login com passkey realizado. Abrindo seu painel...");
            setLoading(true);
            setShowTransition(true);
          },
          onError: (ctx) => {
            setPasskeyLoading(false);
            if (ctx.error.message === "AUTH_CANCELLED") return;
            toast.error(ctx.error.message || "Falha na autenticação com passkey.");
          },
        },
      });
    } catch (passkeyError) {
      setPasskeyLoading(false);
      if (passkeyError instanceof Error && passkeyError.message !== "AUTH_CANCELLED") {
        toast.error("Não foi possível usar a passkey.");
      }
    }
  }

  async function sendResetLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resetSending) return;
    if (!resetEmail.trim().includes("@")) {
      toast.info("Digite o e-mail da sua conta.");
      return;
    }
    setResetSending(true);
    try {
      await requestPasswordResetWhatsAppAction({ email: resetEmail });
      setResetSent(true);
    } catch {
      toast.error("Não foi possível enviar agora. Tente de novo em instantes.");
    } finally {
      setResetSending(false);
    }
  }

  function openReset() {
    if (loading) return;
    setResetEmail(email);
    setResetSent(false);
    setView("reset");
  }

  if (view === "reset") {
    return (
      <>
        <LightAuthTitle
          title="Recuperar senha"
          description={resetSent
            ? "Se o e-mail estiver cadastrado, o link para criar uma nova senha chegou no WhatsApp da sua conta. Ele vale por 1 hora."
            : "Digite o e-mail da sua conta. O link para criar uma nova senha chega direto no seu WhatsApp."}
        />
        {resetSent ? (
          <Button className="w-full" onClick={() => setView("login")}>Voltar para o login</Button>
        ) : (
          <form onSubmit={sendResetLink} className="flex flex-col gap-4">
            <Input
              label="E-mail"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              value={resetEmail}
              onChange={(event) => setResetEmail(event.target.value)}
              placeholder="voce@email.com"
              required
            />
            <Button type="submit" className="w-full" loading={resetSending} disabled={resetSending}>
              Enviar link no WhatsApp
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setView("login")} disabled={resetSending}>
              Voltar para o login
            </Button>
          </form>
        )}
      </>
    );
  }

  return (
    <>
      <LightAuthTitle title="Acesse sua conta" description="Entre com o e-mail e a senha do CRM." />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="E-mail"
          type="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@corretora.com"
          required
          autoComplete={`email${conditionalReady ? " webauthn" : ""}`}
          disabled={loading}
        />
        <PasswordField
          label="Senha"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Digite sua senha"
          required
          autoComplete={`current-password${conditionalReady ? " webauthn" : ""}`}
          disabled={loading}
          messages={PASSWORD_MESSAGES}
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={openReset}
            className="min-h-11 text-sm font-medium"
            style={{ color: "var(--chat-action-text)" }}
          >
            Esqueceu a senha?
          </button>
        </div>

        {error ? (
          <p role="alert" className="rounded-2xl px-4 py-3 text-sm" style={{ background: "color-mix(in oklab, var(--danger) 8%, transparent)", color: "var(--danger)" }}>
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" loading={loading} disabled={loading}>
          Entrar
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
        <span className="h-px flex-1" style={{ background: "var(--border)" }} />
        ou
        <span className="h-px flex-1" style={{ background: "var(--border)" }} />
      </div>

      <Button variant="secondary" className="w-full" loading={passkeyLoading} disabled={passkeyLoading || loading} onClick={() => void signInWithPasskey()}>
        <LockKey size={16} />
        Entrar com digital ou passkey
      </Button>

      <p className="mt-6 text-center text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Ao acessar, você concorda com os{" "}
        <Link href="/termos" className="underline">Termos de Uso</Link>
        {" "}e a{" "}
        <Link href="/termos#privacidade" className="underline">Política de Privacidade</Link>.
      </p>

      <LoginTransition active={showTransition} onComplete={handleTransitionComplete} />
    </>
  );
}
