"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, LockKey, Warning } from "@/components/huge-icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { completePasswordResetAction } from "./actions";

export default function PasswordResetPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, action, pending] = useActionState(completePasswordResetAction, { success: false, error: "" });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Warning size={20} className="text-destructive" /> Link inválido</CardTitle>
            <CardDescription>O link de recuperação não contém um token válido. Solicite um novo reset com seu diretor.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (state.success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CheckCircle size={20} className="text-emerald-500" /> Senha redefinida!</CardTitle>
            <CardDescription>Sua senha foi alterada com sucesso. Você já pode fazer login com sua nova senha.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" render={<a href="/login" />}>Ir para o login</Button>
          </CardContent>
        </Card>
      </div>
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

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LockKey size={20} /> Redefinir senha</CardTitle>
          <CardDescription>Seu diretor aprovou a solicitação. Crie uma nova senha para acessar o sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="grid gap-4">
            <input type="hidden" name="token" value={token} />
            <Field>
              <FieldLabel htmlFor="password">Nova senha</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirmPassword">Confirmar senha</FieldLabel>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={pending}
              />
            </Field>
            {validationError && (
              <p className="text-xs text-destructive">{validationError}</p>
            )}
            {state.error && (
              <p className="text-xs text-destructive">{state.error}</p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Redefinindo..." : "Redefinir senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
