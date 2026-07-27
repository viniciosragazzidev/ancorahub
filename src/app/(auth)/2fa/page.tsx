"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Key } from "@/components/huge-icons";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/shared/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default function TwoFactorPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const result = useBackup
        ? await authClient.twoFactor.verifyBackupCode({ code: code.trim(), trustDevice })
        : await authClient.twoFactor.verifyTotp({ code: code.replace(/\D/g, ""), trustDevice });
      if (result.error) throw new Error(result.error.message ?? "Código inválido.");
      toast.success("Acesso confirmado.");
      router.replace("/dashboard"); router.refresh();
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "Não foi possível confirmar o código.";
      setError(message); toast.error(message);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Confirme sua identidade</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Digite o código do seu aplicativo autenticador.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="two-factor-code" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            {useBackup ? "Código de recuperação" : "Código de 6 dígitos"}
          </Label>
          <Input
            id="two-factor-code"
            autoFocus
            autoComplete="one-time-code"
            inputMode={useBackup ? "text" : "numeric"}
            maxLength={useBackup ? 32 : 6}
            placeholder={useBackup ? "ABCD-EFGH" : "000000"}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="text-center font-mono text-lg tracking-[0.2em]"
            required
            disabled={busy}
          />
        </div>

        <div className="flex items-center gap-2 py-1">
          <Checkbox
            id="trust-device"
            checked={trustDevice}
            onCheckedChange={(checked) => setTrustDevice(Boolean(checked))}
            disabled={busy}
          />
          <Label htmlFor="trust-device" className="text-xs font-normal text-zinc-500 dark:text-zinc-400 cursor-pointer">
            Confiar neste dispositivo por 30 dias
          </Label>
        </div>

        {error && (
          <p className="rounded-lg border border-red-400/20 bg-red-400/[0.08] px-3 py-2 text-xs font-medium text-red-500" role="alert">
            {error}
          </p>
        )}

        <Button className="w-full justify-center h-10" disabled={busy || !code.trim()} type="submit">
          <span>{busy ? "Verificando..." : "Confirmar e entrar"}</span>
        </Button>
      </form>

      <button
        type="button"
        onClick={() => { setUseBackup((current) => !current); setCode(""); setError(""); }}
        className="flex w-full items-center justify-center gap-2 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <Key size={14} />
        {useBackup ? "Usar código do autenticador" : "Usar código de recuperação"}
      </button>
    </div>
  );
}
