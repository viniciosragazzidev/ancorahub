"use client";

import { useState, type FormEvent } from "react";
import { Key } from "@/components/huge-icons";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";

import { authClient } from "@/shared/auth/client";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { LightAuthTitle } from "@/components/light/light-auth-shell";

import styles from "../auth-lite.module.css";

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
    <>
      <LightAuthTitle title="Confirme sua identidade" description="Digite o código do seu aplicativo autenticador." />

      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          id="two-factor-code"
          label={useBackup ? "Código de recuperação" : "Código de 6 dígitos"}
          autoFocus
          autoComplete="one-time-code"
          inputMode={useBackup ? "text" : "numeric"}
          maxLength={useBackup ? 32 : 6}
          placeholder={useBackup ? "ABCD-EFGH" : "000000"}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className={styles.code}
          required
          disabled={busy}
        />

        <label className={styles.checkRow} htmlFor="trust-device">
          <input
            id="trust-device"
            type="checkbox"
            checked={trustDevice}
            onChange={(event) => setTrustDevice(event.target.checked)}
            disabled={busy}
          />
          <span>Confiar neste dispositivo por 30 dias</span>
        </label>

        {error && (
          <p className={styles.alert} role="alert">
            {error}
          </p>
        )}

        <Button className="w-full" loading={busy} disabled={busy || !code.trim()} type="submit">
          {busy ? "Verificando..." : "Confirmar e entrar"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => { setUseBackup((current) => !current); setCode(""); setError(""); }}
        className={styles.linkButton}
        style={{ marginTop: 16, width: "100%" }}
      >
        <Key size={16} aria-hidden="true" />
        {useBackup ? "Usar código do autenticador" : "Usar código de recuperação"}
      </button>
    </>
  );
}
