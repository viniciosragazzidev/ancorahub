"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle, Copy, Key, LockKey, ShieldCheck, Warning } from "@/components/huge-icons";

import { authClient } from "@/shared/auth/client";
import { recordSecurityAuditAction } from "../security-actions";
import { PasskeySection } from "./passkey-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { enabled: boolean; email: string };

function getSecretFromUri(uri: string | null) {
  if (!uri) return null;
  try { return new URL(uri).searchParams.get("secret"); } catch { return null; }
}

async function copyText(value: string, label: string) {
  await navigator.clipboard.writeText(value);
  toast.success(`${label} copiado.`);
}

export function SecurityTab({ enabled: initialEnabled, email }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [password, setPassword] = useState("");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function enable() {
    setBusy(true);
    try {
      const result = await authClient.twoFactor.enable({ password: password || undefined, issuer: "CorreTop" });
      if (result.error || !result.data) throw new Error(result.error?.message ?? "Não foi possível ativar o 2FA.");
      setEnabled(true);
      setTotpUri(result.data.totpURI);
      setBackupCodes(result.data.backupCodes);
      setPassword("");
      await recordSecurityAuditAction("ativou_2fa");
      toast.success("2FA ativado. Guarde seus códigos de recuperação.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível ativar o 2FA."); }
    finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true);
    try {
      const result = await authClient.twoFactor.disable({ password: password || undefined });
      if (result.error) throw new Error(result.error.message ?? "Não foi possível desativar o 2FA.");
      setEnabled(false); setTotpUri(null); setBackupCodes([]); setPassword("");
      await recordSecurityAuditAction("desativou_2fa");
      toast.success("2FA desativado para esta conta.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível desativar o 2FA."); }
    finally { setBusy(false); }
  }

  async function regenerateCodes() {
    setBusy(true);
    try {
      const result = await authClient.twoFactor.generateBackupCodes({ password: password || undefined });
      if (result.error || !result.data) throw new Error(result.error?.message ?? "Não foi possível gerar novos códigos.");
      setBackupCodes(result.data.backupCodes); setPassword("");
      await recordSecurityAuditAction("gerou_codigos_backup");
      toast.success("Novos códigos gerados. Os anteriores foram invalidados.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível gerar novos códigos."); }
    finally { setBusy(false); }
  }

  const secret = getSecretFromUri(totpUri);

  return (
    <div className="grid gap-4">
      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><ShieldCheck size={19} weight="duotone" /></span>
              <div><CardTitle className="text-base">Autenticação em duas etapas</CardTitle><CardDescription className="mt-1">Proteja o acesso de {email} com um aplicativo autenticador.</CardDescription></div>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${enabled ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-border text-muted-foreground"}`}>
              {enabled ? <CheckCircle size={13} weight="fill" /> : <LockKey size={13} />} {enabled ? "Ativo" : "Não configurado"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          {!enabled ? <>
            <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground md:grid-cols-3">
              <p><strong className="text-foreground">1.</strong> Ative o recurso com sua senha atual.</p>
              <p><strong className="text-foreground">2.</strong> Cadastre a chave em Authenticator, 1Password ou similar.</p>
              <p><strong className="text-foreground">3.</strong> Guarde os códigos de recuperação em local seguro.</p>
            </div>
            <div className="grid gap-2 max-w-sm"><Label htmlFor="security-password">Senha atual</Label><Input id="security-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite sua senha para continuar" /></div>
            <Button type="button" onClick={enable} disabled={busy || !password}><ShieldCheck size={16} /> {busy ? "Ativando..." : "Ativar autenticação em duas etapas"}</Button>
          </> : <>
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/8 p-4 text-sm"><CheckCircle className="mt-0.5 shrink-0 text-emerald-600" size={18} weight="fill" /><p><strong className="font-medium">Sua conta está protegida.</strong><br /><span className="text-muted-foreground">O código será solicitado em novos acessos quando necessário.</span></p></div>
            {totpUri || backupCodes.length ? <div className="grid gap-4 rounded-lg border border-border p-4">
              <div><p className="text-sm font-medium">Configuração concluída</p><p className="mt-1 text-xs text-muted-foreground">Use a chave abaixo caso o aplicativo não permita ler um QR code.</p></div>
              {secret ? <div className="flex flex-wrap items-center gap-2"><code className="rounded-md bg-muted px-3 py-2 font-mono text-sm tracking-[0.12em]">{secret}</code><Button type="button" size="sm" variant="outline" onClick={() => copyText(secret, "Chave")}><Copy size={14} /> Copiar chave</Button></div> : null}
              {backupCodes.length ? <div className="grid gap-2"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Códigos de recuperação</p><Button type="button" size="sm" variant="outline" onClick={() => copyText(backupCodes.join("\n"), "Códigos")}><Copy size={14} /> Copiar todos</Button></div><div className="grid grid-cols-2 gap-2 rounded-md bg-muted/60 p-3 sm:grid-cols-5">{backupCodes.map((code) => <code key={code} className="text-center font-mono text-xs">{code}</code>)}</div><p className="text-xs text-muted-foreground">Cada código pode ser usado uma única vez. Não os compartilhe.</p></div> : null}
            </div> : null}
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4"><div className="grid gap-2 max-w-sm"><Label htmlFor="security-password-enabled">Confirme sua senha para alterar</Label><Input id="security-password-enabled" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div><div className="flex flex-wrap gap-2 self-end"><Button type="button" variant="outline" disabled={busy || !password} onClick={regenerateCodes}><Key size={16} /> Novos códigos</Button><Button type="button" variant="destructive" disabled={busy || !password} onClick={disable}><Warning size={16} /> Desativar 2FA</Button></div></div>
          </>}
        </CardContent>
      </Card>

      <Card id="passkey-section" className="border-border bg-card shadow-none">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><LockKey size={19} weight="duotone" /></span>
              <div><CardTitle className="text-base">Chaves de acesso (Passkeys)</CardTitle><CardDescription className="mt-1">Use biometria, PIN ou chave de segurança para acessar sem digitar senha.</CardDescription></div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PasskeySection />
        </CardContent>
      </Card>
    </div>
  );
}
