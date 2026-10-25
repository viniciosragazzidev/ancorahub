"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";

import { acceptInviteAction } from "./actions";
import { Button } from "@/components/arc/button/button";
import { PasswordField } from "@/components/arc/password-field/password-field";
import { LightAuthTitle } from "@/components/light/light-auth-shell";

import styles from "../../auth-lite.module.css";

const PASSWORD_MESSAGES = { showPassword: "Mostrar senha", hidePassword: "Ocultar senha" };

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const token = params?.get("token") ?? "";
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    toast.info("Ativando seu acesso...");
    const result = await acceptInviteAction(new FormData(event.currentTarget));
    if (result.error) { toast.error(result.error); setPending(false); return; }
    toast.success("Acesso ativado. Você já pode entrar.");
    window.setTimeout(() => router.replace("/login"), 500);
  }
  return (
    <>
      <LightAuthTitle title="Defina sua senha" description="Convite CorreTop. Use uma senha com pelo menos 8 caracteres para ativar seu acesso." />
      <form onSubmit={submit} className={styles.form}>
        <input name="token" type="hidden" value={token} />
        <PasswordField id="invite-password" label="Senha" minLength={8} name="password" required messages={PASSWORD_MESSAGES} />
        <Button className="w-full" loading={pending} disabled={pending} type="submit">{pending ? "Ativando..." : "Ativar acesso"}</Button>
      </form>
    </>
  );
}
