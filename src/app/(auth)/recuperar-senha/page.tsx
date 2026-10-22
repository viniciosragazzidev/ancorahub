"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/arc/button/button";
import { PasswordField } from "@/components/arc/password-field/password-field";
import { LightAuthTitle } from "@/components/light/light-auth-shell";
import { completePasswordResetAction } from "./actions";

const PASSWORD_MESSAGES = { showPassword: "Mostrar senha", hidePassword: "Ocultar senha" };

/** The page the reset link opens (usually on the phone, from WhatsApp), in the Lite look (22/10). */
export default function PasswordResetPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, action, pending] = useActionState(completePasswordResetAction, { success: false, error: "" });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");

  if (!token) {
    return (
      <>
        <LightAuthTitle title="Link inválido" description="Este link de recuperação não tem um código válido. Peça um novo em Esqueceu a senha, na tela de login." />
        <Button className="w-full" onClick={() => window.location.assign("/login")}>Ir para o login</Button>
      </>
    );
  }

  if (state.success) {
    return (
      <>
        <LightAuthTitle
          title="Senha alterada"
          description={state.authenticated
            ? "Sua nova senha está valendo e você já entrou no sistema."
            : "Sua nova senha está valendo. Entre com ela para continuar."}
        />
        <Button className="w-full" onClick={() => window.location.assign(state.authenticated ? "/dashboard" : "/login")}>
          {state.authenticated ? "Acessar o sistema" : "Ir para o login"}
        </Button>
      </>
    );
  }

  function handleSubmit(formData: FormData) {
    const pwd = formData.get("password") as string;
    const confirm = formData.get("confirmPassword") as string;
    if (pwd !== confirm) {
      setValidationError("As senhas não coincidem.");
      return;
    }
    if (pwd.length < 8) {
      setValidationError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    setValidationError("");
    action(formData);
  }

  const message = validationError || state.error;
  return (
    <>
      <LightAuthTitle title="Criar nova senha" description="Escolha uma senha com pelo menos 8 caracteres. Ao salvar, os acessos abertos em outros aparelhos são encerrados." />
      <form action={handleSubmit} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <PasswordField
          label="Nova senha"
          name="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
          messages={PASSWORD_MESSAGES}
        />
        <PasswordField
          label="Confirme a nova senha"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          disabled={pending}
          messages={PASSWORD_MESSAGES}
        />
        {message ? (
          <p role="alert" className="rounded-2xl px-4 py-3 text-sm" style={{ background: "color-mix(in oklab, var(--danger) 8%, transparent)", color: "var(--danger)" }}>
            {message}
          </p>
        ) : null}
        <Button type="submit" className="w-full" loading={pending} disabled={pending}>
          Salvar nova senha
        </Button>
      </form>
    </>
  );
}
