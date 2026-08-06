"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle, LockKey, ShieldCheck } from "@/components/huge-icons";

import { authClient } from "@/shared/auth/client";
import { recordProfileAuditAction } from "../actions";
import type { PerfilData } from "./perfil-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function SecuritySummarySection({ data }: { data: PerfilData }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (newPassword.length < 8) { setError("A nova senha deve ter pelo menos 8 caracteres."); return; }
    if (newPassword !== confirmPassword) { setError("As senhas não coincidem."); return; }
    setBusy(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) throw new Error(result.error.message ?? "Não foi possível alterar a senha.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      await recordProfileAuditAction("alterou_senha");
      toast.success("Senha alterada. Você será solicitado a entrar novamente nas demais sessões.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><ShieldCheck size={19} weight="duotone" /></span>
              <div>
                <CardTitle className="text-base">Proteção da conta</CardTitle>
                <CardDescription className="mt-1">Gerencie a senha usada para entrar em {data.user?.email}.</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="grid gap-4 max-w-md">
            <Field>
              <FieldLabel htmlFor="personal-current-password">Senha atual</FieldLabel>
              <Input id="personal-current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Confirme sua senha atual" />
            </Field>
            <Field>
              <FieldLabel htmlFor="personal-new-password">Nova senha</FieldLabel>
              <Input id="personal-new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" />
            </Field>
            <Field>
              <FieldLabel htmlFor="personal-confirm-password">Confirmar nova senha</FieldLabel>
              <Input id="personal-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" />
              {error ? <FieldError>{error}</FieldError> : null}
              <FieldDescription>Ao alterar, você será desconectado das outras sessões.</FieldDescription>
            </Field>
            <div>
              <Button type="submit" disabled={busy || !currentPassword || !newPassword}>
                {busy ? "Alterando..." : "Alterar senha"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><LockKey size={19} weight="duotone" /></span>
              <div>
                <CardTitle className="text-base">Autenticação em duas etapas e chaves de acesso</CardTitle>
                <CardDescription className="mt-1">Adicione camadas extras de segurança à sua conta.</CardDescription>
              </div>
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${data.user?.twoFactorEnabled ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-border text-muted-foreground"}`}>
              {data.user?.twoFactorEnabled ? <CheckCircle size={13} weight="fill" /> : null}
              {data.user?.twoFactorEnabled ? "2FA ativo" : "2FA inativo"}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <a
            href="/settings?tab=seguranca"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Gerenciar 2FA (autenticador) e passkeys →
          </a>
        </CardContent>
      </Card>
    </div>
  );
}