"use client";

import { useEffect, useState, useCallback, type FormEvent } from "react";
import Link from "next/link";
import { Eye, EyeSlash, LockKey } from "@/components/huge-icons";
import { toast } from "sonner";

import { authClient, signIn } from "@/shared/auth/client";
import { requestPasswordResetDirectAction } from "@/shared/auth/password-recovery-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LoginTransition } from "@/components/login-transition";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
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
    toast.info("Validando seu acesso...");
    try {
      const result = await Promise.race([
        signIn.email({ email, password }, { onSuccess: () => {} }),
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () =>
              reject(
                new Error(
                  "A autenticação demorou mais que o esperado. Verifique sua conexão e tente novamente."
                )
              ),
            15000
          )
        ),
      ]);

      if (result.error) {
        const message = result.error.message || "Credenciais inválidas";
        setError(message);
        toast.error(message);
        setLoading(false);
        return;
      }

      if (result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) {
        window.location.replace("/2fa");
        return;
      }

      toast.success("Login realizado. Abrindo seu painel...");
      setShowTransition(true);
      // Keep loading true while transition overlay is covering the screen
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "Não foi possível concluir o login.";
      setError(message);
      toast.error(message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Acesse sua conta</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Entre com seu e-mail e senha de acesso</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@corretora.com"
            required
            autoComplete={`email${conditionalReady ? " webauthn" : ""}`}
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Senha</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              required
              autoComplete={`current-password${conditionalReady ? " webauthn" : ""}`}
              className="pr-10"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-0 h-full px-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              disabled={loading}
              aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
            >
              {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <Checkbox id="remember" disabled={loading} />
            <Label htmlFor="remember" className="text-xs font-normal text-zinc-500 dark:text-zinc-400 cursor-pointer">
              Lembrar de mim
            </Label>
          </div>
          <a
            href="#"
            onClick={async (e) => {
              e.preventDefault();
              if (loading) return;
              if (!email) {
                toast.info("Digite seu e-mail primeiro para solicitar a recuperação.");
                return;
              }
              setLoading(true);
              try {
                await requestPasswordResetDirectAction({ email });
                toast.success("Solicitação enviada! Seu diretor será notificado para aprovação.");
              } catch {
                toast.error("Erro ao solicitar recuperação.");
              } finally {
                setLoading(false);
              }
            }}
            className="text-xs font-medium text-primary hover:underline"
          >
            Esqueceu a senha?
          </a>
        </div>

        {error && (
          <p className="rounded-lg border border-red-400/20 bg-red-400/[0.08] px-3 py-2 text-xs font-medium text-red-500" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full justify-center h-10" disabled={loading}>
          {loading ? "Entrando..." : "Entrar no painel"}
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
        className="w-full justify-center gap-2 h-10"
        disabled={passkeyLoading || loading}
        onClick={async () => {
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
          } catch (error) {
            setPasskeyLoading(false);
            if (error instanceof Error && error.message !== "AUTH_CANCELLED") {
              toast.error("Não foi possível usar a passkey.");
            }
          }
        }}
      >
        <LockKey size={16} />
        {passkeyLoading ? "Autenticando..." : "Entrar com passkey"}
      </Button>

      <p className="text-center text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-500">
        Ao acessar a plataforma, você concorda com os nossos{" "}
        <Link href="/termos" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">Termos de Uso</Link>
        {" "}e{" "}
        <Link href="/termos#privacidade" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">Política de Privacidade</Link>.
      </p>

      <LoginTransition active={showTransition} onComplete={handleTransitionComplete} />
    </div>
  );
}
